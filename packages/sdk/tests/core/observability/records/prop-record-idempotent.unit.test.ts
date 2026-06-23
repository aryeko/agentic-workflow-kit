import { describe, expect, it } from 'vitest';

import {
  buildAnalysisRecordedPayload,
  createAnalysisEventId,
  createAnalysisPayloadDigest,
  recordAnalysisOutcome,
} from '../../../../src/core/observability/records/index.js';

import { createEvent, createRecordInput, createReplay, createWriter, redactedReportRef } from './shared.js';

describe('core-07-s3 record idempotency property', () => {
  it('is total across absent, matching committed, and conflicting committed replay states', async () => {
    const input = createRecordInput();
    const payload = buildAnalysisRecordedPayload(input, redactedReportRef);
    const payloadDigest = createAnalysisPayloadDigest(payload);
    const eventId = createAnalysisEventId(input, payload, payloadDigest);
    const cases = [
      { replay: createReplay([]), expectedStatus: 'appended' },
      {
        replay: createReplay([
          createEvent({ eventId, sequence: 20, type: 'AnalysisRecorded', payload, payloadDigest }),
        ]),
        expectedStatus: 'already-committed',
      },
      {
        replay: createReplay([
          createEvent({
            eventId,
            sequence: 20,
            type: 'AnalysisRecorded',
            payload,
            payloadDigest: 'sha256:conflict',
          }),
        ]),
        expectedStatus: 'event-id-digest-mismatch',
      },
    ];

    for (const testCase of cases) {
      const result = await recordAnalysisOutcome(input, createWriter(), { replay: testCase.replay });
      const status = result.ok ? result.value.status : result.error.conflict;

      expect(status).toBe(testCase.expectedStatus);
    }
  });
});
