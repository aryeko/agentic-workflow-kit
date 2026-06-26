import { describe, expect, it } from 'vitest';

import type { ApprovalDecisionRecordedPayload } from '../../../../src/index.js';

import { approvalDecisionRecordedPayloadFixture, decisionFixture, protectedPolicyBindingFixture } from './fixtures.js';

describe('core-03-s1 protected policy binding contract', () => {
  it('requires a protected policy binding for protected-policy-change requests', () => {
    const payload: ApprovalDecisionRecordedPayload<'protected-policy-change'> = approvalDecisionRecordedPayloadFixture(
      'protected-policy-change',
      {
        decision: decisionFixture(),
        protectedPolicyBinding: protectedPolicyBindingFixture({ newPolicyDigest: 'sha256:new-policy' }),
      },
    );

    expect(payload.protectedPolicyBinding.runId).toBe('run-01');
    expect(payload.protectedPolicyBinding.candidateHeadSha).toBe('abc123def456');
    expect(payload.protectedPolicyBinding.protectedPolicySnapshotEventId).toBe('evt-policy-snapshot-01');
    expect(payload.protectedPolicyBinding.newPolicyDigest).toBe('sha256:new-policy');
  });

  it('permits non-protected subjects to omit the binding', () => {
    const payload: ApprovalDecisionRecordedPayload<'command'> = approvalDecisionRecordedPayloadFixture('command', {
      decision: decisionFixture(),
    });

    expect(payload.protectedPolicyBinding).toBeUndefined();
    expect(payload.sourceEventIds).toEqual(['evt-requested-01', 'evt-risk-01']);
  });
});
