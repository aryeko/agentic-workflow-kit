import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createLeaseStore,
  createWorkspaceRepository,
  type AbsolutePath,
  type GitSha,
  type LocalRef,
  type RepositoryIdentity,
} from '../../../../src/index.js';

const createdRoots: string[] = [];

const createTempRoot = (): AbsolutePath => {
  const root = mkdtempSync(join(tmpdir(), 'workflow-kit-worktree-creation-failures-'));
  createdRoots.push(root);
  return root as AbsolutePath;
};

afterEach(() => {
  for (const root of createdRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

const createHarness = () => {
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

  const branchFailureState = { enabled: true };
  const removedPaths: AbsolutePath[] = [];
  const prunedRegistrations: AbsolutePath[] = [];

  const leaseStore = createLeaseStore({
    now: () => new Date('2026-06-22T11:00:00.000Z'),
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
    now: () => '2026-06-22T11:00:00.000Z',
    git: {
      resolveRefToSha: () => 'abc1234abc1234abc1234abc1234abc1234abcd' as GitSha,
      getExistingBranchSha: () => undefined,
      createWorktree: ({ worktreePath }) => {
        mkdirSync(worktreePath, { recursive: false });
      },
      createLocalBranch: () => {
        if (branchFailureState.enabled) {
          throw new Error('branch creation failed');
        }
      },
      removeWorktreePath: ({ worktreePath }) => {
        removedPaths.push(worktreePath);
        rmSync(worktreePath, { recursive: true, force: true });
      },
      pruneWorktreeRegistration: ({ worktreePath }) => {
        prunedRegistrations.push(worktreePath);
        return true;
      },
    },
  });

  return {
    leaseStore,
    removedPaths,
    prunedRegistrations,
    repository,
    setCreateLocalBranchFails(enabled: boolean) {
      branchFailureState.enabled = enabled;
    },
    workspaceRepository,
    worktreeRoot: worktreeRoot as AbsolutePath,
  };
};

describe('fnd-03-s2 worktree creation cleanup failures', () => {
  it('fails closed, releases the lease, and removes the worktree when local branch creation throws', () => {
    const harness = createHarness();
    const expectedWorktreePath = join(harness.worktreeRoot, 'workflow-kit', 'branch-create-fails') as AbsolutePath;
    const leaseId = 'worktree:workflow-kit:branch-create-fails';

    expect(
      harness.workspaceRepository.createLease({
        runId: 'branch-create-fails',
        taskId: 'fnd-03-s2',
        repoId: harness.repository.repoId,
      }),
    ).toEqual({
      ok: false,
      error: {
        token: 'worktree-path-conflict',
        worktreePath: expectedWorktreePath,
      },
    });
    expect(harness.leaseStore.read(leaseId)).toEqual({ health: 'ok' });
    expect(harness.removedPaths).toEqual([expectedWorktreePath]);
    expect(harness.prunedRegistrations).toEqual([expectedWorktreePath]);
    expect(existsSync(expectedWorktreePath)).toBe(false);

    harness.setCreateLocalBranchFails(false);

    const retry = harness.workspaceRepository.createLease({
      runId: 'branch-create-fails',
      taskId: 'fnd-03-s2',
      repoId: harness.repository.repoId,
    });

    expect(retry.ok).toBe(true);
    if (!retry.ok) {
      throw new Error(`expected retry lease creation to succeed, got ${retry.error.token}`);
    }
    expect(retry.value.lease.leaseId).toBe(leaseId);
    expect(retry.value.lease.epoch).toBe(2);
    expect(existsSync(expectedWorktreePath)).toBe(true);
  });
});
