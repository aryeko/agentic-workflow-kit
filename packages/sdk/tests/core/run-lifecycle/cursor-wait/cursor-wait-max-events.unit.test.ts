import { describe, expect, it } from 'vitest';

import { waitRunEvents } from '../../../../src/core/run-lifecycle/cursor-wait/index.js';

import { makeEnvelope, makeReplaySuccess, textRunId } from './test-support.js';

describe('cursor-wait', () => {
  it('respects maxEvents', () => {
    const events = [1, 2, 3, 4, 5].map((sequence) => makeEnvelope(sequence));

    const result = waitRunEvents(
      {
        runId: textRunId,
        cursor: {
          runId: textRunId,
          afterSequence: 0,
        },
        timeoutMs: 1_000,
        maxEvents: 2,
      },
      () => makeReplaySuccess(events),
      () => 0,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.events).toHaveLength(2);
    expect(result.value.cursor.afterSequence).toBe(2);
  });
});
