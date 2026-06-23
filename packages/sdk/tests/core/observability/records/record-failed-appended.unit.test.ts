import { describe, expect, it } from 'vitest';

import { recordAnalysisOutcome } from '../../../../src/core/observability/records/index.js';

import { createFailedInput, createWriter, onlyPayload, redactedReportRef, triggerEventRef } from './shared.js';

describe('core-07-s3 recordAnalysisOutcome failed path', () => {
  it('appends one AnalysisFailed envelope at barrier with the recordable reason', async () => {
    const writer = createWriter();
    const input = createFailedInput('analysis-redaction-unavailable');

    const result = await recordAnalysisOutcome(input, writer);

    expect(result.ok).toBe(true);
    expect(writer.appendCalls).toHaveLength(1);
    expect(writer.appendCalls[0]?.[0]).toMatchObject({
      type: 'AnalysisFailed',
      durability: 'barrier',
    });

    const payload = onlyPayload(writer);
    expect(payload).toEqual({
      schema: 'kit-vnext.analysis-failed.v1',
      request: input.request,
      inputHealth: input.inputHealth,
      reason: 'analysis-redaction-unavailable',
      evidenceRefs: [triggerEventRef],
      artifactRefs: [redactedReportRef],
    });
  });
});
