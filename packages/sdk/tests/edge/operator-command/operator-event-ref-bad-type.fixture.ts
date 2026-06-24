import type { OperatorEventRef } from '../../../src/edge/operator-command/index.js';

const invalidEventRef: OperatorEventRef = {
  eventId: 'evt-operator-1',
  sequence: 7,
  payloadDigest: 'sha256:operator-action',
  type: 'RunCreated',
};

void invalidEventRef;
