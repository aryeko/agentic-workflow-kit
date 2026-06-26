import { describe, expect, it } from 'vitest';

import type { LivenessProjection } from '../../../../src/index.js';
import { evaluateSupervisionTimers } from '../../../../src/core/supervision/timers/index.js';

import {
  agentSessionLinked,
  fold,
  makeLifecycle,
  progressObserved,
  sessionLinked,
  toolObserved,
  workerSpawned,
} from './shared.js';

describe('core-04-s3 per-tool timer evaluation', () => {
  it('starts from a stable current-session tool item id and stops on matching completion', () => {
    const liveness = fold([
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      workerSpawned(2),
      sessionLinked(3),
      agentSessionLinked(4),
      progressObserved(5, 'session-01', 'tool-01'),
      toolObserved(6, 'session-01', 'tool-01'),
    ]);

    const result = evaluateSupervisionTimers({
      projection: liveness.projection,
      sampledAt: '2026-06-25T10:31:00.000Z',
      timerEvidence: liveness.timerEvidence,
    });

    expect(result.timers['per-tool']).toEqual({
      armed: false,
      deadline: '2026-06-25T10:30:05.000Z',
      exceeded: false,
    });
    expect(result.expired.filter((expired) => expired.timer === 'per-tool')).toEqual([]);
  });

  it('emits tool-timeout when a stable tool item misses its deadline', () => {
    const liveness = fold([
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      workerSpawned(2),
      sessionLinked(3),
      agentSessionLinked(4),
      progressObserved(5, 'session-01', 'tool-01'),
    ]);

    const result = evaluateSupervisionTimers({
      projection: liveness.projection,
      sampledAt: '2026-06-25T10:30:06.000Z',
      timerEvidence: liveness.timerEvidence,
    });

    expect(result.expired).toContainEqual({
      schema: 'kit-vnext.liveness-timer-expired.v1',
      runId: 'run-supervision-timers-01',
      timer: 'per-tool',
      reason: 'tool-timeout',
      deadline: '2026-06-25T10:30:05.000Z',
      observedAt: '2026-06-25T10:30:06.000Z',
      sessionId: 'session-01',
      workerHandleId: 'worker-01',
      lastWorkerEventSequence: 5,
      lastProgressSequence: 5,
      sourceEventIds: ['evt-AgentProgressObserved-5'],
    });
  });

  it('does not guess a per-tool timer when tool tracking is unavailable', () => {
    const liveness = fold([
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      workerSpawned(2),
      sessionLinked(3),
      agentSessionLinked(4),
      progressObserved(5),
      toolObserved(6, 'session-01'),
    ]);

    const result = evaluateSupervisionTimers({
      projection: liveness.projection,
      sampledAt: '2026-06-25T10:30:06.000Z',
      timerEvidence: liveness.timerEvidence,
    });

    expect(liveness.projection.reason).toBe('tool-tracking-unavailable');
    expect(result.timers['per-tool'].armed).toBe(false);
    expect(result.expired.filter((expired) => expired.timer === 'per-tool')).toEqual([]);
  });

  it('suppresses a stale per-tool basis when the projection is already tool-tracking-unavailable', () => {
    const projection: LivenessProjection = {
      runId: 'run-supervision-timers-01',
      state: 'supervision-lost',
      reason: 'tool-tracking-unavailable',
      currentSessionId: 'session-01',
      workerHandleId: 'worker-01',
      timers: {
        startup: { deadline: '2026-06-25T10:02:01.000Z', exceeded: false },
        idle: { deadline: '2026-06-25T10:15:05.000Z', exceeded: false },
        'no-progress': { deadline: '2026-06-25T10:45:05.000Z', exceeded: false },
        'per-tool': { deadline: '2026-06-25T10:30:05.000Z', exceeded: false },
        'approval-SLA': { deadline: '2026-06-26T10:00:00.000Z', exceeded: false },
        'max-runtime': { deadline: '2026-06-25T18:00:01.000Z', exceeded: false },
      },
      terminal: false,
    };

    const result = evaluateSupervisionTimers({
      projection,
      sampledAt: '2026-06-25T10:30:06.000Z',
      timerEvidence: {
        'per-tool': {
          basisAt: '2026-06-25T10:00:05.000Z',
          sourceEventIds: ['evt-tool-01'],
          itemId: 'tool-01',
        },
      },
    });

    expect(result.timers['per-tool']).toEqual({
      armed: false,
      deadline: '2026-06-25T10:30:05.000Z',
      exceeded: false,
    });
  });
});
