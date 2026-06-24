import type { RunAppendFailure } from '../../../../src/index.js';

const invalidAppendFailure: RunAppendFailure = {
  code: 'writer-lost',
  message: 'unexpected code',
  retryable: false,
};

void invalidAppendFailure;
