import { describe, expect, it, vi } from 'vitest';

import { waitRunEvents } from '../../../../src/core/run-lifecycle/cursor-wait/index.js';

import { makeEnvelope, makeReplaySuccess, textRunId } from './test-support.js';

describe('cursor-wait', () => {
  it.each([
    {
      label: 'events-found',
      replayResult: makeReplaySuccess([makeEnvelope(1)]),
      clockValues: [0],
    },
    {
      label: 'timed-out',
      replayResult: makeReplaySuccess([]),
      clockValues: [0, 1_001],
    },
  ])('read-only: returns replay-derived data without mutating the replay result (%s)', async ({
    replayResult,
    clockValues,
  }) => {
    const before = structuredClone(replayResult);
    const replay = vi.fn(() => replayResult);
    const clock = vi.fn(() => clockValues.shift() ?? 1_001);

    const result = await waitRunEvents(
      {
        runId: textRunId,
        cursor: {
          runId: textRunId,
          afterSequence: 0,
        },
        timeoutMs: 1_000,
      },
      replay,
      clock,
    );

    expect(result.ok).toBe(true);
    expect(replay).toHaveBeenCalledWith(textRunId);
    expect(replayResult).toEqual(before);
    if (result.ok && result.value.events.length > 0) {
      expect(result.value.events).toEqual(replayResult.ok ? replayResult.value.events : []);
      expect(result.value.events).not.toBe(replayResult.ok ? replayResult.value.events : []);
    }
  });
});
