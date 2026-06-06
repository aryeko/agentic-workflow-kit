import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { analyzeWorkflowRun } from '../analysis/runAnalyzer.js';
import { FileArtifactStore } from '../artifacts/FileArtifactStore.js';
import { resolveInvocationCwd } from '../cli/args.js';
import { SystemClock } from '../clock/SystemClock.js';
import { createRunId, loadResolvedConfig, resolveCwdOnlyConfig } from '../config/configLoader.js';
import { CodexMcpStoryRunner, type CodexMcpStoryRunnerOptions } from '../drivers/codex-mcp/CodexMcpStoryRunner.js';
import { RealGitInspector } from '../git/GitInspector.js';
import { ConsoleLogger } from '../logging/ConsoleLogger.js';
import { WorkflowRunner } from '../runner/WorkflowRunner.js';
import { selectDispatchableStories } from '../scheduler/scheduler.js';
import { discoverMarkdownTracks, EmptyStorySource, MarkdownTrackStorySource } from '../tracks/markdownTracker.js';
import type {
  CliOverrides,
  Logger,
  ResolvedWorkflowConfig,
  RunState,
  StorySource,
  WorkflowCommand,
  WorkflowStory,
  WorkflowTrack,
} from '../types.js';

export interface CommandHandlerOptions {
  stdout?: (line: string) => void;
  logger?: Logger;
  createCodexMcpClient?: CodexMcpStoryRunnerOptions['createClient'];
}

export interface TracksResult {
  config: ResolvedWorkflowConfig;
  tracks: WorkflowTrack[];
}

export interface StoriesResult {
  config: ResolvedWorkflowConfig;
  stories: WorkflowStory[];
}

export interface WatchRunSnapshot {
  state: unknown | null;
  metrics: unknown | null;
}

type RunCommand = Extract<WorkflowCommand, { kind: 'run-story' | 'run-eligible' }>;

export async function listTracksHandler(
  overrides: CliOverrides = {},
  _options: CommandHandlerOptions = {},
): Promise<TracksResult> {
  const { config, tracks } = await loadConfigAndTracks(overrides);
  return { config, tracks };
}

export async function listStoriesHandler(
  overrides: CliOverrides = {},
  _options: CommandHandlerOptions = {},
): Promise<StoriesResult> {
  const { config, tracks } = await loadConfigAndTracks(overrides);
  const stories = selectStoriesFromTracks(tracks, overrides);
  return { config, stories };
}

export async function listEligibleHandler(
  overrides: CliOverrides = {},
  _options: CommandHandlerOptions = {},
): Promise<StoriesResult> {
  const { config, tracks } = await loadConfigAndTracks(overrides);
  const stories = selectStoriesFromTracks(tracks, overrides).filter((story) => story.eligible);
  return { config, stories };
}

export async function analyzeRunHandler(runPath: string, overrides: CliOverrides = {}): Promise<unknown> {
  return await analyzeWorkflowRun(path.resolve(runPath), {
    sessionRoots: overrides.sessionRoot ? [path.resolve(overrides.sessionRoot)] : undefined,
  });
}

export async function watchRunHandler(runPath: string, _overrides: CliOverrides = {}): Promise<WatchRunSnapshot> {
  const runDirectory = path.resolve(runPath);
  const [state, metrics] = await Promise.all([
    readJsonIfExists(path.join(runDirectory, 'state.json')),
    readJsonIfExists(path.join(runDirectory, 'metrics.live.json')),
  ]);
  return { state, metrics };
}

export async function mcpCheckHandler(
  overrides: CliOverrides = {},
  options: CommandHandlerOptions = {},
): Promise<{ ok: boolean; tools: string[] }> {
  const cwd = resolveInvocationCwd(overrides);
  const storyRunner = new CodexMcpStoryRunner(resolveCwdOnlyConfig(cwd), {
    ...(options.createCodexMcpClient ? { createClient: options.createCodexMcpClient } : {}),
  });
  return await storyRunner.checkTools();
}

export async function runWorkflowHandler(command: RunCommand, options: CommandHandlerOptions = {}): Promise<RunState> {
  const logger = options.logger ?? new ConsoleLogger();
  const stdout = options.stdout ?? console.log;
  const cwd = resolveInvocationCwd(command.overrides);
  const config = await loadResolvedConfig(command.overrides, cwd);
  const tracks = await discoverTracks(config, command.overrides);
  const runId = createRunId();
  const runDirectory = path.join(config.artifacts.runsDirAbs, runId);
  const storySource =
    command.kind === 'run-story'
      ? selectStorySourceForStory(config, tracks, command.storyId, command.overrides)
      : selectStorySourceForRunEligible(config, tracks, command.overrides);
  const workflowRunner = new WorkflowRunner({
    command: command.kind,
    config,
    storySource,
    storyRunner: new CodexMcpStoryRunner(config, {
      ...(options.createCodexMcpClient ? { createClient: options.createCodexMcpClient } : {}),
    }),
    gitInspector: new RealGitInspector(),
    artifactStore: new FileArtifactStore(runDirectory),
    logger,
    clock: new SystemClock(),
    runId,
  });

  const run =
    command.kind === 'run-story'
      ? command.overrides.dryRun
        ? workflowRunner.dryRunStory(command.storyId, { force: command.overrides.force })
        : workflowRunner.runStory(command.storyId, { force: command.overrides.force })
      : command.overrides.dryRun
        ? workflowRunner.dryRunEligible()
        : workflowRunner.runEligible();
  return command.overrides.watch ? await runWithEventWatch(run, runDirectory, command.overrides, stdout) : await run;
}

export function printableStories(stories: WorkflowStory[], overrides: CliOverrides): WorkflowStory[] {
  const limited = selectDispatchableStories(stories, {
    maxParallel: overrides.maxParallel ?? stories.length,
  });
  return overrides.maxParallel ? limited : stories;
}

export async function discoverTracks(
  config: ResolvedWorkflowConfig,
  overrides: CliOverrides,
): Promise<WorkflowTrack[]> {
  return await discoverMarkdownTracks({
    workspaceRoot: config.workspace.rootAbs,
    tracksDir: overrides.tracksDir ?? config.paths.tracksDir,
    archiveDir: config.paths.archiveDir,
    completeStatuses: config.statuses.complete,
    eligibleStatuses: config.statuses.eligible,
    idPattern: config.tracker.idPattern,
  });
}

function selectStoriesFromTracks(tracks: WorkflowTrack[], overrides: CliOverrides): WorkflowStory[] {
  return overrides.track ? selectTrack(tracks, overrides.track).stories : tracks.flatMap((track) => track.stories);
}

function selectStorySourceForRunEligible(
  config: ResolvedWorkflowConfig,
  tracks: WorkflowTrack[],
  overrides: CliOverrides,
): StorySource {
  if (overrides.track) {
    const track = selectTrack(tracks, overrides.track);
    return new MarkdownTrackStorySource(trackOptions(config, overrides), track.id);
  }

  const eligibleTracks = tracks.filter((track) => track.stories.some((story) => story.eligible));
  if (eligibleTracks.length === 0) return new EmptyStorySource();
  if (eligibleTracks.length > 1) {
    throw new Error(
      `multiple tracks have eligible stories: ${eligibleTracks.map((track) => track.id).join(', ')}; pass --track <id>`,
    );
  }

  return new MarkdownTrackStorySource(trackOptions(config, overrides), eligibleTracks[0].id);
}

function selectStorySourceForStory(
  config: ResolvedWorkflowConfig,
  tracks: WorkflowTrack[],
  storyId: string,
  overrides: CliOverrides,
): StorySource {
  if (overrides.track) {
    const track = selectTrack(tracks, overrides.track);
    return new MarkdownTrackStorySource(trackOptions(config, overrides), track.id);
  }

  const matchingTracks = tracks.filter((track) => track.stories.some((story) => story.id === storyId));
  if (matchingTracks.length === 0) return new EmptyStorySource();
  if (matchingTracks.length > 1) {
    throw new Error(
      `story ${storyId} exists in multiple tracks: ${matchingTracks.map((track) => track.id).join(', ')}; pass --track <id>`,
    );
  }

  return new MarkdownTrackStorySource(trackOptions(config, overrides), matchingTracks[0].id);
}

function selectTrack(tracks: WorkflowTrack[], trackId: string): WorkflowTrack {
  const track = tracks.find((entry) => entry.id === trackId);
  if (!track) throw new Error(`track ${trackId} was not found`);
  return track;
}

function trackOptions(
  config: ResolvedWorkflowConfig,
  overrides: CliOverrides,
): {
  workspaceRoot: string;
  tracksDir: string;
  archiveDir: string;
  completeStatuses: string[];
  eligibleStatuses: string[];
  idPattern: string;
} {
  return {
    workspaceRoot: config.workspace.rootAbs,
    tracksDir: overrides.tracksDir ?? config.paths.tracksDir,
    archiveDir: config.paths.archiveDir,
    completeStatuses: config.statuses.complete,
    eligibleStatuses: config.statuses.eligible,
    idPattern: config.tracker.idPattern,
  };
}

async function loadConfigAndTracks(overrides: CliOverrides): Promise<TracksResult> {
  const cwd = resolveInvocationCwd(overrides);
  const config = await loadResolvedConfig(overrides, cwd);
  const tracks = await discoverTracks(config, overrides);
  return { config, tracks };
}

async function runWithEventWatch<T>(
  run: Promise<T>,
  runDirectory: string,
  overrides: CliOverrides,
  stdout: (line: string) => void,
): Promise<T> {
  let done = false;
  const watch = watchRunEvents(runDirectory, overrides, () => done, stdout);
  try {
    const result = await run;
    done = true;
    await watch;
    return result;
  } catch (error) {
    done = true;
    await watch;
    throw error;
  }
}

async function watchRunEvents(
  runDirectory: string,
  overrides: CliOverrides,
  isDone: () => boolean,
  stdout: (line: string) => void,
): Promise<void> {
  const eventPath = path.join(runDirectory, 'events.ndjson');
  let printed = 0;
  while (!isDone()) {
    printed = await printNewEvents(eventPath, printed, overrides, stdout);
    await delay(250);
  }
  await printNewEvents(eventPath, printed, overrides, stdout);
}

async function printNewEvents(
  eventPath: string,
  printed: number,
  overrides: CliOverrides,
  stdout: (line: string) => void,
): Promise<number> {
  let content: string;
  try {
    content = await readFile(eventPath, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return printed;
    throw error;
  }
  const lines = content.trimEnd().split('\n').filter(Boolean);
  for (const line of lines.slice(printed)) {
    if (overrides.json) {
      stdout(line);
    } else {
      const event = JSON.parse(line) as { type?: unknown; ts?: unknown; storyId?: unknown; status?: unknown };
      const story = typeof event.storyId === 'string' ? ` ${event.storyId}` : '';
      const status = typeof event.status === 'string' ? ` ${event.status}` : '';
      stdout(`${String(event.ts ?? '')} ${String(event.type ?? 'event')}${story}${status}`.trim());
    }
  }
  return lines.length;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJsonIfExists(filePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}
