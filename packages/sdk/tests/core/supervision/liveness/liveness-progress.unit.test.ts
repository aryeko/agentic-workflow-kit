import { describe, expect, it } from 'vitest';

import { agentSessionLinked, fold, makeLifecycle, progressObserved, sessionLinked, workerSpawned } from './shared.js';

describe('core-04-s2 progress liveness fold', () => {
  it('refreshes idle and no-progress timers from current-session AgentProgressObserved', () => {
    const result = fold([
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      workerSpawned(2),
      sessionLinked(3),
      agentSessionLinked(4),
      progressObserved(5, 'session-01'),
    ]);

    expect(result.projection.state).toBe('active');
    expect(result.projection.lastWorkerEventSequence).toBe(5);
    expect(result.projection.lastProgressSequence).toBe(5);
    expect(result.timerEvidence.idle?.basisAt).toBe('2026-06-25T10:00:05.000Z');
    expect(result.timerEvidence['no-progress']?.basisAt).toBe('2026-06-25T10:00:05.000Z');
    expect(result.advances.map((advance) => advance.advanceClass)).toEqual(['startup-linkage', 'worker-progress']);
  });
});
