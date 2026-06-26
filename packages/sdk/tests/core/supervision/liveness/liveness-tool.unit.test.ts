import { describe, expect, it } from 'vitest';

import {
  agentSessionLinked,
  fold,
  makeLifecycle,
  progressObserved,
  sessionLinked,
  toolObserved,
  workerSpawned,
} from './shared.js';

describe('core-04-s2 tool completion liveness fold', () => {
  it('refreshes liveness only for a stable current-session tool item id with exitCode and outputRef', () => {
    const result = fold([
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      workerSpawned(2),
      sessionLinked(3),
      agentSessionLinked(4),
      progressObserved(5, 'session-01', 'tool-01'),
      toolObserved(6, 'session-01', 'tool-01'),
    ]);

    expect(result.projection.state).toBe('active');
    expect(result.projection.lastWorkerEventSequence).toBe(6);
    expect(result.projection.lastProgressSequence).toBe(6);
    expect(result.timerEvidence['per-tool']?.stoppedAt).toBe('2026-06-25T10:00:06.000Z');
    expect(result.advances.at(-1)?.advanceClass).toBe('tool-completion');
  });

  it('fails closed to tool-tracking-unavailable when the tool item id is missing or unstable', () => {
    const missing = fold([
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      workerSpawned(2),
      sessionLinked(3),
      agentSessionLinked(4),
      progressObserved(5),
      toolObserved(6, 'session-01'),
    ]);
    const unstable = fold([
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      workerSpawned(2),
      sessionLinked(3),
      agentSessionLinked(4),
      progressObserved(5),
      toolObserved(6, 'session-01', 'tool-99'),
    ]);

    expect(missing.projection.reason).toBe('tool-tracking-unavailable');
    expect(unstable.projection.reason).toBe('tool-tracking-unavailable');
    expect(missing.projection.lastWorkerEventSequence).toBe(5);
    expect(unstable.projection.lastWorkerEventSequence).toBe(5);
    expect(missing.advances.map((advance) => advance.advanceClass)).toEqual(['startup-linkage', 'worker-progress']);
  });
});
