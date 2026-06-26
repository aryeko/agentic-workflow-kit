import type {
  ApprovalContext,
  ApprovalDecisionRecordedPayload,
  ApprovalFailureState,
  ApprovalMode,
  ApprovalOutcomeRecordedPayload,
  ApprovalParkInput,
  ApprovalParkedPayload,
  ApprovalPendingPersistedPayload,
  ApprovalProjection,
  ApprovalRequest,
  ApprovalRequestedPayload,
  ApprovalResumedPayload,
  ApprovalResumeInput,
  ApprovalRisk,
  ApprovalRiskClassifiedPayload,
  ApprovalSubject,
  Decision,
  Outcome,
  ParkDecision,
  PendingApprovalProjection,
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

export const pendingApprovalProjectionFixture = (
  overrides: Partial<PendingApprovalProjection> = {},
): PendingApprovalProjection => ({
  requestId: 'request-01',
  runId: 'run-01',
  sessionId: 'session-01',
  state: 'pending',
  requestEventId: 'evt-requested-01',
  pendingEventId: 'evt-pending-01',
  answerChannelRef: 'channel-01',
  answerChannelPersistable: true,
  liveAnswerDeadline: '2026-06-26T09:05:00.000Z',
  decisionDeadline: '2026-06-26T09:10:00.000Z',
  policyRef: 'policy:approval',
  ...overrides,
});

export const approvalProjectionFixture = (overrides: Partial<ApprovalProjection> = {}): ApprovalProjection => ({
  runId: 'run-01',
  pendingByRequestId: {
    'request-01': pendingApprovalProjectionFixture(),
  },
  latestDecisionByRequestId: {
    'request-01': decisionFixture(),
  },
  latestOutcomeByRequestId: {
    'request-01': outcomeFixture(),
  },
  operatorAttention: {
    requestId: 'request-01',
    reason: 'parked',
    sourceEventId: 'evt-parked-01',
  },
  failureStateByRequestId: {
    'request-01': 'approval-answer-channel-lost',
  },
  ...overrides,
});

export const approvalRequestedPayloadFixture = (
  overrides: Partial<ApprovalRequestedPayload> = {},
): ApprovalRequestedPayload => ({
  schema: 'kit-vnext.approval-requested.v1',
  request: approvalRequestFixture(),
  sourceAgentEventId: 'evt-agent-request-01',
  recordedAt: '2026-06-26T09:00:00.000Z',
  ...overrides,
});

export const approvalPendingPersistedPayloadFixture = (
  overrides: Partial<ApprovalPendingPersistedPayload> = {},
): ApprovalPendingPersistedPayload => ({
  schema: 'kit-vnext.approval-pending-persisted.v1',
  requestId: 'request-01',
  runId: 'run-01',
  sessionId: 'session-01',
  answerChannelRef: 'channel-01',
  answerChannelPersistable: true,
  liveAnswerDeadline: '2026-06-26T09:05:00.000Z',
  decisionDeadline: '2026-06-26T09:10:00.000Z',
  policyRef: 'policy:approval',
  sourceRequestEventId: 'evt-requested-01',
  recordedAt: '2026-06-26T09:00:01.000Z',
  ...overrides,
});

export const approvalRiskClassifiedPayloadFixture = (
  overrides: Partial<ApprovalRiskClassifiedPayload> = {},
): ApprovalRiskClassifiedPayload => ({
  schema: 'kit-vnext.approval-risk-classified.v1',
  requestId: 'request-01',
  risk: 'low',
  triggeredRuleIds: ['rule-low-exact-command'],
  evidenceEventIds: ['evt-evidence-01'],
  classifiedAt: '2026-06-26T09:00:30.000Z',
  ...overrides,
});

export const approvalDecisionRecordedPayloadFixture = <TSubject extends ApprovalSubject = ApprovalSubject>(
  subject: TSubject,
  overrides: Partial<ApprovalDecisionRecordedPayload<TSubject>> = {},
): ApprovalDecisionRecordedPayload<TSubject> =>
  ({
    schema: 'kit-vnext.approval-decision-recorded.v1',
    decision: decisionFixture({ requestId: 'request-01' }),
    sourceEventIds: ['evt-requested-01', 'evt-risk-01'],
    ...(subject === 'protected-policy-change' ? { protectedPolicyBinding: protectedPolicyBindingFixture() } : {}),
    ...overrides,
  }) as ApprovalDecisionRecordedPayload<TSubject>;

export const approvalParkedPayloadFixture = (
  overrides: Partial<ApprovalParkedPayload> = {},
): ApprovalParkedPayload => ({
  schema: 'kit-vnext.approval-parked.v1',
  requestId: 'request-01',
  runId: 'run-01',
  sessionId: 'session-01',
  reason: 'operator-attention',
  decisionDeadline: '2026-06-26T09:10:00.000Z',
  parkedAt: '2026-06-26T09:03:00.000Z',
  sourceEventIds: ['evt-requested-01', 'evt-decision-01'],
  ...overrides,
});

export const approvalResumedPayloadFixture = (
  overrides: Partial<ApprovalResumedPayload> = {},
): ApprovalResumedPayload => ({
  schema: 'kit-vnext.approval-resumed.v1',
  requestId: 'request-01',
  runId: 'run-01',
  sessionId: 'session-01',
  decisionEventId: 'evt-decision-01',
  grant: scopedGrantFixture(),
  resumedAt: '2026-06-26T09:04:30.000Z',
  sourceEventIds: ['evt-parked-01', 'evt-decision-01'],
  ...overrides,
});

export const approvalOutcomeRecordedPayloadFixture = (
  overrides: Partial<ApprovalOutcomeRecordedPayload> = {},
): ApprovalOutcomeRecordedPayload => ({
  schema: 'kit-vnext.approval-outcome-recorded.v1',
  outcome: outcomeFixture(),
  sourceEventIds: ['evt-decision-01', 'evt-answer-01'],
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
export const failureStates: readonly ApprovalFailureState[] = [
  'approval-request-unrecordable',
  'approval-relay-missing',
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
