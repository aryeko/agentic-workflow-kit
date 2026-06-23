import { describe, expect, it } from 'vitest';

import { waitRunEvents } from '../../../../src/index.js';

import { makeEnvelope, makeReplaySuccess, textRunId } from './test-support.js';

describe('cursor-wait', () => {
  it('public import', () => {
    const result = waitRunEvents(
      {
        runId: textRunId,
        cursor: {
          runId: textRunId,
          afterSequence: 0,
        },
        timeoutMs: 1_000,
      },
      () => makeReplaySuccess([makeEnvelope(1)]),
      () => 0,
    );

    expect(waitRunEvents).toBeTypeOf('function');
    expect(result.ok).toBe(true);
  });
});
