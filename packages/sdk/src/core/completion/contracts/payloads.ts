import type { CapabilityGateRecordPayload } from '../../capability/evaluator/index.js';
import type { EvidenceEventRef, RunEventCursor } from '../../run-lifecycle/contracts/index.js';

import type {
  BlockerEvidenceEligibleState,
  CompletionDecisionState,
  MergeDecisionState,
  PostMergeOutcomeState,
} from './catalogs.js';

type ForgeOperationIntent = 'push-branch' | 'upsert-pr' | 'publish-blocker-evidence' | 'update-branch';
type MergeIntentOperation = 'enqueue' | 'merge';
type PostMergeLifecycleTarget = 'completed' | 'merge-waiting' | 'blocked' | 'failed';

export interface CompletionDecisionPayload {
  readonly schema: 'kit-vnext.completion-decision-recorded.v1';
  readonly runId: string;
  readonly state: CompletionDecisionState;
  readonly headSha?: string;
  readonly cursor: RunEventCursor;
  readonly evidenceRefs: readonly EvidenceEventRef[];
  readonly failureReason?: string;
  readonly evaluatedAt: string;
}

export interface MergeDecisionPayload {
  readonly schema: 'kit-vnext.merge-decision-recorded.v1';
  readonly runId: string;
  readonly state: MergeDecisionState;
  readonly headSha: string;
  readonly completionEventId: string;
  readonly gateRef?: CapabilityGateRecordPayload;
  readonly forgeRefs: readonly EvidenceEventRef[];
  readonly evaluatedAt: string;
}

export interface ProtectedPolicySnapshotRecordedPayload {
  readonly schema: 'kit-vnext.protected-policy-snapshot-recorded.v1';
  readonly runId: string;
  readonly policyRef: string;
  readonly policyDigest: string;
  readonly baseSha: string;
  readonly verifierCommandDigest: string;
  readonly protectedPathSets: readonly {
    readonly label: string;
    readonly digest: string;
    readonly paths: readonly string[];
  }[];
  readonly recordedAt: string;
}

export interface ForgeOperationIntentPayload {
  readonly schema: 'kit-vnext.forge-operation-intent-recorded.v1';
  readonly runId: string;
  readonly operation: ForgeOperationIntent;
  readonly expectedHeadSha: string;
  readonly policyRef: string;
  readonly decisionEventId: string;
  readonly evidenceRefs: readonly EvidenceEventRef[];
  readonly purpose?: 'blocker-evidence-pr';
  readonly blockerState?: BlockerEvidenceEligibleState;
  readonly recordedAt: string;
}

export interface MergeIntentPayload {
  readonly schema: 'kit-vnext.merge-intent-recorded.v1';
  readonly runId: string;
  readonly operation: MergeIntentOperation;
  readonly expectedHeadSha: string;
  readonly policyRef: string;
  readonly gateEventId: string;
  readonly mergeDecisionEventId: string;
  readonly recordedAt: string;
}

export interface PostMergeOutcomePayload {
  readonly schema: 'kit-vnext.post-merge-outcome-recorded.v1';
  readonly runId: string;
  readonly state: PostMergeOutcomeState;
  readonly headSha: string;
  readonly sourceActionEventId: string;
  readonly evidenceRefs: readonly EvidenceEventRef[];
  readonly lifecycleTarget: PostMergeLifecycleTarget;
  readonly recordedAt: string;
}
