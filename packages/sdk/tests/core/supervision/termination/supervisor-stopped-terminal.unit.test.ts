import { describe, expect, it } from 'vitest';

import {
  recordLivenessStateChanged,
  startSupervisor,
  stopSupervisor,
} from '../../../../src/core/supervision/termination/index.js';

import { appendFailure, createWriter, cursor, runId, timerPolicy } from './shared.js';

describe('core-04-s4 supervisor stopped terminal guard', () => {
  it('allows SupervisorStopped as the only post-terminal core-04 append', async () => {
    const writer = createWriter();
    const stopped = await stopSupervisor(
      {
        runId,
        outcome: 'terminal-lifecycle-observed',
        stoppedAt: '2026-06-26T09:17:00.000Z',
        terminalSourceEventIds: ['evt-run-completed-01'],
        summarizedEventIds: ['evt-worker-terminated-01'],
        guard: {
          lifecycleTerminal: true,
          supervisorStopped: false,
        },
      },
      writer,
    );

    expect(stopped.ok).toBe(true);
    if (!stopped.ok) {
      throw new Error(stopped.error.reason);
    }

    const lateStart = await startSupervisor(
      {
        runId,
        cursor,
        timerPolicy,
        startedAt: '2026-06-26T09:18:00.000Z',
        sourceEventIds: ['evt-created-01'],
        guard: {
          lifecycleTerminal: true,
          supervisorStopped: false,
        },
      },
      createWriter(),
    );

    expect(lateStart.ok).toBe(false);
    expect(lateStart.ok ? undefined : lateStart.error.reason).toBe('post-terminal-core-04-fact-forbidden');
  });

  it('blocks all later core-04 facts once SupervisorStopped has been recorded', async () => {
    const writer = createWriter();
    const result = await recordLivenessStateChanged(
      {
        runId,
        from: 'active',
        to: 'supervision-lost',
        reason: 'termination-unproven',
        changedAt: '2026-06-26T09:18:00.000Z',
        sourceEventIds: ['evt-supervision-lost-01'],
        guard: {
          lifecycleTerminal: true,
          supervisorStopped: true,
        },
      },
      writer,
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.reason).toBe('supervisor-stopped');
    expect(writer.appendCalls).toHaveLength(0);
  });

  it('rejects duplicate SupervisorStopped appends and surfaces append failures', async () => {
    const blocked = await stopSupervisor(
      {
        runId,
        outcome: 'supervision-lost',
        stoppedAt: '2026-06-26T09:17:00.000Z',
        terminalSourceEventIds: ['evt-run-failed-01'],
        summarizedEventIds: ['evt-supervision-lost-01'],
        guard: {
          lifecycleTerminal: true,
          supervisorStopped: true,
        },
      },
      createWriter(),
    );

    expect(blocked.ok).toBe(false);
    expect(blocked.ok ? undefined : blocked.error.reason).toBe('supervisor-stopped');

    const failedAppend = await stopSupervisor(
      {
        runId,
        outcome: 'supervision-lost',
        stoppedAt: '2026-06-26T09:17:00.000Z',
        terminalSourceEventIds: ['evt-run-failed-01'],
        summarizedEventIds: ['evt-supervision-lost-01'],
      },
      createWriter(() => ({ ok: false, error: appendFailure })),
    );

    expect(failedAppend.ok).toBe(false);
    expect(failedAppend.ok ? undefined : failedAppend.error.reason).toBe('supervision-event-log-unavailable');
  });

  it('falls back to default event ids when the stop batch receipt omits them', async () => {
    const result = await stopSupervisor(
      {
        runId,
        outcome: 'terminated',
        stoppedAt: '2026-06-26T09:17:00.000Z',
        terminalSourceEventIds: ['evt-run-completed-01'],
        summarizedEventIds: ['evt-worker-terminated-01'],
        workerTerminated: {
          runId,
          workerHandleId: 'worker-handle-01',
          observedBy: 'execution-host',
          terminatedAt: '2026-06-26T09:16:00.000Z',
          sourceEventIds: ['evt-proof-01'],
        },
      },
      createWriter((batch) => ({
        ok: true,
        value: {
          runId,
          firstSequence: 1,
          lastSequence: batch.length,
          writerEpoch: 3,
          durability: 'barrier',
          eventIds: [],
          payloadDigests: [],
          frameDigest: 'sha256:frame-1',
          health: 'ok',
        },
      })),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(result.value.workerTerminated?.eventId).toBe('WorkerTerminated');
    expect(result.value.supervisorStopped.eventId).toBe('SupervisorStopped');
  });
});
