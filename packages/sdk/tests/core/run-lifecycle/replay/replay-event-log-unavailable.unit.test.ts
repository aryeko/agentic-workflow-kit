import { describe, expect, it } from 'vitest';
import { replay } from '../../../../src/core/run-lifecycle/replay/index.js';
import type { StorageHealth } from '../../../../src/index.js';

import { digestPayload, makeReplayStore, runId } from './test-support.js';

describe('core-01-s2 event-log unavailable replay failures', () => {
  it.each([
    'network-fs-degraded',
    'read-only',
    'unusable',
  ] satisfies StorageHealth[])('fails when storage health is %s', (health) => {
    const result = replay(
      runId,
      makeReplayStore({
        health,
        records: [],
      }),
      digestPayload,
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'event-log-unavailable',
        healthRecords: [
          {
            kind: 'event-log-unavailable',
            storageHealth: health,
          },
        ],
      },
    });
  });
});
