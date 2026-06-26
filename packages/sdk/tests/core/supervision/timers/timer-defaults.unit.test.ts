import { describe, expect, it } from 'vitest';

import { evaluateSupervisionTimers } from '../../../../src/core/supervision/timers/index.js';

import {
  agentSessionLinked,
  approvalRequested,
  defaultPolicy,
  fold,
  makeLifecycle,
  progressObserved,
  sessionLinked,
  workerSpawned,
} from './shared.js';

describe('core-04-s3 supervision timer defaults', () => {
  it('computes exact v1 default deadlines from fixed source times', () => {
    const liveness = fold([
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      workerSpawned(2),
      sessionLinked(3),
      agentSessionLinked(4),
      progressObserved(5, 'session-01', 'tool-01'),
      approvalRequested(6),
    ]);

    const result = evaluateSupervisionTimers({
      projection: liveness.projection,
      sampledAt: '2026-06-25T10:00:30.000Z',
      timerEvidence: liveness.timerEvidence,
    });

    expect(result.policy).toEqual(defaultPolicy);
    expect(result.timers.startup).toEqual({
      armed: false,
      deadline: '2026-06-25T10:02:01.000Z',
      exceeded: false,
    });
    expect(result.timers.idle).toEqual({
      armed: true,
      deadline: '2026-06-25T10:15:06.000Z',
      exceeded: false,
    });
    expect(result.timers['no-progress']).toEqual({
      armed: true,
      deadline: '2026-06-25T10:45:05.000Z',
      exceeded: false,
    });
    expect(result.timers['per-tool']).toEqual({
      armed: true,
      deadline: '2026-06-25T10:30:05.000Z',
      exceeded: false,
    });
    expect(result.timers['approval-SLA']).toEqual({
      armed: true,
      deadline: '2026-06-26T10:00:06.000Z',
      exceeded: false,
    });
    expect(result.timers['max-runtime']).toEqual({
      armed: true,
      deadline: '2026-06-25T18:00:01.000Z',
      exceeded: false,
    });
  });
});
