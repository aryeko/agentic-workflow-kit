import type { CapabilityGateRecordPayload } from '../../capability/evaluator/index.js';
import type {
  EvidenceEventRef,
  RunAppendFailure,
  RunAppendReceipt,
  RunEventCursor,
  RunLifecycleState,
  RunWriter,
} from '../../run-lifecycle/contracts/index.js';
import type { LeaseSnapshot, Result } from '../../../foundation/storage/index.js';
import type {
  RecoveryActionAppliedPayload,
  RecoveryActionPlannedPayload,
  RecoveryClassifiedPayload,
  RecoveryClassification,
  RecoveryPlan,
  RecoveryPlanInput,
  StaleLaunchClearanceRequestedPayload,
  StoryLaunchLeaseClearedPayload,
} from '../contracts/index.js';

export interface PlanRecoveryActionInput extends RecoveryPlanInput {
  readonly plannedAt: string;
}

export interface RecoveryCommittedPlan {
  readonly plan: RecoveryPlan;
  readonly classifiedEventId: string;
  readonly planEventId: string;
}

export interface RecordRecoveryClassifiedInput {
  readonly payload: RecoveryClassifiedPayload;
  readonly writer: RunWriter;
  readonly causationId?: string;
}

export interface RecordRecoveryPlanInput {
  readonly runId: string;
  readonly plan: RecoveryPlan;
  readonly plannedAt: string;
  readonly classifiedEventId: string;
  readonly writer: RunWriter;
  readonly causationId?: string;
}

export interface RecordRecoveryActionAppliedInput {
  readonly runId: string;
  readonly committedPlan: RecoveryCommittedPlan;
  readonly appliedAt: string;
  readonly evaluatedThrough: RunEventCursor;
  readonly writer: RunWriter;
  readonly gateRef?: CapabilityGateRecordPayload;
  readonly appliedControl?: {
    readonly kind: NonNullable<RecoveryPlan['providerControl']>;
    readonly evidenceRefs: readonly EvidenceEventRef[];
  };
  readonly staleLaunchRequest?: StaleLaunchClearanceRequestedPayload;
  readonly staleLaunchRequestEventId?: string;
  readonly activeStoryLaunchLease?: LeaseSnapshot;
}

export interface RecoveryClassifiedRecord {
  readonly payload: RecoveryClassifiedPayload;
  readonly appendReceipt: RunAppendReceipt;
  readonly eventId: string;
}

export interface RecoveryPlanRecord {
  readonly payload: RecoveryActionPlannedPayload;
  readonly appendReceipt: RunAppendReceipt;
  readonly committedPlan: RecoveryCommittedPlan;
}

export interface RecoveryApplyBlockedResult {
  readonly status: 'blocked';
  readonly reason: 'operator-required';
  readonly failureState: 'operator-required';
}

export interface RecoveryApplySuccess {
  readonly status: 'applied';
  readonly payload?: RecoveryActionAppliedPayload;
  readonly appendReceipt?: RunAppendReceipt;
  readonly clearedPayload?: StoryLaunchLeaseClearedPayload;
  readonly clearedReceipt?: RunAppendReceipt;
}

export interface RecoveryLifecycleEdgeRequest {
  readonly authority: 'recovery';
  readonly from: RunLifecycleState;
  readonly to: RunLifecycleState;
  readonly sourceEventIds: readonly string[];
}

export interface RecoveryPlansFailure {
  readonly reason: 'log-unwritable' | 'unsupported-provider-control' | 'illegal-lifecycle-edge';
  readonly phase?: 'classified' | 'plan' | 'apply';
  readonly appendFailure?: RunAppendFailure;
}

export type RecoveryPlansResult<T> = Result<T, RecoveryPlansFailure>;

export interface BuildRecoveryLifecycleEdgeRequestInput {
  readonly plan: RecoveryPlan;
  readonly from: RunLifecycleState;
  readonly recoveryEventIds: readonly string[];
}

export type RecoveryApplyResult = RecoveryPlansResult<RecoveryApplySuccess | RecoveryApplyBlockedResult>;
export type RecoveryClassifiedResult = RecoveryPlansResult<RecoveryClassifiedRecord>;
export type RecoveryPlanResult = RecoveryPlansResult<RecoveryPlanRecord>;

export const blockedResult = (): RecoveryApplyBlockedResult => ({
  status: 'blocked',
  reason: 'operator-required',
  failureState: 'operator-required',
});

export const unwritableFailure = (
  phase: 'classified' | 'plan' | 'apply',
  appendFailure: RunAppendFailure,
): RecoveryPlansFailure => ({
  reason: 'log-unwritable',
  phase,
  appendFailure,
});

export const unsupportedProviderControlFailure = (): RecoveryPlansFailure => ({
  reason: 'unsupported-provider-control',
});

export const illegalLifecycleEdgeFailure = (): RecoveryPlansFailure => ({
  reason: 'illegal-lifecycle-edge',
});
