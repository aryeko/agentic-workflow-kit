import { describe, expect, it } from 'vitest';

import { requestWorkerTermination } from '../../../../src/core/supervision/termination/index.js';

import {
  appendFailure,
  canKillAttestation,
  createHost,
  createWriter,
  ownedWorkerHandle,
  runId,
  terminationPolicy,
} from './shared.js';

describe('core-04-s4 requestWorkerTermination', () => {
  it.each([
    'startup-timeout',
    'idle-timeout',
    'no-progress-timeout',
    'tool-timeout',
    'max-runtime-exceeded',
  ] as const)('appends a termination request and calls the host exactly once for %s on an owned worker', async (reason) => {
    const writer = createWriter();
    const host = createHost();

    const result = await requestWorkerTermination(
      {
        runId,
        reason,
        requestedAt: '2026-06-26T09:15:00.000Z',
        timerEventId: 'evt-timer-01',
        sourceEventIds: ['evt-liveness-state-01'],
        workerHandle: ownedWorkerHandle(),
        terminationPolicy,
        canKill: canKillAttestation(),
      },
      { writer, host },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(result.value.terminationRequested?.payload).toEqual({
      schema: 'kit-vnext.supervisor-termination-requested.v1',
      runId,
      workerHandleId: 'worker-handle-01',
      reason,
      requestedAt: '2026-06-26T09:15:00.000Z',
      timerEventId: 'evt-timer-01',
      sourceEventIds: ['evt-timer-01', 'evt-liveness-state-01'],
    });
    expect(result.value.supervisionLost).toBeUndefined();
    expect(host.terminateCalls).toEqual([
      {
        handle: ownedWorkerHandle(),
        policy: terminationPolicy,
      },
    ]);
    expect(writer.appendCalls).toHaveLength(1);
    expect(writer.appendCalls[0]?.[0]).toMatchObject({
      type: 'SupervisorTerminationRequested',
      durability: 'barrier',
    });
  });

  it('fails closed before any host call when the termination request append fails', async () => {
    const writer = createWriter(() => ({ ok: false, error: appendFailure }));
    const host = createHost();
    const result = await requestWorkerTermination(
      {
        runId,
        reason: 'idle-timeout',
        requestedAt: '2026-06-26T09:15:00.000Z',
        timerEventId: 'evt-timer-01',
        sourceEventIds: ['evt-state-01'],
        workerHandle: ownedWorkerHandle(),
        terminationPolicy,
        canKill: canKillAttestation(),
      },
      { writer, host },
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.reason).toBe('supervision-event-log-unavailable');
    expect(host.terminateCalls).toHaveLength(0);
  });

  it('rejects termination requests after SupervisorStopped', async () => {
    const writer = createWriter();
    const host = createHost();
    const result = await requestWorkerTermination(
      {
        runId,
        reason: 'idle-timeout',
        requestedAt: '2026-06-26T09:15:00.000Z',
        timerEventId: 'evt-timer-01',
        sourceEventIds: ['evt-state-01'],
        workerHandle: ownedWorkerHandle(),
        terminationPolicy,
        canKill: canKillAttestation(),
        guard: {
          lifecycleTerminal: false,
          supervisorStopped: true,
        },
      },
      { writer, host },
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.reason).toBe('supervisor-stopped');
    expect(host.terminateCalls).toHaveLength(0);
  });
});
