import { classifyRecovery } from '../../../../src/core/recovery/classifier/index.js';
import { describe, expect, it } from 'vitest';

import { createLeaseSnapshot, createSnapshot, evidenceEventRefFixture, observedAt } from './shared.js';

describe('core-06-s2 recovery-fail-closed-state-matrix', () => {
  it.each([
    [
      'log-unwritable',
      createSnapshot({
        state: { lifecycle: 'running', currentSequence: 4, writerEpoch: 1, degradedHealth: 'event-log-unavailable' },
      }),
    ],
    [
      'log-corrupt',
      createSnapshot({
        state: { lifecycle: 'running', currentSequence: 4, writerEpoch: 1, degradedHealth: 'interior-corrupt' },
      }),
    ],
    ['lease-unavailable', createSnapshot({ leases: { leaseHealth: 'network-fs-degraded' } })],
    ['owner-ambiguous', createSnapshot({ launch: { linkage: 'ambiguous', linkHistory: [] } })],
    [
      'termination-ambiguous',
      createSnapshot({ termination: { state: 'ambiguous', evidenceRefs: [evidenceEventRefFixture] } }),
    ],
    [
      'supervision-stale-ambiguous',
      createSnapshot({
        liveness: { runId: 'run-recovery-01', state: 'supervision-lost', timers: {}, terminal: false },
      }),
    ],
    [
      'supervision-stale-ambiguous',
      createSnapshot({
        liveness: { runId: 'run-recovery-01', state: 'stale', timers: {}, terminal: false },
      }),
    ],
    ['merge-outcome-ambiguous', createSnapshot({ completion: { postMergeOutcome: 'post-merge-outcome-ambiguous' } })],
    ['provider-evidence-gap', createSnapshot({ providerGaps: ['agent:resume-evidence-missing'] })],
    ['manual-edits-forbidden', createSnapshot({ manualEditRefs: [evidenceEventRefFixture] })],
    [
      'terminal-no-recovery',
      createSnapshot({
        observedAt,
        state: { lifecycle: 'failed', currentSequence: 4, writerEpoch: 1, degradedHealth: 'ok' },
        completion: { postMergeOutcome: 'post-merge-outcome-ambiguous' },
        leases: { leaseHealth: 'ok', storyLaunch: createLeaseSnapshot({ expiresAt: '2026-06-27T11:00:00.000Z' }) },
      }),
    ],
  ])('classifies %s exactly', (expectedState, snapshot) => {
    expect(classifyRecovery(snapshot).state).toBe(expectedState);
  });
});
