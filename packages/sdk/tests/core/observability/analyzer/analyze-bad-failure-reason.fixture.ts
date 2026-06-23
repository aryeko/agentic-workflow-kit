import type { AnalysisFailure } from '../../../../src/core/observability/analyzer/index.js';

const invalidFailure: AnalysisFailure = {
  reason: 'analysis-record-unwritable',
  evidenceRefs: [],
  artifactRefs: [],
};

void invalidFailure;
