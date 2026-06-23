import { describe, expect, it, vi } from 'vitest';

import { waitRunEvents } from '../../../../src/core/run-lifecycle/cursor-wait/index.js';

import { makeEnvelope, makeReplaySuccess, textRunId } from './test-support.js';

describe('cursor-wait', () => {
  it('keeps polling before timeout elapses', () => {
    const replay = vi
      .fn()
      .mockReturnValueOnce(makeReplaySuccess([], { lastSequence: 3 }))
      .mockReturnValueOnce(makeReplaySuccess([makeEnvelope(4)], { lastSequence: 4 }));
    const clockValues = [0, 500];
    const clock = vi.fn(() => clockValues.shift() ?? 500);

    const result = waitRunEvents(
      {
        runId: textRunId,
        cursor: {
          runId: textRunId,
          afterSequence: 3,
        },
        timeoutMs: 1_000,
      },
      replay,
      clock,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(replay).toHaveBeenCalledTimes(2);
    expect(result.value.events).toEqual([makeEnvelope(4)]);
    expect(result.value.timedOut).toBe(false);
  });
});
