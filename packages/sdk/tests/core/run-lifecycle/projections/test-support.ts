import type {
  Result,
  RunDegradedHealth,
  RunEventEnvelope,
  RunLifecycleTransitionPayload,
  RunPolicyBoundPayload,
  RunProjections,
  RunReplay,
  RunReplayFailure,
  SessionLinkedPayload,
  SessionLinkSupersededPayload,
  TaskSnapshotRecordedPayload,
} from '../../../../src/index.js';

export const runId = 'run-projections-123';

export type ReplayDependency = (runId: string) => Result<RunReplay, RunReplayFailure>;

export function makeEnvelope<TPayload>(
  sequence: number,
  type: string,
  payload: TPayload,
  overrides: Partial<RunEventEnvelope<TPayload>> = {},
): RunEventEnvelope<TPayload> {
  return {
    schema: 'kit-vnext.run-event.v1',
    runId,
    eventId: `evt-${sequence}`,
    sequence,
    writerEpoch: 7,
    domain: overrides.domain ?? 'core-01',
    type,
    durability: 'barrier',
    occurredAt: overrides.occurredAt ?? `2026-06-23T12:00:${String(sequence).padStart(2, '0')}.000Z`,
    recordedAt: overrides.recordedAt ?? `2026-06-23T12:00:${String(sequence).padStart(2, '0')}.500Z`,
    payloadDigest: `sha256:${sequence}`,
    payload,
    artifactRefs: overrides.artifactRefs,
    causationId: overrides.causationId,
    correlationId: overrides.correlationId,
    ...overrides,
  };
}

export function makeLifecyclePayload(
  overrides: Partial<RunLifecycleTransitionPayload> & Pick<RunLifecycleTransitionPayload, 'from' | 'to'>,
): RunLifecycleTransitionPayload {
  return {
    from: overrides.from,
    to: overrides.to,
    reason: overrides.reason ?? `${overrides.from ?? 'null'} -> ${overrides.to}`,
    authority: overrides.authority ?? 'system',
    sourceEventIds: overrides.sourceEventIds ?? [`evidence:${overrides.to}`],
    terminal: overrides.terminal,
  };
}

export function makePolicyPayload(overrides: Partial<RunPolicyBoundPayload> = {}): RunPolicyBoundPayload {
  return {
    policyDigest: overrides.policyDigest ?? 'sha256:policy-1',
    provenanceRef: overrides.provenanceRef ?? 'policy/provenance/1',
    profile: overrides.profile,
  };
}

export function makeTaskSnapshotPayload(
  overrides: Partial<TaskSnapshotRecordedPayload> = {},
): TaskSnapshotRecordedPayload {
  return {
    taskId: overrides.taskId ?? 'task-1',
    sourceRef: overrides.sourceRef ?? 'tasks/1',
    snapshotDigest: overrides.snapshotDigest ?? 'sha256:snapshot-1',
  };
}

export function makeSessionLinkedPayload(
  overrides: Partial<SessionLinkedPayload> & Pick<SessionLinkedPayload, 'linkOrdinal' | 'sessionId'>,
): SessionLinkedPayload {
  return {
    linkOrdinal: overrides.linkOrdinal,
    sessionId: overrides.sessionId,
    linkRole: overrides.linkRole ?? 'primary',
    startedAt: overrides.startedAt ?? '2026-06-23T12:03:00.000Z',
    sourceEventId: overrides.sourceEventId ?? `source:${overrides.linkOrdinal}`,
    supersedesOrdinal: overrides.supersedesOrdinal,
  };
}

export function makeSupersededPayload(
  overrides: Partial<SessionLinkSupersededPayload> = {},
): SessionLinkSupersededPayload {
  return {
    supersededOrdinal: overrides.supersededOrdinal ?? 1,
    replacementOrdinal: overrides.replacementOrdinal ?? 2,
    reason: overrides.reason ?? 'handoff',
    sourceEventId: overrides.sourceEventId ?? 'source:handoff',
  };
}

export function makeReplay(events: readonly RunEventEnvelope[], health: RunDegradedHealth = 'ok'): RunReplay {
  const lastEvent = events.at(-1);

  return {
    runId,
    events: [...events],
    lastSequence: lastEvent?.sequence ?? 0,
    writerEpoch: lastEvent?.writerEpoch,
    health,
    healthRecords: [],
  };
}

export function makeReplayDependency(result: Result<RunReplay, RunReplayFailure>): ReplayDependency {
  return (requestedRunId) => {
    if (requestedRunId !== runId) {
      throw new Error(`unexpected run id: ${requestedRunId}`);
    }

    return result;
  };
}

export function makeReplayFailure(code: RunReplayFailure['code']): RunReplayFailure {
  return {
    code,
    message: `failure:${code}`,
    healthRecords: [],
  };
}

export function makeProjectionFixture(): RunProjections {
  return {
    state: {
      lifecycle: 'running',
      currentSequence: 3,
      writerEpoch: 7,
      degradedHealth: 'ok',
    },
    summary: {
      runId,
      taskId: 'task-1',
      status: 'running',
      ownerSessionId: 'session-1',
      artifactRefs: ['artifact://1'],
      unknownEvents: [],
    },
    metrics: {
      eventCount: 3,
      retryCount: 0,
      parkedMs: 0,
      firstRecordedAt: '2026-06-23T12:00:01.500Z',
      lastRecordedAt: '2026-06-23T12:00:03.500Z',
    },
    launch: {
      policyDigest: 'sha256:policy-1',
      taskSnapshotDigest: 'sha256:snapshot-1',
      linkage: 'known',
      currentSession: makeSessionLinkedPayload({ linkOrdinal: 1, sessionId: 'session-1' }),
      linkHistory: [makeSessionLinkedPayload({ linkOrdinal: 1, sessionId: 'session-1' })],
    },
  };
}
