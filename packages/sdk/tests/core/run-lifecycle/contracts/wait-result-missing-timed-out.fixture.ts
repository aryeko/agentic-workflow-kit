import type { WaitRunEventsResult } from '../../../../src/index.js';

const invalidWaitResult: WaitRunEventsResult = {
  runId: 'run-123',
  cursor: {
    runId: 'run-123',
    afterSequence: 3,
  },
  events: [],
  lastSequence: 3,
  health: 'ok',
  healthRecords: [],
};

void invalidWaitResult;
