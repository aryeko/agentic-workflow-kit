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
  LiveMetricsSnapshot,
  Logger,
  ResolvedWorkflowConfig,
  RunState,
  StorySource,
  TokenTotals,
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
  summary?: WatchRunSummary;
  wait?: {
    timedOut: boolean;
    elapsedMs: number;
    polls: number;
  };
}

export interface WatchRunSummary {
  runId: string | null;
  status: string | null;
  active: string[];
  completedCount: number;
  blockedStoryId: string | null;
  blockedReason: string | null;
  elapsedMs: number | null;
  aggregate: LiveMetricsSnapshot['aggregate'] | null;
  stories: WatchStorySummary[];
}

export interface WatchStorySummary {
  storyId: string;
  status: 'requested' | 'launched' | 'active' | 'blocked' | 'complete' | 'supervision_lost' | 'unknown';
  sessionId: string | null;
  sessionLogPath: string | null;
  expectedBranch: string | null;
  expectedWorktreePath: string | null;
  latestMilestone: string | null;
  latestProgressAt: string | null;
  planSteps: { done: number; total: number } | null;
  toolCounts: Record<string, number>;
  subagentCounts: Record<string, number>;
  tokenTotals: TokenTotals | null;
}

export interface WatchRunCursor {
  eventOffset: number;
}

export interface StartWatchRunResult extends WatchRunSnapshot {
  watchId: string;
  cursor: WatchRunCursor;
}

export interface PollWatchRunResult extends WatchRunSnapshot {
  cursor: WatchRunCursor;
  changes: unknown[];
}

type RunCommand = Extract<WorkflowCommand, { kind: 'run-story' | 'run-eligible' }>;
type WatchOptions = ResolvedWorkflowConfig['orchestrator']['watch'];

const DEFAULT_WATCH_OPTIONS: WatchOptions = {
  enabled: false,
  wait: false,
  intervalMs: 5 * 60 * 1000,
  timeoutMs: 5 * 60 * 1000,
};

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

export async function watchRunHandler(runPath: string, overrides: CliOverrides = {}): Promise<WatchRunSnapshot> {
  const runDirectory = path.resolve(runPath);
  const watch = await resolveWatchOptions(runDirectory, overrides);
  if (!watch.wait) return await readRunSnapshot(runDirectory);
  const startedAt = Date.now();
  let polls = 0;
  for (;;) {
    polls += 1;
    const snapshot = await readRunSnapshot(runDirectory);
    if (!isRunningState(snapshot.state)) {
      return { ...snapshot, wait: { timedOut: false, elapsedMs: Date.now() - startedAt, polls } };
    }
    if (Date.now() - startedAt >= watch.timeoutMs) {
      return { ...snapshot, wait: { timedOut: true, elapsedMs: Date.now() - startedAt, polls } };
    }
    await delay(Math.min(watch.intervalMs, Math.max(0, watch.timeoutMs - (Date.now() - startedAt))));
  }
}

export async function startWatchRunHandler(
  runPath: string,
  overrides: CliOverrides = {},
): Promise<StartWatchRunResult> {
  const runDirectory = path.resolve(runPath);
  const snapshotOverrides = { ...overrides, wait: false };
  const [snapshot, eventOffset] = await Promise.all([
    watchRunHandler(runDirectory, snapshotOverrides),
    countRunEvents(runDirectory),
  ]);
  return {
    ...snapshot,
    watchId: `watch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    cursor: { eventOffset },
  };
}

export async function pollWatchRunHandler(
  input: { runPath: string; cursor: WatchRunCursor },
  overrides: CliOverrides = {},
): Promise<PollWatchRunResult> {
  const runDirectory = path.resolve(input.runPath);
  const snapshotOverrides = { ...overrides, wait: false };
  const [snapshot, events] = await Promise.all([
    watchRunHandler(runDirectory, snapshotOverrides),
    readRunEvents(runDirectory),
  ]);
  const eventOffset = boundedEventOffset(input.cursor.eventOffset, events.length);
  return {
    ...snapshot,
    cursor: { eventOffset: events.length },
    changes: events.slice(eventOffset),
  };
}

export async function stopWatchRunHandler(watchId: string): Promise<{ watchId: string; stopped: boolean }> {
  return { watchId, stopped: true };
}

async function resolveWatchOptions(runDirectory: string, overrides: CliOverrides): Promise<WatchOptions> {
  const configured = watchOptionsFromRunConfig(await readJsonIfExists(path.join(runDirectory, 'config.resolved.json')));
  return {
    enabled: configured.enabled,
    wait: overrides.wait ?? configured.wait,
    intervalMs: overrides.intervalMs ?? configured.intervalMs,
    timeoutMs: overrides.timeoutMs ?? configured.timeoutMs,
  };
}

function watchOptionsFromRunConfig(config: unknown): WatchOptions {
  if (!isObject(config)) return DEFAULT_WATCH_OPTIONS;
  const orchestrator = config.orchestrator;
  if (!isObject(orchestrator)) return DEFAULT_WATCH_OPTIONS;
  const watch = orchestrator.watch;
  if (!isObject(watch)) return DEFAULT_WATCH_OPTIONS;
  return {
    enabled: booleanOrDefault(watch.enabled, DEFAULT_WATCH_OPTIONS.enabled),
    wait: booleanOrDefault(watch.wait, DEFAULT_WATCH_OPTIONS.wait),
    intervalMs: positiveIntegerOrDefault(watch.intervalMs, DEFAULT_WATCH_OPTIONS.intervalMs),
    timeoutMs: positiveIntegerOrDefault(watch.timeoutMs, DEFAULT_WATCH_OPTIONS.timeoutMs),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function positiveIntegerOrDefault(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}

async function readRunSnapshot(runDirectory: string): Promise<WatchRunSnapshot> {
  const [state, metrics] = await Promise.all([
    readJsonIfExists(path.join(runDirectory, 'state.json')),
    readJsonIfExists(path.join(runDirectory, 'metrics.live.json')),
  ]);
  return { state, metrics, summary: buildWatchRunSummary(state, metrics) };
}

function isRunningState(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    !Array.isArray(state) &&
    (state as { status?: unknown }).status === 'running'
  );
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
        : workflowRunner.runEligible({ returnAfterInitialLaunch: command.overrides.asyncLaunch === true });
  return (command.overrides.watch ?? config.orchestrator.watch.enabled)
    ? await runWithEventWatch(run, runDirectory, command.overrides, stdout)
    : await run;
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
      if (!isMeaningfulWatchEvent(event.type)) continue;
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

async function countRunEvents(runDirectory: string): Promise<number> {
  return (await readRunEvents(runDirectory)).length;
}

async function readRunEvents(runDirectory: string): Promise<unknown[]> {
  let content: string;
  try {
    content = await readFile(path.join(runDirectory, 'events.ndjson'), 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
    throw error;
  }
  return content
    .trimEnd()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as unknown;
      } catch {
        return { raw: line };
      }
    });
}

function boundedEventOffset(offset: number, eventCount: number): number {
  if (!Number.isInteger(offset) || offset < 0) return 0;
  return Math.min(offset, eventCount);
}

async function readJsonIfExists(filePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

const meaningfulWatchEventTypes = new Set([
  'run-started',
  'child-launch-requested',
  'child-launched',
  'child-session-linked',
  'child-complete',
  'child-error',
  'story-not-complete',
  'run-blocked',
  'run-complete',
  'run-supervision-lost',
]);

function isMeaningfulWatchEvent(type: unknown): boolean {
  return typeof type === 'string' && meaningfulWatchEventTypes.has(type);
}

function buildWatchRunSummary(state: unknown | null, metrics: unknown | null): WatchRunSummary {
  const stateObject = isObject(state) ? state : {};
  const metricsObject = isObject(metrics) ? metrics : {};
  const children = readRecordMap(metricsObject.children);
  const activeChildren = Array.isArray(stateObject.activeChildren) ? stateObject.activeChildren.filter(isObject) : [];
  const completed = Array.isArray(stateObject.completed) ? stateObject.completed.filter(isObject) : [];
  const active = readStringArray(stateObject.active);
  const storyIds = new Set<string>([
    ...active,
    ...activeChildren
      .map((child) => readOptionalString(child.storyId))
      .filter((storyId): storyId is string => !!storyId),
    ...completed.map((child) => readOptionalString(child.storyId)).filter((storyId): storyId is string => !!storyId),
    ...Object.keys(children),
  ]);

  return {
    runId: readOptionalString(stateObject.runId) ?? readOptionalString(metricsObject.runId),
    status: readOptionalString(stateObject.status) ?? readOptionalString(metricsObject.status),
    active,
    completedCount: completed.length || readOptionalNumber(metricsObject.completedCount) || 0,
    blockedStoryId: readOptionalString(stateObject.blockedStoryId) ?? readOptionalString(metricsObject.blockedStoryId),
    blockedReason: readOptionalString(stateObject.blockedReason) ?? readOptionalString(metricsObject.blockedReason),
    elapsedMs: readOptionalNumber(metricsObject.elapsedMs),
    aggregate: readAggregate(metricsObject.aggregate),
    stories: [...storyIds].sort().map((storyId) =>
      buildWatchStorySummary({
        storyId,
        runStatus: readOptionalString(stateObject.status),
        blockedStoryId: readOptionalString(stateObject.blockedStoryId),
        active,
        activeChild: activeChildren.find((child) => readOptionalString(child.storyId) === storyId) ?? null,
        completedChild: completed.find((child) => readOptionalString(child.storyId) === storyId) ?? null,
        metricChild: children[storyId] ?? null,
      }),
    ),
  };
}

function buildWatchStorySummary(input: {
  storyId: string;
  runStatus: string | null;
  blockedStoryId: string | null;
  active: string[];
  activeChild: Record<string, unknown> | null;
  completedChild: Record<string, unknown> | null;
  metricChild: Record<string, unknown> | null;
}): WatchStorySummary {
  const status = watchStoryStatus(input);
  return {
    storyId: input.storyId,
    status,
    sessionId: readOptionalString(input.completedChild?.sessionId),
    sessionLogPath: readOptionalString(input.metricChild?.sessionLogPath),
    expectedBranch: readOptionalString(input.activeChild?.expectedBranch),
    expectedWorktreePath: readOptionalString(input.activeChild?.expectedWorktreePath),
    latestMilestone: readOptionalString(input.metricChild?.latestProgress),
    latestProgressAt:
      readOptionalString(input.activeChild?.lastObservedChildProgressAt) ??
      readOptionalString(input.activeChild?.lastHeartbeatAt),
    planSteps: null,
    toolCounts: readNumberMap(input.metricChild?.toolCounts),
    subagentCounts: readNumberMap(input.metricChild?.subagentCounts),
    tokenTotals: readTokenTotals(input.metricChild?.tokenTotals),
  };
}

function watchStoryStatus(input: {
  storyId: string;
  runStatus: string | null;
  blockedStoryId: string | null;
  active: string[];
  activeChild: Record<string, unknown> | null;
  completedChild: Record<string, unknown> | null;
}): WatchStorySummary['status'] {
  if (input.completedChild) return readOptionalBoolean(input.completedChild.ok) === false ? 'blocked' : 'complete';
  if (input.blockedStoryId === input.storyId)
    return input.runStatus === 'supervision_lost' ? 'supervision_lost' : 'blocked';
  if (input.active.includes(input.storyId)) return 'active';
  if (input.activeChild) return 'launched';
  return 'unknown';
}

function readRecordMap(value: unknown): Record<string, Record<string, unknown>> {
  if (!isObject(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, Record<string, unknown>] => isObject(entry[1])),
  );
}

function readAggregate(value: unknown): LiveMetricsSnapshot['aggregate'] | null {
  if (!isObject(value)) return null;
  return {
    toolCounts: readNumberMap(value.toolCounts),
    subagentCounts: readNumberMap(value.subagentCounts),
    tokenTotals: readTokenTotals(value.tokenTotals),
  };
}

function readTokenTotals(value: unknown): TokenTotals | null {
  if (!isObject(value)) return null;
  return {
    inputTokens: readOptionalNumber(value.inputTokens) ?? 0,
    cachedInputTokens: readOptionalNumber(value.cachedInputTokens) ?? 0,
    outputTokens: readOptionalNumber(value.outputTokens) ?? 0,
    reasoningOutputTokens: readOptionalNumber(value.reasoningOutputTokens) ?? 0,
    totalTokens: readOptionalNumber(value.totalTokens) ?? 0,
  };
}

function readNumberMap(value: unknown): Record<string, number> {
  if (!isObject(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
  );
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readOptionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readOptionalBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}
