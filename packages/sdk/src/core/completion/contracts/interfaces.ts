import type {
  EvidenceEventRef,
  RunEventCursor,
  RunProjections,
  RunReplay,
} from '../../run-lifecycle/contracts/index.js';

import type { CompletionDecisionPayload, MergeDecisionPayload } from './payloads.js';

export interface CompletionReplayAnchor {
  readonly runId: string;
  readonly evaluatedThrough: RunEventCursor;
  readonly writerEpoch?: number;
  readonly headSha: string;
  readonly evidenceRefs: readonly EvidenceEventRef[];
}

export interface CompletionEvidenceSet {
  readonly anchor: CompletionReplayAnchor;
  readonly localGit: EvidenceEventRef;
  readonly verification?: {
    readonly command: EvidenceEventRef;
    readonly preLocalGit: EvidenceEventRef;
    readonly postLocalGit: EvidenceEventRef;
  };
  readonly forge?: EvidenceEventRef;
  readonly capabilityGate?: EvidenceEventRef;
  readonly workerClaim?: EvidenceEventRef;
  readonly protectedPolicySnapshot: EvidenceEventRef;
  readonly recordedOperatorDecision?: EvidenceEventRef;
}

export interface CompletionMergeEvaluator {
  evaluateCompletion(
    input: {
      readonly runId: string;
      readonly evaluatedThrough: RunEventCursor;
      readonly policyRef: string;
      readonly evaluatedAt: string;
    },
    replay: RunReplay,
    projections: RunProjections,
  ): CompletionDecisionPayload;

  evaluateMerge(
    input: {
      readonly runId: string;
      readonly completionEventId: string;
      readonly policyRef: string;
      readonly evaluatedAt: string;
    },
    replay: RunReplay,
    projections: RunProjections,
  ): MergeDecisionPayload;
}
