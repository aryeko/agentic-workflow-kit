import { describe, expect, it } from 'vitest';

import { evaluateSupervisionTimers } from '../../../../src/core/supervision/timers/index.js';

import { fold, makeLifecycle, workerSpawned, workerExited } from './shared.js';

describe('core-04-s3 max-runtime timer evaluation', () => {
  it('emits max-runtime-exceeded when the worker outlives the policy window', () => {
    const liveness = fold([makeLifecycle(1, 'worker-starting', 'workspace-ready'), workerSpawned(2)]);

    const result = evaluateSupervisionTimers({
      projection: liveness.projection,
      sampledAt: '2026-06-25T18:00:02.000Z',
      timerEvidence: liveness.timerEvidence,
    });

    expect(result.expired).toContainEqual({
      schema: 'kit-vnext.liveness-timer-expired.v1',
      runId: 'run-supervision-timers-01',
      timer: 'max-runtime',
      reason: 'max-runtime-exceeded',
      deadline: '2026-06-25T18:00:01.000Z',
      observedAt: '2026-06-25T18:00:02.000Z',
      workerHandleId: 'worker-01',
      sourceEventIds: ['evt-RunLifecycleTransitioned-1'],
    });
  });

  it('stops max-runtime on terminal lifecycle or worker terminal observation', () => {
    const terminalLifecycle = fold([
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      makeLifecycle(2, 'completed', 'running'),
    ]);
    const terminalObservation = fold([
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      workerSpawned(2),
      workerExited(3),
    ]);

    const lifecycleResult = evaluateSupervisionTimers({
      projection: terminalLifecycle.projection,
      sampledAt: '2026-06-25T18:00:02.000Z',
      timerEvidence: terminalLifecycle.timerEvidence,
    });
    const observationResult = evaluateSupervisionTimers({
      projection: terminalObservation.projection,
      sampledAt: '2026-06-25T18:00:02.000Z',
      timerEvidence: terminalObservation.timerEvidence,
    });

    expect(lifecycleResult.timers['max-runtime'].armed).toBe(false);
    expect(observationResult.timers['max-runtime'].armed).toBe(false);
    expect(lifecycleResult.expired.filter((expired) => expired.timer === 'max-runtime')).toEqual([]);
    expect(observationResult.expired.filter((expired) => expired.timer === 'max-runtime')).toEqual([]);
  });
});
