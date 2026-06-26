import { describe, expect, it, vi } from 'vitest';

import type { LivenessProjection, Result, WaitRunEventsResult } from '../../../../src/index.js';
import { wrapWaitRunEvents } from '../../../../src/core/supervision/wait/index.js';

describe('core-04-s3 wait wrapper side-effect boundaries', () => {
  it.each([
    [
      'success',
      {
        ok: true,
        value: {
          runId: 'run-01',
          cursor: {
            runId: 'run-01',
            afterSequence: 11,
          },
          events: [
            {
              schema: 'kit-vnext.run-event.v1',
              runId: 'run-01',
              eventId: 'evt-11',
              sequence: 11,
              writerEpoch: 1,
              domain: 'core-04-test',
              type: 'AgentProgressObserved',
              durability: 'durable',
              occurredAt: '2026-06-25T10:00:11.000Z',
              recordedAt: '2026-06-25T10:00:11.000Z',
              payloadDigest: 'sha256:evt-11',
              payload: {
                sessionId: 'session-01',
              },
            },
          ],
          timedOut: false,
          lastSequence: 11,
          health: 'ok',
          healthRecords: [],
        },
      } satisfies Result<WaitRunEventsResult, never>,
    ],
    [
      'timeout',
      {
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
      } satisfies Result<WaitRunEventsResult, never>,
    ],
  ])('keeps append, project, renew, and refresh at zero on %s', async (_label, delegated) => {
    const append = vi.fn();
    const project = vi.fn();
    const renew = vi.fn();
    const refreshLiveness = vi.fn();
    const waitRunEvents = vi.fn(async () => delegated);
    const projection: LivenessProjection = {
      runId: 'run-01',
      state: 'active',
      currentSessionId: 'session-01',
      workerHandleId: 'worker-01',
      lastWorkerEventSequence: 10,
      lastProgressSequence: 10,
      timers: {
        startup: { deadline: '2026-06-25T10:02:00.000Z', exceeded: false },
        idle: { deadline: '2026-06-25T10:15:00.000Z', exceeded: false },
        'no-progress': { deadline: '2026-06-25T10:45:00.000Z', exceeded: false },
        'per-tool': { deadline: '2026-06-25T10:30:00.000Z', exceeded: false },
        'approval-SLA': { deadline: '2026-06-26T10:00:00.000Z', exceeded: false },
        'max-runtime': { deadline: '2026-06-25T18:00:00.000Z', exceeded: false },
      },
      terminal: false,
    };

    const result = await wrapWaitRunEvents(
      {
        runId: 'run-01',
        cursor: {
          runId: 'run-01',
          afterSequence: 10,
        },
        timeoutMs: 500,
      },
      {
        waitRunEvents,
        append,
        project,
        renew,
        refreshLiveness,
        projection,
      },
    );

    expect(result).toEqual(delegated);
    expect(append).not.toHaveBeenCalled();
    expect(project).not.toHaveBeenCalled();
    expect(renew).not.toHaveBeenCalled();
    expect(refreshLiveness).not.toHaveBeenCalled();
    expect(projection).toEqual({
      runId: 'run-01',
      state: 'active',
      currentSessionId: 'session-01',
      workerHandleId: 'worker-01',
      lastWorkerEventSequence: 10,
      lastProgressSequence: 10,
      timers: {
        startup: { deadline: '2026-06-25T10:02:00.000Z', exceeded: false },
        idle: { deadline: '2026-06-25T10:15:00.000Z', exceeded: false },
        'no-progress': { deadline: '2026-06-25T10:45:00.000Z', exceeded: false },
        'per-tool': { deadline: '2026-06-25T10:30:00.000Z', exceeded: false },
        'approval-SLA': { deadline: '2026-06-26T10:00:00.000Z', exceeded: false },
        'max-runtime': { deadline: '2026-06-25T18:00:00.000Z', exceeded: false },
      },
      terminal: false,
    });
  });
});
