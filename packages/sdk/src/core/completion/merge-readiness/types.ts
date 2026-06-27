import type { CapabilityGateRecordPayload, CapabilityGateScope } from '../../capability/evaluator/index.js';
import type {
  EvidenceEventRef,
  Result,
  RunAppendFailure,
  RunAppendReceipt,
  RunWriter,
} from '../../run-lifecycle/contracts/index.js';
import type { CompletionDecisionState, MergeDecisionPayload } from '../contracts/index.js';
import type { ForgeEvidenceSnapshot } from '../../../providers/forge/index.js';

export type MergeMethod = 'merge' | 'squash' | 'rebase';
export type RequiredMergeEvidence = 'verification' | 'ci' | 'review' | 'threads-resolved' | 'protection';

export interface MergeReadinessCompletionInput {
  readonly eventId: string;
  readonly state: CompletionDecisionState;
  readonly headSha?: string;
}

export interface MergeReadinessPolicyInput {
  readonly policyRef: string;
  readonly runnerMayMerge: boolean;
  readonly requiredEvidence: readonly RequiredMergeEvidence[];
  readonly allowedMethod?: MergeMethod;
  readonly selectedMethod?: MergeMethod;
}

export interface MergeReadinessLocalInput {
  readonly headSha?: string;
  readonly clean: boolean;
  readonly changedFilesAllowed: boolean;
  readonly verificationFresh: boolean;
}

export interface MergeReadinessForgeInput {
  readonly ref: EvidenceEventRef;
  readonly snapshot?: ForgeEvidenceSnapshot;
  readonly protectionFresh: boolean;
  readonly expectedBaseSha?: string;
}

export interface MergeReadinessGateInput {
  readonly record?: CapabilityGateRecordPayload;
  readonly ref?: EvidenceEventRef;
  readonly pullRequestRef: string;
  readonly providerScopes: CapabilityGateScope['providerScopes'];
  readonly evidenceRefs: readonly string[];
}

export interface MergeAllowedInput {
  readonly candidateHeadSha?: string;
  readonly completionDecision: MergeReadinessCompletionInput;
  readonly policy: MergeReadinessPolicyInput;
  readonly local: MergeReadinessLocalInput;
  readonly forge?: MergeReadinessForgeInput;
  readonly gate?: MergeReadinessGateInput;
}

export interface EvaluateMergeReadinessInput extends Omit<MergeAllowedInput, 'candidateHeadSha'> {
  readonly runId: string;
  readonly evaluatedAt: string;
  readonly candidateHeadSha: string;
}

export interface MergeReadinessCommit {
  readonly decision: MergeDecisionPayload;
  readonly decisionEventId: string;
  readonly appendReceipt: RunAppendReceipt;
}

export interface MergeReadinessFailure {
  readonly token: 'merge-intent-unwritable';
  readonly appendFailure: RunAppendFailure;
}

export interface MergeReadinessDependencies {
  readonly writer: RunWriter;
}

export interface MergeReadinessDetails {
  readonly state: MergeDecisionPayload['state'];
  readonly gateRef?: CapabilityGateRecordPayload;
  readonly forgeRefs: readonly EvidenceEventRef[];
}

export type MergeReadinessResult = Promise<Result<MergeReadinessCommit, MergeReadinessFailure>>;
