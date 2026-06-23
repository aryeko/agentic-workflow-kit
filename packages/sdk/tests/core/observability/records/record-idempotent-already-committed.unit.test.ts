import { describe, expect, it } from 'vitest';

import {
  buildAnalysisRecordedPayload,
  createAnalysisEventId,
  createAnalysisPayloadDigest,
  recordAnalysisOutcome,
} from '../../../../src/core/observability/records/index.js';

import { createEvent, createRecordInput, createReplay, createWriter, redactedReportRef } from './shared.js';

describe('core-07-s3 record idempotent retry', () => {
  it('returns already-committed for a matching same-attempt committed event and appends nothing', async () => {
    const input = createRecordInput();
    const payload = buildAnalysisRecordedPayload(input, redactedReportRef);
    const payloadDigest = createAnalysisPayloadDigest(payload);
    const eventId = createAnalysisEventId(input, payload, payloadDigest);
    const replay = createReplay([
      createEvent({
        eventId,
        sequence: 22,
        type: 'AnalysisRecorded',
        payload,
        payloadDigest,
      }),
    ]);
    const writer = createWriter();

    const result = await recordAnalysisOutcome(input, writer, { replay });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }
    expect(result.value).toEqual({
      status: 'already-committed',
      eventRef: {
        eventId,
        sequence: 22,
        payloadDigest,
        type: 'AnalysisRecorded',
      },
    });
    expect('appendReceipt' in result.value).toBe(false);
    expect(writer.appendCalls).toHaveLength(0);
  });
});
