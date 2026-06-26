import type {
  AppendIntent,
  ApprovalPendingPersistedPayload,
  ApprovalRequest,
  CapabilityAttestation,
  Decision,
  Result,
  RunAppendFailure,
  RunAppendReceipt,
  RunEventEnvelope,
  RunProjections,
  RunReplay,
  RunWriter,
  ScopedGrant,
} from 'sdk';

export const runId = 'run-approval-01';
export const sessionId = 'session-approval-01';
export const requestId = 'request-01';
export const decisionEventId = 'evt-decision-01';
export const requestedAt = '2026-06-23T10:00:00.000Z';
export const evaluatedAt = '2026-06-23T10:05:00.000Z';
export const decisionDeadline = '2026-06-23T10:15:00.000Z';

export type CapturingWriter = RunWriter & {
  readonly appendCalls: AppendIntent[][];
};

export const appendReceipt = (eventIds: readonly string[] = ['evt-append-01']): RunAppendReceipt => ({
  runId,
  firstSequence: 11,
  lastSequence: 10 + eventIds.length,
  writerEpoch: 2,
  durability: 'barrier',
  eventIds: [...eventIds],
  payloadDigests: eventIds.map((eventId) => `sha256:${eventId}`),
  frameDigest: 'sha256:frame-01',
  health: 'ok',
});

export const appendFailure: RunAppendFailure = {
  code: 'event-log-unavailable',
  message: 'event log unavailable',
  retryable: true,
};

export const createWriter = (
  appendImpl?: (batch: AppendIntent[]) => Result<RunAppendReceipt, RunAppendFailure>,
): CapturingWriter => {
  const appendCalls: AppendIntent[][] = [];
  const writer: CapturingWriter = {
    appendCalls,
    append(batch) {
      appendCalls.push(batch);
      return appendImpl?.(batch) ?? { ok: true, value: appendReceipt(batch.map((intent) => `evt-${intent.type}`)) };
    },
    renew() {
      return { ok: true, value: writer };
    },
  };

  return writer;
};

export const createRequest = (overrides: Partial<ApprovalRequest> = {}): ApprovalRequest => ({
  schema: 'kit-vnext.approval-request.v1',
  requestId,
  runId,
  taskId: 'task-approval-01',
  sessionId,
  operationId: 'op-approval-01',
  subject: 'command',
  promptRef: 'artifact://prompt-01',
  command: 'pnpm check',
  cwd: '/workspace/story',
  worktreePath: '/workspace/story',
  requestedScope: 'per-command',
  answerChannelRef: 'channel-01',
  answerChannelPersistable: true,
  requestedAt,
  policyRef: 'policy:approval',
  agentRequestEventId: 'evt-agent-request-01',
  ...overrides,
});

export const grant: ScopedGrant = {
  grantId: 'grant-01',
  kind: 'command-once',
  scope: 'request',
  command: 'pnpm check',
  grantEventId: decisionEventId,
};

export const createDecision = (overrides: Partial<Decision> = {}): Decision => ({
  schema: 'kit-vnext.approval-decision.v1',
  decisionId: 'decision-01',
  requestId,
  risk: 'low',
  mode: 'assisted',
  decision: 'grant',
  grant,
  decidedBy: 'operator',
  sourceEventIds: ['evt-pending-01', 'evt-operator-01'],
  policyRef: 'policy:approval',
  reason: 'operator-approved',
  decidedAt: evaluatedAt,
  ...overrides,
});

export const createEvent = <TPayload>({
  eventId,
  sequence,
  type,
  payload,
  domain = 'core-03',
  durability = 'barrier',
  occurredAt = evaluatedAt,
}: {
  readonly eventId: string;
  readonly sequence: number;
  readonly type: string;
  readonly payload: TPayload;
  readonly domain?: string;
  readonly durability?: 'durable' | 'barrier';
  readonly occurredAt?: string;
}): RunEventEnvelope<TPayload> => ({
  schema: 'kit-vnext.run-event.v1',
  runId,
  eventId,
  sequence,
  writerEpoch: 2,
  domain,
  type,
  durability,
  occurredAt,
  recordedAt: occurredAt,
  payloadDigest: `sha256:${eventId}`,
  payload,
});

export const createPendingPayload = (
  overrides: Partial<ApprovalPendingPersistedPayload> = {},
): ApprovalPendingPersistedPayload => ({
  schema: 'kit-vnext.approval-pending-persisted.v1',
  requestId,
  runId,
  sessionId,
  answerChannelRef: 'channel-01',
  answerChannelPersistable: true,
  decisionDeadline,
  policyRef: 'policy:approval',
  sourceRequestEventId: 'evt-requested-01',
  recordedAt: requestedAt,
  ...overrides,
});

export const createAttestationEvent = (
  eventId: string,
  sequence: number,
  capability: 'canResumeOwned' | 'canRelayApproval' | 'canPersistApprovalAnswerChannel',
  overrides: Partial<CapabilityAttestation<string>> = {},
): RunEventEnvelope<CapabilityAttestation<string>> =>
  createEvent({
    eventId,
    sequence,
    type: 'CapabilityAttestation',
    domain: 'Agent',
    payload: {
      capability,
      probeMethod: 'live-smoke',
      result: 'positive',
      evidenceRef: `evidence:${capability}`,
      scope: sessionId,
      expiry: decisionDeadline,
      driverVersion: '1.0.0',
      platform: 'darwin-arm64',
      freshnessKey: `${capability}:${sessionId}`,
      at: requestedAt,
      ...overrides,
    },
  });

export const createReplay = (events: readonly RunEventEnvelope[] = []): RunReplay => ({
  runId,
  events: [...events],
  lastSequence: events.at(-1)?.sequence ?? 0,
  writerEpoch: 2,
  health: 'ok',
  healthRecords: [],
});

export const createProjections = (overrides: Partial<RunProjections> = {}): RunProjections => ({
  state: {
    lifecycle: 'running',
    currentSequence: 10,
    writerEpoch: 2,
    degradedHealth: 'ok',
  },
  summary: {
    runId,
    taskId: 'task-approval-01',
    status: 'running',
    ownerSessionId: sessionId,
    artifactRefs: [],
    unknownEvents: [],
  },
  metrics: {
    eventCount: 10,
    retryCount: 0,
    parkedMs: 0,
    firstRecordedAt: requestedAt,
    lastRecordedAt: evaluatedAt,
  },
  launch: {
    linkage: 'known',
    currentSession: {
      linkOrdinal: 1,
      sessionId,
      linkRole: 'primary',
      startedAt: requestedAt,
      sourceEventId: 'evt-session-linked-01',
    },
    linkHistory: [],
  },
  ...overrides,
});
