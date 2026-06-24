import type { InspectRunParams } from '../../../src/edge/operator-command/index.js';

const invalidParams: InspectRunParams = {
  runId: 'run-123',
  viewSelectors: ['timeline'],
};

void invalidParams;
