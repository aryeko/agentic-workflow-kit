import { describe, expect, it } from 'vitest';
import { waitRunEvents } from '../../../../src/core/run-lifecycle/cursor-wait/index.js';
import type { RunLogHealthRecord } from '../../../../src/index.js';

import { makeEnvelope, makeReplaySuccess, textRunId } from './test-support.js';

describe('cursor-wait', () => {
  it('health passthrough', () => {
    const healthRecords: RunLogHealthRecord[] = [
      {
        kind: 'tail-repaired',
        detectedAt: '2026-06-23T12:03:00.000Z',
        lastValidSequence: 2,
        storageHealth: 'log-tail-repaired',
        detail: 'truncated tail',
      },
    ];

    const result = waitRunEvents(
      {
        runId: textRunId,
        cursor: {
          runId: textRunId,
          afterSequence: 0,
        },
        timeoutMs: 1_000,
      },
      () =>
        makeReplaySuccess([makeEnvelope(1)], {
          health: 'tail-repaired',
          healthRecords,
        }),
      () => 0,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.health).toBe('tail-repaired');
    expect(result.value.healthRecords).toEqual(healthRecords);
  });
});
