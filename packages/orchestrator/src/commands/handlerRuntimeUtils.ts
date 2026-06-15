import { appendFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveInvocationCwd } from '../cli/args.js';
import { loadResolvedConfig, resolveCwdOnlyConfig } from '../config/configLoader.js';
import { createStoryRunner, discoverSessionLogsForDriver } from '../drivers/registry.js';
import type { StoryRunner } from '../drivers/StoryRunner.js';
import type {
  CliOverrides,
  LiveMetricsSnapshot,
  RunControlChildOutcome,
  RunControlRequest,
  RunControlResult,
  TokenTotals,
} from '../types.js';
import type {
  NormalizedRunEvent,
  WatchRunSnapshot,
  WatchRunSummary,
  WatchStorySummary,
  WorkflowRunEventLevel,
  WorkflowRunEventQuery,
  WorkflowRunEventTopic,
  WorkflowRunInspectResult,
  WorkflowRunStreamSubscription,
} from './handlerTypes.js';
import { DEFAULT_WATCH_OPTIONS, type WatchOptions } from './handlerTypes.js';

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function booleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function positiveIntegerOrDefault(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}

export async function readRunSnapshot(runDirectory: string): Promise<WatchRunSnapshot> {
  const [state, metrics] = await Promise.all([
    readJsonIfExists(path.join(runDirectory, 'state.json')),
    readJsonIfExists(path.join(runDirectory, 'metrics.live.json')),
  ]);
  return { state, metrics, summary: buildWatchRunSummary(state, metrics) };
}

export function isRunningState(state: unknown): boolean {
  if (typeof state !== 'object' || state === null || Array.isArray(state)) return false;
  const status = (state as { status?: unknown }).status;
  return status === 'running' || status === 'aborting';
}

export async function resolveWatchOptions(runDirectory: string, overrides: CliOverrides): Promise<WatchOptions> {
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

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function countRunEvents(runDirectory: string): Promise<number> {
  return (await readRunEvents(runDirectory)).length;
}

export async function readRunEvents(runDirectory: string): Promise<unknown[]> {
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

export async function readNormalizedEvents(
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

export function filterNormalizedEvents(
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

export function normalizeRunEvent(value: unknown, index: number): NormalizedRunEvent {
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

export function topicForEvent(type: string): WorkflowRunEventTopic {
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

export function levelForEvent(type: string, event: Record<string, unknown>): WorkflowRunEventLevel {
  const explicit = readOptionalString(event.level);
  if (explicit === 'debug' || explicit === 'info' || explicit === 'warn' || explicit === 'error') return explicit;
  const normalized = type.toLowerCase();
  if (normalized.includes('error') || normalized.includes('failed') || normalized.includes('blocked')) return 'error';
  if (normalized.includes('warning') || normalized.includes('warn') || normalized.includes('downgraded')) return 'warn';
  if (normalized.includes('debug')) return 'debug';
  return 'info';
}

export function levelRank(level: WorkflowRunEventLevel): number {
  return { debug: 0, info: 1, warn: 2, error: 3 }[level];
}

export function boundEventData(
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

export function boundedLimit(limit: unknown): number {
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1) return 25;
  return Math.min(limit, 200);
}

export async function resolveRunDirectory(input: {
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

export async function resolveSessionRoots(input: CliOverrides, runPath: string): Promise<string[] | undefined> {
  if (input.sessionRoot) return [path.resolve(resolveInvocationCwd(input), input.sessionRoot)];
  const workspaceRoot = await workspaceRootForRunPath(runPath);
  return await discoverSessionLogsForDriver(resolveCwdOnlyConfig(workspaceRoot));
}

export async function workspaceRootForRunPath(runPath: string): Promise<string> {
  const runJson = await readJsonIfExists(path.join(runPath, 'run.json'));
  const workspaceRoot = isObject(runJson) ? readOptionalString(runJson.workspaceRoot) : null;
  if (workspaceRoot) return workspaceRoot;
  const marker = `${path.sep}.codex${path.sep}agentic-workflow-kit${path.sep}runs${path.sep}`;
  const index = runPath.indexOf(marker);
  if (index > 0) return runPath.slice(0, index);
  return process.cwd();
}

export async function assertRunExists(runDirectory: string): Promise<void> {
  const directory = await statIfExists(runDirectory);
  const state = await statIfExists(path.join(runDirectory, 'state.json'));
  if (directory === null || state === null) {
    throw new Error(`run not found: ${runDirectory}`);
  }
}

export async function readControlsIfExists(runDirectory: string): Promise<RunControlRequest[]> {
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
    .flatMap((line) => {
      const parsed = parseJsonObject(line);
      return isRunControlRequest(parsed) ? [parsed] : [];
    });
}

export function runArtifactRefs(): Record<string, string> {
  return {
    state: 'state.json',
    metrics: 'metrics.live.json',
    events: 'events.ndjson',
    controls: 'controls.ndjson',
    summary: 'summary.json',
    rows: 'rows.json',
    budgets: 'budgets.json',
    transcripts: 'transcripts.json',
    analysis: 'analysis.json',
    report: 'report.md',
  };
}

export async function inspectArtifacts(
  runDirectory: string,
): Promise<Array<{ kind: string; path: string; exists: boolean; sizeBytes: number | null }>> {
  return await Promise.all(
    Object.entries(runArtifactRefs()).map(async ([kind, relativePath]) => {
      const stats = await statIfExists(path.join(runDirectory, relativePath));
      return { kind, path: relativePath, exists: stats !== null, sizeBytes: stats?.size ?? null };
    }),
  );
}

export async function inspectChildren(runDirectory: string): Promise<WorkflowRunInspectResult['children']> {
  const childrenDirectory = path.join(runDirectory, 'children');
  let entries: string[];
  try {
    entries = await readdir(childrenDirectory);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
    throw error;
  }
  const storyIds = new Set(
    entries
      .filter((entry) => !entry.endsWith('.raw.json') && !entry.endsWith('.metrics.json'))
      .map((entry) => entry.replace(/(?:\.launch)?\.json$/, '')),
  );
  return await Promise.all(
    [...storyIds].sort().map(async (storyId) => {
      const launchPath = path.join('children', `${storyId}.launch.json`);
      const resultPath = path.join('children', `${storyId}.json`);
      const [launch, result, launchStat, resultStat] = await Promise.all([
        readTolerantJsonIfExists(path.join(runDirectory, launchPath)),
        readTolerantJsonIfExists(path.join(runDirectory, resultPath)),
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

export async function readChildArtifacts(runDirectory: string): Promise<unknown[]> {
  const childrenDirectory = path.join(runDirectory, 'children');
  let entries: string[];
  try {
    entries = await readdir(childrenDirectory);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
    throw error;
  }
  return await Promise.all(
    entries
      .filter((entry) => entry.endsWith('.json') && !entry.endsWith('.raw.json') && !entry.endsWith('.metrics.json'))
      .map((entry) => readTolerantJsonIfExists(path.join(childrenDirectory, entry))),
  );
}

export function collectPrRefs(values: unknown[]): { urls: string[]; numbers: number[] } {
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

export async function statIfExists(filePath: string): Promise<{ size: number } | null> {
  try {
    return await stat(filePath);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

export function boundedEventOffset(offset: number, eventCount: number): number {
  if (!Number.isInteger(offset) || offset < 0) return 0;
  return Math.min(offset, eventCount);
}

export async function readJsonIfExists(filePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function readTolerantJsonIfExists(filePath: string): Promise<unknown | null> {
  try {
    return await readJsonIfExists(filePath);
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function writeTextFile(filePath: string, value: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, value);
}

export async function appendNdjson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(value)}\n`);
}

export async function appendRunEvent(runPath: string, type: string, fields: Record<string, unknown>): Promise<void> {
  const now = new Date().toISOString();
  await appendNdjson(path.join(runPath, 'events.ndjson'), {
    ...fields,
    recordedAt: now,
    eventAt: now,
    type,
  });
}

export async function abortActiveChildren(
  runPath: string,
  activeStoryIds: string[],
  reason: string | null,
  controlRunner: StoryRunner,
): Promise<RunControlChildOutcome[]> {
  const outcomes: RunControlChildOutcome[] = [];
  for (const storyId of activeStoryIds) {
    const launch = await readTolerantJsonIfExists(
      path.join(runPath, 'children', `${safeRunFileName(storyId)}.launch.json`),
    );
    const sessionId = isObject(launch) ? readOptionalString(launch.sessionId) : null;
    if (!sessionId) {
      outcomes.push({
        storyId,
        sessionId: null,
        outcome: 'unsupported',
        detail: 'active child has no linked child session',
      });
      continue;
    }
    try {
      const request = { kind: 'interrupt' as const, sessionId, storyId, runPath, reason: reason ?? undefined };
      const result = controlRunner.abort
        ? await controlRunner.abort(request)
        : await controlRunner.controlChild?.(request);
      if (!result) throw new Error('configured child driver does not support interrupt control');
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

export async function controlRunnerForRunPath(runPath: string): Promise<StoryRunner> {
  const workspaceRoot = await workspaceRootForRunPath(runPath);
  return createStoryRunner(resolveCwdOnlyConfig(workspaceRoot));
}

export function controlOutcomeForChildren(
  hasActiveChildren: boolean,
  childOutcomes: RunControlChildOutcome[],
): RunControlResult['outcome'] {
  if (!hasActiveChildren) return 'applied';
  if (childOutcomes.length === 0) return 'requested';
  if (childOutcomes.every((entry) => entry.outcome === 'unsupported')) return 'unsupported';
  if (childOutcomes.every((entry) => entry.outcome === 'applied')) return 'applied';
  return 'requested';
}

export function controlArtifactRefs(): RunControlResult['artifacts'] {
  return {
    controls: 'controls.ndjson',
    events: 'events.ndjson',
    state: 'state.json',
  };
}

export function parseJsonObject(line: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(line) as unknown;
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function isRunControlRequest(value: unknown): value is RunControlRequest {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.runId === 'string' &&
    record.action === 'abort' &&
    (typeof record.storyId === 'string' || record.storyId === null) &&
    (typeof record.reason === 'string' || record.reason === null) &&
    typeof record.requestedAt === 'string' &&
    typeof record.requestedBy === 'string'
  );
}

export function isTerminalRunStatus(status: string | null): boolean {
  return (
    status === 'aborted' ||
    status === 'blocked' ||
    status === 'complete' ||
    status === 'dry-run' ||
    status === 'supervision_lost'
  );
}

export function safeRunFileName(value: string): string {
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

export function isMeaningfulWatchEvent(type: unknown): boolean {
  return typeof type === 'string' && meaningfulWatchEventTypes.has(type);
}

export function buildWatchRunSummary(state: unknown | null, metrics: unknown | null): WatchRunSummary {
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

export function buildWatchStorySummary(input: {
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

export function watchStoryStatus(input: {
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

export function readRecordMap(value: unknown): Record<string, Record<string, unknown>> {
  if (!isObject(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, Record<string, unknown>] => isObject(entry[1])),
  );
}

export function readAggregate(value: unknown): LiveMetricsSnapshot['aggregate'] | null {
  if (!isObject(value)) return null;
  return {
    toolCounts: readNumberMap(value.toolCounts),
    subagentCounts: readNumberMap(value.subagentCounts),
    tokenTotals: readTokenTotals(value.tokenTotals),
  };
}

export function readTokenTotals(value: unknown): TokenTotals | null {
  if (!isObject(value)) return null;
  return {
    inputTokens: readOptionalNumber(value.inputTokens) ?? 0,
    cachedInputTokens: readOptionalNumber(value.cachedInputTokens) ?? 0,
    outputTokens: readOptionalNumber(value.outputTokens) ?? 0,
    reasoningOutputTokens: readOptionalNumber(value.reasoningOutputTokens) ?? 0,
    totalTokens: readOptionalNumber(value.totalTokens) ?? 0,
  };
}

export function readNumberMap(value: unknown): Record<string, number> {
  if (!isObject(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
  );
}

export function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

export function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function readOptionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function readOptionalBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}
