import { describe, expect, it, vi } from 'vitest';

import type { Result, RunReplayFailure, WaitRunEventsResult } from '../../../../src/index.js';
import { wrapWaitRunEvents } from '../../../../src/core/supervision/wait/index.js';

describe('core-04-s3 wait wrapper', () => {
  it('rejects mismatched request and cursor run ids with event-cursor-unavailable', async () => {
    const waitRunEvents = vi.fn();

    const result = await wrapWaitRunEvents(
      {
        runId: 'run-01',
        cursor: {
          runId: 'run-02',
          afterSequence: 10,
        },
        timeoutMs: 500,
      },
      { waitRunEvents },
    );

    expect(result).toEqual({
      ok: false,
      error: {
        reason: 'event-cursor-unavailable',
        message: 'wait cursor run id does not match request run id',
      },
    });
    expect(waitRunEvents).not.toHaveBeenCalled();
  });

  it('delegates matching cursors unchanged to the Epic 3 wait primitive', async () => {
    const delegated: Result<WaitRunEventsResult, RunReplayFailure> = {
      ok: true,
      value: {
        runId: 'run-01',
        cursor: {
          runId: 'run-01',
          afterSequence: 11,
        },
        events: [],
        timedOut: true,
        lastSequence: 11,
        health: 'ok',
        healthRecords: [],
      },
    };
    const waitRunEvents = vi.fn(async (request) => delegated);

    const request = {
      runId: 'run-01',
      cursor: {
        runId: 'run-01',
        afterSequence: 10,
      },
      timeoutMs: 500,
      maxEvents: 25,
    } as const;
    const result = await wrapWaitRunEvents(request, { waitRunEvents });

    expect(waitRunEvents).toHaveBeenCalledWith(request);
    expect(result).toEqual(delegated);
  });

  it('fails closed to event-cursor-unavailable when the delegated wait fails', async () => {
    const waitRunEvents = vi.fn(async () => ({
      ok: false,
      error: {
        code: 'event-log-unavailable',
        message: 'cursor storage unavailable',
        healthRecords: [],
      },
    }));

    const result = await wrapWaitRunEvents(
      {
        runId: 'run-01',
        cursor: {
          runId: 'run-01',
          afterSequence: 10,
        },
        timeoutMs: 500,
      },
      { waitRunEvents },
    );

    expect(result).toEqual({
      ok: false,
      error: {
        reason: 'event-cursor-unavailable',
        message: 'delegated wait failed',
        waitFailure: {
          code: 'event-log-unavailable',
          message: 'cursor storage unavailable',
          healthRecords: [],
        },
      },
    });
  });
});
