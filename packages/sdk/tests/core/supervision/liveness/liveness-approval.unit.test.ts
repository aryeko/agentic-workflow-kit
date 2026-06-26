import { describe, expect, it } from 'vitest';

import {
  agentSessionLinked,
  approvalRequested,
  fold,
  makeLifecycle,
  progressObserved,
  sessionLinked,
  workerSpawned,
} from './shared.js';

describe('core-04-s2 approval request liveness fold', () => {
  it('enters waiting-for-approval, arms approval-SLA, and does not increment lastProgressSequence', () => {
    const result = fold([
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      workerSpawned(2),
      sessionLinked(3),
      agentSessionLinked(4),
      progressObserved(5),
      approvalRequested(6),
    ]);

    expect(result.projection.state).toBe('waiting-for-approval');
    expect(result.projection.lastWorkerEventSequence).toBe(6);
    expect(result.projection.lastProgressSequence).toBe(5);
    expect(result.timerEvidence['approval-SLA']?.basisAt).toBe('2026-06-25T10:00:06.000Z');
    expect(result.advances.at(-1)?.advanceClass).toBe('approval-request');
  });
});
