import { describe, expect, it } from 'vitest';

import {
  recordLivenessAdvanced,
  recordLivenessStateChanged,
  recordTimerExpired,
} from '../../../../src/core/supervision/termination/index.js';

import { createWriter, runId } from './shared.js';

describe('core-04-s4 durable supervision facts', () => {
  it('records liveness advanced facts equal to the producer inputs', async () => {
    const writer = createWriter();
    const result = await recordLivenessAdvanced(
      {
        runId,
        sessionId: 'session-01',
        workerHandleId: 'worker-handle-01',
        sourceEventId: 'evt-progress-01',
        sourceSequence: 17,
        advanceClass: 'worker-progress',
        refreshedTimers: ['idle', 'no-progress'],
        advancedAt: '2026-06-26T09:01:00.000Z',
      },
      writer,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(result.value.payload).toEqual({
      schema: 'kit-vnext.liveness-advanced.v1',
      runId,
      sessionId: 'session-01',
      workerHandleId: 'worker-handle-01',
      sourceEventId: 'evt-progress-01',
      sourceSequence: 17,
      advanceClass: 'worker-progress',
      refreshedTimers: ['idle', 'no-progress'],
      advancedAt: '2026-06-26T09:01:00.000Z',
    });
    expect(writer.appendCalls[0]?.[0]?.durability).toBe('durable');
  });

  it('records timer expiry facts equal to the producer inputs', async () => {
    const writer = createWriter();
    const result = await recordTimerExpired(
      {
        runId,
        timer: 'no-progress',
        reason: 'no-progress-timeout',
        deadline: '2026-06-26T09:45:00.000Z',
        observedAt: '2026-06-26T09:46:00.000Z',
        sessionId: 'session-01',
        workerHandleId: 'worker-handle-01',
        lastWorkerEventSequence: 30,
        lastProgressSequence: 28,
        sourceEventIds: ['evt-progress-01', 'evt-progress-02'],
      },
      writer,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(result.value.payload).toEqual({
      schema: 'kit-vnext.liveness-timer-expired.v1',
      runId,
      timer: 'no-progress',
      reason: 'no-progress-timeout',
      deadline: '2026-06-26T09:45:00.000Z',
      observedAt: '2026-06-26T09:46:00.000Z',
      sessionId: 'session-01',
      workerHandleId: 'worker-handle-01',
      lastWorkerEventSequence: 30,
      lastProgressSequence: 28,
      sourceEventIds: ['evt-progress-01', 'evt-progress-02'],
    });
    expect(writer.appendCalls[0]?.[0]?.durability).toBe('durable');
  });

  it('records liveness state changes equal to the producer inputs', async () => {
    const writer = createWriter();
    const result = await recordLivenessStateChanged(
      {
        runId,
        from: 'active',
        to: 'stale',
        reason: 'idle-timeout',
        changedAt: '2026-06-26T09:46:00.000Z',
        sourceEventIds: ['evt-liveness-expired-01'],
      },
      writer,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(result.value.payload).toEqual({
      schema: 'kit-vnext.liveness-state-changed.v1',
      runId,
      from: 'active',
      to: 'stale',
      reason: 'idle-timeout',
      changedAt: '2026-06-26T09:46:00.000Z',
      sourceEventIds: ['evt-liveness-expired-01'],
    });
    expect(writer.appendCalls[0]?.[0]?.durability).toBe('durable');
  });

  it('rejects liveness advanced appends after SupervisorStopped', async () => {
    const writer = createWriter();
    const result = await recordLivenessAdvanced(
      {
        runId,
        sessionId: 'session-01',
        sourceEventId: 'evt-progress-01',
        sourceSequence: 17,
        advanceClass: 'worker-progress',
        refreshedTimers: ['idle'],
        advancedAt: '2026-06-26T09:01:00.000Z',
        guard: {
          lifecycleTerminal: false,
          supervisorStopped: true,
        },
      },
      writer,
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.reason).toBe('supervisor-stopped');
  });

  it('rejects timer expiry appends after terminal lifecycle closure', async () => {
    const writer = createWriter();
    const result = await recordTimerExpired(
      {
        runId,
        timer: 'idle',
        reason: 'idle-timeout',
        deadline: '2026-06-26T09:45:00.000Z',
        observedAt: '2026-06-26T09:46:00.000Z',
        sourceEventIds: ['evt-progress-01'],
        guard: {
          lifecycleTerminal: true,
          supervisorStopped: false,
        },
      },
      writer,
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.reason).toBe('post-terminal-core-04-fact-forbidden');
  });
});
