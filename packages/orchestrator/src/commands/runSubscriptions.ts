import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, stat, unlink, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  appendRunEvent,
  assertRunExists,
  boundEventData,
  filterNormalizedEvents,
  isObject,
  normalizeRunEvent,
  readJsonIfExists,
  readOptionalString,
  readRunEvents,
  resolveRunDirectory,
} from './handlerRuntimeUtils.js';
import type { NormalizedRunEvent, WorkflowRunEventLevel, WorkflowRunEventTopic } from './handlerTypes.js';

const SUBSCRIPTION_SCHEMA_VERSION = 1;
const SUBSCRIPTION_DIR = 'subscriptions';
const CURSOR_PREFIX = 'events.ndjson:';
const DEFAULT_THROTTLE_MS = 0;
const DEFAULT_REPLAY_EVENTS = 20;
const DEFAULT_MAX_EVENTS = 200;
const MAX_ACTIVE_SUBSCRIPTIONS = 20;
const IDLE_SUBSCRIPTION_TTL_MS = 24 * 60 * 60 * 1000;

const TERMINAL_STATUSES = new Set(['complete', 'blocked', 'aborted', 'supervision_lost', 'dry-run']);
const LEVEL_RANK: Record<WorkflowRunEventLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export interface RunSubscriptionFilter {
  topics?: WorkflowRunEventTopic[];
  minLevel?: WorkflowRunEventLevel;
  storyIds?: string[];
  includeData?: 'none' | 'summary' | 'full-bounded';
}

export interface RunSubscriptionWakePolicy {
  minLevel?: WorkflowRunEventLevel;
  topics?: WorkflowRunEventTopic[];
  types?: string[];
}

export interface RunSubscriptionInput extends RunSubscriptionFilter {
  replay?: { lastEvents?: number };
  wakeOn?: RunSubscriptionWakePolicy;
  throttleMs?: number;
}

export interface WorkflowRunSubscribeInput {
  runId?: string;
  runPath?: string;
  cwd?: string;
  configPath?: string;
  subscription?: RunSubscriptionInput;
  now?: string;
}

export interface WorkflowRunSubscriptionPollInput {
  runId?: string;
  runPath?: string;
  cwd?: string;
  configPath?: string;
  subscriptionId: string;
  ackCursor?: string;
  max?: number;
  now?: string;
}

export interface WorkflowRunUnsubscribeInput {
  runId?: string;
  runPath?: string;
  cwd?: string;
  configPath?: string;
  subscriptionId: string;
  now?: string;
}

export interface WorkflowRunSubscribeResult {
  runId: string;
  subscriptionId: string;
  committedCursor: string;
  nextCursor: string;
  wakeArtifact: string;
  subscriptionArtifact: string;
  replay: NormalizedRunEvent[];
  terminal: boolean;
  status: RunSubscriptionRecord['status'];
  hostAdapter: {
    watch: string;
    poll: { mcpTool: 'workflow_run_subscription_poll'; args: { runId: string; subscriptionId: string } };
    close: { mcpTool: 'workflow_run_unsubscribe'; args: { runId: string; subscriptionId: string } };
  };
}

export interface WorkflowRunSubscriptionPollResult {
  subscriptionId: string;
  events: NormalizedRunEvent[];
  committedCursor: string;
  nextCursor: string;
  terminal: boolean;
  status: RunSubscriptionRecord['status'];
  eventsDelivered: number;
}

interface RunSubscriptionRecord {
  schemaVersion: 1;
  id: string;
  runId: string;
  filter: Required<Pick<RunSubscriptionFilter, 'includeData'>> & Omit<RunSubscriptionFilter, 'includeData'>;
  wakeOn: RunSubscriptionWakePolicy | null;
  throttleMs: number;
  committedCursor: string;
  createdAt: string;
  updatedAt: string;
  lastWakeAt: string | null;
  terminal: boolean;
  status: 'active' | 'complete' | 'blocked' | 'aborted' | 'supervision_lost' | 'dry-run' | 'closed';
}

export async function runSubscribeHandler(input: WorkflowRunSubscribeInput): Promise<WorkflowRunSubscribeResult> {
  const runDirectory = await resolveRunDirectory(input);
  const now = input.now ?? new Date().toISOString();
  await assertRunExists(runDirectory);
  const events = await readRunEvents(runDirectory);
  const state = await readJsonIfExists(path.join(runDirectory, 'state.json'));
  const runId = readRunId(state, runDirectory);
  const status = terminalStatus(state);
  await cleanupSubscriptions(runDirectory, now);
  const records = await readSubscriptionRecords(runDirectory);
  const activeCount = records.filter((record) => record.status === 'active' && !record.terminal).length;
  if (activeCount >= MAX_ACTIVE_SUBSCRIPTIONS) {
    throw new Error(`active subscription limit ${MAX_ACTIVE_SUBSCRIPTIONS} reached for run ${runId}`);
  }

  const subscription = input.subscription ?? {};
  const filter = normalizeFilter(subscription);
  const subscriptionId = `sub_${randomUUID()}`;
  const cursor = formatCursor(0);
  const nextCursor = formatCursor(events.length);
  const record: RunSubscriptionRecord = {
    schemaVersion: SUBSCRIPTION_SCHEMA_VERSION,
    id: subscriptionId,
    runId,
    filter,
    wakeOn: normalizeWakePolicy(subscription.wakeOn),
    throttleMs: positiveInteger(subscription.throttleMs, DEFAULT_THROTTLE_MS),
    committedCursor: cursor,
    createdAt: now,
    updatedAt: now,
    lastWakeAt: null,
    terminal: status !== null,
    status: status ?? 'active',
  };
  await writeSubscriptionRecord(runDirectory, record);
  await writeWakeSignal(runDirectory, record, status !== null ? 'terminal' : 'events-available', nextCursor, now);

  return {
    runId,
    subscriptionId,
    committedCursor: cursor,
    nextCursor,
    wakeArtifact: wakeArtifact(subscriptionId),
    subscriptionArtifact: subscriptionArtifact(subscriptionId),
    replay: replayEvents(events, filter, subscription.replay?.lastEvents),
    terminal: status !== null,
    status: record.status,
    hostAdapter: {
      watch: wakeArtifact(subscriptionId),
      poll: { mcpTool: 'workflow_run_subscription_poll', args: { runId, subscriptionId } },
      close: { mcpTool: 'workflow_run_unsubscribe', args: { runId, subscriptionId } },
    },
  };
}

export async function runSubscriptionPollHandler(
  input: WorkflowRunSubscriptionPollInput,
): Promise<WorkflowRunSubscriptionPollResult> {
  const runDirectory = await resolveRunDirectory(input);
  const now = input.now ?? new Date().toISOString();
  let record = await readSubscriptionRecord(runDirectory, input.subscriptionId);
  const events = await readRunEvents(runDirectory);
  const eventCount = events.length;
  const committedIndex = parseCursor(record.committedCursor, 'committedCursor');
  let nextCommittedIndex = committedIndex;
  if (input.ackCursor !== undefined) {
    const ackIndex = parseCursor(input.ackCursor, 'ackCursor');
    if (ackIndex > eventCount) throw new Error(`ackCursor ${input.ackCursor} is beyond event log length ${eventCount}`);
    nextCommittedIndex = Math.max(committedIndex, ackIndex);
  }

  const state = await readJsonIfExists(path.join(runDirectory, 'state.json'));
  const terminal = terminalStatus(state);
  record = {
    ...record,
    committedCursor: formatCursor(nextCommittedIndex),
    updatedAt: now,
    ...(terminal !== null ? { terminal: true, status: terminal } : {}),
  };
  await writeSubscriptionRecord(runDirectory, record);

  const max = positiveInteger(input.max, DEFAULT_MAX_EVENTS);
  const page = subscriptionEventPage(events, nextCommittedIndex, record.filter, max);
  return {
    subscriptionId: record.id,
    events: page.events,
    committedCursor: record.committedCursor,
    nextCursor: page.nextCursor,
    terminal: record.terminal,
    status: record.status,
    eventsDelivered: page.events.length,
  };
}

export async function runUnsubscribeHandler(
  input: WorkflowRunUnsubscribeInput,
): Promise<{ subscriptionId: string; closed: true }> {
  const runDirectory = await resolveRunDirectory(input);
  const now = input.now ?? new Date().toISOString();
  const record = await readSubscriptionRecord(runDirectory, input.subscriptionId);
  await writeSubscriptionRecord(runDirectory, {
    ...record,
    terminal: true,
    status: 'closed',
    updatedAt: now,
  });
  await removeIfExists(path.join(runDirectory, wakeArtifact(input.subscriptionId)));
  return { subscriptionId: input.subscriptionId, closed: true };
}

export async function notifyRunSubscriptions(runPath: string, options: { now?: string } = {}): Promise<void> {
  const runDirectory = path.resolve(runPath);
  const now = options.now ?? new Date().toISOString();
  await cleanupSubscriptions(runDirectory, now);
  const records = await readSubscriptionRecords(runDirectory);
  if (records.length === 0) return;
  const events = await readRunEvents(runDirectory);
  const state = await readJsonIfExists(path.join(runDirectory, 'state.json'));
  const terminal = terminalStatus(state) ?? terminalStatusFromEvents(events);
  const cursorAtWake = formatCursor(events.length);
  for (const record of records) {
    if (record.status !== 'active') continue;
    const updated = terminal !== null ? { ...record, terminal: true, status: terminal } : record;
    const shouldWake =
      terminal !== null ||
      matchingEventsAfterCommitted(events, updated).some((event) => shouldWakeForEvent(updated, event));
    if (!shouldWake) {
      if (updated !== record) await writeSubscriptionRecord(runDirectory, { ...updated, updatedAt: now });
      continue;
    }
    const reason = terminal !== null ? 'terminal' : 'events-available';
    if (reason !== 'terminal' && !canWake(updated, now)) continue;
    const woken = {
      ...updated,
      lastWakeAt: now,
      updatedAt: now,
    };
    await writeSubscriptionRecord(runDirectory, woken);
    await writeWakeSignal(runDirectory, woken, reason, cursorAtWake, now);
  }
}

export async function appendRunEventAndNotify(
  runPath: string,
  type: string,
  fields: Record<string, unknown>,
): Promise<void> {
  await appendRunEvent(runPath, type, fields);
  await notifyRunSubscriptions(runPath);
}

function replayEvents(
  rawEvents: unknown[],
  filter: RunSubscriptionRecord['filter'],
  lastEvents: number | undefined,
): NormalizedRunEvent[] {
  if (lastEvents === 0) return [];
  const limit = positiveInteger(lastEvents, DEFAULT_REPLAY_EVENTS);
  return filterNormalizedEvents(
    rawEvents.map((event, index) => normalizeRunEvent(event, index)),
    { ...eventQuery(filter), limit },
    filter.includeData,
  );
}

function matchingEventsAfterCommitted(rawEvents: unknown[], record: RunSubscriptionRecord): NormalizedRunEvent[] {
  const committed = parseCursor(record.committedCursor, 'committedCursor');
  return rawEvents
    .slice(committed)
    .map((event, index) => normalizeRunEvent(event, committed + index))
    .filter((event) => eventMatchesFilter(event, record.filter))
    .map((event) => boundEventData(event, record.filter.includeData));
}

function subscriptionEventPage(
  rawEvents: unknown[],
  committedIndex: number,
  filter: RunSubscriptionRecord['filter'],
  max: number,
): { events: NormalizedRunEvent[]; nextCursor: string } {
  const delivered: Array<{ event: NormalizedRunEvent; cursorAfter: number }> = [];
  let scannedCursor = committedIndex;
  for (let index = committedIndex; index < rawEvents.length; index += 1) {
    scannedCursor = index + 1;
    const event = normalizeRunEvent(rawEvents[index], index);
    if (!eventMatchesFilter(event, filter)) continue;
    delivered.push({ event: boundEventData(event, filter.includeData), cursorAfter: scannedCursor });
    if (delivered.length >= max) break;
  }
  const lastDelivered = delivered.at(-1);
  const nextCursor =
    lastDelivered === undefined || delivered.length < max
      ? formatCursor(rawEvents.length)
      : formatCursor(lastDelivered.cursorAfter);
  return { events: delivered.map(({ event }) => event), nextCursor };
}

function eventMatchesFilter(event: NormalizedRunEvent, filter: RunSubscriptionRecord['filter']): boolean {
  if (filter.topics && !filter.topics.includes(event.topic)) return false;
  if (filter.storyIds && event.storyId !== null && !filter.storyIds.includes(event.storyId)) return false;
  return LEVEL_RANK[event.level] >= LEVEL_RANK[filter.minLevel ?? 'debug'];
}

function shouldWakeForEvent(record: RunSubscriptionRecord, event: NormalizedRunEvent): boolean {
  if (!record.wakeOn) return true;
  if (record.wakeOn.minLevel && LEVEL_RANK[event.level] >= LEVEL_RANK[record.wakeOn.minLevel]) return true;
  if (record.wakeOn.topics?.includes(event.topic)) return true;
  if (record.wakeOn.types?.includes(event.type)) return true;
  return false;
}

function canWake(record: RunSubscriptionRecord, now: string): boolean {
  if (record.lastWakeAt === null) return true;
  return Date.parse(now) - Date.parse(record.lastWakeAt) >= record.throttleMs;
}

async function cleanupSubscriptions(runDirectory: string, now: string): Promise<void> {
  const records = await readSubscriptionRecords(runDirectory);
  const nowMs = Date.parse(now);
  await Promise.all(
    records.map(async (record) => {
      if (record.status !== 'active' || record.terminal) return;
      const idleAt = Date.parse(record.lastWakeAt ?? record.updatedAt ?? record.createdAt);
      if (Number.isFinite(idleAt) && nowMs - idleAt > IDLE_SUBSCRIPTION_TTL_MS) {
        await removeIfExists(path.join(runDirectory, subscriptionArtifact(record.id)));
        await removeIfExists(path.join(runDirectory, wakeArtifact(record.id)));
      }
    }),
  );
}

async function readSubscriptionRecords(runDirectory: string): Promise<RunSubscriptionRecord[]> {
  const directory = path.join(runDirectory, SUBSCRIPTION_DIR);
  let entries: string[];
  try {
    entries = await readdir(directory);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
    throw error;
  }
  const records = await Promise.all(
    entries
      .filter((entry) => entry.endsWith('.json'))
      .map((entry) => readSubscriptionRecordFile(path.join(directory, entry))),
  );
  return records.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

async function readSubscriptionRecord(runDirectory: string, subscriptionId: string): Promise<RunSubscriptionRecord> {
  return await readSubscriptionRecordFile(path.join(runDirectory, subscriptionArtifact(subscriptionId)));
}

async function readSubscriptionRecordFile(filePath: string): Promise<RunSubscriptionRecord> {
  const parsed = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
  if (!isObject(parsed)) throw new Error(`Malformed subscription artifact ${filePath}`);
  if (parsed.schemaVersion !== SUBSCRIPTION_SCHEMA_VERSION) {
    throw new Error(`Unsupported subscription artifact schemaVersion ${String(parsed.schemaVersion)}`);
  }
  if (typeof parsed.id !== 'string') throw new Error(`Malformed subscription artifact ${filePath}: missing id`);
  return parsed as unknown as RunSubscriptionRecord;
}

async function writeSubscriptionRecord(runDirectory: string, record: RunSubscriptionRecord): Promise<void> {
  const filePath = path.join(runDirectory, subscriptionArtifact(record.id));
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(record, null, 2)}\n`);
}

async function writeWakeSignal(
  runDirectory: string,
  record: RunSubscriptionRecord,
  reason: 'events-available' | 'terminal',
  cursorAtWake: string,
  wokeAt: string,
): Promise<void> {
  const filePath = path.join(runDirectory, wakeArtifact(record.id));
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    `${JSON.stringify({ subscriptionId: record.id, runId: record.runId, wokeAt, reason, cursorAtWake }, null, 2)}\n`,
  );
  const oldMtime = await stat(filePath).then(
    (file) => file.mtimeMs,
    () => 0,
  );
  const mtime = new Date(Math.max(Date.parse(wokeAt), oldMtime + 1));
  await utimes(filePath, mtime, mtime);
}

function normalizeFilter(input: RunSubscriptionInput): RunSubscriptionRecord['filter'] {
  return {
    ...(input.topics !== undefined ? { topics: input.topics } : {}),
    ...(input.minLevel !== undefined ? { minLevel: input.minLevel } : {}),
    ...(input.storyIds !== undefined ? { storyIds: input.storyIds } : {}),
    includeData: input.includeData ?? 'summary',
  };
}

function normalizeWakePolicy(input: RunSubscriptionWakePolicy | undefined): RunSubscriptionWakePolicy | null {
  if (!input) return null;
  return {
    ...(input.minLevel !== undefined ? { minLevel: input.minLevel } : {}),
    ...(input.topics !== undefined ? { topics: input.topics } : {}),
    ...(input.types !== undefined ? { types: input.types } : {}),
  };
}

function eventQuery(filter: RunSubscriptionRecord['filter']) {
  return {
    ...(filter.topics !== undefined ? { topics: filter.topics } : {}),
    ...(filter.minLevel !== undefined ? { minLevel: filter.minLevel } : {}),
    ...(filter.storyIds !== undefined ? { storyIds: filter.storyIds } : {}),
  };
}

function terminalStatus(state: unknown): RunSubscriptionRecord['status'] | null {
  if (!isObject(state)) return null;
  const status = readOptionalString(state.status);
  return status && TERMINAL_STATUSES.has(status) ? (status as RunSubscriptionRecord['status']) : null;
}

function terminalStatusFromEvents(rawEvents: unknown[]): RunSubscriptionRecord['status'] | null {
  for (let index = rawEvents.length - 1; index >= 0; index -= 1) {
    const event = rawEvents[index];
    if (!isObject(event)) continue;
    const type = readOptionalString(event.type);
    if (type === 'run-complete') return 'complete';
    if (type === 'run-blocked') return 'blocked';
    if (type === 'run-aborted') return 'aborted';
    if (type === 'run-supervision-lost') return 'supervision_lost';
  }
  return null;
}

function readRunId(state: unknown, runDirectory: string): string {
  return (isObject(state) ? readOptionalString(state.runId) : null) ?? path.basename(runDirectory);
}

function formatCursor(lineCount: number): string {
  return `${CURSOR_PREFIX}${lineCount}`;
}

function parseCursor(cursor: string, name: string): number {
  if (!cursor.startsWith(CURSOR_PREFIX)) throw new Error(`${name} must use ${CURSOR_PREFIX}<lineCount> format`);
  const raw = cursor.slice(CURSOR_PREFIX.length);
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${name} must use a non-negative line count`);
  return parsed;
}

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback;
}

function subscriptionArtifact(subscriptionId: string): string {
  return path.join(SUBSCRIPTION_DIR, `${subscriptionId}.json`);
}

function wakeArtifact(subscriptionId: string): string {
  return path.join(SUBSCRIPTION_DIR, `${subscriptionId}.wake`);
}

async function removeIfExists(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return;
    throw error;
  }
}
