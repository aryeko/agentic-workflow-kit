import { describe, expect, it } from 'vitest';

import type { RunEventCursor, RunReplay, WaitRunEventsRequest, WaitRunEventsResult } from '../../../../src/index.js';

import {
  runEventCursorFixture,
  runReplayFixture,
  waitRunEventsRequestFixture,
  waitRunEventsResultFixture,
} from './fixtures.js';

describe('core-01-s1 replay, cursor, and wait types', () => {
  it('constructs replay, cursor, wait request, and wait result fixtures', () => {
    const replay: RunReplay = runReplayFixture;
    const cursor: RunEventCursor = runEventCursorFixture;
    const request: WaitRunEventsRequest = waitRunEventsRequestFixture;
    const result: WaitRunEventsResult = waitRunEventsResultFixture;

    expect(replay.healthRecords).toHaveLength(1);
    expect(cursor.afterSequence).toBe(1);
    expect(request.cursor).toEqual(cursor);
    expect(result.timedOut).toBe(false);
  });
});
