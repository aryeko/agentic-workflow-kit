import { describe, expect, it } from 'vitest';

import type {
  ApprovalDecisionRecordedPayload,
  ApprovalOutcomeRecordedPayload,
  ApprovalParkedPayload,
  ApprovalPendingPersistedPayload,
  ApprovalRequestedPayload,
  ApprovalResumedPayload,
  ApprovalRiskClassifiedPayload,
} from '../../../../src/index.js';

import {
  approvalDecisionRecordedPayloadFixture,
  approvalOutcomeRecordedPayloadFixture,
  approvalParkedPayloadFixture,
  approvalPendingPersistedPayloadFixture,
  approvalRequestedPayloadFixture,
  approvalResumedPayloadFixture,
  approvalRiskClassifiedPayloadFixture,
} from './fixtures.js';

describe('core-03-s1 approval event payload contracts', () => {
  it('constructs all seven v1 approval payloads with their exact schema literals', () => {
    const requested: ApprovalRequestedPayload = approvalRequestedPayloadFixture();
    const pending: ApprovalPendingPersistedPayload = approvalPendingPersistedPayloadFixture();
    const risk: ApprovalRiskClassifiedPayload = approvalRiskClassifiedPayloadFixture();
    const decision: ApprovalDecisionRecordedPayload = approvalDecisionRecordedPayloadFixture('command');
    const parked: ApprovalParkedPayload = approvalParkedPayloadFixture();
    const resumed: ApprovalResumedPayload = approvalResumedPayloadFixture();
    const outcome: ApprovalOutcomeRecordedPayload = approvalOutcomeRecordedPayloadFixture();

    expect(requested.schema).toBe('kit-vnext.approval-requested.v1');
    expect(pending.schema).toBe('kit-vnext.approval-pending-persisted.v1');
    expect(risk.schema).toBe('kit-vnext.approval-risk-classified.v1');
    expect(decision.schema).toBe('kit-vnext.approval-decision-recorded.v1');
    expect(parked.schema).toBe('kit-vnext.approval-parked.v1');
    expect(resumed.schema).toBe('kit-vnext.approval-resumed.v1');
    expect(outcome.schema).toBe('kit-vnext.approval-outcome-recorded.v1');
  });

  it('keeps classifiedAt and parkedAt as required source timestamps', () => {
    const risk: ApprovalRiskClassifiedPayload = approvalRiskClassifiedPayloadFixture();
    const parked: ApprovalParkedPayload = approvalParkedPayloadFixture();

    expect(risk.classifiedAt).toBe('2026-06-26T09:00:30.000Z');
    expect(parked.parkedAt).toBe('2026-06-26T09:03:00.000Z');
    expect(parked.sourceEventIds).toEqual(['evt-requested-01', 'evt-decision-01']);
  });
});
