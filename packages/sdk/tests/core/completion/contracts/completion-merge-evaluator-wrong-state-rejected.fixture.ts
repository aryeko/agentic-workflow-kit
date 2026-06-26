import type { CompletionMergeEvaluator } from '../../../../src/index.js';

const invalidEvaluator: CompletionMergeEvaluator = {
  // @ts-expect-error Completion decisions cannot return a merge state.
  evaluateCompletion(input) {
    return {
      schema: 'kit-vnext.completion-decision-recorded.v1',
      runId: input.runId,
      state: 'merge-ready',
      headSha: 'abc123',
      cursor: input.evaluatedThrough,
      evidenceRefs: [],
      evaluatedAt: input.evaluatedAt,
    };
  },
  evaluateMerge(input) {
    return {
      schema: 'kit-vnext.merge-decision-recorded.v1',
      runId: input.runId,
      state: 'merge-ready',
      headSha: 'abc123',
      completionEventId: input.completionEventId,
      forgeRefs: [],
      evaluatedAt: input.evaluatedAt,
    };
  },
};

void invalidEvaluator;
