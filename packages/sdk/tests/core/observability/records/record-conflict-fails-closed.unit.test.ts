import { describe, expect, it } from 'vitest';

import {
  buildAnalysisRecordedPayload,
  createAnalysisEventId,
  createAnalysisPayloadDigest,
  recordAnalysisOutcome,
} from '../../../../src/core/observability/records/index.js';

import { createEvent, createRecordInput, createReplay, createWriter, redactedReportRef } from './shared.js';

describe('core-07-s3 record conflict handling', () => {
  it('fails closed on same event id with a different payload digest', async () => {
    const input = createRecordInput();
    const payload = buildAnalysisRecordedPayload(input, redactedReportRef);
    const conflictingPayload = buildAnalysisRecordedPayload(
      createRecordInput({
        outcome: {
          kind: 'recorded',
          result: {
            issues: [],
            metrics: {},
            evidenceRefs: [],
            reportArtifactRef: redactedReportRef,
          },
        },
      }),
      redactedReportRef,
    );
    const payloadDigest = createAnalysisPayloadDigest(payload);
    const eventId = createAnalysisEventId(input, payload, payloadDigest);
    const replay = createReplay([
      createEvent({
        eventId,
        sequence: 20,
        type: 'AnalysisRecorded',
        payload: conflictingPayload,
        payloadDigest: 'sha256:different',
      }),
    ]);
    const writer = createWriter();

    const result = await recordAnalysisOutcome(input, writer, { replay });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected conflict');
    }
    expect(result.error.conflict).toBe('event-id-digest-mismatch');
    expect(writer.appendCalls).toHaveLength(0);
  });

  it('fails closed on current analysis at the same analysis key and cursor without supersession', async () => {
    const input = createRecordInput();
    const existingPayload = buildAnalysisRecordedPayload(
      createRecordInput({
        outcome: {
          kind: 'recorded',
          result: {
            issues: [],
            metrics: {},
            evidenceRefs: [],
            reportArtifactRef: redactedReportRef,
          },
        },
      }),
      redactedReportRef,
    );
    const replay = createReplay([
      createEvent({
        eventId: 'analysis:already-current',
        sequence: 20,
        type: 'AnalysisRecorded',
        payload: existingPayload,
      }),
    ]);
    const writer = createWriter();

    const result = await recordAnalysisOutcome(input, writer, { replay });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected conflict');
    }
    expect(result.error.conflict).toBe('current-analysis-conflict');
    expect(writer.appendCalls).toHaveLength(0);
  });

  it('fails closed when supersedesEventId does not cite the current analysis record', async () => {
    const input = createRecordInput({ supersedesEventId: 'analysis:missing' });
    const existingPayload = buildAnalysisRecordedPayload(createRecordInput(), redactedReportRef);
    const replay = createReplay([
      createEvent({
        eventId: 'analysis:already-current',
        sequence: 20,
        type: 'AnalysisRecorded',
        payload: existingPayload,
      }),
    ]);
    const writer = createWriter();

    const result = await recordAnalysisOutcome(input, writer, { replay });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected conflict');
    }
    expect(result.error.conflict).toBe('current-analysis-conflict');
    expect(writer.appendCalls).toHaveLength(0);
  });

  it('allows supersession when supersedesEventId cites the current analysis record', async () => {
    const existingEventId = 'analysis:already-current';
    const input = createRecordInput({ supersedesEventId: existingEventId });
    const existingPayload = buildAnalysisRecordedPayload(createRecordInput(), redactedReportRef);
    const replay = createReplay([
      createEvent({
        eventId: existingEventId,
        sequence: 20,
        type: 'AnalysisRecorded',
        payload: existingPayload,
      }),
    ]);
    const writer = createWriter();

    const result = await recordAnalysisOutcome(input, writer, { replay });

    expect(result.ok).toBe(true);
    expect(writer.appendCalls).toHaveLength(1);
  });

  it('fails closed when supersedesEventId cites an older superseded analysis record', async () => {
    const supersededEventId = 'analysis:old-current';
    const currentEventId = 'analysis:new-current';
    const input = createRecordInput({ supersedesEventId: supersededEventId });
    const supersededPayload = buildAnalysisRecordedPayload(createRecordInput(), redactedReportRef);
    const currentPayload = buildAnalysisRecordedPayload(
      createRecordInput({ supersedesEventId: supersededEventId }),
      redactedReportRef,
    );
    const replay = createReplay([
      createEvent({
        eventId: supersededEventId,
        sequence: 20,
        type: 'AnalysisRecorded',
        payload: supersededPayload,
      }),
      createEvent({
        eventId: currentEventId,
        sequence: 21,
        type: 'AnalysisRecorded',
        payload: currentPayload,
      }),
    ]);
    const writer = createWriter();

    const result = await recordAnalysisOutcome(input, writer, { replay });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected conflict');
    }
    expect(result.error.conflict).toBe('current-analysis-conflict');
    expect(writer.appendCalls).toHaveLength(0);
  });
});
