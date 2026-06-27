import type {
  EvidenceEventRef,
  Result,
  RunAppendFailure,
  RunAppendReceipt,
  RunWriter,
} from '../../run-lifecycle/contracts/index.js';
import type {
  BlockerEvidenceEligibleCompletionState,
  BlockerEvidenceEligibleMergeState,
  CompletionDecisionPayload,
  CompletionDecisionState,
  ForgeOperationIntentPayload,
  MergeDecisionPayload,
  MergeDecisionState,
  MergeIntentPayload,
} from '../contracts/index.js';

export type ForgeOperationKind = ForgeOperationIntentPayload['operation'];
export type BlockerEvidenceOperation = Exclude<ForgeOperationKind, 'update-branch'>;
export type MergeIntentOperation = MergeIntentPayload['operation'];

export interface ExactHeadEvidence {
  readonly headSha?: string;
  readonly clean: boolean;
  readonly evidenceRefs?: readonly EvidenceEventRef[];
}

export interface RecordForgeOperationIntentInput {
  readonly runId: string;
  readonly recordedAt: string;
  readonly operation: ForgeOperationKind;
  readonly policyRef: string;
  readonly decisionEventId: string;
  readonly expectedHeadSha?: string;
  readonly localHead: ExactHeadEvidence;
  readonly evidenceRefs: readonly EvidenceEventRef[];
  readonly purpose?: ForgeOperationIntentPayload['purpose'];
  readonly blockerState?: ForgeOperationIntentPayload['blockerState'];
}

export interface ForgeOperationIntentCommit {
  readonly intent: ForgeOperationIntentPayload;
  readonly intentEventId: string;
  readonly appendReceipt: RunAppendReceipt;
}

export interface ForgeOperationIntentFailure {
  readonly token: 'event-log-unwritable' | 'head-ambiguous' | 'workspace-dirty';
  readonly appendFailure?: RunAppendFailure;
}

export interface MergeDecisionRef {
  readonly eventId: string;
  readonly decision: MergeDecisionPayload;
}

export interface RecordMergeIntentInput {
  readonly runId: string;
  readonly recordedAt: string;
  readonly operation: MergeIntentOperation;
  readonly policyRef: string;
  readonly gateEventId?: string;
  readonly mergeDecision: MergeDecisionRef;
}

export interface MergeIntentCommit {
  readonly intent: MergeIntentPayload;
  readonly intentEventId: string;
  readonly appendReceipt: RunAppendReceipt;
}

export interface MergeIntentFailure {
  readonly token: MergeDecisionState;
  readonly appendFailure?: RunAppendFailure;
}

export type BlockerDecisionRef =
  | {
      readonly kind: 'completion';
      readonly eventId: string;
      readonly decision: CompletionDecisionPayload;
    }
  | {
      readonly kind: 'merge';
      readonly eventId: string;
      readonly decision: MergeDecisionPayload;
    };

export interface RecordBlockerEvidenceIntentInput {
  readonly runId: string;
  readonly recordedAt: string;
  readonly operation: BlockerEvidenceOperation;
  readonly policyRef: string;
  readonly runnerMayPush: boolean;
  readonly runnerMayOpenPr: boolean;
  readonly localHead: ExactHeadEvidence;
  readonly decision: BlockerDecisionRef;
}

export interface BlockerEvidenceIntentCommit extends ForgeOperationIntentCommit {}

export interface BlockerEvidenceIntentFailure {
  readonly token: CompletionDecisionState | MergeDecisionState;
  readonly appendFailure?: RunAppendFailure;
}

export interface CompletionBlockerEligibility {
  readonly eligible: true;
  readonly blockerState: BlockerEvidenceEligibleCompletionState;
}

export interface MergeBlockerEligibility {
  readonly eligible: true;
  readonly blockerState: BlockerEvidenceEligibleMergeState;
}

export interface IntentsDependencies {
  readonly writer: RunWriter;
}

export type ForgeOperationIntentResult = Promise<Result<ForgeOperationIntentCommit, ForgeOperationIntentFailure>>;
export type MergeIntentResult = Promise<Result<MergeIntentCommit, MergeIntentFailure>>;
export type BlockerEvidenceIntentResult = Promise<Result<BlockerEvidenceIntentCommit, BlockerEvidenceIntentFailure>>;
