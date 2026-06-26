import { describe, expect, it } from 'vitest';

import { evaluateSupervisionTimers } from '../../../../src/core/supervision/timers/index.js';

import { agentSessionLinked, fold, makeLifecycle, sessionLinked, workerSpawned } from './shared.js';

describe('core-04-s3 startup timer evaluation', () => {
  it('stops startup on current-session AgentSessionLinked', () => {
    const liveness = fold([
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      workerSpawned(2),
      sessionLinked(3),
      agentSessionLinked(4),
    ]);

    const result = evaluateSupervisionTimers({
      projection: liveness.projection,
      sampledAt: '2026-06-25T10:03:00.000Z',
      timerEvidence: liveness.timerEvidence,
    });

    expect(result.timers.startup.armed).toBe(false);
    expect(result.timers.startup.exceeded).toBe(false);
    expect(result.expired.filter((expired) => expired.timer === 'startup')).toEqual([]);
  });

  it('expires startup from worker-starting when linkage never arrives', () => {
    const liveness = fold([makeLifecycle(1, 'worker-starting', 'workspace-ready')], '2026-06-25T10:02:02.000Z');

    const result = evaluateSupervisionTimers({
      projection: liveness.projection,
      sampledAt: '2026-06-25T10:02:02.000Z',
      timerEvidence: liveness.timerEvidence,
    });

    expect(result.expired).toContainEqual({
      schema: 'kit-vnext.liveness-timer-expired.v1',
      runId: 'run-supervision-timers-01',
      timer: 'startup',
      reason: 'startup-timeout',
      deadline: '2026-06-25T10:02:01.000Z',
      observedAt: '2026-06-25T10:02:02.000Z',
      sourceEventIds: ['evt-RunLifecycleTransitioned-1'],
    });
  });

  it('falls back to WorkerSpawned when lifecycle startup evidence is absent', () => {
    const liveness = fold([workerSpawned(1)], '2026-06-25T10:02:02.000Z');

    const result = evaluateSupervisionTimers({
      projection: liveness.projection,
      sampledAt: '2026-06-25T10:02:02.000Z',
      timerEvidence: liveness.timerEvidence,
    });

    expect(result.expired).toContainEqual({
      schema: 'kit-vnext.liveness-timer-expired.v1',
      runId: 'run-supervision-timers-01',
      timer: 'startup',
      reason: 'startup-timeout',
      deadline: '2026-06-25T10:02:01.000Z',
      observedAt: '2026-06-25T10:02:02.000Z',
      workerHandleId: 'worker-01',
      sourceEventIds: ['evt-WorkerSpawned-1'],
    });
  });
});
