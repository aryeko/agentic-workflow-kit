import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'tinyglobby';
import { FileArtifactStore } from '../artifacts/FileArtifactStore.js';
import { resolveInvocationCwd } from '../cli/args.js';
import { SystemClock } from '../clock/SystemClock.js';
import { GhCollaborationInspector } from '../collaboration/CollaborationInspector.js';
import { createRunId, loadResolvedConfig, resolveCwdOnlyConfig } from '../config/configLoader.js';
import { createStoryRunner } from '../drivers/registry.js';
import { RealGitInspector } from '../git/GitInspector.js';
import { ConsoleLogger } from '../logging/ConsoleLogger.js';
import { WorkflowRunner } from '../runner/WorkflowRunner.js';
import { selectDispatchableStories } from '../scheduler/scheduler.js';
import {
  discoverMarkdownTracks,
  EmptyStorySource,
  MarkdownTrackStorySource,
  migrateMarkdownTracker,
  validateTrackerMarkdown,
} from '../tracks/markdownTracker.js';
import type {
  CliOverrides,
  ResolvedWorkflowConfig,
  RunControlChildOutcome,
  RunControlRequest,
  RunControlResult,
  RunState,
  StorySource,
  WorkflowStory,
  WorkflowTrack,
} from '../types.js';

import type {
  AbortRunInput,
  CommandHandlerOptions,
  NormalizedRunEvent,
  PollWatchRunResult,
  RunCommand,
  StartWatchRunResult,
  StoriesResult,
  TrackerMigrateInput,
  TrackerMigrateResult,
  TrackerValidateResult,
  TracksResult,
  WatchRunCursor,
  WatchRunSnapshot,
  WorkflowRunInspectInput,
  WorkflowRunInspectResult,
  WorkflowRunStatusInput,
  WorkflowRunStatusResult,
  WorkflowRunStreamInput,
  WorkflowRunStreamResult,
} from './handlerTypes.js';

export type * from './handlerTypes.js';
export { analyzeRunHandler, runExportHandler, runReportHandler } from './runReports.js';

import {
  abortActiveChildren,
  appendNdjson,
  appendRunEvent,
  assertRunExists,
  boundedEventOffset,
  boundedLimit,
  collectPrRefs,
  controlArtifactRefs,
  controlOutcomeForChildren,
  controlRunnerForRunPath,
  countRunEvents,
  delay,
  filterNormalizedEvents,
  inspectArtifacts,
  inspectChildren,
  isMeaningfulWatchEvent,
  isObject,
  isRunningState,
  isTerminalRunStatus,
  normalizeRunEvent,
  parseJsonObject,
  positiveIntegerOrDefault,
  readChildArtifacts,
  readControlsIfExists,
  readJsonIfExists,
  readNormalizedEvents,
  readOptionalString,
  readRunEvents,
  readRunSnapshot,
  readStringArray,
  resolveRunDirectory,
  resolveWatchOptions,
  runArtifactRefs,
} from './handlerRuntimeUtils.js';

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

  const childOutcomes = await abortActiveChildren(
    runPath,
    activeStoryIds,
    request.reason,
    input.controlRunner ?? (await controlRunnerForRunPath(runPath)),
  );
  const hasActiveChildren = activeStoryIds.length > 0;
  const appliedAt = new Date().toISOString();
  const outcome = controlOutcomeForChildren(hasActiveChildren, childOutcomes);
  await appendRunEvent(runPath, 'control-applied', {
    controlId: request.id,
    action: request.action,
    outcome,
    childOutcomes,
  });
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
  const [state, metrics, artifacts, children, childArtifacts, events] = await Promise.all([
    readJsonIfExists(path.join(runDirectory, 'state.json')),
    readJsonIfExists(path.join(runDirectory, 'metrics.live.json')),
    inspectArtifacts(runDirectory),
    inspectChildren(runDirectory),
    readChildArtifacts(runDirectory),
    readRunEvents(runDirectory),
  ]);
  const stateObject = isObject(state) ? state : {};
  const pr = collectPrRefs([...events, ...childArtifacts]);
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

export async function mcpCheckHandler(
  overrides: CliOverrides = {},
  options: CommandHandlerOptions = {},
): Promise<{ ok: boolean; tools: string[] }> {
  const cwd = resolveInvocationCwd(overrides);
  const storyRunner = createStoryRunner(resolveCwdOnlyConfig(cwd), {
    ...(options.createCodexMcpClient ? { createCodexMcpClient: options.createCodexMcpClient } : {}),
  });
  return await storyRunner.checkTools();
}

export async function runWorkflowHandler(command: RunCommand, options: CommandHandlerOptions = {}): Promise<RunState> {
  const logger = options.logger ?? new ConsoleLogger();
  const stdout = options.stdout ?? console.log;
  const cwd = resolveInvocationCwd(command.overrides);
  const config = await loadResolvedConfig(command.overrides, cwd);
  const runId = createRunId();
  const runDirectory = path.join(config.artifacts.runsDirAbs, runId);
  if (command.overrides.dryRun !== true && command.overrides.confirmNonDryRun !== true) {
    const now = new Date().toISOString();
    return {
      runId,
      command: command.kind,
      workspaceRoot: config.workspace.rootAbs,
      artifactDir: runDirectory,
      status: 'blocked',
      maxParallel: command.overrides.maxParallel ?? config.orchestrator.maxParallel,
      startedAt: now,
      completedAt: now,
      active: [],
      completed: [],
      blockedStoryId: null,
      blockedReason: 'approval_required: set confirmNonDryRun/--yes to launch non-dry-run child sessions',
    };
  }
  const tracks = await discoverTracks(config, command.overrides);
  await assertTracksValidForDispatch(config, command.overrides, tracks);
  const storySource =
    command.kind === 'run-story'
      ? selectStorySourceForStory(config, tracks, command.storyId, command.overrides)
      : selectStorySourceForRunEligible(config, tracks, command.overrides);
  const workflowRunner = new WorkflowRunner({
    command: command.kind,
    config,
    storySource,
    storyRunner: createStoryRunner(config, {
      ...(options.createCodexMcpClient ? { createCodexMcpClient: options.createCodexMcpClient } : {}),
    }),
    gitInspector: new RealGitInspector(),
    collaborationInspector: new GhCollaborationInspector(),
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
    const event = parseJsonObject(line);
    if (!event) continue;
    if (overrides.json) {
      stdout(line);
    } else {
      if (!isMeaningfulWatchEvent(event.type)) continue;
      const story = typeof event.storyId === 'string' ? ` ${event.storyId}` : '';
      const status = typeof event.status === 'string' ? ` ${event.status}` : '';
      stdout(`${String(event.ts ?? '')} ${String(event.type ?? 'event')}${story}${status}`.trim());
    }
  }
  return lines.length;
}
