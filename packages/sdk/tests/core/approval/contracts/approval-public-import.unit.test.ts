import { describe, expect, it } from 'vitest';

import type {
  ApprovalContext,
  ApprovalDecisionInput,
  ApprovalDecisionRecordedPayload,
  ApprovalEscalation,
  ApprovalFailureState,
  ApprovalMode,
  ApprovalOutcomeInput,
  ApprovalOutcomeRecordedPayload,
  ApprovalParkInput,
  ApprovalParkedPayload,
  ApprovalPendingPersistedPayload,
  ApprovalProjection,
  ApprovalRequest,
  ApprovalRequestedPayload,
  ApprovalResumeInput,
  ApprovalResumedPayload,
  ApprovalRisk,
  ApprovalRiskClassifiedPayload,
  ApprovalState,
  ApprovalSubject,
  Decision,
  Outcome,
  ParkDecision,
  PendingApprovalProjection,
  PolicyGrantPlan,
  PolicyGrantScope,
  ProtectedPolicyApprovalBinding,
  ResumeDecision,
} from 'sdk';

import {
  approvalContextFixture,
  approvalDecisionRecordedPayloadFixture,
  approvalOutcomeRecordedPayloadFixture,
  approvalProjectionFixture,
  approvalRequestFixture,
  approvalRequestedPayloadFixture,
  approvalResumedPayloadFixture,
  approvalRiskClassifiedPayloadFixture,
  decisionFixture,
  outcomeFixture,
  parkDecisionFixture,
  parkInputFixture,
  pendingApprovalProjectionFixture,
  policyGrantPlanFixture,
  protectedPolicyBindingFixture,
  resumeDecisionFixture,
  resumeInputFixture,
} from './fixtures.js';

describe('core-03-s1 public sdk approval imports', () => {
  it('exports the approval contracts from the sdk entrypoint', () => {
    const mode: ApprovalMode = 'assisted';
    const risk: ApprovalRisk = 'low';
    const state: ApprovalState = 'pending';
    const subject: ApprovalSubject = 'command';
    const scope: PolicyGrantScope = 'per-command';
    const failure: ApprovalFailureState = 'approval-policy-unavailable';
    const context: ApprovalContext = approvalContextFixture();
    const request: ApprovalRequest = approvalRequestFixture();
    const plan: PolicyGrantPlan = policyGrantPlanFixture();
    const decision: Decision = decisionFixture();
    const outcome: Outcome = outcomeFixture();
    const parkInput: ApprovalParkInput = parkInputFixture();
    const parkDecision: ParkDecision = parkDecisionFixture();
    const resumeInput: ApprovalResumeInput = resumeInputFixture();
    const resumeDecision: ResumeDecision = resumeDecisionFixture();
    const pending: PendingApprovalProjection = pendingApprovalProjectionFixture();
    const projection: ApprovalProjection = approvalProjectionFixture();
    const binding: ProtectedPolicyApprovalBinding = protectedPolicyBindingFixture();
    const requestedPayload: ApprovalRequestedPayload = approvalRequestedPayloadFixture();
    const riskPayload: ApprovalRiskClassifiedPayload = approvalRiskClassifiedPayloadFixture();
    const decisionPayload: ApprovalDecisionRecordedPayload<'protected-policy-change'> =
      approvalDecisionRecordedPayloadFixture('protected-policy-change');
    const pendingPayload: ApprovalPendingPersistedPayload = {
      schema: 'kit-vnext.approval-pending-persisted.v1',
      requestId: request.requestId,
      runId: request.runId,
      sessionId: request.sessionId,
      answerChannelRef: request.answerChannelRef,
      answerChannelPersistable: request.answerChannelPersistable,
      decisionDeadline: '2026-06-26T09:10:00.000Z',
      policyRef: request.policyRef,
      sourceRequestEventId: 'evt-requested-01',
      recordedAt: '2026-06-26T09:00:01.000Z',
    };
    const parkedPayload: ApprovalParkedPayload = {
      schema: 'kit-vnext.approval-parked.v1',
      requestId: request.requestId,
      runId: request.runId,
      sessionId: request.sessionId,
      reason: 'operator-attention',
      decisionDeadline: '2026-06-26T09:10:00.000Z',
      parkedAt: '2026-06-26T09:03:00.000Z',
      sourceEventIds: ['evt-requested-01', 'evt-decision-01'],
    };
    const resumedPayload: ApprovalResumedPayload = approvalResumedPayloadFixture();
    const outcomePayload: ApprovalOutcomeRecordedPayload = approvalOutcomeRecordedPayloadFixture();
    const decisionInput: ApprovalDecisionInput = {
      request,
      risk,
      mode,
      policy: {} as never,
      replay: {} as never,
      projections: {} as never,
      evaluatedAt: '2026-06-26T09:01:00.000Z',
    };
    const outcomeInput: ApprovalOutcomeInput = {
      request,
      decision,
      recordedAt: '2026-06-26T09:02:00.000Z',
    };
    const escalation: ApprovalEscalation = {
      normalize: () => request,
      classify: () => risk,
      decide: () => decision,
      park: () => parkDecision,
      recordOutcome: () => outcome,
      resumePending: () => resumeDecision,
    };

    expect(mode).toBe('assisted');
    expect(risk).toBe('low');
    expect(state).toBe('pending');
    expect(subject).toBe('command');
    expect(scope).toBe('per-command');
    expect(failure).toBe('approval-policy-unavailable');
    expect(context.promptRef).toBe('artifact://prompt-01');
    expect(request.requestId).toBe('request-01');
    expect(plan.scope).toBe('per-command');
    expect(decision.decision).toBe('grant');
    expect(outcome.outcome).toBe('answered');
    expect(parkInput.reason).toBe('operator-attention');
    expect(parkDecision.sourceEventIds).toEqual(['evt-requested-01', 'evt-decision-01']);
    expect(resumeInput.decisionEventId).toBe('evt-decision-01');
    expect(resumeDecision.outcome).toBe('resume');
    expect(pending.decisionDeadline).toBe('2026-06-26T09:10:00.000Z');
    expect(projection.operatorAttention?.reason).toBe('parked');
    expect(binding.protectedPolicySnapshotEventId).toBe('evt-policy-snapshot-01');
    expect(requestedPayload.schema).toBe('kit-vnext.approval-requested.v1');
    expect(riskPayload.schema).toBe('kit-vnext.approval-risk-classified.v1');
    expect(decisionPayload.protectedPolicyBinding.protectedPolicySnapshotEventId).toBe('evt-policy-snapshot-01');
    expect(pendingPayload.schema).toBe('kit-vnext.approval-pending-persisted.v1');
    expect(parkedPayload.schema).toBe('kit-vnext.approval-parked.v1');
    expect(resumedPayload.schema).toBe('kit-vnext.approval-resumed.v1');
    expect(outcomePayload.schema).toBe('kit-vnext.approval-outcome-recorded.v1');
    expect(decisionInput.evaluatedAt).toBe('2026-06-26T09:01:00.000Z');
    expect(outcomeInput.recordedAt).toBe('2026-06-26T09:02:00.000Z');
    expect(escalation.decide(decisionInput).decisionId).toBe('decision-01');
  });
});
