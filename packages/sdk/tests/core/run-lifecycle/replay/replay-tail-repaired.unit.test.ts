import { describe, expect, it } from 'vitest';

import { replay } from '../../../../src/core/run-lifecycle/replay/index.js';

import {
  digestPayload,
  lifecycleTransitionPayload,
  makeEnvelope,
  makeReplayStore,
  makeStoredRecord,
  runId,
  tailRepairedPayload,
} from './test-support.js';

describe('core-01-s2 tail-repaired replay', () => {
  it('returns a usable replay with a corruption health record derived from the committed repair event', () => {
    const result = replay(
      runId,
      makeReplayStore({
        health: 'log-tail-repaired',
        records: [
          makeStoredRecord(1, makeEnvelope(1, 'RunCreated', { idempotencyKey: 'idem-1', requestedBy: 'runner' })),
          makeStoredRecord(2, makeEnvelope(2, 'RunLifecycleTransitioned', lifecycleTransitionPayload)),
          makeStoredRecord(3, makeEnvelope(3, 'RunLogTailRepaired', tailRepairedPayload, { durability: 'barrier' })),
        ],
      }),
      digestPayload,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.health).toBe('tail-repaired');
    expect(result.value.healthRecords).toEqual([
      {
        kind: 'tail-repaired',
        detectedAt: tailRepairedPayload.repairedAt,
        lastValidSequence: tailRepairedPayload.lastCommittedSequence,
        storageHealth: 'log-tail-repaired',
        detail: 'fnd-02 replay reported repaired tail bytes',
      },
    ]);
  });
});
