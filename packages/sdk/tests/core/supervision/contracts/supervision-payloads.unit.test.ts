import { describe, expect, it } from 'vitest';

import type {
  LivenessAdvancedPayload,
  LivenessStateChangedPayload,
  LivenessTimerExpiredPayload,
  SupervisorStartedPayload,
  SupervisorStoppedPayload,
  SupervisorTerminationRequestedPayload,
  SupervisionLostPayload,
  SupervisionTimerPolicy,
  WorkerTerminatedPayload,
} from '../../../../src/index.js';

describe('core-04-s1 supervision payloads', () => {
  it('constructs the v1 supervision payload catalog with the declared schemas and source fields', () => {
    const timerPolicy: SupervisionTimerPolicy = {
      startupMs: 120_000,
      idleMs: 900_000,
      noProgressMs: 2_700_000,
      perToolMs: 1_800_000,
      approvalSlaMs: 86_400_000,
      maxRuntimeMs: 28_800_000,
    };
    const started: SupervisorStartedPayload = {
      schema: 'kit-vnext.supervisor-started.v1',
      runId: 'run-01',
      cursor: { runId: 'run-01', afterSequence: 0 },
      expectedSessionId: 'session-01',
      expectedWorkerHandleId: 'worker-01',
      timerPolicy,
      startedAt: '2026-06-24T10:00:00.000Z',
      sourceEventIds: ['evt-created-01'],
    };
    const advanced: LivenessAdvancedPayload = {
      schema: 'kit-vnext.liveness-advanced.v1',
      runId: 'run-01',
      sessionId: 'session-01',
      workerHandleId: 'worker-01',
      sourceEventId: 'evt-progress-01',
      sourceSequence: 12,
      advanceClass: 'worker-progress',
      refreshedTimers: ['idle', 'no-progress'],
      advancedAt: '2026-06-24T10:01:00.000Z',
    };
    const expired: LivenessTimerExpiredPayload = {
      schema: 'kit-vnext.liveness-timer-expired.v1',
      runId: 'run-01',
      timer: 'idle',
      reason: 'idle-timeout',
      deadline: '2026-06-24T10:15:00.000Z',
      observedAt: '2026-06-24T10:16:00.000Z',
      sessionId: 'session-01',
      workerHandleId: 'worker-01',
      lastWorkerEventSequence: 12,
      lastProgressSequence: 11,
      sourceEventIds: ['evt-progress-01', 'evt-progress-02'],
    };
    const changed: LivenessStateChangedPayload = {
      schema: 'kit-vnext.liveness-state-changed.v1',
      runId: 'run-01',
      from: 'active',
      to: 'stale',
      reason: 'idle-timeout',
      changedAt: '2026-06-24T10:16:00.100Z',
      sourceEventIds: ['evt-expired-01'],
    };
    const lost: SupervisionLostPayload = {
      schema: 'kit-vnext.supervision-lost.v1',
      runId: 'run-01',
      reason: 'termination-unproven',
      lostAt: '2026-06-24T10:16:10.000Z',
      sourceEventIds: ['evt-termination-result-01'],
    };
    const requested: SupervisorTerminationRequestedPayload = {
      schema: 'kit-vnext.supervisor-termination-requested.v1',
      runId: 'run-01',
      workerHandleId: 'worker-01',
      reason: 'idle-timeout',
      requestedAt: '2026-06-24T10:16:05.000Z',
      timerEventId: 'evt-expired-01',
      sourceEventIds: ['evt-expired-01', 'evt-state-change-01'],
    };
    const terminated: WorkerTerminatedPayload = {
      schema: 'kit-vnext.worker-terminated.v1',
      runId: 'run-01',
      workerHandleId: 'worker-01',
      observedBy: 'execution-host',
      proofRef: 'artifact://termination-proof/01',
      containmentEmpty: true,
      terminatedAt: '2026-06-24T10:16:20.000Z',
      sourceEventIds: ['evt-host-proof-01'],
    };
    const stopped: SupervisorStoppedPayload = {
      schema: 'kit-vnext.supervisor-stopped.v1',
      runId: 'run-01',
      outcome: 'terminated',
      stoppedAt: '2026-06-24T10:16:21.000Z',
      terminalSourceEventIds: ['evt-worker-terminated-01'],
      summarizedEventIds: ['evt-expired-01', 'evt-termination-requested-01'],
    };

    expect(started.sourceEventIds).toEqual(['evt-created-01']);
    expect(advanced.sourceSequence).toBe(12);
    expect(expired.deadline).toBe('2026-06-24T10:15:00.000Z');
    expect(changed.reason).toBe('idle-timeout');
    expect(lost.reason).toBe('termination-unproven');
    expect(requested.timerEventId).toBe('evt-expired-01');
    expect(terminated.observedBy).toBe('execution-host');
    expect(stopped.terminalSourceEventIds).toEqual(['evt-worker-terminated-01']);
  });
});
