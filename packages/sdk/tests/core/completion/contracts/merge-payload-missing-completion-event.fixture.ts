import type { MergeDecisionPayload } from '../../../../src/index.js';

// @ts-expect-error MergeDecisionPayload requires completionEventId.
const invalidPayload: MergeDecisionPayload = {
  schema: 'kit-vnext.merge-decision-recorded.v1',
  runId: 'run-completion-01',
  state: 'merge-ready',
  headSha: 'abc123',
  forgeRefs: [],
  evaluatedAt: '2026-06-27T09:06:00.000Z',
};

void invalidPayload;
