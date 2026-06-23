import type {
  AnalysisFailedPayload,
  AnalysisFailureReason,
  AnalysisRecordCommit,
  AnalysisRecordedPayload,
  AnalysisRecordFailure,
  AnalysisRecordInput,
  RecordableAnalysisFailureReason,
} from 'sdk';
import { recordAnalysisOutcome } from 'sdk';
import { describe, expect, it } from 'vitest';

import { createFailedInput, createWriter } from './shared.js';

describe('core-07-s3 records public imports', () => {
  it('imports records API and public types from sdk', async () => {
    const input: AnalysisRecordInput = createFailedInput('analysis-redaction-unavailable');
    const reason: AnalysisFailureReason = 'analysis-invariant-missing';
    const recordableReason: RecordableAnalysisFailureReason = 'analysis-redaction-unavailable';
    const recordedPayload: AnalysisRecordedPayload | undefined = undefined;
    const failedPayload: AnalysisFailedPayload = {
      schema: 'kit-vnext.analysis-failed.v1',
      request: input.request,
      inputHealth: input.inputHealth,
      reason: recordableReason,
      evidenceRefs: [],
      artifactRefs: [],
    };

    const result = await recordAnalysisOutcome(input, createWriter());
    const commit: AnalysisRecordCommit | undefined = result.ok ? result.value : undefined;
    const failure: AnalysisRecordFailure | undefined = result.ok ? undefined : result.error;

    expect(reason).toBe('analysis-invariant-missing');
    expect(recordedPayload).toBeUndefined();
    expect(failedPayload.reason).toBe('analysis-redaction-unavailable');
    expect(commit ?? failure).toBeDefined();
  });
});
