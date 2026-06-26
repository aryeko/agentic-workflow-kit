import { describe, expect, it } from 'vitest';

import {
  agentSessionLinked,
  approvalAnswered,
  fold,
  inertEvent,
  makeLifecycle,
  progressObserved,
  sessionLinked,
  workerSpawned,
} from './shared.js';

describe('core-04-s2 non-refreshing event list', () => {
  it.each([
    ['WaitTimedOut', inertEvent(6, 'WaitTimedOut')],
    ['ProjectionRead', inertEvent(6, 'ProjectionRead')],
    ['HostWorkspaceAttached', inertEvent(6, 'HostWorkspaceAttached')],
    ['HostCapabilityAttested', inertEvent(6, 'HostCapabilityAttested')],
    ['AgentCapabilityAttested', inertEvent(6, 'AgentCapabilityAttested')],
    ['AgentApprovalAnswered', approvalAnswered(6)],
    ['RunnerCommandStarted', inertEvent(6, 'RunnerCommandStarted')],
    ['ForgeEvidenceCollected', inertEvent(6, 'ForgeEvidenceCollected')],
    ['WorkSourceStatusWritten', inertEvent(6, 'WorkSourceStatusWritten')],
    ['RunLifecycleTransitioned', makeLifecycle(6, 'running', 'worker-starting')],
  ])('keeps worker/progress sequences inert for %s', (_label, inert) => {
    const result = fold([
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      workerSpawned(2),
      sessionLinked(3),
      agentSessionLinked(4),
      progressObserved(5),
      inert,
    ]);

    expect(result.projection.state).toBe('active');
    expect(result.projection.lastWorkerEventSequence).toBe(5);
    expect(result.projection.lastProgressSequence).toBe(5);
    expect(result.advances.map((advance) => advance.advanceClass)).toEqual(['startup-linkage', 'worker-progress']);
  });
});
