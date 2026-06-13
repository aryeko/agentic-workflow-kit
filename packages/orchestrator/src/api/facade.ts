import path from 'node:path';

import { resolveInvocationCwd } from '../cli/args.js';
import { discoverTracks, runWorkflowHandler } from '../commands/handlers.js';
import { loadResolvedConfig } from '../config/configLoader.js';
import type { CliOverrides, ResolvedWorkflowConfig, RunState, WorkflowRunPreviewTarget } from '../types.js';

export type WorkflowApiOperation = 'workflow_project_inspect' | 'workflow_run_preview';
export type WorkflowApiErrorCode =
  | 'CONFIG_INVALID'
  | 'TRACKER_INVALID'
  | 'STORY_NOT_ELIGIBLE'
  | 'RUN_NOT_FOUND'
  | 'INTERNAL_ERROR';

export interface WorkflowArtifactRef {
  kind: string;
  path: string;
  description?: string;
}

export interface WorkflowApiWarning {
  code: string;
  message: string;
}

export interface WorkflowNextAction {
  label: string;
  mcpTool?: string;
  cli?: string;
}

export interface WorkflowProjectRef {
  repoRoot: string;
  configPath: string;
}

export interface WorkflowApiError {
  code: WorkflowApiErrorCode;
  message: string;
  severity: 'error';
  retryable: boolean;
  details: unknown[];
  artifactRefs: WorkflowArtifactRef[];
}

export type WorkflowApiEnvelope<T> = WorkflowApiSuccess<T> | WorkflowApiFailure;

export interface WorkflowApiSuccess<T> {
  ok: true;
  operation: WorkflowApiOperation;
  apiVersion: '1';
  requestId?: string;
  project: WorkflowProjectRef;
  result: T;
  artifacts: WorkflowArtifactRef[];
  warnings: WorkflowApiWarning[];
  next: WorkflowNextAction[];
  response: {
    include: 'summary';
    bounded: true;
  };
}

export interface WorkflowApiFailure {
  ok: false;
  operation: WorkflowApiOperation;
  apiVersion: '1';
  requestId?: string;
  project?: WorkflowProjectRef;
  error: WorkflowApiError;
  artifacts: WorkflowArtifactRef[];
  warnings: WorkflowApiWarning[];
  next: WorkflowNextAction[];
}

export interface WorkflowProjectInspectResult {
  project: {
    repoRoot: string;
    configPath: string;
    tracksDir: string;
    artifactsRoot: string;
    tracks: Array<{
      id: string;
      title: string;
      relativePath: string;
      storyCount: number;
      eligibleCount: number;
    }>;
  };
  capabilities: WorkflowApiCapabilities;
}

export interface WorkflowApiCapabilities {
  authoring: boolean;
  trackerMigration: boolean;
  runStory: boolean;
  runTrack: boolean;
  streaming: boolean;
  abort: boolean;
  tokenTelemetryLive: boolean;
  structuredOutputEnforced: boolean;
  github: boolean;
}

export interface WorkflowRunPreviewInput extends CliOverrides {
  target: WorkflowRunPreviewTarget;
}

export interface WorkflowRunPreviewResult {
  run: {
    id: string;
    status: RunState['status'];
    target: WorkflowRunPreviewTarget;
  };
  dryRunDispatch: string[];
  state: RunState;
}

export async function projectInspectFacade(
  input: CliOverrides = {},
): Promise<WorkflowApiEnvelope<WorkflowProjectInspectResult>> {
  const operation = 'workflow_project_inspect';
  try {
    const config = await loadResolvedConfig(input, resolveInvocationCwd(input));
    const tracks = await discoverTracks(config, input);
    return successEnvelope(operation, config, input.requestId, {
      result: {
        project: {
          repoRoot: config.workspace.rootAbs,
          configPath: relativeToRepo(config, config.configPath),
          tracksDir: config.paths.tracksDir,
          artifactsRoot: config.artifacts.rootDir,
          tracks: tracks.map((track) => ({
            id: track.id,
            title: track.title,
            relativePath: track.relativePath,
            storyCount: track.stories.length,
            eligibleCount: track.stories.filter((story) => story.eligible).length,
          })),
        },
        capabilities: capabilitiesFromConfig(config),
      },
      artifacts: [{ kind: 'config', path: relativeToRepo(config, config.configPath), description: 'Workflow config' }],
      next: [
        { label: 'Preview eligible run', mcpTool: 'workflow_run_preview', cli: 'agentic-workflow-kit run preview' },
      ],
    });
  } catch (error) {
    return failureEnvelope(operation, input, error);
  }
}

export async function runPreviewFacade(
  input: WorkflowRunPreviewInput,
): Promise<WorkflowApiEnvelope<WorkflowRunPreviewResult>> {
  const operation = 'workflow_run_preview';
  try {
    const config = await loadResolvedConfig(input, resolveInvocationCwd(input));
    const runState = await runWorkflowHandler(toDryRunCommand(input), { logger: nullLogger, stdout: noopStdout });
    return successEnvelope(operation, config, input.requestId, {
      result: {
        run: {
          id: runState.runId,
          status: runState.status,
          target: input.target,
        },
        dryRunDispatch: runState.dryRunDispatch ?? [],
        state: runState,
      },
      artifacts: [{ kind: 'runRoot', path: runState.artifactDir, description: 'Run artifact root' }],
      next: [
        {
          label: 'Start run',
          mcpTool: 'workflow_run_start',
          cli:
            input.target.type === 'story'
              ? `agentic-workflow-kit run-story ${input.target.storyId}`
              : 'agentic-workflow-kit run-eligible',
        },
      ],
    });
  } catch (error) {
    return failureEnvelope(operation, input, error);
  }
}

function toDryRunCommand(input: WorkflowRunPreviewInput): Parameters<typeof runWorkflowHandler>[0] {
  const overrides = {
    ...input,
    dryRun: true,
    ...(input.target.trackId !== undefined ? { track: input.target.trackId } : {}),
  };
  return input.target.type === 'story'
    ? { kind: 'run-story', storyId: input.target.storyId, overrides }
    : { kind: 'run-eligible', overrides };
}

function successEnvelope<T>(
  operation: WorkflowApiOperation,
  config: ResolvedWorkflowConfig,
  requestId: string | undefined,
  content: { result: T; artifacts?: WorkflowArtifactRef[]; next?: WorkflowNextAction[] },
): WorkflowApiSuccess<T> {
  return {
    ok: true,
    operation,
    apiVersion: '1',
    ...(requestId !== undefined ? { requestId } : {}),
    project: projectRef(config),
    result: content.result,
    artifacts: content.artifacts ?? [],
    warnings: [],
    next: content.next ?? [],
    response: {
      include: 'summary',
      bounded: true,
    },
  };
}

function failureEnvelope(
  operation: WorkflowApiOperation,
  input: Pick<CliOverrides, 'cwd' | 'configPath' | 'requestId'>,
  error: unknown,
): WorkflowApiFailure {
  const message = error instanceof Error ? error.message : String(error);
  return {
    ok: false,
    operation,
    apiVersion: '1',
    ...(input.requestId !== undefined ? { requestId: input.requestId } : {}),
    project: input.cwd
      ? {
          repoRoot: path.resolve(input.cwd),
          configPath: input.configPath ?? '.workflow/config.yaml',
        }
      : undefined,
    error: {
      code: errorCodeForMessage(message),
      message,
      severity: 'error',
      retryable: false,
      details: [],
      artifactRefs: [],
    },
    artifacts: [],
    warnings: [],
    next: [
      { label: 'Inspect project', mcpTool: 'workflow_project_inspect', cli: 'agentic-workflow-kit project inspect' },
    ],
  };
}

function projectRef(config: ResolvedWorkflowConfig): WorkflowProjectRef {
  return {
    repoRoot: config.workspace.rootAbs,
    configPath: relativeToRepo(config, config.configPath),
  };
}

function relativeToRepo(config: ResolvedWorkflowConfig, filePath: string): string {
  return path.isAbsolute(filePath) ? path.relative(config.workspace.rootAbs, filePath) || '.' : filePath;
}

function capabilitiesFromConfig(config: ResolvedWorkflowConfig): WorkflowApiCapabilities {
  return {
    authoring: true,
    trackerMigration: false,
    runStory: true,
    runTrack: true,
    streaming: false,
    abort: false,
    tokenTelemetryLive: false,
    structuredOutputEnforced: false,
    github: config.pr.create,
  };
}

function errorCodeForMessage(message: string): WorkflowApiErrorCode {
  if (message.includes('config') || message.includes('.workflow/config.yaml')) return 'CONFIG_INVALID';
  if (message.includes('not eligible')) return 'STORY_NOT_ELIGIBLE';
  if (message.includes('run') && message.includes('not found')) return 'RUN_NOT_FOUND';
  if (message.includes('track') || message.includes('stories')) return 'TRACKER_INVALID';
  return 'INTERNAL_ERROR';
}

const noopStdout = (): void => undefined;

const nullLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};
