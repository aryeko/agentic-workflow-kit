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
      total += Math.max(0, Date.parse(event.occurredAt) - Date.parse(parkedStartedAt));
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

    if (direction === 'first' ? event.recordedAt < boundary : event.recordedAt > boundary) {
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
