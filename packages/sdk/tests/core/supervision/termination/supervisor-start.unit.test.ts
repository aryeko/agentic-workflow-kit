import { describe, expect, it } from 'vitest';

import { startSupervisor } from '../../../../src/core/supervision/termination/index.js';

import { appendFailure, createWriter, cursor, runId, timerPolicy } from './shared.js';

describe('core-04-s4 startSupervisor', () => {
  it('appends the durable supervisor started payload with the exact source inputs', async () => {
    const writer = createWriter();

    const result = await startSupervisor(
      {
        runId,
        cursor,
        timerPolicy,
        expectedSessionId: 'session-01',
        expectedWorkerHandleId: 'worker-handle-01',
        startedAt: '2026-06-26T09:00:00.000Z',
        sourceEventIds: ['evt-run-created-01', 'evt-session-linked-01'],
      },
      writer,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(writer.appendCalls[0]?.[0]).toMatchObject({
      domain: 'core-04',
      type: 'SupervisorStarted',
      durability: 'durable',
      occurredAt: '2026-06-26T09:00:00.000Z',
    });
    expect(result.value.payload).toEqual({
      schema: 'kit-vnext.supervisor-started.v1',
      runId,
      cursor,
      timerPolicy,
      expectedSessionId: 'session-01',
      expectedWorkerHandleId: 'worker-handle-01',
      startedAt: '2026-06-26T09:00:00.000Z',
      sourceEventIds: ['evt-run-created-01', 'evt-session-linked-01'],
    });
  });

  it('falls back to the event type when the writer receipt omits event ids', async () => {
    const writer = createWriter((batch) => ({
      ok: true,
      value: {
        runId,
        firstSequence: 1,
        lastSequence: 1,
        writerEpoch: 3,
        durability: batch[0]?.durability ?? 'durable',
        eventIds: [],
        payloadDigests: [],
        frameDigest: 'sha256:frame-1',
        health: 'ok',
      },
    }));

    const result = await startSupervisor(
      {
        runId,
        cursor,
        timerPolicy,
        startedAt: '2026-06-26T09:00:00.000Z',
        sourceEventIds: ['evt-run-created-01'],
      },
      writer,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(result.value.eventId).toBe('SupervisorStarted');
  });

  it('returns supervision-event-log-unavailable when the append fails', async () => {
    const writer = createWriter(() => ({ ok: false, error: appendFailure }));
    const result = await startSupervisor(
      {
        runId,
        cursor,
        timerPolicy,
        startedAt: '2026-06-26T09:00:00.000Z',
        sourceEventIds: ['evt-run-created-01'],
      },
      writer,
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.reason).toBe('supervision-event-log-unavailable');
  });
});
