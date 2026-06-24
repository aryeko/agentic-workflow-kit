import { describe, expect, it, vi } from 'vitest';

import { waitRunEvents } from '../../../../src/core/run-lifecycle/cursor-wait/index.js';

import { makeEnvelope, makeReplaySuccess, textRunId } from './test-support.js';

describe('cursor-wait', () => {
  it('keeps polling before timeout elapses', async () => {
    const replay = vi
      .fn()
      .mockReturnValueOnce(makeReplaySuccess([], { lastSequence: 3 }))
      .mockReturnValueOnce(makeReplaySuccess([makeEnvelope(4)], { lastSequence: 4 }));
    const clockValues = [0, 500];
    const clock = vi.fn(() => clockValues.shift() ?? 500);
    const pause = vi.fn(async () => undefined);

    const result = await waitRunEvents(
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
      pause,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(replay).toHaveBeenCalledTimes(2);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(pause).toHaveBeenCalledWith(25);
    expect(result.value.events).toEqual([makeEnvelope(4)]);
    expect(result.value.timedOut).toBe(false);
  });
});
