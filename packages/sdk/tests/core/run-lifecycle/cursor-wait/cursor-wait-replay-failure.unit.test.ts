import { describe, expect, it } from 'vitest';

import { waitRunEvents } from '../../../../src/core/run-lifecycle/cursor-wait/index.js';

import { makeReplayFailure, textRunId } from './test-support.js';

describe('cursor-wait', () => {
  it.each([
    'malformed-envelope',
    'interior-corrupt',
    'event-log-unavailable',
    'malformed-declared-payload',
  ] as const)('surfaces replay failure verbatim for %s', async (code) => {
    const result = await waitRunEvents(
      {
        runId: textRunId,
        cursor: {
          runId: textRunId,
          afterSequence: 0,
        },
        timeoutMs: 1_000,
      },
      () => makeReplayFailure(code),
      () => 0,
    );

    expect(result).toEqual(makeReplayFailure(code));
  });
});
