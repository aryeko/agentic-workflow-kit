import type { ApprovalSubject } from './unions.js';
import type { Decision, Outcome, ProtectedPolicyApprovalBinding, ApprovalRequest } from './values.js';
import type { ApprovalRisk } from './unions.js';
import type { ScopedGrant } from '../../../providers/agent/index.js';

export interface ApprovalRequestedPayload {
  readonly schema: 'kit-vnext.approval-requested.v1';
  readonly request: ApprovalRequest;
  readonly sourceAgentEventId: string;
  readonly recordedAt: string;
}

export interface ApprovalPendingPersistedPayload {
  readonly schema: 'kit-vnext.approval-pending-persisted.v1';
  readonly requestId: string;
  readonly runId: string;
  readonly sessionId: string;
  readonly answerChannelRef: string;
  readonly answerChannelPersistable: boolean;
  readonly liveAnswerDeadline?: string;
  readonly decisionDeadline: string;
  readonly policyRef: string;
  readonly sourceRequestEventId: string;
  readonly recordedAt: string;
}

export interface ApprovalRiskClassifiedPayload {
  readonly schema: 'kit-vnext.approval-risk-classified.v1';
  readonly requestId: string;
  readonly risk: ApprovalRisk;
  readonly triggeredRuleIds: readonly string[];
  readonly evidenceEventIds: readonly string[];
  readonly classifiedAt: string;
}

type ApprovalDecisionRecordedBasePayload = {
  readonly schema: 'kit-vnext.approval-decision-recorded.v1';
  readonly decision: Decision;
  readonly operatorDecisionEventId?: string;
  readonly capabilityGateEventId?: string;
  readonly sourceEventIds: readonly string[];
};

export type ApprovalDecisionRecordedPayload<TSubject extends ApprovalSubject = ApprovalSubject> =
  ApprovalDecisionRecordedBasePayload &
    (TSubject extends 'protected-policy-change'
      ? { readonly protectedPolicyBinding: ProtectedPolicyApprovalBinding }
      : { readonly protectedPolicyBinding?: ProtectedPolicyApprovalBinding });

export interface ApprovalParkedPayload {
  readonly schema: 'kit-vnext.approval-parked.v1';
  readonly requestId: string;
  readonly runId: string;
  readonly sessionId: string;
  readonly reason: 'live-window-elapsed' | 'live-only-channel' | 'operator-attention';
  readonly decisionDeadline: string;
  readonly parkedAt: string;
  readonly sourceEventIds: readonly string[];
}

export interface ApprovalResumedPayload {
  readonly schema: 'kit-vnext.approval-resumed.v1';
  readonly requestId: string;
  readonly runId: string;
  readonly sessionId: string;
  readonly decisionEventId: string;
  readonly grant: ScopedGrant;
  readonly resumedAt: string;
  readonly sourceEventIds: readonly string[];
}

export interface ApprovalOutcomeRecordedPayload {
  readonly schema: 'kit-vnext.approval-outcome-recorded.v1';
  readonly outcome: Outcome;
  readonly sourceEventIds: readonly string[];
}
