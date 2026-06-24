import type { AnalysisInputHealth } from '../../../../src/core/observability/analyzer/index.js';

const invalidInputHealth: AnalysisInputHealth = {
  replayHealth: 'ok',
  projections: 'partial',
  artifactInputs: 'available',
  redaction: 'applied',
};

void invalidInputHealth;
