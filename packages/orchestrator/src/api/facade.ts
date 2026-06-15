import path from 'node:path';

import { resolveInvocationCwd } from '../cli/args.js';
import {
  discoverTracks,
  listEligibleHandler,
  listStoriesHandler,
  runExportHandler,
  runInspectHandler,
  runReportHandler,
  runStatusHandler,
  runStreamHandler,
  type TrackerMigrateInput,
  trackerMigrateHandler,
  trackerValidateHandler,
  type WorkflowRunExportInput,
  type WorkflowRunExportResult,
  type WorkflowRunInspectInput,
  type WorkflowRunInspectResult,
  type WorkflowRunReportInput,
  type WorkflowRunReportResult,
  type WorkflowRunStatusInput,
  type WorkflowRunStatusResult,
  type WorkflowRunStreamInput,
  type WorkflowRunStreamResult,
} from '../commands/handlers.js';
import { loadResolvedConfig } from '../config/configLoader.js';
import { type WorkflowApiErrorCode, WorkflowTrackerError, workflowKitErrorFromUnknown } from '../internal/errors.js';
import { selectDispatchableStories } from '../scheduler/scheduler.js';
import type { TrackerMigrationReport, TrackerValidationReport } from '../tracks/markdownTracker.js';
import type { CliOverrides, ResolvedWorkflowConfig, RunStatus, WorkflowRunPreviewTarget } from '../types.js';

export type { WorkflowApiErrorCode } from '../internal/errors.js';

export type WorkflowApiOperation =
  | 'workflow_project_inspect'
  | 'workflow_run_preview'
  | 'workflow_run_status'
  | 'workflow_run_stream'
  | 'workflow_run_inspect'
  | 'workflow_run_report'
  | 'workflow_run_export'
  | 'workflow_tracker_validate'
  | 'workflow_tracker_migrate';
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
  githubVerificationConfigured: boolean;
  githubVerificationAvailable: boolean | null;
}

export interface WorkflowRunPreviewInput extends CliOverrides {
  target: WorkflowRunPreviewTarget;
}

export interface WorkflowRunPreviewResult {
  run: {
    id: null;
    status: RunStatus;
    target: WorkflowRunPreviewTarget;
  };
  dryRunDispatch: string[];
  blockers: string[];
}

export interface WorkflowTrackerValidateResult {
  track: {
    id: string;
    relativePath: string;
  };
  report: TrackerValidationReport;
}

export interface WorkflowTrackerMigrateInput extends Omit<CliOverrides, 'track'>, TrackerMigrateInput {}

export interface WorkflowTrackerMigrateResult {
  track: {
    id: string;
  };
  draftMarkdown: string;
  report: TrackerMigrationReport;
}

export async function projectInspectFacade(
  input: CliOverrides = {},
): Promise<WorkflowApiEnvelope<WorkflowProjectInspectResult>> {
  const operation = 'workflow_project_inspect';
  try {
    const config = await loadConfigForFacade(input);
    const tracks = await discoverTracks(config, input).catch((error: unknown) => {
      throw workflowKitErrorFromUnknown(error, 'TRACKER_INVALID');
    });
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
    const preview = await buildRunPreview(input);
    return successEnvelope(operation, preview.config, input.requestId, {
      result: {
        run: {
          id: null,
          status: preview.blockers.length > 0 ? 'blocked' : 'dry-run',
          target: input.target,
        },
        dryRunDispatch: preview.dispatchableStoryIds,
        blockers: preview.blockers,
      },
      artifacts: [],
      next: [
        {
          label: 'Start run',
          mcpTool: input.target.type === 'story' ? 'run_story' : 'run_eligible',
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

export async function runStatusFacade(
  input: WorkflowRunStatusInput,
): Promise<WorkflowApiEnvelope<WorkflowRunStatusResult>> {
  const operation = 'workflow_run_status';
  try {
    const result = await runStatusHandler(input);
    return await successRunReadEnvelope(operation, input, {
      result,
      artifacts: [{ kind: 'run', path: input.runPath ?? input.runId ?? result.runId, description: 'Run artifacts' }],
      next: [
        { label: 'Stream run', mcpTool: 'workflow_run_stream', cli: `agentic-workflow-kit run stream ${result.runId}` },
        {
          label: 'Inspect run',
          mcpTool: 'workflow_run_inspect',
          cli: `agentic-workflow-kit run inspect ${result.runId}`,
        },
      ],
    });
  } catch (error) {
    return failureEnvelope(operation, input, workflowKitErrorFromUnknown(error, 'RUN_NOT_FOUND'));
  }
}

export async function runStreamFacade(
  input: WorkflowRunStreamInput,
): Promise<WorkflowApiEnvelope<WorkflowRunStreamResult>> {
  const operation = 'workflow_run_stream';
  try {
    const result = await runStreamHandler(input);
    return await successRunReadEnvelope(operation, input, {
      result,
      artifacts: [{ kind: 'run', path: input.runPath ?? input.runId ?? result.runId, description: 'Run artifacts' }],
      next: [
        {
          label: 'Inspect run',
          mcpTool: 'workflow_run_inspect',
          cli: `agentic-workflow-kit run inspect ${result.runId}`,
        },
      ],
    });
  } catch (error) {
    return failureEnvelope(operation, input, workflowKitErrorFromUnknown(error, 'RUN_NOT_FOUND'));
  }
}

export async function runInspectFacade(
  input: WorkflowRunInspectInput,
): Promise<WorkflowApiEnvelope<WorkflowRunInspectResult>> {
  const operation = 'workflow_run_inspect';
  try {
    const result = await runInspectHandler(input);
    return await successRunReadEnvelope(operation, input, {
      result,
      artifacts: result.artifacts
        .filter((artifact) => artifact.exists)
        .map((artifact) => ({ kind: artifact.kind, path: artifact.path })),
      next: [
        { label: 'Analyze run', mcpTool: 'analyze_run', cli: `agentic-workflow-kit analyze-run ${result.artifactDir}` },
      ],
    });
  } catch (error) {
    return failureEnvelope(operation, input, workflowKitErrorFromUnknown(error, 'RUN_NOT_FOUND'));
  }
}

export async function runReportFacade(
  input: WorkflowRunReportInput,
): Promise<WorkflowApiEnvelope<WorkflowRunReportResult>> {
  const operation = 'workflow_run_report';
  try {
    const result = await runReportHandler(input);
    return await successRunReadEnvelope(operation, input, {
      result,
      artifacts: [
        { kind: 'analysis', path: result.artifacts.analysis },
        { kind: 'report', path: result.artifacts.report },
      ],
      next: [
        {
          label: 'Export run',
          mcpTool: 'workflow_run_export',
          cli: `agentic-workflow-kit run export ${result.runId}`,
        },
      ],
    });
  } catch (error) {
    return failureEnvelope(operation, input, workflowKitErrorFromUnknown(error, 'RUN_NOT_FOUND'));
  }
}

export async function runExportFacade(
  input: WorkflowRunExportInput,
): Promise<WorkflowApiEnvelope<WorkflowRunExportResult>> {
  const operation = 'workflow_run_export';
  try {
    const result = await runExportHandler(input);
    return await successRunReadEnvelope(operation, input, {
      result,
      artifacts: [{ kind: 'export', path: result.bundleDir }],
      next: [],
    });
  } catch (error) {
    return failureEnvelope(operation, input, workflowKitErrorFromUnknown(error, 'RUN_NOT_FOUND'));
  }
}

async function successRunReadEnvelope<T>(
  operation: Extract<
    WorkflowApiOperation,
    | 'workflow_run_status'
    | 'workflow_run_stream'
    | 'workflow_run_inspect'
    | 'workflow_run_report'
    | 'workflow_run_export'
  >,
  input: Pick<CliOverrides, 'cwd' | 'configPath' | 'requestId'> & { runPath?: string; runId?: string },
  content: { result: T; artifacts?: WorkflowArtifactRef[]; next?: WorkflowNextAction[] },
): Promise<WorkflowApiSuccess<T>> {
  try {
    const config = await loadResolvedConfig(input, resolveInvocationCwd(input));
    return successEnvelope(operation, config, input.requestId, content);
  } catch (error) {
    if (!input.runPath || !path.isAbsolute(input.runPath)) throw error;
    return {
      ok: true,
      operation,
      apiVersion: '1',
      ...(input.requestId !== undefined ? { requestId: input.requestId } : {}),
      project: {
        repoRoot: path.dirname(input.runPath),
        configPath: input.configPath ?? '.workflow/config.yaml',
      },
      result: content.result,
      artifacts: content.artifacts ?? [],
      warnings: [
        {
          code: 'CONFIG_UNAVAILABLE',
          message: 'Run artifact was read from an explicit runPath without resolved repo config.',
        },
      ],
      next: content.next ?? [],
      response: {
        include: 'summary',
        bounded: true,
      },
    };
  }
}

export async function trackerValidateFacade(
  input: CliOverrides = {},
): Promise<WorkflowApiEnvelope<WorkflowTrackerValidateResult>> {
  const operation = 'workflow_tracker_validate';
  try {
    const validation = await trackerValidateHandler(input).catch((error: unknown) => {
      throw workflowKitErrorFromUnknown(error, 'TRACKER_INVALID');
    });
    return successEnvelope(operation, validation.config, input.requestId, {
      result: {
        track: validation.track,
        report: validation.report,
      },
      artifacts: [{ kind: 'tracker', path: validation.track.relativePath, description: 'Validated tracker' }],
      next: [
        {
          label: 'List eligible stories',
          mcpTool: 'list_eligible',
          cli: `agentic-workflow-kit list-eligible --track ${validation.track.id}`,
        },
      ],
    });
  } catch (error) {
    return failureEnvelope(operation, input, error);
  }
}

export async function trackerMigrateFacade(
  input: WorkflowTrackerMigrateInput,
): Promise<WorkflowApiEnvelope<WorkflowTrackerMigrateResult>> {
  const operation = 'workflow_tracker_migrate';
  try {
    const migration = await trackerMigrateHandler({ from: input.from, track: input.track }, input).catch(
      (error: unknown) => {
        throw workflowKitErrorFromUnknown(error, 'TRACKER_INVALID');
      },
    );
    return successEnvelope(operation, migration.config, input.requestId, {
      result: {
        track: migration.track,
        draftMarkdown: migration.draftMarkdown,
        report: migration.report,
      },
      artifacts: [],
      next: [
        {
          label: 'Validate migrated tracker',
          mcpTool: 'workflow_tracker_validate',
          cli: `agentic-workflow-kit tracker validate --track ${migration.track.id}`,
        },
      ],
    });
  } catch (error) {
    return failureEnvelope(operation, input, error);
  }
}

async function buildRunPreview(input: WorkflowRunPreviewInput): Promise<{
  config: ResolvedWorkflowConfig;
  dispatchableStoryIds: string[];
  blockers: string[];
}> {
  const overrides = {
    ...input,
    ...(input.target.trackId !== undefined ? { track: input.target.trackId } : {}),
  };
  const target = input.target;
  if (target.type === 'story') {
    const { config, stories } = await listStoriesForFacade(overrides);
    const matchingStories = stories.filter((entry) => entry.id === target.storyId);
    if (target.trackId === undefined && matchingStories.length > 1) {
      throw new WorkflowTrackerError(
        `story ${target.storyId} exists in multiple tracks: ${matchingStories
          .map((story) => story.metadata.trackId)
          .join(', ')}; pass --track <id>`,
      );
    }
    const story = matchingStories[0];
    if (!story) throw new WorkflowTrackerError(`target ${target.storyId} was not found`);
    if (input.force === true) {
      return {
        config,
        dispatchableStoryIds: [story.id],
        blockers: [],
      };
    }
    return {
      config,
      dispatchableStoryIds: story.eligible ? [story.id] : [],
      blockers: story.eligible ? [] : [story.blockedReason ?? `story ${story.id} is not eligible`],
    };
  }

  const { config, stories } =
    target.trackId === undefined ? await listStoriesForFacade(overrides) : await listEligibleForFacade(overrides);
  const eligibleStories = stories.filter((story) => story.eligible);
  const eligibleTrackIds = [...new Set(eligibleStories.map((story) => story.metadata.trackId))];
  if (target.trackId === undefined && eligibleTrackIds.length > 1) {
    throw new WorkflowTrackerError(
      `multiple tracks have eligible stories: ${eligibleTrackIds.join(', ')}; pass --track <id>`,
    );
  }
  const dispatchable = selectDispatchableStories(eligibleStories, {
    maxParallel: input.maxParallel ?? config.orchestrator.maxParallel,
  });
  return {
    config,
    dispatchableStoryIds: dispatchable.map((story) => story.id),
    blockers: [],
  };
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
  const apiError = workflowKitErrorFromUnknown(error);
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
      code: apiError.code,
      message: apiError.message,
      severity: 'error',
      retryable: apiError.retryable,
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

async function loadConfigForFacade(input: CliOverrides): Promise<ResolvedWorkflowConfig> {
  return await loadResolvedConfig(input, resolveInvocationCwd(input)).catch((error: unknown) => {
    throw workflowKitErrorFromUnknown(error, 'CONFIG_INVALID');
  });
}

async function listStoriesForFacade(input: CliOverrides): Promise<Awaited<ReturnType<typeof listStoriesHandler>>> {
  await loadConfigForFacade(input);
  return await listStoriesHandler(input).catch((error: unknown) => {
    throw workflowKitErrorFromUnknown(error, 'TRACKER_INVALID');
  });
}

async function listEligibleForFacade(input: CliOverrides): Promise<Awaited<ReturnType<typeof listEligibleHandler>>> {
  await loadConfigForFacade(input);
  return await listEligibleHandler(input).catch((error: unknown) => {
    throw workflowKitErrorFromUnknown(error, 'TRACKER_INVALID');
  });
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
    trackerMigration: true,
    runStory: true,
    runTrack: true,
    streaming: true,
    abort: true,
    tokenTelemetryLive: false,
    structuredOutputEnforced: false,
    github: config.pr.create,
    githubVerificationConfigured: config.pr.create,
    githubVerificationAvailable: null,
  };
}
