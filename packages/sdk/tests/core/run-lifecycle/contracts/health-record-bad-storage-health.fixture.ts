import type { RunLogHealthRecord } from '../../../../src/index.js';

const invalidHealthRecord: RunLogHealthRecord = {
  kind: 'tail-repaired',
  detectedAt: '2026-06-23T12:03:00.000Z',
  storageHealth: 'read-only',
  detail: 'wrong storage health for a repair record',
};

void invalidHealthRecord;
