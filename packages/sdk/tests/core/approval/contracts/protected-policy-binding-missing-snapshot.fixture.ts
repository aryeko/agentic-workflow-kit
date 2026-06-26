import type { ApprovalDecisionRecordedPayload } from '../../../../src/core/approval/contracts/index.js';

const invalidPayload: ApprovalDecisionRecordedPayload<'protected-policy-change'> = {
  schema: 'kit-vnext.approval-decision-recorded.v1',
  decision: {
    schema: 'kit-vnext.approval-decision.v1',
    decisionId: 'decision-01',
    requestId: 'request-01',
    risk: 'high',
    mode: 'manual',
    decision: 'human-required',
    decidedBy: 'operator',
    sourceEventIds: ['evt-requested-01'],
    policyRef: 'policy:approval',
    reason: 'protected policy change',
    decidedAt: '2026-06-26T09:01:00.000Z',
  },
  sourceEventIds: ['evt-requested-01', 'evt-risk-01'],
  // @ts-expect-error Protected policy bindings require protectedPolicySnapshotEventId.
  protectedPolicyBinding: {
    runId: 'run-01',
    candidateHeadSha: 'abc123def456',
  },
};

void invalidPayload;
