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
  ])('read-only: no lease/projection/append side effects (%s)', ({ replayResult, clockValues }) => {
    const context = {
      replay: vi.fn(() => replayResult),
      acquire: vi.fn(),
      renew: vi.fn(),
      append: vi.fn(),
      writeProjection: vi.fn(),
      mutateLiveness: vi.fn(),
    };

    const result = waitRunEvents(
      {
        runId: textRunId,
        cursor: {
          runId: textRunId,
          afterSequence: 0,
        },
        timeoutMs: 1_000,
      },
      context.replay,
      vi.fn(() => clockValues.shift() ?? 1_001),
    );

    expect(result.ok).toBe(true);
    expect(context.acquire).not.toHaveBeenCalled();
    expect(context.renew).not.toHaveBeenCalled();
    expect(context.append).not.toHaveBeenCalled();
    expect(context.writeProjection).not.toHaveBeenCalled();
    expect(context.mutateLiveness).not.toHaveBeenCalled();
  });
});
