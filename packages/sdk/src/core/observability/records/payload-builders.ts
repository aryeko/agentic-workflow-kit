import type { ArtifactRef } from '../../../foundation/storage/artifacts/index.js';
import type { AnalysisFailure } from '../analyzer/index.js';

import type { AnalysisFailedPayload, AnalysisRecordedPayload, AnalysisRecordInput } from './types.js';

export const buildAnalysisRecordedPayload = (
  input: AnalysisRecordInput,
  reportArtifactRef: ArtifactRef,
): AnalysisRecordedPayload => {
  if (input.outcome.kind !== 'recorded') {
    throw new Error('AnalysisRecordedPayload requires a recorded analysis outcome.');
  }

  return {
    schema: 'kit-vnext.analysis-recorded.v1',
    request: input.request,
    inputHealth: input.inputHealth,
    issues: input.outcome.result.issues,
    metrics: input.outcome.result.metrics,
    evidenceRefs: input.outcome.result.evidenceRefs,
    reportArtifactRef,
    ...(input.supersedesEventId === undefined ? {} : { supersedesEventId: input.supersedesEventId }),
  };
};

export const buildAnalysisFailedPayload = (
  input: AnalysisRecordInput,
  failure: AnalysisFailure,
): AnalysisFailedPayload => ({
  schema: 'kit-vnext.analysis-failed.v1',
  request: input.request,
  inputHealth: input.inputHealth,
  reason: failure.reason,
  evidenceRefs: failure.evidenceRefs,
  artifactRefs: failure.artifactRefs,
  ...(input.supersedesEventId === undefined ? {} : { supersedesEventId: input.supersedesEventId }),
});
