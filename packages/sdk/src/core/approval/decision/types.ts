import type { CapabilityGateRecordPayload } from '../../capability/evaluator/index.js';
import type {
  AppendIntent,
  Result,
  RunAppendFailure,
  RunAppendReceipt,
  RunProjections,
  RunReplay,
  RunWriter,
} from '../../run-lifecycle/contracts/index.js';
import type { ResolvedPolicy } from '../../../foundation/configuration-policy/index.js';

import type {
  ApprovalDecisionRecordedPayload,
  ApprovalMode,
  ApprovalRequest,
  ApprovalRisk,
  ApprovalRiskClassifiedPayload,
  Decision,
  PolicyGrantPlan,
  ProtectedPolicyApprovalBinding,
} from '../contracts/index.js';

export type ApprovalDecisionIdGenerator = () => string;

export interface ApprovalRiskClassificationInput {
  readonly request: ApprovalRequest;
  readonly policy?: ResolvedPolicy;
  readonly replay: RunReplay;
  readonly projections: RunProjections;
  readonly classifiedAt: string;
  readonly requestEvidenceRefs?: readonly string[];
}

export interface ApprovalRiskClassification {
  readonly risk: ApprovalRisk;
  readonly triggeredRuleIds: readonly string[];
  readonly evidenceEventIds: readonly string[];
  readonly classifiedAt: string;
}

export interface ApprovalRiskClassificationFailure {
  readonly failureState: 'approval-policy-unavailable';
  readonly reason: string;
}

export type ApprovalRiskClassificationResult = Result<ApprovalRiskClassification, ApprovalRiskClassificationFailure>;

export interface RecordApprovalRiskClassifiedInput {
  readonly requestId: string;
  readonly classification: ApprovalRiskClassification;
}

export interface ApprovalRiskRecordCommit {
  readonly payload: ApprovalRiskClassifiedPayload;
  readonly eventId: string;
  readonly appendReceipt: RunAppendReceipt;
}

export interface ApprovalRiskRecordFailure {
  readonly failureState: 'approval-event-log-unavailable';
  readonly appendFailure: RunAppendFailure;
}

export type ApprovalRiskRecordResult = Promise<Result<ApprovalRiskRecordCommit, ApprovalRiskRecordFailure>>;

export type ApprovalAutoGrantGate =
  | {
      readonly status: 'allow' | 'deny';
      readonly eventId: string;
      readonly record: CapabilityGateRecordPayload;
    }
  | {
      readonly status: 'append-failed';
    };

export interface DecideApprovalInput {
  readonly request: ApprovalRequest;
  readonly risk: ApprovalRisk;
  readonly mode: ApprovalMode;
  readonly policy?: ResolvedPolicy;
  readonly replay: RunReplay;
  readonly projections: RunProjections;
  readonly evaluatedAt: string;
  readonly ids: ApprovalDecisionIdGenerator;
  readonly requestEvidenceRefs?: readonly string[];
  readonly policySourceEventIds?: readonly string[];
  readonly autoGrantGate?: ApprovalAutoGrantGate;
  readonly operatorDecisionEventId?: string;
  readonly consultOrchestrator?: boolean;
}

export interface ApprovalDecisionComputation {
  readonly decision: Decision;
  readonly failureState?:
    | 'approval-risk-high'
    | 'approval-session-ambiguous'
    | 'approval-gate-denied'
    | 'approval-gate-unwritable';
  readonly matchedRule?: ResolvedPolicy['policy']['escalationPolicy']['grantRules'][number];
  readonly policyGrantPlan?: PolicyGrantPlan;
}

export interface ApprovalDecisionFailure {
  readonly failureState: 'approval-policy-unavailable';
  readonly reason: string;
}

export type ApprovalDecisionResult = Result<ApprovalDecisionComputation, ApprovalDecisionFailure>;

export interface RecordApprovalDecisionInput {
  readonly request: ApprovalRequest;
  readonly decision: Decision;
  readonly sourceEventIds: readonly string[];
  readonly operatorDecisionEventId?: string;
  readonly capabilityGateEventId?: string;
  readonly protectedPolicyBinding?: ProtectedPolicyApprovalBinding;
}

export interface ApprovalDecisionRecordCommit {
  readonly payload: ApprovalDecisionRecordedPayload;
  readonly eventId: string;
  readonly appendReceipt: RunAppendReceipt;
}

export interface ApprovalDecisionRecordFailure {
  readonly reason:
    | 'approval-event-log-unavailable'
    | 'protected-policy-binding-required'
    | 'protected-policy-binding-forbidden';
  readonly appendFailure?: RunAppendFailure;
}

export type ApprovalDecisionRecordResult = Promise<Result<ApprovalDecisionRecordCommit, ApprovalDecisionRecordFailure>>;

export type ApprovalRecordIntent<TPayload> = AppendIntent<TPayload>;
export type ApprovalRecordWriter = RunWriter;
