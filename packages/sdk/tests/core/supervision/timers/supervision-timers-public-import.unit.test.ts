import { describe, expect, it } from 'vitest';

import type { LivenessProjection } from 'sdk';
import { evaluateSupervisionTimers, wrapWaitRunEvents } from 'sdk';

describe('core-04-s3 public supervision timer and wait imports', () => {
  it('imports evaluateSupervisionTimers and wrapWaitRunEvents from sdk', async () => {
    const projection: LivenessProjection = {
      runId: 'run-01',
      state: 'starting',
      timers: {
        startup: { deadline: '2026-06-25T10:02:01.000Z', exceeded: false },
        idle: { deadline: '2026-06-25T10:15:00.000Z', exceeded: false },
        'no-progress': { deadline: '2026-06-25T10:45:00.000Z', exceeded: false },
        'per-tool': { deadline: '2026-06-25T10:30:00.000Z', exceeded: false },
        'approval-SLA': { deadline: '2026-06-26T10:00:00.000Z', exceeded: false },
        'max-runtime': { deadline: '2026-06-25T18:00:01.000Z', exceeded: false },
      },
      terminal: false,
    };

    const timers = evaluateSupervisionTimers({
      projection,
      sampledAt: '2026-06-25T10:02:02.000Z',
      timerEvidence: {
        startup: {
          basisAt: '2026-06-25T10:00:01.000Z',
          sourceEventIds: ['evt-startup'],
        },
      },
    });

    const waited = await wrapWaitRunEvents(
      {
        runId: 'run-01',
        cursor: {
          runId: 'run-01',
          afterSequence: 10,
        },
        timeoutMs: 100,
      },
      {
        waitRunEvents: async (request) => ({
          ok: true,
          value: {
            runId: request.runId,
            cursor: request.cursor,
            events: [],
            timedOut: true,
            lastSequence: request.cursor.afterSequence,
            health: 'ok',
            healthRecords: [],
          },
        }),
      },
    );

    expect(timers.expired.map((expired) => expired.reason)).toEqual(['startup-timeout']);
    expect(waited).toEqual({
      ok: true,
      value: {
        runId: 'run-01',
        cursor: {
          runId: 'run-01',
          afterSequence: 10,
        },
        events: [],
        timedOut: true,
        lastSequence: 10,
        health: 'ok',
        healthRecords: [],
      },
    });
  });
});
