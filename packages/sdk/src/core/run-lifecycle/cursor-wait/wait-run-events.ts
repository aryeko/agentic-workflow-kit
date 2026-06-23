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
      runId: request.cursor.runId,
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
): Result<WaitRunEventsResult, RunReplayFailure> => ({
  ok: true,
  value: {
    runId: request.runId,
    cursor: {
      runId: request.cursor.runId,
      afterSequence: request.cursor.afterSequence,
    },
    events: [],
    timedOut: true,
    lastSequence: replay.lastSequence,
    health: replay.health,
    healthRecords: replay.healthRecords,
  },
});

export const waitRunEvents = (
  request: WaitRunEventsRequest,
  replayRun: ReplayRun,
  now: CursorWaitClock,
): Result<WaitRunEventsResult, RunReplayFailure> => {
  const startedAt = now();

  while (true) {
    const replayed = replayRun(request.runId);
    if (!replayed.ok) {
      return replayed;
    }

    const events = takeEventsAfterCursor(replayed.value.events, request.cursor.afterSequence, request.maxEvents);
    if (events.length > 0) {
      return toDeliveredResult(request, replayed.value, events);
    }

    if (now() - startedAt >= request.timeoutMs) {
      return toTimedOutResult(request, replayed.value);
    }
  }
};
