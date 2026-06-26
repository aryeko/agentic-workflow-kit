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
  terminationResult,
} from './shared.js';

describe('core-04-s4 termination unproven', () => {
  it('records termination-unproven without appending WorkerTerminated when host proof is incomplete', async () => {
    const writer = createWriter();
    const host = createHost(
      terminationResult({
        proof: {
          signalSent: true,
          graceObserved: true,
          forceKillSent: true,
          reaped: true,
          containmentEmpty: false,
          evidenceRef: 'artifact://termination-proof-02',
          checkedAt: '2026-06-26T09:16:00.000Z',
        },
      }),
    );

    const result = await requestWorkerTermination(
      {
        runId,
        reason: 'no-progress-timeout',
        requestedAt: '2026-06-26T09:15:00.000Z',
        timerEventId: 'evt-timer-01',
        sourceEventIds: ['evt-state-01'],
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

    expect(writer.appendCalls).toHaveLength(2);
    expect(writer.appendCalls[0]?.map((intent) => intent.type)).toEqual(['SupervisorTerminationRequested']);
    expect(writer.appendCalls[1]?.map((intent) => intent.type)).toEqual(['SupervisionLost']);
    expect(result.value.supervisionLost?.payload.reason).toBe('termination-unproven');
    expect(result.value.supervisionLost?.payload.sourceEventIds).toEqual([
      'evt-SupervisorTerminationRequested-1-1',
      'evt-timer-01',
      'evt-state-01',
    ]);
    expect(writer.appendCalls.flat().map((intent) => intent.type)).not.toContain('WorkerTerminated');
  });

  it('surfaces a supervision append failure after the host returns unproven termination', async () => {
    const writer = createWriter((batch, callIndex) =>
      callIndex === 2
        ? { ok: false, error: appendFailure }
        : {
            ok: true,
            value: {
              runId,
              firstSequence: 1,
              lastSequence: batch.length,
              writerEpoch: 3,
              durability: 'barrier',
              eventIds: batch.map((intent, index) => `evt-${intent.type}-${index + 1}`),
              payloadDigests: [],
              frameDigest: 'sha256:frame-1',
              health: 'ok',
            },
          },
    );
    const host = createHost(
      terminationResult({
        proof: {
          signalSent: true,
          graceObserved: true,
          forceKillSent: true,
          reaped: true,
          containmentEmpty: false,
          evidenceRef: 'artifact://termination-proof-02',
          checkedAt: '2026-06-26T09:16:00.000Z',
        },
      }),
    );

    const result = await requestWorkerTermination(
      {
        runId,
        reason: 'no-progress-timeout',
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
  });
});
