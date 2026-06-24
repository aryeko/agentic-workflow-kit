import { describe, expect, it } from 'vitest';

import { recordAnalysisOutcome } from '../../../../src/core/observability/records/index.js';

import { appendFailure, createRecordInput, createWriter } from './shared.js';

describe('core-07-s3 append unwritable failure', () => {
  it('returns AnalysisRecordFailure and never self-records analysis-record-unwritable', async () => {
    const writer = createWriter(() => ({ ok: false, error: appendFailure }));

    const result = await recordAnalysisOutcome(createRecordInput(), writer);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected failure');
    }
    expect(result.error).toMatchObject({
      reason: 'analysis-record-unwritable',
      appendFailure,
      retry: 'replay-before-retry',
    });
    expect(result.error.attemptedEventId).toMatch(/^analysis:/);
    expect(result.error.attemptedPayloadDigest).toMatch(/^sha256:/);
    expect(writer.appendCalls).toHaveLength(1);
    expect(writer.appendCalls[0]?.[0]?.payload).not.toMatchObject({
      reason: 'analysis-record-unwritable',
    });
  });
});
