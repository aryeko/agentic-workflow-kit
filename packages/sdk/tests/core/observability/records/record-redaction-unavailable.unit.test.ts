import { describe, expect, it } from 'vitest';

import { recordAnalysisOutcome } from '../../../../src/core/observability/records/index.js';

import { createRecordInput, createWriter, onlyPayload } from './shared.js';

describe('core-07-s3 redaction unavailable failure', () => {
  it('records AnalysisFailed with analysis-redaction-unavailable when redaction evidence is unavailable', async () => {
    const writer = createWriter();
    const input = createRecordInput({
      inputHealth: {
        replayHealth: 'ok',
        projections: 'available',
        artifactInputs: 'partial',
        redaction: 'unavailable',
      },
    });

    const result = await recordAnalysisOutcome(input, writer);

    expect(result.ok).toBe(true);
    expect(writer.appendCalls[0]?.[0]?.type).toBe('AnalysisFailed');

    const payload = onlyPayload(writer);
    expect(payload.schema).toBe('kit-vnext.analysis-failed.v1');
    if (payload.schema !== 'kit-vnext.analysis-failed.v1') {
      throw new Error('expected failed payload');
    }
    expect(payload.reason).toBe('analysis-redaction-unavailable');
  });
});
