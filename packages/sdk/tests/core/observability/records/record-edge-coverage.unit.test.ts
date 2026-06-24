import { describe, expect, it } from 'vitest';

import {
  buildAnalysisFailedPayload,
  buildAnalysisRecordedPayload,
  canonicalJson,
  checkTerminalAnalysisInvariant,
  recordAnalysisOutcome,
  resolveExistingAnalysisRecord,
} from '../../../../src/core/observability/records/index.js';

import {
  createEvent,
  createFailedInput,
  createRecordInput,
  createReplay,
  createTerminalEvent,
  createWriter,
  redactedReportRef,
} from './shared.js';

describe('core-07-s3 record edge cases', () => {
  it('covers defensive payload and canonical JSON branches', () => {
    expect(() => buildAnalysisRecordedPayload(createFailedInput('analysis-rule-error'), redactedReportRef)).toThrow(
      /recorded analysis outcome/,
    );
    expect(
      buildAnalysisFailedPayload(createFailedInput('analysis-rule-error'), {
        reason: 'analysis-rule-error',
        evidenceRefs: [],
        artifactRefs: [],
      }).supersedesEventId,
    ).toBeUndefined();
    expect(
      buildAnalysisRecordedPayload(createRecordInput({ supersedesEventId: 'analysis:prior' }), redactedReportRef)
        .supersedesEventId,
    ).toBe('analysis:prior');
    expect(canonicalJson(Symbol('unsupported'))).toBe('null');
  });

  it('treats absent replay, superseded attempts, and non-analysis events as absent', () => {
    const input = createRecordInput({ supersedesEventId: 'analysis:prior' });

    expect(resolveExistingAnalysisRecord(undefined, input, 'analysis:new', 'sha256:new')).toEqual({ status: 'absent' });
    expect(
      resolveExistingAnalysisRecord(
        createReplay([
          createEvent({
            eventId: 'evt-unrelated',
            sequence: 9,
            type: 'RunCreated',
            payload: { idempotencyKey: 'run', requestedBy: 'operator' },
          }),
        ]),
        input,
        'analysis:new',
        'sha256:new',
      ),
    ).toEqual({ status: 'absent' });
  });

  it('reports non-terminal and unwritable-log invariant states explicitly', () => {
    expect(checkTerminalAnalysisInvariant(createReplay([]))).toEqual({ status: 'not-terminal' });
    expect(
      checkTerminalAnalysisInvariant(createReplay([createTerminalEvent(10), createTerminalEvent(12)])),
    ).toMatchObject({
      status: 'unmet',
      terminalEventRef: { sequence: 12 },
    });
    expect(checkTerminalAnalysisInvariant(createReplay([createTerminalEvent()]), { logWritable: false })).toMatchObject(
      {
        status: 'unmet',
        reason: 'analysis-record-unwritable',
      },
    );
  });

  it('records redaction unavailable when a recorded outcome lacks a report ref', async () => {
    const writer = createWriter();
    const input = createRecordInput({
      outcome: {
        kind: 'recorded',
        result: {
          issues: [],
          metrics: {},
          evidenceRefs: [],
        },
      },
    });

    const result = await recordAnalysisOutcome(input, writer);

    expect(result.ok).toBe(true);
    expect(writer.appendCalls[0]?.[0]?.type).toBe('AnalysisFailed');
  });
});
