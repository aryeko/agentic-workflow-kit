import { describe, expect, it } from 'vitest';

import { recordWorkerTerminated, stopSupervisor } from '../../../../src/core/supervision/termination/index.js';

import { appendFailure, createWriter, runId } from './shared.js';

describe('core-04-s4 worker terminated ordering', () => {
  it('records WorkerTerminated at barrier before terminal lifecycle closure', async () => {
    const writer = createWriter();
    const result = await recordWorkerTerminated(
      {
        runId,
        workerHandleId: 'worker-handle-01',
        observedBy: 'execution-host',
        containmentEmpty: true,
        proofRef: 'artifact://termination-proof-01',
        terminatedAt: '2026-06-26T09:16:00.000Z',
        sourceEventIds: ['evt-proof-01'],
      },
      writer,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(writer.appendCalls[0]?.[0]).toMatchObject({
      type: 'WorkerTerminated',
      durability: 'barrier',
    });
  });

  it('rejects post-terminal WorkerTerminated appends outside the SupervisorStopped batch', async () => {
    const writer = createWriter();
    const result = await recordWorkerTerminated(
      {
        runId,
        workerHandleId: 'worker-handle-01',
        observedBy: 'agent',
        terminatedAt: '2026-06-26T09:16:00.000Z',
        sourceEventIds: ['evt-agent-terminal-01'],
        guard: {
          lifecycleTerminal: true,
          supervisorStopped: false,
        },
      },
      writer,
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.reason).toBe('post-terminal-core-04-fact-forbidden');
    expect(writer.appendCalls).toHaveLength(0);
  });

  it('batches WorkerTerminated before SupervisorStopped when closing supervision after a terminal observation', async () => {
    const writer = createWriter();
    const result = await stopSupervisor(
      {
        runId,
        outcome: 'terminated',
        stoppedAt: '2026-06-26T09:16:01.000Z',
        terminalSourceEventIds: ['evt-terminal-01'],
        summarizedEventIds: ['evt-termination-requested-01'],
        guard: {
          lifecycleTerminal: true,
          supervisorStopped: false,
        },
        workerTerminated: {
          runId,
          workerHandleId: 'worker-handle-01',
          observedBy: 'execution-host',
          proofRef: 'artifact://termination-proof-01',
          containmentEmpty: true,
          terminatedAt: '2026-06-26T09:16:00.000Z',
          sourceEventIds: ['evt-proof-01'],
        },
      },
      writer,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(writer.appendCalls).toHaveLength(1);
    expect(writer.appendCalls[0]?.map((intent) => intent.type)).toEqual(['WorkerTerminated', 'SupervisorStopped']);
    expect(result.value.workerTerminated?.eventId).toBe('evt-WorkerTerminated-1-1');
    expect(result.value.supervisorStopped.eventId).toBe('evt-SupervisorStopped-1-2');
  });

  it('returns supervision-event-log-unavailable when WorkerTerminated cannot be appended', async () => {
    const writer = createWriter(() => ({ ok: false, error: appendFailure }));
    const result = await recordWorkerTerminated(
      {
        runId,
        workerHandleId: 'worker-handle-01',
        observedBy: 'execution-host',
        terminatedAt: '2026-06-26T09:16:00.000Z',
        sourceEventIds: ['evt-proof-01'],
      },
      writer,
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.reason).toBe('supervision-event-log-unavailable');
  });
});
