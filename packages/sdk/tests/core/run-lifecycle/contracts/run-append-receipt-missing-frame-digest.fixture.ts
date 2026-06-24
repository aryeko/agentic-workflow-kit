import type { RunAppendReceipt } from '../../../../src/index.js';

const invalidReceipt: RunAppendReceipt = {
  runId: 'run-123',
  firstSequence: 1,
  lastSequence: 1,
  writerEpoch: 2,
  durability: 'durable',
  eventIds: ['evt-1'],
  payloadDigests: ['sha256:payload'],
  health: 'ok',
};

void invalidReceipt;
