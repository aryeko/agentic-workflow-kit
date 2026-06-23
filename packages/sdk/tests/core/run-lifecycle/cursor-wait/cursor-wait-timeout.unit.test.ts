import { describe, expect, it, vi } from 'vitest';

import { waitRunEvents } from '../../../../src/core/run-lifecycle/cursor-wait/index.js';

import { makeReplaySuccess, textRunId } from './test-support.js';

describe('cursor-wait', () => {
  it('timedOut on no new events', () => {
    const replay = vi.fn(() => makeReplaySuccess([]));
    const clockValues = [0, 1_001];
    const clock = vi.fn(() => clockValues.shift() ?? 1_001);

    const result = waitRunEvents(
      {
        runId: textRunId,
        cursor: {
          runId: textRunId,
          afterSequence: 4,
        },
        timeoutMs: 1_000,
      },
      replay,
      clock,
    );

    expect(result).toEqual({
      ok: true,
      value: {
        runId: textRunId,
        cursor: {
          runId: textRunId,
          afterSequence: 4,
        },
        events: [],
        timedOut: true,
        lastSequence: 0,
        health: 'ok',
        healthRecords: [],
      },
    });
  });
});
