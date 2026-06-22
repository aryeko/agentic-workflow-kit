import { describe, expect, it } from 'vitest';

import { isWorkSourceError, workSourceCapabilities } from 'sdk';
import type {
  AuditCitation,
  Claim,
  ClaimResult,
  SpecRef,
  StatusBucket,
  StatusBuckets,
  StatusWriteResult,
  TaskKey,
  TaskSnapshot,
  TaskStatus,
  TaskView,
  TrackView,
  WorkSourceCapability,
  WorkSourceError,
  WorkSourceProbeScope,
  WorkSourceProvider,
} from 'sdk';

describe('prov-03-s1 work source public imports', () => {
  it('imports the entire work source surface from the sdk entrypoint', () => {
    const taskKey: TaskKey = {
      workSourceId: 'work-source',
      trackId: 'track-a',
      taskId: 'task-1',
    };
    const statusBucket: StatusBucket = 'eligible';
    const statusBuckets: StatusBuckets = {
      eligible: ['task-1'],
      inProgress: [],
      complete: [],
      blocked: [],
    };
    const capability: WorkSourceCapability = 'supportsClaim';
    const specRef: SpecRef = { kind: 'url', ref: 'https://example.test/spec' };
    const taskStatus: TaskStatus = { native: 'todo', bucket: statusBucket };
    const claim: Claim = {
      runId: 'run-1',
      holder: 'runner',
      claimedAt: '2026-06-22T12:00:00.000Z',
      expiresAt: '2026-06-22T12:05:00.000Z',
      epoch: 1,
    };
    const taskView: TaskView = {
      key: taskKey,
      title: 'Task',
      status: taskStatus,
      target: { project: 'sdk' },
      spec: { refs: [specRef] },
      dependencies: [],
      claim,
      sourceRecordDigest: 'sha256:task',
    };
    const trackView: TrackView = {
      trackId: 'track-a',
      workSourceId: 'work-source',
      statusBuckets,
      taskKeys: [taskKey],
      sourceRecordDigest: 'sha256:track',
    };
    const taskSnapshot: TaskSnapshot = {
      task: taskView,
      sourcePath: 'docs/spec.md',
      sourceRevision: 'rev-1',
      sourceBytesDigest: 'sha256:bytes',
      rawExcerptDigest: 'sha256:excerpt',
      createdAt: '2026-06-22T12:10:00.000Z',
    };
    const claimResult: ClaimResult = {
      task: taskView,
      snapshotRef: {
        id: 'artifact-1',
        digest: 'sha256:snapshot',
        size: 12,
        mediaType: 'application/json',
        retentionClass: 'evidence',
        classification: 'internal',
        redactionState: 'raw',
      },
      snapshotDigest: 'sha256:snapshot',
    };
    const auditCitation: AuditCitation = {
      runId: 'run-1',
      taskSnapshotRef: 'artifact://snapshot',
    };
    const statusWriteResult: StatusWriteResult = {
      written: true,
      updatedRecordDigest: 'sha256:updated',
      at: '2026-06-22T12:15:00.000Z',
      auditCitation,
    };
    const error: WorkSourceError = {
      kind: 'status-write-unavailable',
      task: taskKey,
      diagnostic: 'offline',
    };
    const scope: WorkSourceProbeScope = {
      driverId: 'provider-markdown',
      driverVersion: '1.0.0',
      platform: 'darwin-arm64',
      sourceKind: 'mock',
      freshnessKey: 'provider-markdown@1.0.0',
      capabilities: [capability],
      at: '2026-06-22T12:00:00.000Z',
    };
    const provider: WorkSourceProvider = {
      probeCapabilities: () => [],
      listTracks: () => [trackView],
      listTasks: () => [taskView],
      nextEligible: () => taskView,
      claim: () => claimResult,
      release: () => undefined,
      writeStatus: () => statusWriteResult,
    };

    expect(workSourceCapabilities).toEqual([
      'supportsTracks',
      'supportsClaim',
      'supportsStatusWrite',
      'supportsDependencies',
    ]);
    expect(isWorkSourceError(error)).toBe(true);
    expect(scope.sourceKind).toBe('mock');
    expect(provider.listTasks('track-a')).toEqual([taskView]);
    expect(taskSnapshot.sourceRevision).toBe('rev-1');
  });
});
