import type { CompletionDecisionPayload } from '../../../../src/index.js';

// @ts-expect-error CompletionDecisionPayload requires cursor.
const invalidPayload: CompletionDecisionPayload = {
  schema: 'kit-vnext.completion-decision-recorded.v1',
  runId: 'run-completion-01',
  state: 'completion-verified',
  headSha: 'abc123',
  evidenceRefs: [],
  evaluatedAt: '2026-06-27T09:05:00.000Z',
};

void invalidPayload;
