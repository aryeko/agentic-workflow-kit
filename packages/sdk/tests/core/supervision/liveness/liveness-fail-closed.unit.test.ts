import { describe, expect, it } from 'vitest';

import {
  agentSessionLinked,
  fold,
  makeLifecycle,
  observationDegraded,
  sessionLinked,
  workerSpawned,
} from './shared.js';

describe('core-04-s2 fail-closed liveness fold', () => {
  it('returns supervision-lost with session-linkage-ambiguous for ambiguous current linkage', () => {
    const result = fold([
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      workerSpawned(2),
      sessionLinked(3, 'session-01'),
      sessionLinked(4, 'session-02'),
      agentSessionLinked(5, 'session-02'),
    ]);

    expect(result.projection.state).toBe('supervision-lost');
    expect(result.projection.reason).toBe('session-linkage-ambiguous');
  });

  it('returns supervision-lost with agent-progress-unobservable when observation is degraded', () => {
    const result = fold([
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      workerSpawned(2),
      sessionLinked(3),
      agentSessionLinked(4),
      observationDegraded(5),
    ]);

    expect(result.projection.state).toBe('supervision-lost');
    expect(result.projection.reason).toBe('agent-progress-unobservable');
  });
});
