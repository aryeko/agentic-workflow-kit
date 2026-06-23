import { describe, expect, it } from 'vitest';

import { replay } from '../../../../src/core/run-lifecycle/replay/index.js';

import { lifecycleTransitionPayload, makeEnvelope, makeReplayStore, makeStoredRecord, runId } from './test-support.js';

describe('core-01-s2 interior-corrupt replay failure', () => {
  it('fails closed with an interior-corrupt health record', () => {
    const result = replay(
      runId,
      makeReplayStore({
        health: 'log-interior-corrupt',
        records: [
          makeStoredRecord(1, makeEnvelope(1, 'RunCreated', { idempotencyKey: 'idem-1', requestedBy: 'runner' })),
          makeStoredRecord(2, makeEnvelope(2, 'RunLifecycleTransitioned', lifecycleTransitionPayload)),
        ],
      }),
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'interior-corrupt',
        message: 'Committed run history is interior-corrupt and cannot be replayed safely.',
        healthRecords: [
          {
            kind: 'interior-corrupt',
            detectedAt: '2026-06-23T12:02:01.000Z',
            storageHealth: 'log-interior-corrupt',
            detail: 'fnd-02 replay reported interior corruption in committed history',
          },
        ],
      },
    });
  });
});
