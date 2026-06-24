import type {
  RunEventEnvelope,
  RunLifecycleTransitionPayload,
  RunMetricsProjection,
  RunReplay,
} from '../contracts/index.js';

const RECOVERY_REENTRY_TRANSITIONS = new Set([
  'runner-verifying->running',
  'forge-waiting->runner-verifying',
  'merge-waiting->forge-waiting',
  'settling->merge-waiting',
]);

function isLifecycleTransitionPayload(value: unknown): value is RunLifecycleTransitionPayload {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'from' in value &&
      'to' in value &&
      'authority' in value &&
      'sourceEventIds' in value,
  );
}

function isLifecycleTransitionEvent(event: RunEventEnvelope): event is RunEventEnvelope<RunLifecycleTransitionPayload> {
  return event.type === 'RunLifecycleTransitioned' && isLifecycleTransitionPayload(event.payload);
}

function countRetries(events: readonly RunEventEnvelope[]): number {
  return events.reduce((count, event) => {
    if (!isLifecycleTransitionEvent(event) || event.payload.authority !== 'recovery') {
      return count;
    }

    const transitionKey = `${event.payload.from ?? 'null'}->${event.payload.to}`;
    return count + Number(RECOVERY_REENTRY_TRANSITIONS.has(transitionKey));
  }, 0);
}

function toEpochMs(value: string): number | undefined {
  const epochMs = Date.parse(value);
  return Number.isFinite(epochMs) ? epochMs : undefined;
}

function calculateParkedMs(events: readonly RunEventEnvelope[]): number {
  let parkedStartedAt: string | undefined;
  let total = 0;

  for (const event of events) {
    if (!isLifecycleTransitionEvent(event)) {
      continue;
    }

    if (event.payload.from === 'running' && event.payload.to === 'parked') {
      parkedStartedAt = event.occurredAt;
      continue;
    }

    if (event.payload.from === 'parked' && event.payload.to === 'running' && parkedStartedAt) {
      const parkedStart = toEpochMs(parkedStartedAt);
      const parkedEnd = toEpochMs(event.occurredAt);
      if (parkedStart !== undefined && parkedEnd !== undefined) {
        total += Math.max(0, parkedEnd - parkedStart);
      }
      parkedStartedAt = undefined;
    }
  }

  return total;
}

function findRecordedAtBoundary(events: readonly RunEventEnvelope[], direction: 'first' | 'last'): string | undefined {
  let boundary: string | undefined;

  for (const event of events) {
    if (boundary === undefined) {
      boundary = event.recordedAt;
      continue;
    }

    const eventEpochMs = toEpochMs(event.recordedAt);
    const boundaryEpochMs = toEpochMs(boundary);
    const isNewBoundary =
      eventEpochMs !== undefined && boundaryEpochMs !== undefined
        ? direction === 'first'
          ? eventEpochMs < boundaryEpochMs
          : eventEpochMs > boundaryEpochMs
        : direction === 'first'
          ? event.recordedAt < boundary
          : event.recordedAt > boundary;

    if (isNewBoundary) {
      boundary = event.recordedAt;
    }
  }

  return boundary;
}

export function projectMetrics(replay: RunReplay): RunMetricsProjection {
  return {
    eventCount: replay.events.length,
    retryCount: countRetries(replay.events),
    parkedMs: calculateParkedMs(replay.events),
    firstRecordedAt: findRecordedAtBoundary(replay.events, 'first'),
    lastRecordedAt: findRecordedAtBoundary(replay.events, 'last'),
  };
}
