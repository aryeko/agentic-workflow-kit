import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach } from 'vitest';

import {
  createLeaseStore,
  createWorkspaceRepository,
  type AbsolutePath,
  type BranchDisposition,
  type CleanupObservedState,
  type CleanupRequest,
  type GitSha,
  type LocalGitEvidence,
  type LocalRef,
  type RepositoryIdentity,
  type WorkspaceRepository,
} from '../../../../src/index.js';

type ExpectTrue<T extends true> = T;

type KeysExactly<T, Keys extends PropertyKey> = [Exclude<keyof T, Keys>, Exclude<Keys, keyof T>] extends [never, never]
  ? true
  : false;

export type CleanupRequestKeysExact = ExpectTrue<
  KeysExactly<CleanupRequest, 'leaseId' | 'epoch' | 'fenceToken' | 'deleteLocalBranch' | 'expectedHeadSha'>
>;

export type CleanupObservedStateKeysExact = ExpectTrue<
  KeysExactly<
    CleanupObservedState,
    | 'pathExists'
    | 'worktreeRegistrationPresent'
    | 'branchExists'
    | 'branchCheckedOut'
    | 'observedHeadSha'
    | 'dirtyPaths'
  >
>;

const createdRoots: string[] = [];

const createClock = (initial: string) => {
  let nowMs = Date.parse(initial);

  return {
    now: (): Date => new globalThis.Date(nowMs),
    advanceMs: (deltaMs: number): void => {
      nowMs += deltaMs;
    },
  };
};

export const createTempRoot = (): AbsolutePath => {
  const root = mkdtempSync(join(tmpdir(), 'workflow-kit-cleanup-settlement-'));
  createdRoots.push(root);
  return root as AbsolutePath;
};

afterEach(() => {
  for (const root of createdRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

type HarnessOptions = {
  readonly localGitEvidence: LocalGitEvidence;
  readonly pathOwnedByLease?: boolean;
  readonly registrationPresent?: boolean;
  readonly branchHeadSha?: GitSha;
  readonly checkedOutWorktreePaths?: readonly AbsolutePath[];
  readonly removePathFails?: boolean;
  readonly pruneRegistrationFails?: boolean;
  readonly deleteBranchFails?: boolean;
  readonly writeTombstoneFails?: boolean;
  readonly currentHeadSha?: GitSha;
};

export const createLocalGitEvidence = (worktreePath: AbsolutePath, dirty = false): LocalGitEvidence => ({
  evidenceId: dirty ? 'evidence-dirty-001' : 'evidence-clean-001',
  leaseId: 'worktree:workflow-kit:cleanup-run',
  repoId: 'workflow-kit',
  worktreePath,
  branchName: 'task/workflow-kit/cleanup-run/fnd-03-s4',
  inspectedAt: '2026-06-22T09:03:00.000Z',
  baseSha: 'abc1234abc1234abc1234abc1234abc1234abcd' as GitSha,
  mergeBaseSha: 'abc1234abc1234abc1234abc1234abc1234abcd' as GitSha,
  headSha: 'def5678def5678def5678def5678def5678def0' as GitSha,
  localCommits: [
    {
      sha: 'def5678def5678def5678def5678def5678def0' as GitSha,
      parentShas: ['abc1234abc1234abc1234abc1234abc1234abcd' as GitSha],
      subject: 'feat: finalize cleanup settlement',
      authoredAt: '2026-06-22T09:02:00.000Z',
    },
  ],
  fromSha: 'abc1234abc1234abc1234abc1234abc1234abcd' as GitSha,
  toSha: 'def5678def5678def5678def5678def5678def0' as GitSha,
  changedPaths: ['packages/sdk/src/foundation/workspace-repository/cleanup/index.ts'],
  statRef: 'artifact:sha256:stat-cleanup',
  patchRef: 'artifact:sha256:patch-cleanup',
  clean: !dirty,
  stagedPaths: dirty ? ['packages/sdk/src/foundation/workspace-repository/cleanup/index.ts'] : [],
  unstagedPaths: dirty ? ['README.md'] : [],
  untrackedPaths: dirty ? ['scratch.txt'] : [],
});

export const createHarness = (options?: Partial<HarnessOptions>) => {
  const clock = createClock('2026-06-22T09:00:00.000Z');
  const root = createTempRoot();
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

  let registrationPresent = options?.registrationPresent ?? true;
  const removedPaths: string[] = [];
  const deletedBranches: string[] = [];
  const tombstoneWrites: Array<{
    readonly leaseId: string;
    readonly branchDisposition: BranchDisposition;
  }> = [];
  let getHeadShaCallCount = 0;

  const leaseStore = createLeaseStore({
    now: clock.now,
    createToken: (() => {
      let next = 0;
      return () => {
        next += 1;
        return `lease-token-${next}`;
      };
    })(),
    digestToken: (token) => `digest:${token}`,
  });

  const workspaceRepository = createWorkspaceRepository({
    repository,
    worktreeRoot: worktreeRoot as AbsolutePath,
    setup: {
      command: 'pnpm install',
      workingDirectory: '.',
      freshness: { kind: 'path-set', paths: ['node_modules'] },
      rerunPolicy: 'when-stale',
    },
    leaseStore,
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
      resolveRefToSha: () => 'abc1234abc1234abc1234abc1234abc1234abcd' as GitSha,
      getExistingBranchSha: () => undefined,
      createWorktree: ({ worktreePath }) => {
        mkdirSync(worktreePath, { recursive: false });
      },
      createLocalBranch: () => {},
      getWorktreeHeadSha: () => {
        getHeadShaCallCount += 1;
        return options?.currentHeadSha;
      },
      isWorktreePathOwnedByLease: () => options?.pathOwnedByLease ?? true,
      isWorktreeRegistrationPresent: () => registrationPresent,
      pruneWorktreeRegistration: () => {
        if (options?.pruneRegistrationFails) {
          return false;
        }

        registrationPresent = false;
        return true;
      },
      removeWorktreePath: ({ worktreePath }) => {
        if (options?.removePathFails) {
          throw new Error('remove failed');
        }

        removedPaths.push(worktreePath);
        rmSync(worktreePath, { recursive: true, force: true });
      },
      getBranchHeadSha: () => options?.branchHeadSha,
      listBranchCheckoutPaths: () => options?.checkedOutWorktreePaths ?? [],
      deleteLocalBranch: ({ branchName }) => {
        if (options?.deleteBranchFails) {
          throw new Error('delete failed');
        }

        deletedBranches.push(branchName);
      },
    },
    localGitEvidenceRecorder: {
      record: () => ({
        ok: true,
        value:
          options?.localGitEvidence ??
          createLocalGitEvidence(join(worktreeRoot, 'workflow-kit', 'cleanup-run') as AbsolutePath),
      }),
    },
    cleanupDependencies: {
      retryDelayMs: 300_000,
      writeCleanupTombstone: (input) => {
        if (options?.writeTombstoneFails) {
          throw new Error('tombstone failed');
        }

        tombstoneWrites.push({
          leaseId: input.lease.leaseId,
          branchDisposition: input.branchDisposition,
        });
        return 'artifact:sha256:cleanup-tombstone';
      },
    },
  });

  return {
    clock,
    deletedBranches,
    getHeadShaCallCount: (): number => getHeadShaCallCount,
    registrationPresent: (): boolean => registrationPresent,
    removedPaths,
    repository,
    tombstoneWrites,
    workspaceRepository,
    worktreeRoot: worktreeRoot as AbsolutePath,
  };
};

export const expectCreateLeaseSuccess = (
  value: ReturnType<ReturnType<typeof createWorkspaceRepository>['createLease']>,
): Extract<typeof value, { readonly ok: true }>['value'] => {
  if (!value.ok) {
    throw new Error(`expected createLease success, got ${value.error.token}`);
  }

  return value.value;
};

export const expectRecordEvidenceSuccess = (
  value: ReturnType<WorkspaceRepository['recordLocalGitEvidence']>,
): Extract<typeof value, { readonly ok: true }>['value'] => {
  if (!value.ok) {
    throw new Error(`expected recordLocalGitEvidence success, got ${value.error.token}`);
  }

  return value.value;
};

export const expectFinalizeSuccess = (
  value: ReturnType<WorkspaceRepository['finalizeLease']>,
): Extract<typeof value, { readonly ok: true }>['value'] => {
  if (!value.ok) {
    throw new Error(`expected finalizeLease success, got ${value.error.token}`);
  }

  return value.value;
};

export const tokenRepresentsForbiddenConcept = (token: string, term: string): boolean => {
  const lowered = token.toLowerCase();

  if (term === 'ci') {
    return lowered === term || lowered.startsWith('ci_') || lowered.endsWith('_ci');
  }

  return lowered.includes(term);
};
