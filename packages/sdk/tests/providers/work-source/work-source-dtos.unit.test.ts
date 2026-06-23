import { describe, expect, it } from 'vitest';

import type {
  AuditCitation,
  Claim,
  ClaimResult,
  SpecRef,
  StatusWriteResult,
  TaskKey,
  TaskSnapshot,
  TaskStatus,
  TaskView,
  TrackView,
} from '../../../src/index.js';

const taskKey: TaskKey = {
  workSourceId: 'work-source',
  trackId: 'track-a',
  taskId: 'task-1',
};

const specRef: SpecRef = {
  kind: 'path',
  ref: 'docs/spec.md',
  label: 'Task spec',
  declaredDigest: 'sha256:spec',
};

const taskStatus: TaskStatus = {
  native: 'todo',
  bucket: 'eligible',
};

const claim: Claim = {
  runId: 'run-1',
  holder: 'runner',
  claimedAt: '2026-06-22T12:00:00.000Z',
  expiresAt: '2026-06-22T12:05:00.000Z',
  epoch: 2,
};

const taskView: TaskView = {
  key: taskKey,
  title: 'Implement work source port',
  status: taskStatus,
  target: { project: 'sdk' },
  spec: {
    inline: 'Implement the provider port.',
    refs: [specRef],
  },
  dependencies: [taskKey],
  claim,
  sourceRecordDigest: 'sha256:task-record',
};

const trackView: TrackView = {
  trackId: 'track-a',
  workSourceId: 'work-source',
  statusBuckets: {
    eligible: ['task-1'],
    inProgress: [],
    complete: [],
    blocked: [],
  },
  taskKeys: [taskKey],
  sourceRecordDigest: 'sha256:track-record',
};

const taskSnapshot: TaskSnapshot = {
  task: taskView,
  sourcePath: 'docs/tasks/track-a.md',
  sourceRevision: 'rev-1',
  sourceBytesDigest: 'sha256:bytes',
  inlineSpecDigest: 'sha256:inline',
  rawExcerptDigest: 'sha256:excerpt',
  createdAt: '2026-06-22T12:10:00.000Z',
};

const claimResult: ClaimResult = {
  task: taskView,
  snapshotRef: {
    id: 'artifact-1',
    digest: 'sha256:snapshot',
    size: 42,
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
  statusEvidenceRef: 'artifact://status',
};

const statusWriteResult: StatusWriteResult = {
  written: true,
  updatedRecordDigest: 'sha256:updated',
  evidenceRef: claimResult.snapshotRef,
  auditCitation,
  at: '2026-06-22T12:15:00.000Z',
};

describe('prov-03-s1 work source DTOs', () => {
  it('constructs fixtures for every work source DTO', () => {
    expect(taskView.claim).toEqual(claim);
    expect(trackView.statusBuckets.eligible).toEqual(['task-1']);
    expect(taskSnapshot.task.title).toBe('Implement work source port');
    expect(claimResult.snapshotDigest).toBe('sha256:snapshot');
    expect(statusWriteResult.auditCitation).toEqual(auditCitation);
  });
});
