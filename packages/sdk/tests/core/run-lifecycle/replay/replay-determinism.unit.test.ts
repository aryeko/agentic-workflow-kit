import { describe, expect, it } from 'vitest';

import { replay } from '../../../../src/core/run-lifecycle/replay/index.js';

import { lifecycleTransitionPayload, makeEnvelope, makeReplayStore, makeStoredRecord, runId } from './test-support.js';

describe('core-01-s2 replay determinism', () => {
  it('returns identical replay values for the same committed log bytes', () => {
    const store = makeReplayStore({
      health: 'ok',
      records: [
        makeStoredRecord(1, makeEnvelope(1, 'RunCreated', { idempotencyKey: 'idem-1', requestedBy: 'runner' })),
        makeStoredRecord(2, makeEnvelope(2, 'RunLifecycleTransitioned', lifecycleTransitionPayload)),
      ],
    });

    const first = replay(runId, store);
    const second = replay(runId, store);

    expect(first).toEqual(second);
  });
});
