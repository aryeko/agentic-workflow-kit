import type { CapabilityMode } from '../../capability/registry/index.js';
import type {
  CapabilityGateRecordPayload,
  CapabilityGateRequest,
  CapabilityGateScope,
} from '../../capability/evaluator/index.js';
import type {
  EvidenceEventRef,
  RunAppendFailure,
  RunAppendReceipt,
  RunEventCursor,
  RunLaunchProjection,
  RunLifecycleState,
  RunStateProjection,
  RunWriter,
} from '../../run-lifecycle/contracts/index.js';
import type { LivenessProjection } from '../../supervision/contracts/index.js';
import type { LeaseSnapshot, StorageHealth } from '../../../foundation/storage/index.js';
import type {
  CompletionDecisionState,
  MergeDecisionState,
  PostMergeOutcomeState,
} from '../../completion/contracts/index.js';

import type { ActionSafetyClass, ProviderControlKind, RecoveryAction, RecoveryState } from './catalogs.js';

export interface RecoveryEvidenceSnapshot {
  readonly runId: string;
  readonly evaluatedThrough: RunEventCursor;
  readonly observedAt: string;
  readonly state: RunStateProjection;
  readonly launch: RunLaunchProjection;
  readonly liveness?: LivenessProjection;
  readonly leases: {
    readonly runWriter?: LeaseSnapshot;
    readonly storyLaunch?: LeaseSnapshot;
    readonly leaseHealth: StorageHealth;
  };
  readonly evidenceRefs: readonly EvidenceEventRef[];
  readonly providerGaps: readonly string[];
  readonly completion?: {
    readonly latestDecisionState?: CompletionDecisionState;
    readonly latestMergeState?: MergeDecisionState;
    readonly postMergeOutcome?: PostMergeOutcomeState;
  };
  readonly ownership?: {
    readonly ownerState: 'none' | 'owned' | 'foreign' | 'unknown' | 'ambiguous';
    readonly sessionId?: string;
    readonly workerHandleId?: string;
    readonly canResumeOwned?: boolean;
    readonly resumeEvidenceRef?: EvidenceEventRef;
  };
  readonly termination?: {
    readonly state: 'none' | 'requested' | 'confirmed' | 'ambiguous';
    readonly evidenceRefs: readonly EvidenceEventRef[];
    readonly proofRef?: string;
    readonly containmentEmpty?: boolean;
    readonly terminatedAt?: string;
  };
  readonly approval?: {
    readonly state: 'none' | 'pending' | 'parked' | 'unknown' | 'ambiguous';
    readonly evidenceRefs: readonly EvidenceEventRef[];
  };
  readonly workSource?: {
    readonly claimState: 'unknown' | 'empty' | 'claimed' | 'released' | 'ambiguous';
    readonly evidenceRefs: readonly EvidenceEventRef[];
  };
  readonly process?: {
    readonly state: 'unknown' | 'empty' | 'active' | 'ambiguous';
    readonly evidenceRefs: readonly EvidenceEventRef[];
  };
  readonly manualEditRefs?: readonly EvidenceEventRef[];
}

export interface RecoveryClassification {
  readonly state: RecoveryState;
  readonly actionSafety: ActionSafetyClass;
  readonly recommendedAction: RecoveryAction;
  readonly reason: string;
  readonly requiredGate?: 'auto-recover';
  readonly evidenceRefs: readonly EvidenceEventRef[];
}

export interface RecoveryPlanInput {
  readonly runId: string;
  readonly mode: CapabilityMode;
  readonly policyRef: string;
  readonly requestedAction: RecoveryAction;
  readonly scope: CapabilityGateScope;
  readonly evaluatedThrough: RunEventCursor;
}

interface RecoveryRecordInputBase {
  readonly runId: string;
  readonly plan: RecoveryPlan;
  readonly appliedControl?: {
    readonly kind: NonNullable<RecoveryPlan['providerControl']>;
    readonly evidenceRefs: readonly EvidenceEventRef[];
  };
  readonly gateRef?: CapabilityGateRecordPayload;
  readonly evaluatedThrough: RunEventCursor;
  readonly sourceEventIds: readonly string[];
}

export type RecoveryRecordInput =
  | (RecoveryRecordInputBase & {
      readonly outcome: 'applied';
      readonly blockedReason?: never;
    })
  | (RecoveryRecordInputBase & {
      readonly outcome: 'blocked';
      readonly blockedReason: string;
    });

export interface RecoveryPlan {
  readonly planId: string;
  readonly classification: RecoveryClassification;
  readonly selectedAction: RecoveryAction;
  readonly requiresGate?: CapabilityGateRequest;
  readonly lifecycleTarget?: RunLifecycleState;
  readonly providerControl?: ProviderControlKind;
  readonly sourceEventIds: readonly string[];
}

export interface RecoveryCoordinator {
  classify(snapshot: RecoveryEvidenceSnapshot): RecoveryClassification;
  plan(input: RecoveryPlanInput, classification: RecoveryClassification): RecoveryPlan;
  record(input: RecoveryRecordInput, writer: RunWriter): RunAppendReceipt | RunAppendFailure;
}
