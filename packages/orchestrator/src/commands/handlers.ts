import { appendFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'tinyglobby';

import { analyzeWorkflowRun } from '../analysis/runAnalyzer.js';
import { FileArtifactStore } from '../artifacts/FileArtifactStore.js';
import { resolveInvocationCwd } from '../cli/args.js';
import { SystemClock } from '../clock/SystemClock.js';
import { createRunId, loadResolvedConfig, resolveCwdOnlyConfig } from '../config/configLoader.js';
import { CodexMcpStoryRunner, type CodexMcpStoryRunnerOptions } from '../drivers/codex-mcp/CodexMcpStoryRunner.js';
import { RealGitInspector } from '../git/GitInspector.js';
import { ConsoleLogger } from '../logging/ConsoleLogger.js';
import { sendCodexInterrupt } from '../mcp/codexControl.js';
import { WorkflowRunner } from '../runner/WorkflowRunner.js';
import { selectDispatchableStories } from '../scheduler/scheduler.js';
import {
  discoverMarkdownTracks,
  EmptyStorySource,
  MarkdownTrackStorySource,
  migrateMarkdownTracker,
  type TrackerMigrationReport,
  type TrackerValidationReport,
  validateTrackerMarkdown,
} from '../tracks/markdownTracker.js';
import type {
  CliOverrides,
  LiveMetricsSnapshot,
  Logger,
  ResolvedWorkflowConfig,
  RunControlChildOutcome,
  RunControlRequest,
  RunControlResult,
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

export interface TrackerValidateResult {
  config: ResolvedWorkflowConfig;
  track: {
    id: string;
    relativePath: string;
  };
  report: TrackerValidationReport;
}

export interface TrackerMigrateInput {
  from: string;
  track: string;
}

export interface TrackerMigrateResult {
  config: ResolvedWorkflowConfig;
  track: {
    id: string;
  };
  draftMarkdown: string;
  report: TrackerMigrationReport;
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

export interface AbortRunInput {
  runPath: string;
  storyId?: string;
  reason?: string;
  requestedBy?: string;
}

export type WorkflowRunEventTopic =
  | 'run'
  | 'tracker'
  | 'story'
  | 'child'
  | 'review'
  | 'pr'
  | 'merge'
  | 'budget'
  | 'control'
  | 'error'
  | 'debug';
export type WorkflowRunEventLevel = 'debug' | 'info' | 'warn' | 'error';

export interface WorkflowRunEventQuery {
  limit?: number;
  topics?: WorkflowRunEventTopic[];
  storyIds?: string[];
  minLevel?: WorkflowRunEventLevel;
}

export interface WorkflowRunStreamSubscription extends WorkflowRunEventQuery {
  replay?: { lastEvents?: number };
  includeData?: 'none' | 'summary' | 'full-bounded';
  throttleMs?: number;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

export interface WorkflowRunStatusInput extends CliOverrides {
  runId?: string;
  runPath?: string;
  events?: WorkflowRunEventQuery;
}

export interface WorkflowRunStreamInput extends CliOverrides {
  runId?: string;
  runPath?: string;
  subscription?: WorkflowRunStreamSubscription;
  onProgress?: (event: NormalizedRunEvent, delivered: number) => Promise<void> | void;
}

export interface WorkflowRunInspectInput extends CliOverrides {
  runId?: string;
  runPath?: string;
  include?: 'summary' | 'artifacts' | 'children' | 'full-bounded';
}

export interface NormalizedRunEvent {
  id: string;
  recordedAt: string | null;
  eventAt: string | null;
  type: string;
  topic: WorkflowRunEventTopic;
  level: WorkflowRunEventLevel;
  message: string;
  storyId: string | null;
  childId: string | null;
  data?: Record<string, unknown>;
}

export interface WorkflowRunStatusResult {
  runId: string;
  status: string | null;
  active: string[];
  completedCount: number;
  blockedStoryId: string | null;
  blockedReason: string | null;
  controls: RunControlRequest[];
  artifacts: Record<string, string>;
  metrics: unknown | null;
  recentEvents: NormalizedRunEvent[];
}

export interface WorkflowRunStreamResult {
  runId: string;
  terminal: boolean;
  status: string | null;
  eventsDelivered: number;
  timedOut: boolean;
  events: NormalizedRunEvent[];
}

export interface WorkflowRunInspectResult {
  runId: string;
  status: string | null;
  artifactDir: string;
  artifacts: Array<{ kind: string; path: string; exists: boolean; sizeBytes: number | null }>;
  children: Array<{
    storyId: string;
    launchPath: string | null;
    resultPath: string | null;
    sessionId: string | null;
    sessionLogPath: string | null;
  }>;
  pr: { urls: string[]; numbers: number[] };
  metrics: unknown | null;
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

export async function trackerValidateHandler(
  overrides: CliOverrides = {},
  _options: CommandHandlerOptions = {},
): Promise<TrackerValidateResult> {
  const cwd = resolveInvocationCwd(overrides);
  const config = await loadResolvedConfig(overrides, cwd);
  const trackId = requireTrack(overrides.track);
  const relativePath = slash(path.join(overrides.tracksDir ?? config.paths.tracksDir, trackId, 'README.md'));
  const trackerPath = path.join(config.workspace.rootAbs, relativePath);
  const markdown = await readFile(trackerPath, 'utf8');
  const storyBriefs = await findStoryBriefs(config, overrides, trackId);
  const report = validateTrackerMarkdown(markdown, {
    completeStatuses: new Set(config.statuses.complete),
    eligibleStatuses: new Set(config.statuses.eligible),
    statusVocabulary: statusVocabulary(config),
    idPattern: new RegExp(config.tracker.idPattern),
    expectedIdPrefix: expectedPrefixFromMarkdown(markdown, config.tracker.idPattern),
    storyBriefBaseDir: slash(path.join(path.dirname(relativePath), 'stories')),
    existingStoryBriefs: storyBriefs,
    trackId,
    trackTitle: trackId,
    trackerPath: relativePath,
  });
  return { config, track: { id: trackId, relativePath }, report };
}

export async function trackerMigrateHandler(
  input: TrackerMigrateInput,
  overrides: CliOverrides = {},
  _options: CommandHandlerOptions = {},
): Promise<TrackerMigrateResult> {
  const cwd = resolveInvocationCwd(overrides);
  const config = await loadResolvedConfig(overrides, cwd);
  const sourcePath = path.isAbsolute(input.from) ? input.from : path.join(config.workspace.rootAbs, input.from);
  const markdown = await readFile(sourcePath, 'utf8');
  const tracks = await discoverTracks(config, overrides);
  const existingTrack = tracks.find((track) => track.id === input.track);
  const idPrefix = prefixFromTrack(existingTrack) ?? prefixFromTrackId(input.track);
  const result = migrateMarkdownTracker(markdown, {
    trackId: input.track,
    trackTitle: existingTrack?.title ?? `${input.track} tracker`,
    idPrefix,
    idPattern: new RegExp(config.tracker.idPattern),
    statusVocabulary: statusVocabulary(config),
    defaultEligibleStatus: config.statuses.eligible[0],
    defaultCompleteStatus: config.statuses.complete[0],
    inProgressStatus: config.statuses.inProgress,
  });
  return { config, track: { id: input.track }, ...result };
}

export async function analyzeRunHandler(runPath: string, overrides: CliOverrides = {}): Promise<unknown> {
  return await analyzeWorkflowRun(path.resolve(runPath), {
    sessionRoots: overrides.sessionRoot ? [path.resolve(overrides.sessionRoot)] : undefined,
  });
}

export async function abortRunHandler(input: AbortRunInput): Promise<RunControlResult> {
  const runPath = path.resolve(input.runPath);
  const statePath = path.join(runPath, 'state.json');
  const state = await readJsonIfExists(statePath);
  if (!isObject(state) || typeof state.runId !== 'string') {
    throw new Error(`run state not found or invalid: ${statePath}`);
  }

  const requestedAt = new Date().toISOString();
  const request: RunControlRequest = {
    id: `ctrl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    runId: state.runId,
    action: 'abort',
    storyId: input.storyId ?? null,
    reason: input.reason ?? null,
    requestedAt,
    requestedBy: input.requestedBy ?? 'operator',
  };
  await appendNdjson(path.join(runPath, 'controls.ndjson'), request);
  await appendRunEvent(runPath, 'control-requested', {
    controlId: request.id,
    action: request.action,
    storyId: request.storyId,
    reason: request.reason,
    requestedBy: request.requestedBy,
  });

  const status = readOptionalString(state.status);
  const allActiveStoryIds = readStringArray(state.active);
  if (request.storyId && allActiveStoryIds.length > 0 && !allActiveStoryIds.includes(request.storyId)) {
    const childOutcomes: RunControlChildOutcome[] = [
      {
        storyId: request.storyId,
        sessionId: null,
        outcome: 'unsupported',
        detail: 'requested story is not active in this run',
      },
    ];
    await appendRunEvent(runPath, 'control-applied', {
      controlId: request.id,
      action: request.action,
      outcome: 'unsupported',
      childOutcomes,
    });
    return {
      ok: true,
      runId: request.runId,
      action: request.action,
      outcome: 'unsupported',
      reason: request.reason,
      requestedAt,
      appliedAt: null,
      runPath,
      activeStoryIds: [],
      childOutcomes,
      artifacts: controlArtifactRefs(),
    };
  }
  const activeStoryIds = allActiveStoryIds.filter((storyId) => !request.storyId || storyId === request.storyId);
  const terminal = isTerminalRunStatus(status);
  if (terminal) {
    return {
      ok: true,
      runId: request.runId,
      action: request.action,
      outcome: 'already-terminal',
      reason: request.reason,
      requestedAt,
      appliedAt: null,
      runPath,
      activeStoryIds,
      childOutcomes: [],
      artifacts: controlArtifactRefs(),
    };
  }

  const childOutcomes = await abortActiveChildren(runPath, activeStoryIds, request.reason);
  const hasActiveChildren = activeStoryIds.length > 0;
  const appliedAt = new Date().toISOString();
  const outcome = controlOutcomeForChildren(hasActiveChildren, childOutcomes);
  const nextStatus = hasActiveChildren && outcome !== 'applied' ? 'aborting' : 'aborted';
  const updatedState = {
    ...state,
    status: nextStatus,
    blockedStoryId: nextStatus === 'aborted' ? null : readOptionalString(state.blockedStoryId),
    blockedReason: nextStatus === 'aborted' ? null : (request.reason ?? 'abort requested'),
    ...(nextStatus === 'aborted' ? { completedAt: appliedAt } : {}),
  };
  await writeJsonFile(statePath, updatedState);
  await appendRunEvent(runPath, 'control-applied', {
    controlId: request.id,
    action: request.action,
    outcome,
    childOutcomes,
  });
  if (nextStatus === 'aborted') {
    await appendRunEvent(runPath, 'run-aborted', {
      controlId: request.id,
      reason: request.reason,
    });
  }
  return {
    ok: true,
    runId: request.runId,
    action: request.action,
    outcome,
    reason: request.reason,
    requestedAt,
    appliedAt,
    runPath,
    activeStoryIds,
    childOutcomes,
    artifacts: controlArtifactRefs(),
  };
}

export async function runStatusHandler(input: WorkflowRunStatusInput = {}): Promise<WorkflowRunStatusResult> {
  const runDirectory = await resolveRunDirectory(input);
  await assertRunExists(runDirectory);
  const [state, metrics, controls, events] = await Promise.all([
    readJsonIfExists(path.join(runDirectory, 'state.json')),
    readJsonIfExists(path.join(runDirectory, 'metrics.live.json')),
    readControlsIfExists(runDirectory),
    readNormalizedEvents(runDirectory, {
      limit: input.events?.limit ?? input.limit ?? 25,
      topics: input.events?.topics,
      storyIds: input.events?.storyIds,
      minLevel: input.events?.minLevel,
    }),
  ]);
  const stateObject = isObject(state) ? state : {};
  return {
    runId: readOptionalString(stateObject.runId) ?? path.basename(runDirectory),
    status: readOptionalString(stateObject.status),
    active: readStringArray(stateObject.active),
    completedCount: Array.isArray(stateObject.completed) ? stateObject.completed.length : 0,
    blockedStoryId: readOptionalString(stateObject.blockedStoryId),
    blockedReason: readOptionalString(stateObject.blockedReason),
    controls,
    artifacts: runArtifactRefs(),
    metrics,
    recentEvents: events,
  };
}

export async function runStreamHandler(input: WorkflowRunStreamInput = {}): Promise<WorkflowRunStreamResult> {
  const runDirectory = await resolveRunDirectory(input);
  await assertRunExists(runDirectory);
  const subscription = input.subscription ?? {};
  const limit = boundedLimit(subscription.replay?.lastEvents ?? subscription.limit ?? input.limit ?? 20);
  const timeoutMs = positiveIntegerOrDefault(subscription.timeoutMs ?? input.timeoutMs, 300_000);
  const pollIntervalMs = positiveIntegerOrDefault(subscription.pollIntervalMs ?? input.intervalMs, 1000);
  const startedAt = Date.now();
  let delivered = 0;
  let lastCount = 0;
  let latestEvents: NormalizedRunEvent[] = [];
  for (;;) {
    const rawEvents = await readRunEvents(runDirectory);
    const normalized = filterNormalizedEvents(
      rawEvents.map((event, index) => normalizeRunEvent(event, index)),
      {
        limit,
        topics: subscription.topics,
        storyIds: subscription.storyIds,
        minLevel: subscription.minLevel,
      },
      subscription.includeData ?? 'summary',
    );
    latestEvents = normalized;
    const newEvents = normalized.slice(Math.max(0, normalized.length - Math.max(0, rawEvents.length - lastCount)));
    for (const event of newEvents) {
      delivered += 1;
      await input.onProgress?.(event, delivered);
    }
    lastCount = rawEvents.length;
    const state = await readJsonIfExists(path.join(runDirectory, 'state.json'));
    if (!isRunningState(state)) {
      return {
        runId: readOptionalString(isObject(state) ? state.runId : undefined) ?? path.basename(runDirectory),
        terminal: true,
        status: readOptionalString(isObject(state) ? state.status : undefined),
        eventsDelivered: delivered || latestEvents.length,
        timedOut: false,
        events: latestEvents,
      };
    }
    if (Date.now() - startedAt >= timeoutMs) {
      return {
        runId: readOptionalString(isObject(state) ? state.runId : undefined) ?? path.basename(runDirectory),
        terminal: false,
        status: readOptionalString(isObject(state) ? state.status : undefined),
        eventsDelivered: delivered || latestEvents.length,
        timedOut: true,
        events: latestEvents,
      };
    }
    await delay(Math.min(pollIntervalMs, Math.max(0, timeoutMs - (Date.now() - startedAt))));
  }
}

export async function runInspectHandler(input: WorkflowRunInspectInput = {}): Promise<WorkflowRunInspectResult> {
  const runDirectory = await resolveRunDirectory(input);
  await assertRunExists(runDirectory);
  const [state, metrics, artifacts, children, events] = await Promise.all([
    readJsonIfExists(path.join(runDirectory, 'state.json')),
    readJsonIfExists(path.join(runDirectory, 'metrics.live.json')),
    inspectArtifacts(runDirectory),
    inspectChildren(runDirectory),
    readRunEvents(runDirectory),
  ]);
  const stateObject = isObject(state) ? state : {};
  const pr = collectPrRefs([...events, ...children]);
  return {
    runId: readOptionalString(stateObject.runId) ?? path.basename(runDirectory),
    status: readOptionalString(stateObject.status),
    artifactDir: runDirectory,
    artifacts,
    children,
    pr,
    metrics,
  };
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
  if (typeof state !== 'object' || state === null || Array.isArray(state)) return false;
  const status = (state as { status?: unknown }).status;
  return status === 'running' || status === 'aborting';
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
  await assertTracksValidForDispatch(config, command.overrides, tracks);
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

function requireTrack(track: string | undefined): string {
  if (!track) throw new Error('tracker validation requires --track <id>');
  return track;
}

function statusVocabulary(config: ResolvedWorkflowConfig): string[] {
  return [
    ...new Set([
      ...config.statuses.eligible,
      config.statuses.inProgress,
      ...config.statuses.complete,
      'blocked',
      'canceled',
      'deferred',
      'superseded',
    ]),
  ];
}

async function findStoryBriefs(
  config: ResolvedWorkflowConfig,
  overrides: CliOverrides,
  trackId: string,
): Promise<Set<string>> {
  const tracksDir = overrides.tracksDir ?? config.paths.tracksDir;
  const tracksDirAbs = path.resolve(config.workspace.rootAbs, tracksDir);
  const matches = await glob(`${trackId}/stories/*.md`, { cwd: tracksDirAbs, absolute: false });
  return new Set(matches.map((match) => slash(path.join(tracksDir, match))));
}

async function assertTracksValidForDispatch(
  config: ResolvedWorkflowConfig,
  overrides: CliOverrides,
  tracks: WorkflowTrack[],
): Promise<void> {
  const selectedTracks = overrides.track ? [selectTrack(tracks, overrides.track)] : tracks;
  const failures: string[] = [];
  for (const track of selectedTracks) {
    const markdown = await readFile(track.pathAbs, 'utf8');
    const storyBriefs = await findStoryBriefs(config, overrides, track.id);
    const report = validateTrackerMarkdown(markdown, {
      completeStatuses: new Set(config.statuses.complete),
      eligibleStatuses: new Set(config.statuses.eligible),
      statusVocabulary: statusVocabulary(config),
      idPattern: new RegExp(config.tracker.idPattern),
      expectedIdPrefix: expectedPrefixFromMarkdown(markdown, config.tracker.idPattern),
      storyBriefBaseDir: slash(path.join(path.dirname(track.relativePath), 'stories')),
      existingStoryBriefs: storyBriefs,
      trackId: track.id,
      trackTitle: track.title,
      trackerPath: track.relativePath,
    });
    if (!report.ok) {
      const codes = report.diagnostics
        .filter((diagnostic) => diagnostic.severity === 'error')
        .map((diagnostic) => diagnostic.code)
        .join(', ');
      failures.push(`${track.id}: ${codes}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(`tracker validation failed for ${failures.join('; ')}`);
  }
}

function expectedPrefixFromMarkdown(markdown: string, idPattern: string): string | undefined {
  const pattern = new RegExp(idPattern);
  const match = markdown.match(/\|\s*([A-Z]{2,}[0-9]+)\s*\|/);
  if (!match || !pattern.test(match[1])) return undefined;
  return match[1].match(/^[A-Z]+/)?.[0];
}

function prefixFromTrack(track: WorkflowTrack | undefined): string | null {
  const firstId = track?.stories[0]?.id;
  return firstId?.match(/^[A-Z]+/)?.[0] ?? null;
}

function prefixFromTrackId(trackId: string): string {
  const letters = trackId
    .split(/[^a-zA-Z]+/)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('');
  return letters.length >= 2 ? letters : 'WK';
}

function slash(value: string): string {
  return value.split(path.sep).join('/');
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

async function readNormalizedEvents(
  runDirectory: string,
  query: WorkflowRunEventQuery,
  includeData: WorkflowRunStreamSubscription['includeData'] = 'summary',
): Promise<NormalizedRunEvent[]> {
  const events = await readRunEvents(runDirectory);
  return filterNormalizedEvents(
    events.map((event, index) => normalizeRunEvent(event, index)),
    query,
    includeData,
  );
}

function filterNormalizedEvents(
  events: NormalizedRunEvent[],
  query: WorkflowRunEventQuery,
  includeData: WorkflowRunStreamSubscription['includeData'],
): NormalizedRunEvent[] {
  const topics = query.topics ? new Set(query.topics) : null;
  const storyIds = query.storyIds ? new Set(query.storyIds) : null;
  const minLevel = query.minLevel ?? 'debug';
  const filtered = events.filter((event) => {
    if (topics && !topics.has(event.topic)) return false;
    if (storyIds && event.storyId !== null && !storyIds.has(event.storyId)) return false;
    return levelRank(event.level) >= levelRank(minLevel);
  });
  return filtered.slice(-boundedLimit(query.limit)).map((event) => boundEventData(event, includeData));
}

function normalizeRunEvent(value: unknown, index: number): NormalizedRunEvent {
  const event = isObject(value) ? value : {};
  const type = readOptionalString(event.type) ?? 'event';
  const recordedAt = readOptionalString(event.recordedAt) ?? readOptionalString(event.ts);
  const eventAt = readOptionalString(event.eventAt) ?? recordedAt;
  const storyId = readOptionalString(event.storyId);
  const childId = readOptionalString(event.childId) ?? storyId;
  const topic = topicForEvent(type);
  const level = levelForEvent(type, event);
  const message = readOptionalString(event.message) ?? readOptionalString(event.reason) ?? type.replace(/[-_]/g, ' ');
  const data = Object.fromEntries(
    Object.entries(event).filter(
      ([key]) => !['recordedAt', 'eventAt', 'ts', 'type', 'storyId', 'childId', 'message'].includes(key),
    ),
  );
  return {
    id: readOptionalString(event.id) ?? `evt_${String(index + 1).padStart(6, '0')}`,
    recordedAt,
    eventAt,
    type,
    topic,
    level,
    message,
    storyId,
    childId,
    ...(Object.keys(data).length > 0 ? { data } : {}),
  };
}

function topicForEvent(type: string): WorkflowRunEventTopic {
  const normalized = type.replace(/_/g, '-');
  if (normalized.includes('error') || normalized.includes('failed') || normalized.includes('blocked')) return 'error';
  if (normalized.startsWith('tracker-') || normalized === 'claimed' || normalized.endsWith('-written'))
    return 'tracker';
  if (normalized.startsWith('story-') || normalized === 'story-selected') return 'story';
  if (normalized.startsWith('child-') || normalized.startsWith('session-') || normalized.startsWith('codex-'))
    return 'child';
  if (normalized.startsWith('pre-pr-review')) return 'review';
  if (normalized.startsWith('pr-') || normalized.startsWith('pr-review') || normalized.startsWith('pr-checks'))
    return 'pr';
  if (normalized.startsWith('merge-') || normalized === 'pr-merged' || normalized === 'cleanup-complete')
    return 'merge';
  if (normalized.startsWith('budget-') || normalized === 'tokens-observed') return 'budget';
  if (normalized.startsWith('control-')) return 'control';
  if (normalized.includes('debug')) return 'debug';
  return 'run';
}

function levelForEvent(type: string, event: Record<string, unknown>): WorkflowRunEventLevel {
  const explicit = readOptionalString(event.level);
  if (explicit === 'debug' || explicit === 'info' || explicit === 'warn' || explicit === 'error') return explicit;
  const normalized = type.toLowerCase();
  if (normalized.includes('error') || normalized.includes('failed') || normalized.includes('blocked')) return 'error';
  if (normalized.includes('warning') || normalized.includes('warn') || normalized.includes('downgraded')) return 'warn';
  if (normalized.includes('debug')) return 'debug';
  return 'info';
}

function levelRank(level: WorkflowRunEventLevel): number {
  return { debug: 0, info: 1, warn: 2, error: 3 }[level];
}

function boundEventData(
  event: NormalizedRunEvent,
  includeData: WorkflowRunStreamSubscription['includeData'],
): NormalizedRunEvent {
  if (includeData === 'none') {
    const { data: _data, ...rest } = event;
    return rest;
  }
  if (includeData !== 'full-bounded' || event.data === undefined) return event;
  const serialized = JSON.stringify(event.data);
  if (serialized.length <= 20_000) return event;
  return { ...event, data: { truncated: true, preview: `${serialized.slice(0, 20_000)}...` } };
}

function boundedLimit(limit: unknown): number {
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1) return 25;
  return Math.min(limit, 200);
}

async function resolveRunDirectory(input: {
  runId?: string;
  runPath?: string;
  cwd?: string;
  configPath?: string;
}): Promise<string> {
  const runRef = input.runPath ?? input.runId;
  if (!runRef) throw new Error('run not found: pass runId or runPath');
  if (path.isAbsolute(runRef) || runRef.includes(path.sep)) return path.resolve(runRef);
  const cwd = resolveInvocationCwd(input);
  const config = await loadResolvedConfig(input, cwd);
  return path.join(config.artifacts.runsDirAbs, runRef);
}

async function assertRunExists(runDirectory: string): Promise<void> {
  const directory = await statIfExists(runDirectory);
  const state = await statIfExists(path.join(runDirectory, 'state.json'));
  if (directory === null || state === null) {
    throw new Error(`run not found: ${runDirectory}`);
  }
}

async function readControlsIfExists(runDirectory: string): Promise<RunControlRequest[]> {
  let content: string;
  try {
    content = await readFile(path.join(runDirectory, 'controls.ndjson'), 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
    throw error;
  }
  return content
    .trimEnd()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RunControlRequest);
}

function runArtifactRefs(): Record<string, string> {
  return {
    state: 'state.json',
    metrics: 'metrics.live.json',
    events: 'events.ndjson',
    controls: 'controls.ndjson',
    summary: 'summary.json',
    rows: 'rows.json',
    budgets: 'budgets.json',
    transcripts: 'transcripts.json',
  };
}

async function inspectArtifacts(
  runDirectory: string,
): Promise<Array<{ kind: string; path: string; exists: boolean; sizeBytes: number | null }>> {
  return await Promise.all(
    Object.entries(runArtifactRefs()).map(async ([kind, relativePath]) => {
      const stats = await statIfExists(path.join(runDirectory, relativePath));
      return { kind, path: relativePath, exists: stats !== null, sizeBytes: stats?.size ?? null };
    }),
  );
}

async function inspectChildren(runDirectory: string): Promise<WorkflowRunInspectResult['children']> {
  const childrenDirectory = path.join(runDirectory, 'children');
  let entries: string[];
  try {
    entries = await readdir(childrenDirectory);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
    throw error;
  }
  const storyIds = new Set(
    entries.map((entry) => entry.replace(/(?:\.launch)?\.json$/, '')).filter((entry) => !entry.endsWith('.raw')),
  );
  return await Promise.all(
    [...storyIds].sort().map(async (storyId) => {
      const launchPath = path.join('children', `${storyId}.launch.json`);
      const resultPath = path.join('children', `${storyId}.json`);
      const [launch, result, launchStat, resultStat] = await Promise.all([
        readJsonIfExists(path.join(runDirectory, launchPath)),
        readJsonIfExists(path.join(runDirectory, resultPath)),
        statIfExists(path.join(runDirectory, launchPath)),
        statIfExists(path.join(runDirectory, resultPath)),
      ]);
      const source = isObject(result) ? result : isObject(launch) ? launch : {};
      return {
        storyId,
        launchPath: launchStat ? launchPath : null,
        resultPath: resultStat ? resultPath : null,
        sessionId: readOptionalString(source.sessionId),
        sessionLogPath: readOptionalString(source.sessionLogPath),
      };
    }),
  );
}

function collectPrRefs(values: unknown[]): { urls: string[]; numbers: number[] } {
  const urls = new Set<string>();
  const numbers = new Set<number>();
  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      const matches = value.match(/https:\/\/github\.com\/[^\s)]+\/pull\/\d+/g) ?? [];
      for (const match of matches) {
        urls.add(match);
        const number = Number(match.match(/\/pull\/(\d+)/)?.[1]);
        if (Number.isInteger(number)) numbers.add(number);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!isObject(value)) return;
    const prUrl = readOptionalString(value.prUrl);
    if (prUrl) urls.add(prUrl);
    const prNumber = typeof value.prNumber === 'number' ? value.prNumber : null;
    if (prNumber !== null) numbers.add(prNumber);
    for (const item of Object.values(value)) visit(item);
  };
  for (const value of values) visit(value);
  return { urls: [...urls].sort(), numbers: [...numbers].sort((a, b) => a - b) };
}

async function statIfExists(filePath: string): Promise<{ size: number } | null> {
  try {
    return await stat(filePath);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
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

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function appendNdjson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(value)}\n`);
}

async function appendRunEvent(runPath: string, type: string, fields: Record<string, unknown>): Promise<void> {
  const now = new Date().toISOString();
  await appendNdjson(path.join(runPath, 'events.ndjson'), {
    ...fields,
    recordedAt: now,
    eventAt: now,
    type,
  });
}

async function abortActiveChildren(
  runPath: string,
  activeStoryIds: string[],
  reason: string | null,
): Promise<RunControlChildOutcome[]> {
  const outcomes: RunControlChildOutcome[] = [];
  for (const storyId of activeStoryIds) {
    const launch = await readJsonIfExists(path.join(runPath, 'children', `${safeRunFileName(storyId)}.launch.json`));
    const sessionId = isObject(launch) ? readOptionalString(launch.sessionId) : null;
    if (!sessionId) {
      outcomes.push({
        storyId,
        sessionId: null,
        outcome: 'unsupported',
        detail: 'active child has no linked Codex session',
      });
      continue;
    }
    try {
      const result = await sendCodexInterrupt({ sessionId, storyId, runPath, reason: reason ?? undefined });
      outcomes.push({
        storyId,
        sessionId,
        outcome: 'requested',
        detail: `sent ${result.tool}`,
      });
    } catch (error) {
      outcomes.push({
        storyId,
        sessionId,
        outcome: 'unsupported',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return outcomes;
}

function controlOutcomeForChildren(
  hasActiveChildren: boolean,
  childOutcomes: RunControlChildOutcome[],
): RunControlResult['outcome'] {
  if (!hasActiveChildren) return 'applied';
  if (childOutcomes.length === 0) return 'requested';
  if (childOutcomes.every((entry) => entry.outcome === 'unsupported')) return 'unsupported';
  if (childOutcomes.every((entry) => entry.outcome === 'applied')) return 'applied';
  return 'requested';
}

function controlArtifactRefs(): RunControlResult['artifacts'] {
  return {
    controls: 'controls.ndjson',
    events: 'events.ndjson',
    state: 'state.json',
  };
}

function isTerminalRunStatus(status: string | null): boolean {
  return (
    status === 'aborted' ||
    status === 'blocked' ||
    status === 'complete' ||
    status === 'dry-run' ||
    status === 'supervision_lost'
  );
}

function safeRunFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

const meaningfulWatchEventTypes = new Set([
  'run-started',
  'control-requested',
  'control-applied',
  'run-aborted',
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
