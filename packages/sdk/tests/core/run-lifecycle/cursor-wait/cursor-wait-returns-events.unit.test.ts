import { describe, expect, it, vi } from 'vitest';

import { waitRunEvents } from '../../../../src/core/run-lifecycle/cursor-wait/index.js';

import { makeEnvelope, makeReplaySuccess, textRunId } from './test-support.js';

describe('cursor-wait', () => {
  it('returns events after cursor', () => {
    const events = [makeEnvelope(1), makeEnvelope(2), makeEnvelope(3)];
    const replay = vi.fn(() => makeReplaySuccess(events));
    const clock = vi.fn(() => 0);

    const result = waitRunEvents(
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

    expect(result).toEqual({
      ok: true,
      value: {
        runId: textRunId,
        cursor: {
          runId: textRunId,
          afterSequence: 3,
        },
        events,
        timedOut: false,
        lastSequence: 3,
        health: 'ok',
        healthRecords: [],
      },
    });
  });
});
