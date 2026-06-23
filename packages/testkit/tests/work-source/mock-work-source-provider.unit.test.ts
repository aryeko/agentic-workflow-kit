import { describe, expect, it } from 'vitest';

import { capabilityAttestationSchema, isWorkSourceError, type TaskKey, type WorkSourceError } from 'sdk';

import { createMockWorkSourceProvider } from '../../src/work-source/index.js';
import { createMockWorkSourceProvider as createFromPublicSurface } from '../../src/index.js';

const startedAt = '2026-06-22T12:00:00.000Z';

const defaultStatusBuckets = {
  eligible: ['todo'],
  inProgress: ['doing'],
  complete: ['done'],
  blocked: ['blocked'],
};

const taskKey = (taskId: string, trackId = 'track-a'): TaskKey => ({
  workSourceId: 'mock-source',
  trackId,
  taskId,
});

const createProvider = () =>
  createMockWorkSourceProvider({
    workSourceId: 'mock-source',
    now: startedAt,
    tracks: [
      {
        trackId: 'track-a',
        statusBuckets: defaultStatusBuckets,
        tasks: [
          {
            taskId: 'task-1',
            title: 'Ready task',
            status: 'todo',
            targetProject: 'sdk',
            spec: {
              inline: 'Implement the SDK-facing behavior.',
              refs: [{ kind: 'path', ref: 'docs/design/task-1.md', label: 'Design' }],
            },
          },
          {
            taskId: 'task-2',
            title: 'Dependent task',
            status: 'todo',
            targetProject: 'sdk',
            dependencies: [taskKey('task-3')],
          },
          {
            taskId: 'task-3',
            title: 'Finished dependency',
            status: 'done',
            targetProject: 'sdk',
          },
          {
            taskId: 'task-4',
            title: 'Other project task',
            status: 'todo',
            targetProject: 'cli',
          },
        ],
      },
    ],
  });

const expectError = <Kind extends WorkSourceError['kind']>(
  result: unknown,
  kind: Kind,
): Extract<WorkSourceError, { readonly kind: Kind }> => {
  expect(isWorkSourceError(result)).toBe(true);
  expect((result as WorkSourceError).kind).toBe(kind);
  return result as Extract<WorkSourceError, { readonly kind: Kind }>;
};

describe('work source mock testkit provider', () => {
  it('emits SDK capability attestations for requested work source capabilities', () => {
    const provider = createProvider();

    const attestations = provider.probeCapabilities({
      driverId: 'testkit-work-source-mock',
      driverVersion: '1.2.3',
      platform: 'test',
      sourceKind: 'mock',
      freshnessKey: 'fresh',
      capabilities: ['supportsTracks', 'supportsClaim', 'supportsStatusWrite', 'supportsDependencies'],
      trackIds: ['track-a'],
      at: startedAt,
    });

    expect(attestations.map((attestation) => [attestation.capability, attestation.result])).toEqual([
      ['supportsTracks', 'positive'],
      ['supportsClaim', 'positive'],
      ['supportsStatusWrite', 'positive'],
      ['supportsDependencies', 'positive'],
    ]);
    for (const attestation of attestations) {
      expect(capabilityAttestationSchema.safeParse(attestation).success).toBe(true);
      expect(attestation.scope).toBe('workSource:mock-source');
      expect(attestation.evidenceRef).toBe(`memory://work-source/mock-source/probe/${attestation.capability}`);
    }
  });

  it('lists tracks, reads tasks, and discovers eligible work deterministically', () => {
    const provider = createProvider();

    expect(provider.listTracks()).toMatchObject([
      {
        trackId: 'track-a',
        workSourceId: 'mock-source',
        taskKeys: [taskKey('task-1'), taskKey('task-2'), taskKey('task-3'), taskKey('task-4')],
      },
    ]);
    expect(provider.listTasks('track-a')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: taskKey('task-1'),
          title: 'Ready task',
          status: { native: 'todo', bucket: 'eligible' },
          target: { project: 'sdk' },
        }),
        expect.objectContaining({
          key: taskKey('task-2'),
          dependencies: [taskKey('task-3')],
        }),
      ]),
    );
    expect(provider.nextEligible({ trackIds: ['track-a'], targetProject: 'sdk' })).toMatchObject({
      key: taskKey('task-1'),
      title: 'Ready task',
    });
    expect(provider.nextEligible({ trackIds: ['track-a'], targetProject: 'missing-project' })).toBeNull();
  });

  it('handles claim and release races with digest and epoch preconditions', () => {
    const provider = createProvider();
    const task = provider.nextEligible({ trackIds: ['track-a'], targetProject: 'sdk' });

    expect(isWorkSourceError(task)).toBe(false);
    expect(task).not.toBeNull();
    const selected = task!;

    const claim = provider.claim({
      task: selected.key,
      runId: 'run-1',
      holder: 'runner',
      ttlMs: 60_000,
      expectedRecordDigest: selected.sourceRecordDigest,
      sourceRevision: 'rev-1',
    });

    expect(isWorkSourceError(claim)).toBe(false);
    expect(claim).toMatchObject({
      task: {
        key: taskKey('task-1'),
        claim: {
          runId: 'run-1',
          holder: 'runner',
          claimedAt: startedAt,
          expiresAt: '2026-06-22T12:01:00.000Z',
          epoch: 1,
        },
      },
      snapshotRef: {
        id: 'memory://work-source/mock-source/snapshots/track-a/task-1/1',
        mediaType: 'application/json',
        retentionClass: 'evidence',
      },
    });

    const staleClaim = provider.claim({
      task: selected.key,
      runId: 'run-2',
      holder: 'other-runner',
      ttlMs: 60_000,
      expectedRecordDigest: selected.sourceRecordDigest,
      sourceRevision: 'rev-2',
    });
    expectError(staleClaim, 'claim-conflict');

    const wrongEpochRelease = provider.release({
      task: selected.key,
      runId: 'run-1',
      reason: 'done',
      expectedEpoch: 99,
    });
    expectError(wrongEpochRelease, 'claim-conflict');

    expect(
      provider.release({
        task: selected.key,
        runId: 'run-1',
        reason: 'done',
        expectedEpoch: claim.task.claim?.epoch ?? 0,
      }),
    ).toBeUndefined();
    const releasedTask = (
      provider.listTasks('track-a') as ReturnType<typeof provider.listTasks> & readonly [{ key: TaskKey }]
    ).find((candidate) => candidate.key.taskId === 'task-1');
    expect(releasedTask).toMatchObject({ key: taskKey('task-1') });
    expect(releasedTask).not.toHaveProperty('claim');
  });

  it('writes task status only with current authority digest and preserves audit metadata', () => {
    const provider = createProvider();
    const [task] = provider.listTasks('track-a') as ReturnType<typeof provider.listTasks> &
      readonly [{ sourceRecordDigest: string }];

    const staleWrite = provider.writeStatus({
      task: task.key,
      status: { native: 'done', bucket: 'complete' },
      expectedRecordDigest: 'sha256:stale',
    });
    expectError(staleWrite, 'status-authority-conflict');

    const evidenceRef = {
      id: 'artifact-status',
      digest: 'sha256:status',
      size: 12,
      mediaType: 'application/json',
      retentionClass: 'evidence',
      classification: 'internal',
      redactionState: 'raw' as const,
    };
    const result = provider.writeStatus({
      task: task.key,
      status: { native: 'done', bucket: 'complete' },
      expectedRecordDigest: task.sourceRecordDigest,
      evidenceRef,
      note: 'verified',
      auditCitation: { runId: 'run-1', taskSnapshotRef: 'snapshot-1', statusEvidenceRef: evidenceRef.id },
    });

    expect(isWorkSourceError(result)).toBe(false);
    expect(result).toMatchObject({
      written: true,
      evidenceRef,
      auditCitation: { runId: 'run-1', taskSnapshotRef: 'snapshot-1', statusEvidenceRef: evidenceRef.id },
      at: startedAt,
    });
    const updatedTask = (
      provider.listTasks('track-a') as ReturnType<typeof provider.listTasks> & readonly [{ key: TaskKey }]
    ).find((candidate) => candidate.key.taskId === task.key.taskId);
    expect(updatedTask).toMatchObject({ key: task.key, status: { native: 'done', bucket: 'complete' } });
  });

  it('returns degraded and error tokens without external side effects', () => {
    const malformed = createMockWorkSourceProvider({
      workSourceId: 'mock-source',
      now: startedAt,
      tracks: [
        { trackId: 'bad-track', statusBuckets: defaultStatusBuckets, malformedDiagnostic: 'bad yaml', tasks: [] },
      ],
    });
    expectError(malformed.listTracks(), 'track-malformed');
    expect(
      malformed.probeCapabilities({
        driverId: 'testkit-work-source-mock',
        driverVersion: '1.0.0',
        platform: 'test',
        sourceKind: 'mock',
        freshnessKey: 'fresh',
        capabilities: ['supportsTracks', 'supportsClaim', 'supportsStatusWrite', 'supportsDependencies'],
        at: startedAt,
      }),
    ).toEqual([
      expect.objectContaining({ capability: 'supportsTracks', result: 'negative' }),
      expect.objectContaining({ capability: 'supportsClaim', result: 'negative' }),
      expect.objectContaining({ capability: 'supportsStatusWrite', result: 'negative' }),
      expect.objectContaining({ capability: 'supportsDependencies', result: 'negative' }),
    ]);

    const unavailable = createMockWorkSourceProvider({
      workSourceId: 'mock-source',
      now: startedAt,
      unavailable: { kind: 'work-source-unavailable', message: 'fixture disabled', sourceRef: 'memory://mock-source' },
      tracks: [],
    });
    expectError(unavailable.listTracks(), 'work-source-unavailable');

    const dependencyBlocked = createMockWorkSourceProvider({
      workSourceId: 'mock-source',
      now: startedAt,
      tracks: [
        {
          trackId: 'track-a',
          statusBuckets: defaultStatusBuckets,
          tasks: [
            {
              taskId: 'blocked-by-missing',
              title: 'Blocked',
              status: 'todo',
              targetProject: 'sdk',
              dependencies: [taskKey('missing')],
            },
          ],
        },
      ],
    });
    expectError(dependencyBlocked.nextEligible({ trackIds: ['track-a'] }), 'dependency-unresolved');
    const [dependencyBlockedTask] = dependencyBlocked.listTasks('track-a') as ReturnType<
      typeof dependencyBlocked.listTasks
    > &
      readonly [{ sourceRecordDigest: string }];
    expectError(
      dependencyBlocked.claim({
        task: dependencyBlockedTask.key,
        runId: 'run-1',
        holder: 'runner',
        ttlMs: 60_000,
        expectedRecordDigest: dependencyBlockedTask.sourceRecordDigest,
        sourceRevision: 'rev-1',
      }),
      'dependency-unresolved',
    );

    const unknownStatus = createMockWorkSourceProvider({
      workSourceId: 'mock-source',
      now: startedAt,
      tracks: [
        {
          trackId: 'track-a',
          statusBuckets: defaultStatusBuckets,
          tasks: [{ taskId: 'unknown-status', title: 'Unknown', status: 'triaged', targetProject: 'sdk' }],
        },
      ],
    });
    expectError(unknownStatus.nextEligible({ trackIds: ['track-a'] }), 'status-bucket-unknown');
    const [unknownStatusTask] = unknownStatus.listTasks('track-a') as ReturnType<typeof unknownStatus.listTasks> &
      readonly [{ sourceRecordDigest: string }];
    expectError(
      unknownStatus.claim({
        task: unknownStatusTask.key,
        runId: 'run-1',
        holder: 'runner',
        ttlMs: 60_000,
        expectedRecordDigest: unknownStatusTask.sourceRecordDigest,
        sourceRevision: 'rev-1',
      }),
      'status-bucket-unknown',
    );

    const completedTaskProvider = createMockWorkSourceProvider({
      workSourceId: 'mock-source',
      now: startedAt,
      tracks: [
        {
          trackId: 'track-a',
          statusBuckets: defaultStatusBuckets,
          tasks: [{ taskId: 'completed', title: 'Complete', status: 'done', targetProject: 'sdk' }],
        },
      ],
    });
    const [completedTask] = completedTaskProvider.listTasks('track-a') as ReturnType<
      typeof completedTaskProvider.listTasks
    > &
      readonly [{ sourceRecordDigest: string }];
    expectError(
      completedTaskProvider.claim({
        task: completedTask.key,
        runId: 'run-1',
        holder: 'runner',
        ttlMs: 60_000,
        expectedRecordDigest: completedTask.sourceRecordDigest,
        sourceRevision: 'rev-1',
      }),
      'claim-lock-unavailable',
    );

    const injected = createMockWorkSourceProvider({
      workSourceId: 'mock-source',
      now: startedAt,
      failures: {
        snapshotArtifactUnavailableTaskIds: ['task-1'],
        statusWriteUnavailableTaskIds: ['task-2'],
      },
      tracks: [
        {
          trackId: 'track-a',
          statusBuckets: defaultStatusBuckets,
          tasks: [
            { taskId: 'task-1', title: 'Snapshot unavailable', status: 'todo', targetProject: 'sdk' },
            { taskId: 'task-2', title: 'Status unavailable', status: 'todo', targetProject: 'sdk' },
          ],
        },
      ],
    });
    const [snapshotTask, statusTask] = injected.listTasks('track-a') as ReturnType<typeof injected.listTasks> &
      readonly [{ sourceRecordDigest: string }, { sourceRecordDigest: string }];
    expectError(
      injected.claim({
        task: snapshotTask.key,
        runId: 'run-1',
        holder: 'runner',
        ttlMs: 60_000,
        expectedRecordDigest: snapshotTask.sourceRecordDigest,
        sourceRevision: 'rev-1',
      }),
      'snapshot-artifact-unavailable',
    );
    expectError(
      injected.writeStatus({
        task: statusTask.key,
        status: { native: 'done', bucket: 'complete' },
        expectedRecordDigest: statusTask.sourceRecordDigest,
      }),
      'status-write-unavailable',
    );
  });

  it('returns immutable copies instead of exposing provider state', () => {
    const provider = createProvider();
    const [task] = provider.listTasks('track-a') as ReturnType<typeof provider.listTasks> &
      readonly [{ title: string }];

    (task as { title: string }).title = 'mutated outside provider';
    (task.spec.refs as { ref: string }[]).push({ ref: 'mutated' });

    const [freshTask] = provider.listTasks('track-a') as ReturnType<typeof provider.listTasks> &
      readonly [{ title: string }];
    expect(freshTask.title).toBe('Ready task');
    expect(freshTask.spec.refs).toEqual([{ kind: 'path', ref: 'docs/design/task-1.md', label: 'Design' }]);
  });

  it('exports the mock provider from the public testkit source surface', () => {
    expect(createFromPublicSurface).toBe(createMockWorkSourceProvider);
  });
});
