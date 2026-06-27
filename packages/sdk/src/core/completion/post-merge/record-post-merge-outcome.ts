import { classifyPostMergeOutcome } from './classify-post-merge-outcome.js';
import { appendBarrierEvent } from './shared.js';
import type { PostMergeDependencies, PostMergeOutcomeResult, RecordPostMergeOutcomeInput } from './types.js';

export const recordPostMergeOutcome = async (
  input: RecordPostMergeOutcomeInput,
  dependencies: PostMergeDependencies,
): PostMergeOutcomeResult => {
  const outcome = classifyPostMergeOutcome(input);
  const appendResult = await appendBarrierEvent(
    dependencies.writer,
    'PostMergeOutcomeRecorded',
    input.evaluatedAt,
    outcome,
  );

  if (!appendResult.ok) {
    return {
      ok: false,
      error: {
        token: 'event-log-unwritable',
        appendFailure: appendResult.error,
      },
    };
  }

  return {
    ok: true,
    value: {
      outcome,
      outcomeEventId: appendResult.value.eventIds[0] ?? 'PostMergeOutcomeRecorded',
      appendReceipt: appendResult.value,
    },
  };
};
