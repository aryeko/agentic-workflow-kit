import { describe, expect, it } from 'vitest';

import { replay } from '../../../../src/core/run-lifecycle/replay/index.js';

import { lifecycleTransitionPayload, makeEnvelope, makeReplayStore, makeStoredRecord, runId } from './test-support.js';

describe('core-01-s2 malformed envelope replay failures', () => {
  it('fails when a committed frame omits schema', () => {
    const malformedEnvelope = {
      ...makeEnvelope(2, 'RunLifecycleTransitioned', lifecycleTransitionPayload),
    };
    delete (malformedEnvelope as { schema?: string }).schema;

    const result = replay(
      runId,
      makeReplayStore({
        health: 'ok',
        records: [
          makeStoredRecord(1, makeEnvelope(1, 'RunCreated', { idempotencyKey: 'idem-1', requestedBy: 'runner' })),
          makeStoredRecord(2, malformedEnvelope),
        ],
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'malformed-envelope',
      },
    });
  });

  it('fails when a committed frame is not valid JSON', () => {
    const result = replay(
      runId,
      makeReplayStore({
        health: 'ok',
        records: [
          makeStoredRecord(1, makeEnvelope(1, 'RunCreated', { idempotencyKey: 'idem-1', requestedBy: 'runner' }), {
            payload: new TextEncoder().encode('{not-json'),
            payloadLength: 9,
          }),
        ],
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'malformed-envelope',
      },
    });
  });

  it('fails when committed sequences are not contiguous', () => {
    const result = replay(
      runId,
      makeReplayStore({
        health: 'ok',
        records: [
          makeStoredRecord(1, makeEnvelope(1, 'RunCreated', { idempotencyKey: 'idem-1', requestedBy: 'runner' })),
          makeStoredRecord(4, makeEnvelope(4, 'RunLifecycleTransitioned', lifecycleTransitionPayload)),
        ],
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'malformed-envelope',
      },
    });
  });
});
