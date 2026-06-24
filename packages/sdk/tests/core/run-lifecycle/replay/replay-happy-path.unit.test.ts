import { describe, expect, it } from 'vitest';

import { replay } from '../../../../src/core/run-lifecycle/replay/index.js';

import {
  digestPayload,
  lifecycleTransitionPayload,
  makeEnvelope,
  makeReplayStore,
  makeStoredRecord,
  runId,
} from './test-support.js';

describe('core-01-s2 replay happy path', () => {
  it('returns the committed envelopes with ok health', () => {
    const store = makeReplayStore({
      health: 'ok',
      records: [
        makeStoredRecord(1, makeEnvelope(1, 'RunCreated', { idempotencyKey: 'idem-1', requestedBy: 'runner' })),
        makeStoredRecord(2, makeEnvelope(2, 'RunLifecycleTransitioned', lifecycleTransitionPayload)),
        makeStoredRecord(3, makeEnvelope(3, 'UnknownFutureEvent', { future: true })),
      ],
    });

    const result = replay(runId, store, digestPayload);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.events).toHaveLength(3);
    expect(result.value.lastSequence).toBe(3);
    expect(result.value.health).toBe('ok');
    expect(result.value.healthRecords).toHaveLength(0);
  });
});
