import { describe, expect, it } from 'vitest';

import { replay } from '../../../../src/core/run-lifecycle/replay/index.js';

import { makeEnvelope, makeReplayStore, makeStoredRecord, runId } from './test-support.js';

describe('core-01-s2 malformed declared payload replay failures', () => {
  it('fails when a declared relevant payload is malformed', () => {
    const result = replay(
      runId,
      makeReplayStore({
        health: 'ok',
        records: [
          makeStoredRecord(1, makeEnvelope(1, 'RunCreated', { idempotencyKey: 'idem-1', requestedBy: 'runner' })),
          makeStoredRecord(2, makeEnvelope(2, 'RunLifecycleTransitioned', {})),
        ],
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'malformed-declared-payload',
      },
    });
  });
});
