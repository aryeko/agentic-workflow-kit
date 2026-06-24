import type {
  Result,
  RunEventEnvelope,
  RunReplay,
  RunReplayFailure,
  WaitRunEventsRequest,
  WaitRunEventsResult,
} from '../contracts/index.js';

export type ReplayRun = (runId: string) => Result<RunReplay, RunReplayFailure>;
export type CursorWaitClock = () => number;
export type CursorWaitSleep = (delayMs: number) => Promise<void>;

const DEFAULT_POLL_INTERVAL_MS = 25;

const sleep: CursorWaitSleep = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

const takeEventsAfterCursor = (
  events: RunEventEnvelope[],
  afterSequence: number,
  maxEvents?: number,
): RunEventEnvelope[] => {
  const nextEvents = events.filter((event) => event.sequence > afterSequence);
  if (maxEvents === undefined) {
    return nextEvents;
  }

  return nextEvents.slice(0, Math.max(maxEvents, 0));
};

const toDeliveredResult = (
  request: WaitRunEventsRequest,
  replay: RunReplay,
  events: RunEventEnvelope[],
): Result<WaitRunEventsResult, RunReplayFailure> => ({
  ok: true,
  value: {
    runId: request.runId,
    cursor: {
      runId: request.runId,
      afterSequence: events[events.length - 1].sequence,
    },
    events,
    timedOut: false,
    lastSequence: replay.lastSequence,
    health: replay.health,
    healthRecords: replay.healthRecords,
  },
});

const toTimedOutResult = (
  request: WaitRunEventsRequest,
  replay: RunReplay,
  afterSequence: number,
): Result<WaitRunEventsResult, RunReplayFailure> => ({
  ok: true,
  value: {
    runId: request.runId,
    cursor: {
      runId: request.runId,
      afterSequence,
    },
    events: [],
    timedOut: true,
    lastSequence: replay.lastSequence,
    health: replay.health,
    healthRecords: replay.healthRecords,
  },
});

export const waitRunEvents = async (
  request: WaitRunEventsRequest,
  replayRun: ReplayRun,
  now: CursorWaitClock,
  pause: CursorWaitSleep = sleep,
): Promise<Result<WaitRunEventsResult, RunReplayFailure>> => {
  const startedAt = now();
  const afterSequence = request.cursor.runId === request.runId ? request.cursor.afterSequence : 0;

  while (true) {
    const replayed = replayRun(request.runId);
    if (!replayed.ok) {
      return replayed;
    }

    const events = takeEventsAfterCursor(replayed.value.events, afterSequence, request.maxEvents);
    if (events.length > 0) {
      return toDeliveredResult(request, replayed.value, events);
    }

    if (now() - startedAt >= request.timeoutMs) {
      return toTimedOutResult(request, replayed.value, afterSequence);
    }

    const remainingMs = request.timeoutMs - (now() - startedAt);
    await pause(Math.max(0, Math.min(DEFAULT_POLL_INTERVAL_MS, remainingMs)));
  }
};
