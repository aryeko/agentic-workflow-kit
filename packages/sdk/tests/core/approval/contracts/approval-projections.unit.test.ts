import { describe, expect, it } from 'vitest';

import type { ApprovalProjection, PendingApprovalProjection } from '../../../../src/index.js';

import { approvalProjectionFixture, pendingApprovalProjectionFixture } from './fixtures.js';

describe('core-03-s1 approval projections', () => {
  it('tracks pending approvals with a required decision deadline', () => {
    const pending: PendingApprovalProjection = pendingApprovalProjectionFixture();

    expect(pending.requestId).toBe('request-01');
    expect(pending.state).toBe('pending');
    expect(pending.decisionDeadline).toBe('2026-06-26T09:10:00.000Z');
  });

  it('tracks latest decision, latest outcome, operator attention, and failure states', () => {
    const projection: ApprovalProjection = approvalProjectionFixture();

    expect(projection.pendingByRequestId['request-01']?.decisionDeadline).toBe('2026-06-26T09:10:00.000Z');
    expect(projection.latestDecisionByRequestId['request-01']?.decision).toBe('grant');
    expect(projection.latestOutcomeByRequestId['request-01']?.outcome).toBe('answered');
    expect(projection.operatorAttention?.reason).toBe('parked');
    expect(projection.failureStateByRequestId['request-01']).toBe('approval-answer-channel-lost');
  });
});
