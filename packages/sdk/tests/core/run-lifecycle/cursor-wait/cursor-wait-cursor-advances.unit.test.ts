import { describe, expect, it } from 'vitest';

import { waitRunEvents } from '../../../../src/core/run-lifecycle/cursor-wait/index.js';

import { makeEnvelope, makeReplaySuccess, textRunId } from './test-support.js';

describe('cursor-wait', () => {
  it('cursor advances to last delivered sequence', async () => {
    const events = [makeEnvelope(5), makeEnvelope(7), makeEnvelope(9)];

    const result = await waitRunEvents(
      {
        runId: textRunId,
        cursor: {
          runId: textRunId,
          afterSequence: 4,
        },
        timeoutMs: 1_000,
      },
      () => makeReplaySuccess(events, { lastSequence: 9 }),
      () => 0,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.cursor.afterSequence).toBe(9);
  });
});
