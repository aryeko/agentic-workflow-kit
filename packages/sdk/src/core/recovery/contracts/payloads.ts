import type { CapabilityGateRecordPayload } from '../../capability/evaluator/index.js';
import type { EvidenceEventRef, RunEventCursor, RunLifecycleState } from '../../run-lifecycle/contracts/index.js';

import type { ActionSafetyClass, ProviderControlKind, RecoveryAction, RecoveryState } from './catalogs.js';

export interface StoryLaunchLeaseAcquiredPayload {
  readonly schema: 'kit-vnext.story-launch-lease-acquired.v1';
  readonly runId: string;
  readonly storyLaunchKey: string;
  readonly leaseEpoch: number;
  readonly acquiredAt: string;
  readonly sourceEventIds: readonly string[];
}

export interface DuplicateLaunchBlockedPayload {
  readonly schema: 'kit-vnext.duplicate-launch-blocked.v1';
  readonly runId: string;
  readonly storyLaunchKey: string;
  readonly incumbentLeaseEpoch: number;
  readonly blockedAt: string;
  readonly sourceEventIds: readonly string[];
}

export interface RecoveryClassifiedPayload {
  readonly schema: 'kit-vnext.recovery-classified.v1';
  readonly runId: string;
  readonly recoveryState: RecoveryState;
  readonly actionSafety: ActionSafetyClass;
  readonly recommendedAction: RecoveryAction;
  readonly classifierRuleVersion: string;
  readonly cursor: RunEventCursor;
  readonly evidenceRefs: readonly EvidenceEventRef[];
  readonly classifiedAt: string;
}

export interface RecoveryActionPlannedPayload {
  readonly schema: 'kit-vnext.recovery-action-planned.v1';
  readonly runId: string;
  readonly planId: string;
  readonly selectedAction: RecoveryAction;
  readonly requiredGate?: 'auto-recover';
  readonly lifecycleTarget?: RunLifecycleState;
  readonly providerControl?: ProviderControlKind;
  readonly plannedAt: string;
  readonly sourceEventIds: readonly string[];
}

export interface RecoveryActionAppliedPayload {
  readonly schema: 'kit-vnext.recovery-action-applied.v1';
  readonly runId: string;
  readonly planId: string;
  readonly appliedControl: ProviderControlKind;
  readonly gateRef?: CapabilityGateRecordPayload;
  readonly appliedEvidenceRefs: readonly EvidenceEventRef[];
  readonly appliedAt: string;
  readonly sourceEventIds: readonly string[];
}

export interface StaleLaunchClearanceRequestedPayload {
  readonly schema: 'kit-vnext.stale-launch-clearance-requested.v1';
  readonly runId: string;
  readonly storyLaunchKey: string;
  readonly expiredLeaseEpoch: number;
  readonly nextLeaseEpoch: number;
  readonly requestedAt: string;
  readonly evidenceRefs: readonly EvidenceEventRef[];
}

export interface StoryLaunchLeaseClearedPayload {
  readonly schema: 'kit-vnext.story-launch-lease-cleared.v1';
  readonly runId: string;
  readonly storyLaunchKey: string;
  readonly clearedLeaseEpoch: number;
  readonly clearedAt: string;
  readonly sourceEventIds: readonly string[];
}

export interface ReconciliationBlockedPayload {
  readonly schema: 'kit-vnext.reconciliation-blocked.v1';
  readonly runId: string;
  readonly recoveryState: RecoveryState;
  readonly parkedReason: string;
  readonly severity: 'operator-attention' | 'info';
  readonly evidenceRefs: readonly EvidenceEventRef[];
  readonly cursor: RunEventCursor;
  readonly blockedAt: string;
}
