import type {
  ApprovalContext,
  ApprovalFailureState,
  ApprovalMode,
  ApprovalParkInput,
  ApprovalRequest,
  ApprovalResumeInput,
  ApprovalRisk,
  ApprovalSubject,
  Decision,
  Outcome,
  ParkDecision,
  PolicyGrantPlan,
  PolicyGrantScope,
  ProtectedPolicyApprovalBinding,
  ResumeDecision,
  ScopedGrant,
} from '../../../../src/index.js';

export const scopedGrantFixture = (overrides: Partial<ScopedGrant> = {}): ScopedGrant => ({
  grantId: 'grant-01',
  kind: 'command-once',
  scope: 'request',
  command: 'pnpm check',
  grantEventId: 'evt-grant-01',
  ...overrides,
});

export const approvalContextFixture = (overrides: Partial<ApprovalContext> = {}): ApprovalContext => ({
  runId: 'run-01',
  taskId: 'task-01',
  operationId: 'op-01',
  sessionId: 'session-01',
  policyRef: 'policy:approval',
  agentRequestEventId: 'evt-agent-request-01',
  requestedAt: '2026-06-26T09:00:00.000Z',
  promptRef: 'artifact://prompt-01',
  ...overrides,
});

export const approvalRequestFixture = (overrides: Partial<ApprovalRequest> = {}): ApprovalRequest => ({
  schema: 'kit-vnext.approval-request.v1',
  requestId: 'request-01',
  runId: 'run-01',
  taskId: 'task-01',
  sessionId: 'session-01',
  operationId: 'op-01',
  subject: 'command',
  promptRef: 'artifact://prompt-01',
  command: 'pnpm check',
  cwd: '/repo',
  answerChannelRef: 'channel-01',
  answerChannelPersistable: true,
  requestedAt: '2026-06-26T09:00:00.000Z',
  policyRef: 'policy:approval',
  agentRequestEventId: 'evt-agent-request-01',
  ...overrides,
});

export const policyGrantPlanFixture = (overrides: Partial<PolicyGrantPlan> = {}): PolicyGrantPlan => ({
  grantId: 'grant-plan-01',
  scope: 'per-command',
  command: 'pnpm check',
  reason: 'allowlisted exact command',
  ...overrides,
});

export const decisionFixture = (overrides: Partial<Decision> = {}): Decision => ({
  schema: 'kit-vnext.approval-decision.v1',
  decisionId: 'decision-01',
  requestId: 'request-01',
  risk: 'low',
  mode: 'assisted',
  decision: 'grant',
  policyGrantPlan: policyGrantPlanFixture(),
  grant: scopedGrantFixture(),
  decidedBy: 'policy',
  sourceEventIds: ['evt-requested-01', 'evt-risk-01'],
  capabilityGateEventId: 'evt-gate-01',
  policyRef: 'policy:approval',
  reason: 'allowlisted command',
  decidedAt: '2026-06-26T09:01:00.000Z',
  ...overrides,
});

export const outcomeFixture = (overrides: Partial<Outcome> = {}): Outcome => ({
  schema: 'kit-vnext.approval-outcome.v1',
  outcomeId: 'outcome-01',
  requestId: 'request-01',
  decisionId: 'decision-01',
  outcome: 'answered',
  agentAnswerEventId: 'evt-answer-01',
  recordedAt: '2026-06-26T09:02:00.000Z',
  ...overrides,
});

export const protectedPolicyBindingFixture = (
  overrides: Partial<ProtectedPolicyApprovalBinding> = {},
): ProtectedPolicyApprovalBinding => ({
  runId: 'run-01',
  candidateHeadSha: 'abc123def456',
  protectedPolicySnapshotEventId: 'evt-policy-snapshot-01',
  ...overrides,
});

export const parkInputFixture = (overrides: Partial<ApprovalParkInput> = {}): ApprovalParkInput => ({
  request: approvalRequestFixture(),
  reason: 'operator-attention',
  decisionDeadline: '2026-06-26T09:10:00.000Z',
  parkedAt: '2026-06-26T09:03:00.000Z',
  sourceEventIds: ['evt-requested-01', 'evt-decision-01'],
  ...overrides,
});

export const parkDecisionFixture = (overrides: Partial<ParkDecision> = {}): ParkDecision => ({
  schema: 'kit-vnext.approval-park-decision.v1',
  requestId: 'request-01',
  runId: 'run-01',
  sessionId: 'session-01',
  reason: 'operator-attention',
  decisionDeadline: '2026-06-26T09:10:00.000Z',
  parkedAt: '2026-06-26T09:03:00.000Z',
  sourceEventIds: ['evt-requested-01', 'evt-decision-01'],
  ...overrides,
});

export const resumeInputFixture = (overrides: Partial<ApprovalResumeInput> = {}): ApprovalResumeInput => ({
  requestId: 'request-01',
  runId: 'run-01',
  sessionId: 'session-01',
  decisionEventId: 'evt-decision-01',
  evaluatedAt: '2026-06-26T09:04:00.000Z',
  ...overrides,
});

export const resumeDecisionFixture = (overrides: Partial<ResumeDecision> = {}): ResumeDecision => ({
  schema: 'kit-vnext.approval-resume-decision.v1',
  requestId: 'request-01',
  runId: 'run-01',
  sessionId: 'session-01',
  decisionEventId: 'evt-decision-01',
  outcome: 'resume',
  grant: scopedGrantFixture(),
  sourceEventIds: ['evt-parked-01', 'evt-decision-01'],
  evaluatedAt: '2026-06-26T09:04:00.000Z',
  ...overrides,
});

export const approvalModes: readonly ApprovalMode[] = ['manual', 'assisted'];
export const approvalRisks: readonly ApprovalRisk[] = ['low', 'medium', 'high'];
export const policyGrantScopes: readonly PolicyGrantScope[] = [
  'per-command',
  'per-command-prefix',
  'per-host',
  'session',
];
export const approvalSubjects: readonly ApprovalSubject[] = [
  'command',
  'file-change',
  'permission',
  'network',
  'input',
  'protected-policy-change',
  'other',
];
export const failureStates: readonly ApprovalFailureState[] = [
  'approval-request-unrecordable',
  'approval-relay-missing',
  'approval-resume-capability-missing',
  'approval-answer-channel-lost',
  'approval-session-ambiguous',
  'approval-owner-missing',
  'approval-policy-unavailable',
  'approval-risk-high',
  'approval-gate-denied',
  'approval-gate-unwritable',
  'approval-grant-mapping-invalid',
  'approval-expired',
  'approval-event-log-unavailable',
  'approval-outcome-ambiguous',
];
