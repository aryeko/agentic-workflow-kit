import { describe, expect, it } from 'vitest';

import type { LivenessProjection } from '../../../../src/index.js';
import { evaluateSupervisionTimers } from '../../../../src/core/supervision/timers/index.js';

import {
  agentSessionLinked,
  agentTerminal,
  approvalAnswered,
  approvalRequested,
  fold,
  makeLifecycle,
  progressObserved,
  sessionLinked,
  workerSpawned,
} from './shared.js';

describe('core-04-s3 approval SLA timer evaluation', () => {
  it('emits approval-sla-exceeded when the approval attention window is overdue', () => {
    const liveness = fold([
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      workerSpawned(2),
      sessionLinked(3),
      agentSessionLinked(4),
      progressObserved(5),
      approvalRequested(6),
    ]);

    const result = evaluateSupervisionTimers({
      projection: liveness.projection,
      sampledAt: '2026-06-26T10:00:07.000Z',
      timerEvidence: liveness.timerEvidence,
    });

    expect(result.expired).toContainEqual({
      schema: 'kit-vnext.liveness-timer-expired.v1',
      runId: 'run-supervision-timers-01',
      timer: 'approval-SLA',
      reason: 'approval-sla-exceeded',
      deadline: '2026-06-26T10:00:06.000Z',
      observedAt: '2026-06-26T10:00:07.000Z',
      sessionId: 'session-01',
      workerHandleId: 'worker-01',
      lastWorkerEventSequence: 6,
      lastProgressSequence: 5,
      sourceEventIds: ['evt-AgentApprovalRequested-6'],
    });
  });

  it('stops approval-SLA on a recorded approval answer', () => {
    const liveness = fold([
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      workerSpawned(2),
      sessionLinked(3),
      agentSessionLinked(4),
      progressObserved(5),
      approvalRequested(6),
      approvalAnswered(7),
    ]);

    const result = evaluateSupervisionTimers({
      projection: liveness.projection,
      sampledAt: '2026-06-26T10:00:07.000Z',
      timerEvidence: liveness.timerEvidence,
    });

    expect(result.timers['approval-SLA'].armed).toBe(false);
    expect(result.expired.filter((expired) => expired.timer === 'approval-SLA')).toEqual([]);
  });

  it('stops approval-SLA on a terminal observation', () => {
    const liveness = fold([
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      workerSpawned(2),
      sessionLinked(3),
      agentSessionLinked(4),
      progressObserved(5),
      approvalRequested(6),
      agentTerminal(7),
    ]);

    const result = evaluateSupervisionTimers({
      projection: liveness.projection,
      sampledAt: '2026-06-26T10:00:07.000Z',
      timerEvidence: liveness.timerEvidence,
    });

    expect(result.timers['approval-SLA'].armed).toBe(false);
    expect(result.expired.filter((expired) => expired.timer === 'approval-SLA')).toEqual([]);
  });

  it('suppresses approval-SLA when the projection is already terminal even without explicit stop evidence', () => {
    const projection: LivenessProjection = {
      runId: 'run-supervision-timers-01',
      state: 'terminated',
      currentSessionId: 'session-01',
      workerHandleId: 'worker-01',
      timers: {
        startup: { deadline: '2026-06-25T10:02:01.000Z', exceeded: false },
        idle: { deadline: '2026-06-25T10:15:06.000Z', exceeded: false },
        'no-progress': { deadline: '2026-06-25T10:45:05.000Z', exceeded: false },
        'per-tool': { deadline: '2026-06-25T10:30:05.000Z', exceeded: false },
        'approval-SLA': { deadline: '2026-06-26T10:00:06.000Z', exceeded: false },
        'max-runtime': { deadline: '2026-06-25T18:00:01.000Z', exceeded: false },
      },
      terminal: true,
    };

    const result = evaluateSupervisionTimers({
      projection,
      sampledAt: '2026-06-26T10:00:07.000Z',
      timerEvidence: {
        'approval-SLA': {
          basisAt: '2026-06-25T10:00:06.000Z',
          sourceEventIds: ['evt-approval-01'],
        },
      },
    });

    expect(result.timers['approval-SLA']).toEqual({
      armed: false,
      deadline: '2026-06-26T10:00:06.000Z',
      exceeded: false,
    });
    expect(result.expired.filter((expired) => expired.timer === 'approval-SLA')).toEqual([]);
  });

  it('suppresses every armed timer when the projection is already terminal', () => {
    const projection: LivenessProjection = {
      runId: 'run-supervision-timers-01',
      state: 'terminated',
      currentSessionId: 'session-01',
      workerHandleId: 'worker-01',
      timers: {
        startup: { deadline: '2026-06-25T10:02:01.000Z', exceeded: false },
        idle: { deadline: '2026-06-25T10:15:06.000Z', exceeded: false },
        'no-progress': { deadline: '2026-06-25T10:45:05.000Z', exceeded: false },
        'per-tool': { deadline: '2026-06-25T10:30:05.000Z', exceeded: false },
        'approval-SLA': { deadline: '2026-06-26T10:00:06.000Z', exceeded: false },
        'max-runtime': { deadline: '2026-06-25T18:00:01.000Z', exceeded: false },
      },
      terminal: true,
    };

    const result = evaluateSupervisionTimers({
      projection,
      sampledAt: '2026-06-26T10:00:07.000Z',
      timerEvidence: {
        startup: { basisAt: '2026-06-25T10:00:01.000Z', sourceEventIds: ['evt-worker-spawned-01'] },
        idle: { basisAt: '2026-06-25T10:00:06.000Z', sourceEventIds: ['evt-progress-01'] },
        'no-progress': { basisAt: '2026-06-25T10:00:05.000Z', sourceEventIds: ['evt-progress-01'] },
        'per-tool': { basisAt: '2026-06-25T10:00:05.000Z', sourceEventIds: ['evt-tool-01'] },
        'approval-SLA': { basisAt: '2026-06-25T10:00:06.000Z', sourceEventIds: ['evt-approval-01'] },
        'max-runtime': { basisAt: '2026-06-25T10:00:01.000Z', sourceEventIds: ['evt-worker-spawned-01'] },
      },
    });

    expect(Object.values(result.timers).map((timer) => timer.armed)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(result.expired).toEqual([]);
  });
});
