import { describe, expect, it } from 'vitest';

import type { LivenessProjection } from '../../../../src/index.js';

describe('core-04-s1 liveness projection', () => {
  it('constructs active, stale, and terminated projection fixtures', () => {
    const active: LivenessProjection = {
      runId: 'run-01',
      state: 'active',
      currentSessionId: 'session-01',
      workerHandleId: 'worker-01',
      lastWorkerEventSequence: 18,
      lastProgressSequence: 17,
      timers: {
        startup: { deadline: '2026-06-24T10:02:00.000Z', exceeded: false },
        idle: { deadline: '2026-06-24T10:15:00.000Z', exceeded: false },
        'no-progress': { deadline: '2026-06-24T10:45:00.000Z', exceeded: false },
        'per-tool': { deadline: '2026-06-24T10:30:00.000Z', exceeded: false },
        'approval-SLA': { deadline: '2026-06-25T10:00:00.000Z', exceeded: false },
        'max-runtime': { deadline: '2026-06-24T18:00:00.000Z', exceeded: false },
      },
      terminal: false,
    };
    const stale: LivenessProjection = {
      runId: 'run-01',
      state: 'stale',
      reason: 'idle-timeout',
      currentSessionId: 'session-01',
      workerHandleId: 'worker-01',
      lastWorkerEventSequence: 18,
      lastProgressSequence: 17,
      staleSince: '2026-06-24T10:16:00.000Z',
      timers: {
        startup: { deadline: '2026-06-24T10:02:00.000Z', exceeded: false },
        idle: { deadline: '2026-06-24T10:15:00.000Z', exceeded: true },
        'no-progress': { deadline: '2026-06-24T10:45:00.000Z', exceeded: false },
        'per-tool': { deadline: '2026-06-24T10:30:00.000Z', exceeded: false },
        'approval-SLA': { deadline: '2026-06-25T10:00:00.000Z', exceeded: false },
        'max-runtime': { deadline: '2026-06-24T18:00:00.000Z', exceeded: false },
      },
      terminal: false,
    };
    const terminated: LivenessProjection = {
      runId: 'run-01',
      state: 'terminated',
      reason: 'worker-terminal-observed',
      currentSessionId: 'session-01',
      workerHandleId: 'worker-01',
      lastWorkerEventSequence: 19,
      lastProgressSequence: 17,
      timers: {
        startup: { deadline: '2026-06-24T10:02:00.000Z', exceeded: false },
        idle: { deadline: '2026-06-24T10:15:00.000Z', exceeded: false },
        'no-progress': { deadline: '2026-06-24T10:45:00.000Z', exceeded: false },
        'per-tool': { deadline: '2026-06-24T10:30:00.000Z', exceeded: false },
        'approval-SLA': { deadline: '2026-06-25T10:00:00.000Z', exceeded: false },
        'max-runtime': { deadline: '2026-06-24T18:00:00.000Z', exceeded: false },
      },
      terminal: true,
    };

    expect(active.state).toBe('active');
    expect(active.timers.idle.exceeded).toBe(false);
    expect(stale.reason).toBe('idle-timeout');
    expect(stale.staleSince).toBe('2026-06-24T10:16:00.000Z');
    expect(terminated.state).toBe('terminated');
    expect(terminated.terminal).toBe(true);
  });
});
