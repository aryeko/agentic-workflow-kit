import type {
  ApprovalAnswer,
  ApprovalAnswerResult,
  ApprovalRequest,
  Decision,
  PolicyGrantPlan,
  Result,
  ScopedGrant,
} from 'sdk';

export const runId = 'run-approval-01';
export const sessionId = 'session-approval-01';
export const requestId = 'request-01';
export const decisionId = 'decision-01';
export const decisionEventId = 'evt-decision-recorded-01';
export const answeredAt = '2026-06-26T09:05:00.000Z';

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

export const createPlan = (overrides: Partial<PolicyGrantPlan> = {}): PolicyGrantPlan => ({
  grantId: 'grant-01',
  scope: 'per-command',
  command: 'pnpm check',
  reason: 'verification',
  ...overrides,
});

export const createGrant = (overrides: Partial<ScopedGrant> = {}): ScopedGrant => ({
  grantId: 'grant-01',
  kind: 'command-once',
  scope: 'request',
  command: 'pnpm check',
  grantEventId: decisionEventId,
  ...overrides,
});

export const createDecision = (overrides: Partial<Decision> = {}): Decision => ({
  schema: 'kit-vnext.approval-decision.v1',
  decisionId,
  requestId,
  risk: 'low',
  mode: 'assisted',
  decision: 'grant',
  grant: createGrant(),
  decidedBy: 'policy',
  sourceEventIds: ['evt-agent-request-01', decisionEventId],
  policyRef: 'policy:approval',
  reason: 'allowlisted',
  decidedAt: answeredAt,
  ...overrides,
});

export type CapturingApprovalRelay = {
  readonly answers: ApprovalAnswer[];
  answerApproval(answer: ApprovalAnswer): Result<ApprovalAnswerResult, { readonly reason: 'channel-lost' }>;
};

export const createRelay = (
  result: ApprovalAnswerResult = {
    delivered: true,
    persisted: true,
    channelRef: 'channel-01',
    evidenceRef: 'evidence:answer-01',
    at: answeredAt,
  },
): CapturingApprovalRelay => {
  const answers: ApprovalAnswer[] = [];
  return {
    answers,
    answerApproval(answer) {
      answers.push(answer);
      return { ok: true, value: result };
    },
  };
};
