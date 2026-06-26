import type { CompletionReplayAnchor } from '../../../../src/index.js';

// @ts-expect-error CompletionReplayAnchor requires the replay cursor field evaluatedThrough.
const invalidAnchor: CompletionReplayAnchor = {
  runId: 'run-completion-01',
  headSha: 'abc123',
  evidenceRefs: [],
};

void invalidAnchor;
