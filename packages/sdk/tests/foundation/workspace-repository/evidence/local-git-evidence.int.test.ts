import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createLeaseStore,
  createLocalGitEvidenceRecorder,
  createWorkspaceRepository,
  type AbsolutePath,
  type GitSha,
  type LocalGitEvidence,
  type LocalGitEvidenceRecordedPayload,
  type LocalRef,
  type RepositoryIdentity,
  type WorkspaceRepository,
} from '../../../../src/index.js';

import {
  cleanupCreatedRoots,
  createArtifactRecorderHarness,
  createFixtureInspector,
  createLocalGitFixture,
  createTempRoot,
} from './local-git-evidence-test-helpers.js';

type ExpectTrue<T extends true> = T;
type KeysExactly<T, Keys extends PropertyKey> = [Exclude<keyof T, Keys>, Exclude<Keys, keyof T>] extends [never, never]
  ? true
  : false;
type LocalGitEvidenceKeysExact = ExpectTrue<
  KeysExactly<
    LocalGitEvidence,
    | 'evidenceId'
    | 'leaseId'
    | 'repoId'
    | 'worktreePath'
    | 'branchName'
    | 'inspectedAt'
    | 'baseSha'
    | 'mergeBaseSha'
    | 'headSha'
    | 'localCommits'
    | 'fromSha'
    | 'toSha'
    | 'changedPaths'
    | 'statRef'
    | 'patchRef'
    | 'clean'
    | 'stagedPaths'
    | 'unstagedPaths'
    | 'untrackedPaths'
  >
>;
type LocalGitEvidenceRecordedPayloadKeysExact = ExpectTrue<
  KeysExactly<
    LocalGitEvidenceRecordedPayload,
    | 'evidenceId'
    | 'leaseId'
    | 'repoId'
    | 'worktreePath'
    | 'branchName'
    | 'inspectedAt'
    | 'baseSha'
    | 'mergeBaseSha'
    | 'headSha'
    | 'localCommits'
    | 'fromSha'
    | 'toSha'
    | 'changedPaths'
    | 'statRef'
    | 'patchRef'
    | 'clean'
    | 'stagedPaths'
    | 'unstagedPaths'
    | 'untrackedPaths'
  >
>;

afterEach(() => {
  cleanupCreatedRoots();
});

const createClock = (initial: string) => {
  let nowMs = Date.parse(initial);

  return {
    now: (): Date => new globalThis.Date(nowMs),
    advanceMs: (deltaMs: number): void => {
      nowMs += deltaMs;
    },
  };
};

const createWorkspaceHarness = (recorder: ReturnType<typeof createLocalGitEvidenceRecorder>) => {
  const clock = createClock('2026-06-22T10:00:00.000Z');
  const root = createTempRoot('workflow-kit-local-git-workspace-');
  const repoRoot = join(root, 'repo');
  const worktreeRoot = join(root, 'worktrees');
  mkdirSync(join(repoRoot, '.git'), { recursive: true });
  mkdirSync(worktreeRoot, { recursive: true });

  const repository: RepositoryIdentity = {
    repoId: 'workflow-kit',
    repoRoot: repoRoot as AbsolutePath,
    gitDir: join(repoRoot, '.git') as AbsolutePath,
    defaultBaseRef: 'refs/heads/v-next' as LocalRef,
  };

  const workspaceRepository = createWorkspaceRepository({
    repository,
    worktreeRoot: worktreeRoot as AbsolutePath,
    setup: {
      command: 'pnpm install',
      workingDirectory: '.',
      freshness: { kind: 'path-set', paths: ['node_modules'] },
      rerunPolicy: 'when-stale',
    },
    leaseStore: createLeaseStore({
      now: clock.now,
      createToken: (() => {
        let next = 0;
        return () => {
          next += 1;
          return `lease-token-${next}`;
        };
      })(),
      digestToken: (token) => `digest:${token}`,
    }),
    leaseHolder: 'worker:test',
    leaseTtlMs: 60_000,
    branchOptions: {
      prefix: 'task',
      includeRunId: true,
      includeTaskId: true,
      maxLength: 80,
    },
    now: () => clock.now().toISOString(),
    git: {
      resolveRefToSha: () => 'abc1234' as GitSha,
      getExistingBranchSha: () => undefined,
      createWorktree: ({ worktreePath }) => {
        mkdirSync(worktreePath, { recursive: false });
      },
      createLocalBranch: () => {},
    },
    localGitEvidenceRecorder: recorder,
    setupDependencies: {
      pathExists: () => false,
      readTextFile: () => ({ ok: true, value: undefined }) as const,
      resolveArtifactRef: () => ({ ok: true, value: undefined }) as const,
    },
  });

  return { workspaceRepository };
};

const expectRecordSuccess = (
  result: ReturnType<ReturnType<typeof createLocalGitEvidenceRecorder>['record']>,
): LocalGitEvidence => {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`Expected success, received ${result.error.token}`);
  }
  return result.value;
};

describe('fnd-03-s3 local git evidence recorder', () => {
  it('records the local git evidence shape, commit summaries, diff refs, and clean working tree from a local fixture', () => {
    const compileOnlyAssertions: readonly [LocalGitEvidenceKeysExact, LocalGitEvidenceRecordedPayloadKeysExact] = [
      true,
      true,
    ];
    const fixture = createLocalGitFixture();
    const artifacts = createArtifactRecorderHarness();
    const recorder = createLocalGitEvidenceRecorder({
      now: () => '2026-06-22T10:15:00.000Z',
      createEvidenceId: () => 'evidence-001',
      inspector: createFixtureInspector(fixture),
      artifactRecorder: artifacts.recorder,
    });

    const recorded = expectRecordSuccess(recorder.record({ lease: fixture.lease, repository: fixture.repository }));

    expect(compileOnlyAssertions).toEqual([true, true]);
    expect(recorded).toMatchObject({
      evidenceId: 'evidence-001',
      leaseId: fixture.lease.leaseId,
      repoId: fixture.repository.repoId,
      worktreePath: fixture.lease.worktreePath,
      branchName: fixture.lease.branchName,
      inspectedAt: '2026-06-22T10:15:00.000Z',
      baseSha: fixture.baseSha,
      mergeBaseSha: fixture.baseSha,
      headSha: fixture.headSha,
      fromSha: fixture.baseSha,
      toSha: fixture.headSha,
      changedPaths: [
        'packages/sdk/src/foundation/workspace-repository/evidence/index.ts',
        'packages/sdk/src/foundation/workspace-repository/evidence/notes.md',
      ],
      clean: true,
      stagedPaths: [],
      unstagedPaths: [],
      untrackedPaths: [],
    });
    expect(recorded.localCommits).toHaveLength(2);
    expect(recorded.localCommits[0]).toMatchObject({
      parentShas: [recorded.localCommits[1]?.sha as GitSha],
      subject: 'test: cover dirty local git evidence',
      authoredAt: '2026-06-22T09:06:00Z',
    });
    expect(recorded.localCommits[1]).toEqual({
      sha: recorded.localCommits[1]?.sha,
      parentShas: [fixture.baseSha],
      subject: 'feat: add local git evidence recorder',
      authoredAt: '2026-06-22T09:04:00Z',
    });
    expect(recorded.statRef).toBe(artifacts.recordedArtifacts.find((artifact) => artifact.kind === 'stat')?.refId);
    expect(recorded.patchRef).toBe(artifacts.recordedArtifacts.find((artifact) => artifact.kind === 'patch')?.refId);
    expect(artifacts.recordedArtifacts).toHaveLength(2);
    expect(artifacts.recordedArtifacts[0]?.content).toContain('evidence/index.ts');
    expect(artifacts.recordedArtifacts[1]?.content).toContain('evidenceVersion = 2');
  });

  it('records dirty staged, unstaged, and untracked paths with clean=false and top-level changed paths', () => {
    const fixture = createLocalGitFixture({ dirty: true });
    const recorder = createLocalGitEvidenceRecorder({
      now: () => '2026-06-22T10:20:00.000Z',
      createEvidenceId: () => 'evidence-dirty-001',
      inspector: createFixtureInspector(fixture),
    });

    const recorded = expectRecordSuccess(recorder.record({ lease: fixture.lease, repository: fixture.repository }));

    expect(recorded.clean).toBe(false);
    expect(recorded.changedPaths).toEqual([
      'packages/sdk/src/foundation/workspace-repository/evidence/index.ts',
      'packages/sdk/src/foundation/workspace-repository/evidence/notes.md',
    ]);
    expect(recorded.stagedPaths).toEqual(['packages/sdk/src/foundation/workspace-repository/evidence/index.ts']);
    expect(recorded.unstagedPaths).toEqual(['README.md']);
    expect(recorded.untrackedPaths).toEqual([
      'packages/sdk/src/foundation/workspace-repository/evidence/untracked.txt',
    ]);
  });

  it('returns local-git-evidence-unavailable without partial success when branch, merge base, status, or diff cannot be read', () => {
    const fixture = createLocalGitFixture();

    for (const failReason of [
      'branch-missing',
      'merge-base-unavailable',
      'status-unavailable',
      'diff-unavailable',
    ] as const) {
      const recorder = createLocalGitEvidenceRecorder({
        now: () => '2026-06-22T10:25:00.000Z',
        createEvidenceId: () => 'evidence-unavailable-001',
        inspector: createFixtureInspector(fixture, { failReason }),
      });

      expect(recorder.record({ lease: fixture.lease, repository: fixture.repository })).toEqual({
        ok: false,
        error: {
          token: 'local-git-evidence-unavailable',
          leaseId: fixture.lease.leaseId,
        },
      });
    }
  });

  it('keeps the evidence boundary local-only with the expected top-level and commit fields', () => {
    const fixture = createLocalGitFixture();
    const recorder = createLocalGitEvidenceRecorder({
      now: () => '2026-06-22T10:30:00.000Z',
      createEvidenceId: () => 'evidence-boundary-001',
      inspector: createFixtureInspector(fixture),
    });

    const recorded = expectRecordSuccess(recorder.record({ lease: fixture.lease, repository: fixture.repository }));

    expect(Object.keys(recorded).sort()).toEqual([
      'baseSha',
      'branchName',
      'changedPaths',
      'clean',
      'evidenceId',
      'fromSha',
      'headSha',
      'inspectedAt',
      'leaseId',
      'localCommits',
      'mergeBaseSha',
      'patchRef',
      'repoId',
      'stagedPaths',
      'statRef',
      'toSha',
      'unstagedPaths',
      'untrackedPaths',
      'worktreePath',
    ]);
    expect(recorded).not.toMatchObject({
      remoteRef: expect.anything(),
      remoteUrl: expect.anything(),
      credential: expect.anything(),
      ciState: expect.anything(),
      reviewState: expect.anything(),
      mergeState: expect.anything(),
      workerSummary: expect.anything(),
      workerProse: expect.anything(),
    });
    expect(Object.keys(recorded.localCommits[0] ?? {}).sort()).toEqual(['authoredAt', 'parentShas', 'sha', 'subject']);
  });

  it('returns stale-lease-fence through WorkspaceRepository before invoking evidence recording', () => {
    let calls = 0;
    const recorder = createLocalGitEvidenceRecorder({
      now: () => '2026-06-22T10:40:00.000Z',
      inspector: {
        inspect() {
          calls += 1;
          return {
            ok: true,
            value: {
              headSha: 'def5678' as GitSha,
              mergeBaseSha: 'abc1234' as GitSha,
              localCommits: [],
              diff: {
                fromSha: 'abc1234' as GitSha,
                toSha: 'def5678' as GitSha,
                changedPaths: [],
              },
              workingTree: {
                stagedPaths: [],
                unstagedPaths: [],
                untrackedPaths: [],
              },
            },
          } as const;
        },
      },
    });
    const harness = createWorkspaceHarness(recorder);

    const created = harness.workspaceRepository.createLease({
      runId: 'evidence-run',
      taskId: 'fnd-03-s3',
      repoId: 'workflow-kit',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error(`Expected lease creation to succeed, received ${created.error.token}`);
    }

    const recordMethod: WorkspaceRepository['recordLocalGitEvidence'] =
      harness.workspaceRepository.recordLocalGitEvidence;
    expect(
      recordMethod({
        leaseId: created.value.lease.leaseId,
        epoch: created.value.lease.epoch + 1,
        fenceToken: created.value.lease.fenceToken,
      }),
    ).toEqual({
      ok: false,
      error: {
        token: 'stale-lease-fence',
        leaseId: created.value.lease.leaseId,
        epoch: created.value.lease.epoch + 1,
      },
    });
    expect(calls).toBe(0);
  });
});
