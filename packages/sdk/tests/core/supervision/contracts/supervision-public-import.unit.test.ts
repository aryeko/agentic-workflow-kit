import { LIVENESS_ADVANCE_CLASSES, LIVENESS_REASONS, LIVENESS_STATES, SUPERVISION_TIMER_NAMES } from 'sdk';
import type * as sdk from 'sdk';
import { describe, expect, it } from 'vitest';

describe('core-04-s1 public sdk supervision imports', () => {
  it('imports the full supervision contract surface from the sdk entrypoint', () => {
    const projection: sdk.LivenessProjection = {
      runId: 'run-01',
      state: 'waiting-for-approval',
      reason: 'approval-sla-exceeded',
      currentSessionId: 'session-01',
      workerHandleId: 'worker-01',
      lastWorkerEventSequence: 12,
      lastProgressSequence: 11,
      staleSince: '2026-06-24T10:00:00.000Z',
      timers: {
        startup: { deadline: '2026-06-24T10:02:00.000Z', exceeded: false },
        idle: { deadline: '2026-06-24T10:15:00.000Z', exceeded: false },
        'no-progress': { deadline: '2026-06-24T10:45:00.000Z', exceeded: false },
        'per-tool': { deadline: '2026-06-24T10:30:00.000Z', exceeded: false },
        'approval-SLA': { deadline: '2026-06-25T10:00:00.000Z', exceeded: true },
        'max-runtime': { deadline: '2026-06-24T18:00:00.000Z', exceeded: false },
      },
      terminal: false,
    };
    const waitRequest: sdk.SupervisionWaitRequest = {
      runId: projection.runId,
      cursor: { runId: projection.runId, afterSequence: 12 },
      timeoutMs: 30_000,
      maxEvents: 10,
    };
    const stopped: sdk.SupervisorStoppedPayload = {
      schema: 'kit-vnext.supervisor-stopped.v1',
      runId: projection.runId,
      outcome: 'supervision-lost',
      stoppedAt: '2026-06-24T10:16:21.000Z',
      terminalSourceEventIds: ['evt-terminal-01'],
      summarizedEventIds: ['evt-expired-01', 'evt-supervision-lost-01'],
    };

    expect(LIVENESS_STATES).toContain('approval-overdue');
    expect(LIVENESS_REASONS).toContain('termination-unavailable');
    expect(SUPERVISION_TIMER_NAMES).toContain('approval-SLA');
    expect(LIVENESS_ADVANCE_CLASSES).toContain('terminal-observation');
    expect(projection.timers['approval-SLA'].exceeded).toBe(true);
    expect(waitRequest.cursor.afterSequence).toBe(12);
    expect(stopped.terminalSourceEventIds).toEqual(['evt-terminal-01']);
  });
});
