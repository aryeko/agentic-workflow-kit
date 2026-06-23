import type {
  RunEventEnvelope,
  RunLifecycleState,
  RunLifecycleTransitionPayload,
  SessionLinkedPayload,
  SessionLinkSupersededPayload,
} from '../../../../src/index.js';

export const ALL_LIFECYCLE_STATES = [
  'created',
  'configured',
  'task-snapshotted',
  'workspace-ready',
  'worker-starting',
  'running',
  'parked',
  'runner-verifying',
  'forge-waiting',
  'merge-waiting',
  'settling',
  'completed',
  'blocked',
  'failed',
  'canceled',
] as const satisfies readonly RunLifecycleState[];

export const TERMINAL_LIFECYCLE_STATES = ['completed', 'blocked', 'failed', 'canceled'] as const;

export const NON_TERMINAL_LIFECYCLE_STATES = ALL_LIFECYCLE_STATES.filter(
  (state) => !TERMINAL_LIFECYCLE_STATES.includes(state as (typeof TERMINAL_LIFECYCLE_STATES)[number]),
);

export function makeReference(eventType: string, suffix: string): string {
  return `${eventType}:evt-${suffix}`;
}

export function makeTransitionPayload(
  overrides: Partial<RunLifecycleTransitionPayload> & Pick<RunLifecycleTransitionPayload, 'from' | 'to'>,
): RunLifecycleTransitionPayload {
  return {
    from: overrides.from,
    to: overrides.to,
    reason: overrides.reason ?? `${overrides.from ?? 'null'}->${overrides.to}`,
    authority: overrides.authority ?? 'system',
    sourceEventIds: overrides.sourceEventIds ?? [makeReference('Evidence', `${overrides.to}-1`)],
    terminal: overrides.terminal,
  };
}

export function makeLifecycleEnvelope(
  sequence: number,
  payload: RunLifecycleTransitionPayload,
): RunEventEnvelope<RunLifecycleTransitionPayload> {
  return {
    schema: 'kit-vnext.run-event.v1',
    runId: 'run-lifecycle-fixture',
    eventId: `evt-lifecycle-${sequence}`,
    sequence,
    writerEpoch: 1,
    domain: 'core-01',
    type: 'RunLifecycleTransitioned',
    durability: 'durable',
    occurredAt: `2026-06-23T12:00:${String(sequence).padStart(2, '0')}.000Z`,
    recordedAt: `2026-06-23T12:00:${String(sequence).padStart(2, '0')}.000Z`,
    payloadDigest: `sha256:lifecycle-${sequence}`,
    payload,
  };
}

export function makeEventEnvelope<TPayload>(
  type: string,
  sequence: number,
  payload: TPayload,
): RunEventEnvelope<TPayload> {
  return {
    schema: 'kit-vnext.run-event.v1',
    runId: 'run-lifecycle-fixture',
    eventId: `evt-${type}-${sequence}`,
    sequence,
    writerEpoch: 1,
    domain: 'core-01',
    type,
    durability: 'barrier',
    occurredAt: `2026-06-23T12:01:${String(sequence).padStart(2, '0')}.000Z`,
    recordedAt: `2026-06-23T12:01:${String(sequence).padStart(2, '0')}.000Z`,
    payloadDigest: `sha256:${type}-${sequence}`,
    payload,
  };
}

export function makeSessionLinkedPayload(
  overrides: Partial<SessionLinkedPayload> & Pick<SessionLinkedPayload, 'linkOrdinal' | 'sessionId'>,
): SessionLinkedPayload {
  return {
    linkOrdinal: overrides.linkOrdinal,
    sessionId: overrides.sessionId,
    linkRole: overrides.linkRole ?? 'primary',
    startedAt: overrides.startedAt ?? '2026-06-23T12:02:00.000Z',
    sourceEventId: overrides.sourceEventId ?? makeReference('SessionLinked', String(overrides.linkOrdinal)),
    supersedesOrdinal: overrides.supersedesOrdinal,
  };
}

export function makeSessionLinkSupersededPayload(
  overrides: SessionLinkSupersededPayload,
): SessionLinkSupersededPayload {
  return overrides;
}
