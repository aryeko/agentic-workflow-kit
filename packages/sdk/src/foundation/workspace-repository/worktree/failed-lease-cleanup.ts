import { existsSync, rmSync } from 'node:fs';

import type { LeaseCapability, LeaseStore } from '../../storage/leases/index.js';
import type { CleanupGitDependencies } from '../cleanup/index.js';
import type { AbsolutePath, RepositoryIdentity } from '../repository/index.js';

type FailedLeaseCleanupInput = {
  readonly repository: RepositoryIdentity;
  readonly worktreePath: AbsolutePath;
  readonly acquiredLease: LeaseCapability;
  readonly leaseStore: Pick<LeaseStore, 'release'>;
  readonly git: Pick<CleanupGitDependencies, 'pruneWorktreeRegistration' | 'removeWorktreePath'>;
};

const defaultRemoveWorktreePath = (worktreePath: AbsolutePath): void => {
  rmSync(worktreePath, { recursive: true, force: true });
};

export const cleanupFailedLeaseCreation = (input: FailedLeaseCleanupInput): void => {
  try {
    if (existsSync(input.worktreePath)) {
      if (input.git.removeWorktreePath !== undefined) {
        input.git.removeWorktreePath({
          repository: input.repository,
          worktreePath: input.worktreePath,
        });
      } else {
        defaultRemoveWorktreePath(input.worktreePath);
      }
    }
  } catch {
    // Fail closed. Lease release still runs so the caller gets a bounded failure result.
  } finally {
    try {
      input.git.pruneWorktreeRegistration?.({
        repository: input.repository,
        worktreePath: input.worktreePath,
      });
    } catch {
      // Best-effort cleanup only.
    }

    input.leaseStore.release(input.acquiredLease.name, input.acquiredLease.epoch, input.acquiredLease.token);
  }
};
