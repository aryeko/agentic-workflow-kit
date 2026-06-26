import {
  recordLivenessAdvanced,
  recordLivenessStateChanged,
  recordSupervisionLost,
  recordTimerExpired,
  recordWorkerTerminated,
  requestWorkerTermination,
  startSupervisor,
  stopSupervisor,
  type CapabilityAttestation,
  type RequestWorkerTerminationInput,
  type TerminationPolicy,
  type WorkerHandle,
} from 'sdk';
import { describe, expect, it } from 'vitest';

describe('core-04-s4 public sdk termination imports', () => {
  it('exports the full supervision termination function surface from sdk', () => {
    const workerHandle: WorkerHandle = {
      handleId: 'worker-handle-01',
      runId: 'run-termination-01',
      operationId: 'op-worker-01',
      workspaceHandleId: 'workspace-handle-01',
      ownershipClass: 'owned',
      containmentRef: 'containment://worker-handle-01',
      startedAt: '2026-06-26T08:50:00.000Z',
    };
    const canKill: CapabilityAttestation<'canKill'> = {
      capability: 'canKill',
      probeMethod: 'live-smoke',
      result: 'positive',
      evidenceRef: 'artifact://host-can-kill',
      scope: 'executionHost',
      expiry: '2026-06-26T10:30:00.000Z',
      driverVersion: '1.0.0',
      platform: 'darwin-arm64',
      freshnessKey: 'execution-host:provider-local',
      at: '2026-06-26T09:00:00.000Z',
    };
    const policy: TerminationPolicy = {
      initialSignal: 'SIGTERM',
      graceSeconds: 15,
      forceKill: true,
      proveEmptyTimeoutSeconds: 30,
    };
    const request: RequestWorkerTerminationInput = {
      runId: 'run-termination-01',
      reason: 'idle-timeout',
      requestedAt: '2026-06-26T09:15:00.000Z',
      timerEventId: 'evt-timer-01',
      sourceEventIds: ['evt-state-01'],
      workerHandle,
      terminationPolicy: policy,
      canKill,
    };

    expect(typeof startSupervisor).toBe('function');
    expect(typeof recordLivenessAdvanced).toBe('function');
    expect(typeof recordTimerExpired).toBe('function');
    expect(typeof recordLivenessStateChanged).toBe('function');
    expect(typeof recordSupervisionLost).toBe('function');
    expect(typeof requestWorkerTermination).toBe('function');
    expect(typeof recordWorkerTerminated).toBe('function');
    expect(typeof stopSupervisor).toBe('function');
    expect(request.workerHandle?.ownershipClass).toBe('owned');
    expect(request.canKill?.capability).toBe('canKill');
  });
});
