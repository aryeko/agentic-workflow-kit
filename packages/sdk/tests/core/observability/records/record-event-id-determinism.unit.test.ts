import { describe, expect, it } from 'vitest';

import { recordAnalysisOutcome } from '../../../../src/core/observability/records/index.js';

import { createRecordInput, createWriter, issueFixture, redactedReportRef } from './shared.js';

const appendEventId = async (input = createRecordInput()): Promise<string> => {
  const writer = createWriter();
  const result = await recordAnalysisOutcome(input, writer);
  expect(result.ok).toBe(true);

  const eventId = writer.appendCalls[0]?.[0]?.eventId;
  if (eventId === undefined) {
    throw new Error('expected deterministic event id');
  }

  return eventId;
};

describe('core-07-s3 analysis event id determinism', () => {
  it('keeps identical inputs stable and changes ids when payload fields change', async () => {
    const first = await appendEventId();
    const second = await appendEventId();
    const changedAnalyzedAt = await appendEventId(
      createRecordInput({
        request: {
          ...createRecordInput().request,
          analyzedAt: '2026-06-23T12:01:00.000Z',
        },
      }),
    );
    const changedIssueSet = await appendEventId(
      createRecordInput({
        outcome: {
          kind: 'recorded',
          result: {
            issues: [{ ...issueFixture, issueId: 'issue-secondary', code: 'storage-artifact-unavailable' }],
            metrics: {},
            evidenceRefs: [],
            reportArtifactRef: redactedReportRef,
          },
        },
      }),
    );

    expect(second).toBe(first);
    expect(changedAnalyzedAt).not.toBe(first);
    expect(changedIssueSet).not.toBe(first);
  });
});
