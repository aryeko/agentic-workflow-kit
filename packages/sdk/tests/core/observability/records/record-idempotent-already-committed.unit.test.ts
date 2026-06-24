import { describe, expect, it, vi } from 'vitest';

import {
  buildAnalysisRecordedPayload,
  createAnalysisEventId,
  createAnalysisPayloadDigest,
  recordAnalysisOutcome,
} from '../../../../src/core/observability/records/index.js';

import {
  createEvent,
  createRecordInput,
  createReplay,
  createWriter,
  rawReportRef,
  redactedReportRef,
  reportArtifactInput,
  scratchReportRef,
  storageError,
} from './shared.js';

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

  it('returns already-committed when the writer committed a different digest for the same analysis payload', async () => {
    const input = createRecordInput();
    const payload = buildAnalysisRecordedPayload(input, redactedReportRef);
    const payloadDigest = createAnalysisPayloadDigest(payload);
    const writerPayloadDigest = 'digest:writer-canonical-json';
    const eventId = createAnalysisEventId(input, payload, payloadDigest);
    const replay = createReplay([
      createEvent({
        eventId,
        sequence: 22,
        type: 'AnalysisRecorded',
        payload,
        payloadDigest: writerPayloadDigest,
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
        payloadDigest: writerPayloadDigest,
        type: 'AnalysisRecorded',
      },
    });
    expect(writer.appendCalls).toHaveLength(0);
  });

  it('checks replay before preparing analysis artifacts on retry', async () => {
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
    const put = vi.fn(async () => storageError);

    const result = await recordAnalysisOutcome(input, writer, {
      replay,
      reportArtifact: reportArtifactInput,
      artifactStore: {
        put,
        putScratch: vi.fn(async () => scratchReportRef),
        resolve: vi.fn(() => rawReportRef),
        get: vi.fn(() => storageError),
        redact: vi.fn(() => rawReportRef),
        export: vi.fn(() => storageError),
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }
    expect(result.value.status).toBe('already-committed');
    expect(put).not.toHaveBeenCalled();
    expect(writer.appendCalls).toHaveLength(0);
  });

  it('uses replayed report artifact refs before preparing retry artifacts', async () => {
    const originalInput = createRecordInput();
    const retryInput = createRecordInput({
      outcome: {
        kind: 'recorded',
        result: {
          ...originalInput.outcome.result,
          reportArtifactRef: undefined,
        },
      },
    });
    const payload = buildAnalysisRecordedPayload(originalInput, redactedReportRef);
    const payloadDigest = createAnalysisPayloadDigest(payload);
    const eventId = createAnalysisEventId(originalInput, payload, payloadDigest);
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
    const put = vi.fn(async () => storageError);

    const result = await recordAnalysisOutcome(retryInput, writer, {
      replay,
      reportArtifact: reportArtifactInput,
      artifactStore: {
        put,
        putScratch: vi.fn(async () => scratchReportRef),
        resolve: vi.fn(() => rawReportRef),
        get: vi.fn(() => storageError),
        redact: vi.fn(() => rawReportRef),
        export: vi.fn(() => storageError),
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }
    expect(result.value.status).toBe('already-committed');
    expect(put).not.toHaveBeenCalled();
    expect(writer.appendCalls).toHaveLength(0);
  });
});
