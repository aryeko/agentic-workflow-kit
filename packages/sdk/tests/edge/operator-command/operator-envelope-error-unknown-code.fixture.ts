import type { OperatorEnvelopeError } from '../../../src/edge/operator-command/index.js';

const invalidError: OperatorEnvelopeError = {
  code: 'digest-mismatch',
  message: 'digest mismatch',
};

void invalidError;
