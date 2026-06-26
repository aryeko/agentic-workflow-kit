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

describe('core-04-s4 termination unavailable', () => {
  it.each([
    {
      label: 'missing canKill',
      input: {
        workerHandle: ownedWorkerHandle(),
        canKill: undefined,
      },
    },
    {
      label: 'stale canKill',
      input: {
        workerHandle: ownedWorkerHandle(),
        canKill: canKillAttestation({ expiry: '2026-06-26T09:14:59.000Z' }),
      },
    },
    {
      label: 'malformed canKill expiry',
      input: {
        workerHandle: ownedWorkerHandle(),
        canKill: canKillAttestation({ expiry: 'not-a-date' }),
      },
    },
    {
      label: 'negative canKill',
      input: {
        workerHandle: ownedWorkerHandle(),
        canKill: canKillAttestation({ result: 'negative' }),
      },
    },
    {
      label: 'observe-only ownership',
      input: {
        workerHandle: ownedWorkerHandle({ ownershipClass: 'observe-only' }),
        canKill: canKillAttestation(),
      },
    },
    {
      label: 'missing worker handle',
      input: {
        workerHandle: undefined,
        canKill: canKillAttestation(),
      },
    },
  ])('records termination-unavailable and makes zero host calls for $label', async ({ input }) => {
    const writer = createWriter();
    const host = createHost();

    const result = await requestWorkerTermination(
      {
        runId,
        reason: 'idle-timeout',
        requestedAt: '2026-06-26T09:15:00.000Z',
        timerEventId: 'evt-timer-01',
        sourceEventIds: ['evt-state-01'],
        terminationPolicy,
        ...input,
      },
      { writer, host },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(result.value.terminationRequested).toBeUndefined();
    expect(result.value.supervisionLost?.payload.reason).toBe('termination-unavailable');
    expect(result.value.supervisionLost?.payload.sourceEventIds).toEqual(['evt-timer-01', 'evt-state-01']);
    expect(host.terminateCalls).toHaveLength(0);
    expect(writer.appendCalls).toHaveLength(1);
    expect(writer.appendCalls[0]?.map((intent) => intent.type)).toEqual(['SupervisionLost']);
  });

  it('surfaces an append failure while recording termination-unavailable', async () => {
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
      },
      { writer, host },
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.reason).toBe('supervision-event-log-unavailable');
    expect(host.terminateCalls).toHaveLength(0);
  });
});
