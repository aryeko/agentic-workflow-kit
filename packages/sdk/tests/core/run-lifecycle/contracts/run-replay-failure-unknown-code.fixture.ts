import type { RunReplayFailure } from '../../../../src/index.js';

const invalidReplayFailure: RunReplayFailure = {
  code: 'corrupt-tail',
  message: 'unexpected code',
  healthRecords: [],
};

void invalidReplayFailure;
