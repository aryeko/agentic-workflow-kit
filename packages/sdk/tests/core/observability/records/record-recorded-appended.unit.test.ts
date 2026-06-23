import { describe, expect, it } from 'vitest';

import { recordAnalysisOutcome } from '../../../../src/core/observability/records/index.js';

import {
  appendReceipt,
  createArtifactStore,
  createRecordInput,
  createWriter,
  onlyPayload,
  redactedReportRef,
  reportArtifactInput,
} from './shared.js';

describe('core-07-s3 recordAnalysisOutcome recorded path', () => {
  it('publishes a redacted report ref and appends one AnalysisRecorded envelope at barrier', async () => {
    const writer = createWriter();
    const input = createRecordInput();

    const result = await recordAnalysisOutcome(input, writer, {
      artifactStore: createArtifactStore(redactedReportRef),
      reportArtifact: reportArtifactInput,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(result.value.status).toBe('appended');
    expect(result.value.appendReceipt).toMatchObject({
      ...appendReceipt,
      eventIds: [writer.appendCalls[0]?.[0]?.eventId],
    });
    expect(writer.appendCalls).toHaveLength(1);
    expect(writer.appendCalls[0]).toHaveLength(1);
    expect(writer.appendCalls[0]?.[0]).toMatchObject({
      domain: 'core-07',
      type: 'AnalysisRecorded',
      durability: 'barrier',
      occurredAt: input.request.analyzedAt,
    });

    const payload = onlyPayload(writer);
    expect(payload.schema).toBe('kit-vnext.analysis-recorded.v1');
    if (payload.schema !== 'kit-vnext.analysis-recorded.v1') {
      throw new Error('expected recorded payload');
    }
    expect(payload.request).toEqual(input.request);
    expect(payload.inputHealth).toEqual(input.inputHealth);
    expect(payload.issues).toEqual(input.outcome.kind === 'recorded' ? input.outcome.result.issues : []);
    expect(payload.metrics).toEqual(input.outcome.kind === 'recorded' ? input.outcome.result.metrics : {});
    expect(payload.evidenceRefs).toEqual(input.outcome.kind === 'recorded' ? input.outcome.result.evidenceRefs : []);
    expect(payload.reportArtifactRef).toEqual(redactedReportRef);
  });
});
