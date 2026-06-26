import { describe, expect, it } from 'vitest';
import { agentSessionLinked, fold, makeLifecycle, sessionLinked, workerSpawned } from './shared.js';

describe('core-04-s2 startup linkage liveness fold', () => {
  it('advances to active only when AgentSessionLinked pairs with a current non-ambiguous SessionLinked', () => {
    const linked = fold([
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      workerSpawned(2),
      sessionLinked(3, 'session-01'),
      agentSessionLinked(4, 'session-01', 'worker-01'),
    ]);

    expect(linked.projection.state).toBe('active');
    expect(linked.projection.currentSessionId).toBe('session-01');
    expect(linked.projection.workerHandleId).toBe('worker-01');
    expect(linked.advances.map((advance) => advance.advanceClass)).toEqual(['startup-linkage']);
    expect(linked.timerEvidence.startup?.stoppedAt).toBe('2026-06-25T10:00:04.000Z');
  });

  it('does not activate on an unpaired AgentSessionLinked event', () => {
    const unpaired = fold([
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      workerSpawned(2),
      agentSessionLinked(3, 'session-02', 'worker-02'),
    ]);

    expect(unpaired.projection.state).toBe('starting');
    expect(unpaired.projection.currentSessionId).toBeUndefined();
    expect(unpaired.advances).toEqual([]);
  });
});
