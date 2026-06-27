import type { ForgeOperationIntentPayload } from '../../../../src/index.js';

const invalidPayload: ForgeOperationIntentPayload = {
  schema: 'kit-vnext.forge-operation-intent-recorded.v1',
  runId: 'run-completion-01',
  operation: 'upsert-pr',
  expectedHeadSha: 'abc123',
  policyRef: 'policy:merge',
  decisionEventId: 'evt-merge-01',
  evidenceRefs: [],
  recordedAt: '2026-06-27T09:07:00.000Z',
  // @ts-expect-error Provider driver fields are forbidden in core-05 intent payloads.
  pullRequestNumber: 42,
};

void invalidPayload;
