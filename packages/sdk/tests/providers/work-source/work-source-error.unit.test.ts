import { describe, expect, it } from 'vitest';

import { isWorkSourceError } from '../../../src/index.js';
import type { Claim, TaskKey, WorkSourceError } from '../../../src/index.js';

const task: TaskKey = {
  workSourceId: 'work-source',
  trackId: 'track-a',
  taskId: 'task-1',
};

const priorClaim: Claim = {
  runId: 'run-0',
  holder: 'runner',
  claimedAt: '2026-06-22T11:00:00.000Z',
  expiresAt: '2026-06-22T11:05:00.000Z',
  epoch: 1,
};

describe('prov-03-s1 work source errors', () => {
  it('recognizes every supported work source error kind', () => {
    const fixtures: readonly WorkSourceError[] = [
      { kind: 'work-source-unavailable', message: 'offline', sourceRef: 'docs/tasks.md' },
      { kind: 'track-malformed', trackId: 'track-a', diagnostic: 'missing header' },
      { kind: 'dependency-unresolved', task, dependency: task, reason: 'blocked' },
      { kind: 'status-bucket-unknown', task, nativeStatus: 'custom' },
      {
        kind: 'claim-conflict',
        task,
        expectedRecordDigest: 'sha256:expected',
        observedRecordDigest: 'sha256:observed',
        expectedEpoch: 1,
        observedEpoch: 2,
      },
      { kind: 'claim-lock-unavailable', task, leaseKey: 'lease-1', priorClaim },
      { kind: 'snapshot-artifact-unavailable', task, diagnostic: 'artifact store offline' },
      { kind: 'status-write-unavailable', task, diagnostic: 'write denied' },
      {
        kind: 'status-authority-conflict',
        task,
        expectedRecordDigest: 'sha256:expected',
        observedRecordDigest: 'sha256:observed',
      },
    ];

    expect(fixtures.every((fixture) => isWorkSourceError(fixture))).toBe(true);
    expect(isWorkSourceError({ kind: 'claim-stale' })).toBe(false);
    expect(isWorkSourceError({ message: 'not enough fields' })).toBe(false);
  });
});
