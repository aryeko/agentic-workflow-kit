import type {
  ApprovalDecisionRecordedPayload,
  ApprovalOutcomeRecordedPayload,
  ApprovalParkedPayload,
  ApprovalPendingPersistedPayload,
  ApprovalProjection,
  ApprovalRequestedPayload,
  ApprovalResumedPayload,
  ApprovalRiskClassifiedPayload,
  ApprovalSubject,
  PendingApprovalProjection,
} from '../../../../src/index.js';

import {
  approvalRequestFixture,
  decisionFixture,
  outcomeFixture,
  protectedPolicyBindingFixture,
  scopedGrantFixture,
} from './value-fixtures.js';

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
