import type {
  AppendIntent,
  EvidenceEventRef,
  Result,
  RunAppendFailure,
  RunAppendReceipt,
  RunWriter,
} from '../../run-lifecycle/contracts/index.js';
import type { PostMergeOutcomePayload } from '../contracts/index.js';
import type { ForgeFailureToken } from '../../../providers/forge/index.js';
import { dedupeEvidenceEventRefs } from '../contracts/evidence-refs.js';

import type { RecordPostMergeOutcomeInput } from './types.js';

const RETRYABLE_REFUSAL_TOKENS = new Set<ForgeFailureToken>(['forge-rate-limited', 'forge-merge-queue-unavailable']);
const BLOCKED_REFUSAL_TOKENS = new Set<ForgeFailureToken>([
  'forge-protection-uninspectable',
  'forge-review-threads-uninspectable',
  'forge-rulesets-unattested',
]);
const FAILED_REFUSAL_TOKENS = new Set<ForgeFailureToken>([
  'forge-admin-bypass-refused',
  'forge-auth-denied',
  'forge-credential-unavailable',
  'forge-ghes-capability-unknown',
  'forge-redaction-unavailable',
]);

export const uniqueEvidenceRefs = (refs: readonly EvidenceEventRef[] | undefined): readonly EvidenceEventRef[] =>
  dedupeEvidenceEventRefs(refs);

export const appendBarrierEvent = async <TPayload>(
  writer: RunWriter,
  type: string,
  occurredAt: string,
  payload: TPayload,
): Promise<Result<RunAppendReceipt, RunAppendFailure>> => {
  const appendIntent: AppendIntent<TPayload> = {
    domain: 'core-05',
    type,
    durability: 'barrier',
    payload,
    occurredAt,
  };

  return Promise.resolve(writer.append([appendIntent]));
};

export const buildOutcome = (
  input: RecordPostMergeOutcomeInput,
  state: PostMergeOutcomePayload['state'],
  lifecycleTarget: PostMergeOutcomePayload['lifecycleTarget'],
): PostMergeOutcomePayload => ({
  schema: 'kit-vnext.post-merge-outcome-recorded.v1',
  runId: input.runId,
  state,
  headSha: input.mergeIntent.intent.expectedHeadSha,
  sourceActionEventId: input.sourceActionEventId,
  evidenceRefs: uniqueEvidenceRefs(input.exactHeadEvidenceRefs),
  lifecycleTarget,
  recordedAt: input.evaluatedAt,
});

export const buildAmbiguousOutcome = (input: RecordPostMergeOutcomeInput): PostMergeOutcomePayload =>
  buildOutcome(input, 'post-merge-outcome-ambiguous', 'blocked');

export const hasDurableExactHeadEvidenceRefs = (input: RecordPostMergeOutcomeInput): boolean =>
  uniqueEvidenceRefs(input.exactHeadEvidenceRefs).length > 0;

export const isAcceptedMergedEvent = (input: RecordPostMergeOutcomeInput): boolean =>
  input.sourceActionEventType === 'ForgePullRequestMerged';

export const isRefusedEvent = (input: RecordPostMergeOutcomeInput): boolean =>
  input.sourceActionEventType === 'ForgeActionRefused';

export const hasExactObservedHead = (input: RecordPostMergeOutcomeInput): boolean => {
  const observedHeadSha = input.actionResult?.observedHeadSha;
  const expectedHeadSha = input.mergeIntent.intent.expectedHeadSha;

  return observedHeadSha !== undefined && observedHeadSha.length > 0 && observedHeadSha === expectedHeadSha;
};

export const mapExactHeadRefusalToken = (
  token: ForgeFailureToken,
): Pick<PostMergeOutcomePayload, 'state' | 'lifecycleTarget'> | undefined => {
  if (RETRYABLE_REFUSAL_TOKENS.has(token)) {
    return {
      state: 'post-merge-retryable-refused',
      lifecycleTarget: 'merge-waiting',
    };
  }

  if (BLOCKED_REFUSAL_TOKENS.has(token)) {
    return {
      state: 'post-merge-blocked',
      lifecycleTarget: 'blocked',
    };
  }

  if (FAILED_REFUSAL_TOKENS.has(token)) {
    return {
      state: 'post-merge-failed',
      lifecycleTarget: 'failed',
    };
  }

  return undefined;
};
