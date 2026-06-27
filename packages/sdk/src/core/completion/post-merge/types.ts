import type {
  EvidenceEventRef,
  Result,
  RunAppendFailure,
  RunAppendReceipt,
  RunWriter,
} from '../../run-lifecycle/contracts/index.js';
import type { MergeIntentPayload, PostMergeOutcomePayload } from '../contracts/index.js';
import type { ForgeActionResult } from '../../../providers/forge/index.js';

export type PostMergeActionEventType =
  | 'ForgeActionRefused'
  | 'ForgeMergeQueued'
  | 'ForgePullRequestMerged'
  | (string & {});

export interface MergeIntentRef {
  readonly eventId: string;
  readonly intent: MergeIntentPayload;
}

export interface RecordPostMergeOutcomeInput {
  readonly runId: string;
  readonly evaluatedAt: string;
  readonly mergeIntent: MergeIntentRef;
  readonly sourceActionEventId: string;
  readonly sourceActionEventType: PostMergeActionEventType;
  readonly actionResult?: ForgeActionResult;
  readonly exactHeadEvidenceRefs: readonly EvidenceEventRef[];
}

export interface PostMergeOutcomeCommit {
  readonly outcome: PostMergeOutcomePayload;
  readonly outcomeEventId: string;
  readonly appendReceipt: RunAppendReceipt;
}

export interface PostMergeOutcomeFailure {
  readonly token: 'event-log-unwritable';
  readonly appendFailure: RunAppendFailure;
}

export interface PostMergeDependencies {
  readonly writer: RunWriter;
}

export type PostMergeOutcomeResult = Promise<Result<PostMergeOutcomeCommit, PostMergeOutcomeFailure>>;
