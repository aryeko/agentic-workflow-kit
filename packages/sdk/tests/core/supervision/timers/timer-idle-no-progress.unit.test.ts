import { describe, expect, it } from 'vitest';

import { evaluateSupervisionTimers } from '../../../../src/core/supervision/timers/index.js';

import {
  agentSessionLinked,
  approvalRequested,
  fold,
  inertEvent,
  makeLifecycle,
  progressObserved,
  sessionLinked,
  workerSpawned,
} from './shared.js';

describe('core-04-s3 idle and no-progress timer evaluation', () => {
  it('refreshes idle on approval request but leaves no-progress anchored to progress events', () => {
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
      sampledAt: '2026-06-25T10:20:07.000Z',
      timerEvidence: liveness.timerEvidence,
    });

    expect(result.timers.idle.deadline).toBe('2026-06-25T10:15:06.000Z');
    expect(result.timers['no-progress'].deadline).toBe('2026-06-25T10:45:05.000Z');
    expect(result.expired.map((expired) => expired.timer)).toEqual(['idle']);
  });

  it('does not refresh idle or no-progress from parent polls or wait timeouts', () => {
    const liveness = fold([
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      workerSpawned(2),
      sessionLinked(3),
      agentSessionLinked(4),
      progressObserved(5),
      inertEvent(6, 'WaitTimedOut'),
      inertEvent(7, 'ProjectionRead'),
    ]);

    const result = evaluateSupervisionTimers({
      projection: liveness.projection,
      sampledAt: '2026-06-25T10:50:06.000Z',
      timerEvidence: liveness.timerEvidence,
    });

    expect(result.timers.idle.deadline).toBe('2026-06-25T10:15:05.000Z');
    expect(result.timers['no-progress'].deadline).toBe('2026-06-25T10:45:05.000Z');
    expect(result.expired.map((expired) => expired.timer)).toEqual(['idle', 'no-progress']);
    expect(result.expired.map((expired) => expired.sourceEventIds)).toEqual([
      ['evt-AgentProgressObserved-5'],
      ['evt-AgentProgressObserved-5'],
    ]);
  });
});
