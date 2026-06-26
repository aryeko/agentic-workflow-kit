import type {
  AppendIntent,
  ApprovalRequest,
  Decision,
  Result,
  RunAppendFailure,
  RunAppendReceipt,
  RunEventEnvelope,
  RunWriter,
  ScopedGrant,
} from 'sdk';

export const runId = 'run-approval-01';
export const sessionId = 'session-approval-01';
export const requestId = 'request-01';
export const decisionId = 'decision-01';
export const decisionEventId = 'evt-decision-recorded-01';
export const recordedAt = '2026-06-26T09:06:00.000Z';

export type CapturingWriter = RunWriter & {
  readonly appendCalls: AppendIntent[][];
};

export const appendReceipt = (eventIds: readonly string[] = ['evt-outcome-recorded-01']): RunAppendReceipt => ({
  runId,
  firstSequence: 31,
  lastSequence: 30 + eventIds.length,
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

export const grant: ScopedGrant = {
  grantId: 'grant-01',
  kind: 'command-once',
  scope: 'request',
  command: 'pnpm check',
  grantEventId: decisionEventId,
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
  requestedAt: '2026-06-26T09:00:00.000Z',
  policyRef: 'policy:approval',
  agentRequestEventId: 'evt-agent-request-01',
  ...overrides,
});

export const createDecision = (overrides: Partial<Decision> = {}): Decision => ({
  schema: 'kit-vnext.approval-decision.v1',
  decisionId,
  requestId,
  risk: 'low',
  mode: 'assisted',
  decision: 'grant',
  grant,
  decidedBy: 'policy',
  sourceEventIds: ['evt-agent-request-01', decisionEventId],
  policyRef: 'policy:approval',
  reason: 'allowlisted',
  decidedAt: '2026-06-26T09:05:00.000Z',
  ...overrides,
});

export const createEvent = <TPayload>({
  eventId,
  sequence,
  type,
  payload,
}: {
  readonly eventId: string;
  readonly sequence: number;
  readonly type: string;
  readonly payload: TPayload;
}): RunEventEnvelope<TPayload> => ({
  schema: 'kit-vnext.run-event.v1',
  runId,
  eventId,
  sequence,
  writerEpoch: 2,
  domain: 'core-03',
  type,
  durability: 'barrier',
  occurredAt: recordedAt,
  recordedAt,
  payloadDigest: `sha256:${eventId}`,
  payload,
});
