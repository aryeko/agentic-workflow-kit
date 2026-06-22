import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import type { StorageError } from '../../storage/errors/index.js';
import type { LeaseStore } from '../../storage/leases/index.js';
import {
  buildLocalBranchName,
  planLocalBranch,
  type BranchConflict,
  type LocalBranchNameOptions,
} from '../branch/index.js';
import {
  resolveLocalBaseRef,
  type AbsolutePath,
  type BaseRefUnresolved,
  type GitSha,
  type LocalRef,
  type RepositoryIdentity,
} from '../repository/index.js';
import {
  createSetupDependencies,
  evaluateDeclaredSetup,
  type DeclaredSetup,
  type SetupDependencies,
  type SetupEvaluation,
} from '../setup/index.js';

import {
  createLocalBranchCreatedIntent,
  createRepoSetupConfirmedIntent,
  createRepoSetupEvaluatedIntent,
  createWorktreeLeaseCreatedIntent,
  type WorkspaceRepositoryAppendIntent,
} from './intents.js';

export const WORKTREE_LEASE_STATES = [
  'planned',
  'leased',
  'branch-created',
  'setup-required',
  'ready',
  'finalized',
  'cleanup-pending',
  'cleanup-blocked',
  'cleaned',
] as const;

export type WorktreeLeaseState = (typeof WORKTREE_LEASE_STATES)[number];

export type WorktreeLease = {
  readonly leaseId: string;
  readonly epoch: number;
  readonly runId: string;
  readonly repoId: string;
  readonly worktreePath: AbsolutePath;
  readonly baseRef: LocalRef;
  readonly baseSha: GitSha;
  readonly branchName: string;
  readonly state: WorktreeLeaseState;
  readonly fenceToken: string;
};

export type WorktreePathConflict = {
  readonly token: 'worktree-path-conflict';
  readonly worktreePath: AbsolutePath;
};

export type StaleLeaseFence = {
  readonly token: 'stale-lease-fence';
  readonly leaseId: string;
  readonly epoch: number;
};

export type LeaseNotFound = {
  readonly token: 'lease-not-found';
  readonly leaseId: string;
};

export type WorktreeInputInvalid = {
  readonly token: 'worktree-input-invalid';
  readonly reason: 'repo-id-mismatch' | 'path-traversal';
  readonly repoId?: string;
  readonly segment?: string;
};

export type WorkspaceRepositoryError =
  | BaseRefUnresolved
  | BranchConflict
  | WorktreePathConflict
  | StaleLeaseFence
  | LeaseNotFound
  | WorktreeInputInvalid
  | StorageError;

export type CreateLeaseInput = {
  readonly runId: string;
  readonly taskId: string;
  readonly repoId: string;
  readonly baseRef?: LocalRef;
};

export type ConfirmSetupInput = {
  readonly leaseId: string;
  readonly epoch: number;
  readonly fenceToken: string;
};

export type LeaseOperationSuccess = {
  readonly lease: WorktreeLease;
  readonly setupEvaluation: SetupEvaluation;
  readonly appendIntents: readonly WorkspaceRepositoryAppendIntent[];
};

export type WorkspaceRepositoryResult =
  | { readonly ok: true; readonly value: LeaseOperationSuccess }
  | { readonly ok: false; readonly error: WorkspaceRepositoryError };

export interface WorkspaceRepository {
  createLease(input: CreateLeaseInput): WorkspaceRepositoryResult;
  evaluateSetup(leaseId: string): WorkspaceRepositoryResult;
  confirmSetup(input: ConfirmSetupInput): WorkspaceRepositoryResult;
}

type GitDependencies = {
  readonly resolveRefToSha: (ref: LocalRef, repository: RepositoryIdentity) => GitSha | undefined;
  readonly getExistingBranchSha: (branchName: string, repository: RepositoryIdentity) => GitSha | undefined;
  readonly createWorktree: (input: {
    readonly repository: RepositoryIdentity;
    readonly worktreePath: AbsolutePath;
    readonly baseSha: GitSha;
  }) => void;
  readonly createLocalBranch: (input: {
    readonly repository: RepositoryIdentity;
    readonly worktreePath: AbsolutePath;
    readonly branchName: string;
    readonly targetSha: GitSha;
    readonly trackUpstream: false;
  }) => void;
};

export type WorkspaceRepositoryDependencies = {
  readonly repository: RepositoryIdentity;
  readonly worktreeRoot: AbsolutePath;
  readonly setup: DeclaredSetup;
  readonly branchOptions: LocalBranchNameOptions;
  readonly leaseStore: LeaseStore;
  readonly leaseHolder: string;
  readonly leaseTtlMs: number;
  readonly now: () => string;
  readonly git: GitDependencies;
  readonly setupDependencies?: Partial<SetupDependencies>;
};

type StoredLeaseRecord = {
  readonly lease: WorktreeLease;
  readonly setup: DeclaredSetup;
  readonly setupEvaluatedAtLeastOnce: boolean;
};

const isStorageError = (value: unknown): value is StorageError =>
  typeof value === 'object' && value !== null && 'code' in value && 'health' in value && 'message' in value;

const toAbsolutePath = (path: string): AbsolutePath => path as AbsolutePath;

const isTraversingPath = (value: string): boolean => {
  const normalized = value.trim();

  return (
    normalized.length === 0 ||
    normalized === '.' ||
    normalized === '..' ||
    normalized.includes('/') ||
    normalized.includes('\\') ||
    normalized.includes('\0')
  );
};

const isPathContainedWithinRoot = (root: AbsolutePath, path: AbsolutePath): boolean => {
  const relativePath = relative(root, path);

  return relativePath.length > 0 && !relativePath.startsWith('..') && !isAbsolute(relativePath);
};

const getResultingState = (evaluation: SetupEvaluation): Extract<WorktreeLeaseState, 'setup-required' | 'ready'> =>
  evaluation.fresh ? 'ready' : 'setup-required';

const updateLeaseState = (lease: WorktreeLease, state: WorktreeLeaseState): WorktreeLease => ({
  ...lease,
  state,
});

export const createWorkspaceRepository = (dependencies: WorkspaceRepositoryDependencies): WorkspaceRepository => {
  const setupDependencies = createSetupDependencies(dependencies.setupDependencies);
  const records = new Map<string, StoredLeaseRecord>();

  const persistRecord = (record: StoredLeaseRecord): void => {
    records.set(record.lease.leaseId, record);
  };

  const evaluateForRecord = (
    record: StoredLeaseRecord,
    occurredAt: string,
    intentFactory: typeof createRepoSetupEvaluatedIntent | typeof createRepoSetupConfirmedIntent,
  ): LeaseOperationSuccess => {
    const evaluation = evaluateDeclaredSetup(
      {
        leaseId: record.lease.leaseId,
        setup: record.setup,
        worktreePath: record.lease.worktreePath,
        isInitialEvaluation: !record.setupEvaluatedAtLeastOnce,
      },
      setupDependencies,
    );
    const resultingState = getResultingState(evaluation);
    const updatedLease = updateLeaseState(record.lease, resultingState);
    const appendIntent =
      intentFactory === createRepoSetupEvaluatedIntent
        ? createRepoSetupEvaluatedIntent(
            {
              leaseId: updatedLease.leaseId,
              epoch: updatedLease.epoch,
              repoId: updatedLease.repoId,
              worktreePath: updatedLease.worktreePath,
              setup: record.setup,
              evaluatedAt: occurredAt,
              fresh: evaluation.fresh,
              reason: evaluation.reason,
              resultingState,
            },
            occurredAt,
          )
        : createRepoSetupConfirmedIntent(
            {
              leaseId: updatedLease.leaseId,
              epoch: updatedLease.epoch,
              repoId: updatedLease.repoId,
              worktreePath: updatedLease.worktreePath,
              setup: record.setup,
              confirmedAt: occurredAt,
              fresh: evaluation.fresh,
              reason: evaluation.reason,
              resultingState,
            },
            occurredAt,
          );

    persistRecord({
      lease: updatedLease,
      setup: record.setup,
      setupEvaluatedAtLeastOnce: true,
    });

    return {
      lease: updatedLease,
      setupEvaluation: evaluation,
      appendIntents: [appendIntent],
    };
  };

  return {
    createLease(input) {
      if (input.repoId !== dependencies.repository.repoId) {
        return {
          ok: false,
          error: {
            token: 'worktree-input-invalid',
            reason: 'repo-id-mismatch',
            repoId: input.repoId,
          },
        };
      }

      if (isTraversingPath(input.repoId)) {
        return {
          ok: false,
          error: {
            token: 'worktree-input-invalid',
            reason: 'path-traversal',
            segment: input.repoId,
          },
        };
      }

      if (isTraversingPath(input.runId)) {
        return {
          ok: false,
          error: {
            token: 'worktree-input-invalid',
            reason: 'path-traversal',
            segment: input.runId,
          },
        };
      }

      const baseRefResult = resolveLocalBaseRef({
        repository: dependencies.repository,
        baseRef: input.baseRef,
        resolveRefToSha: dependencies.git.resolveRefToSha,
      });

      if (!baseRefResult.ok) {
        return baseRefResult;
      }

      const worktreePath = toAbsolutePath(resolve(dependencies.worktreeRoot, input.repoId, input.runId));

      if (!isPathContainedWithinRoot(dependencies.worktreeRoot, worktreePath)) {
        return {
          ok: false,
          error: {
            token: 'worktree-input-invalid',
            reason: 'path-traversal',
            segment: input.runId,
          },
        };
      }

      if (setupDependencies.pathExists(worktreePath)) {
        return {
          ok: false,
          error: {
            token: 'worktree-path-conflict',
            worktreePath,
          },
        };
      }

      const branchName = buildLocalBranchName({
        repoId: input.repoId,
        runId: input.runId,
        taskId: input.taskId,
        options: dependencies.branchOptions,
      });
      const branchPlan = planLocalBranch({
        repoId: input.repoId,
        runId: input.runId,
        taskId: input.taskId,
        options: dependencies.branchOptions,
        targetSha: baseRefResult.value.sha,
        existingBranchSha: dependencies.git.getExistingBranchSha(branchName, dependencies.repository),
      });

      if (!branchPlan.ok) {
        return branchPlan;
      }

      const leaseId = `worktree:${input.repoId}:${input.runId}`;
      const acquiredLease = dependencies.leaseStore.acquire(leaseId, dependencies.leaseHolder, dependencies.leaseTtlMs);

      if (isStorageError(acquiredLease)) {
        return {
          ok: false,
          error: acquiredLease,
        };
      }

      mkdirSync(dirname(worktreePath), { recursive: true });

      try {
        dependencies.git.createWorktree({
          repository: dependencies.repository,
          worktreePath,
          baseSha: baseRefResult.value.sha,
        });
      } catch {
        dependencies.leaseStore.release(acquiredLease.name, acquiredLease.epoch, acquiredLease.token);
        return {
          ok: false,
          error: {
            token: 'worktree-path-conflict',
            worktreePath,
          },
        };
      }

      dependencies.git.createLocalBranch({
        repository: dependencies.repository,
        worktreePath,
        branchName: branchPlan.value.branchName,
        targetSha: branchPlan.value.targetSha,
        trackUpstream: false,
      });

      const lease: WorktreeLease = {
        leaseId: acquiredLease.name,
        epoch: acquiredLease.epoch,
        runId: input.runId,
        repoId: input.repoId,
        worktreePath,
        baseRef: baseRefResult.value.ref,
        baseSha: baseRefResult.value.sha,
        branchName: branchPlan.value.branchName,
        state: 'branch-created',
        fenceToken: acquiredLease.token,
      };

      persistRecord({
        lease,
        setup: dependencies.setup,
        setupEvaluatedAtLeastOnce: false,
      });

      const occurredAt = dependencies.now();
      const setupResult = evaluateForRecord(
        records.get(lease.leaseId) as StoredLeaseRecord,
        occurredAt,
        createRepoSetupEvaluatedIntent,
      );

      return {
        ok: true,
        value: {
          lease: setupResult.lease,
          setupEvaluation: setupResult.setupEvaluation,
          appendIntents: [
            createWorktreeLeaseCreatedIntent(
              {
                leaseId: lease.leaseId,
                epoch: lease.epoch,
                runId: lease.runId,
                taskId: input.taskId,
                repoId: lease.repoId,
                worktreePath: lease.worktreePath,
                baseRef: lease.baseRef,
                baseSha: lease.baseSha,
                state: 'leased',
              },
              occurredAt,
            ),
            createLocalBranchCreatedIntent(
              {
                leaseId: lease.leaseId,
                epoch: lease.epoch,
                runId: lease.runId,
                taskId: input.taskId,
                repoId: lease.repoId,
                worktreePath: lease.worktreePath,
                branchName: lease.branchName,
                baseSha: lease.baseSha,
                state: 'branch-created',
              },
              occurredAt,
            ),
            ...setupResult.appendIntents,
          ],
        },
      };
    },

    evaluateSetup(leaseId) {
      const record = records.get(leaseId);

      if (record === undefined) {
        return {
          ok: false,
          error: {
            token: 'lease-not-found',
            leaseId,
          },
        };
      }

      return {
        ok: true,
        value: evaluateForRecord(record, dependencies.now(), createRepoSetupEvaluatedIntent),
      };
    },

    confirmSetup(input) {
      const record = records.get(input.leaseId);

      if (record === undefined) {
        return {
          ok: false,
          error: {
            token: 'lease-not-found',
            leaseId: input.leaseId,
          },
        };
      }

      if (!dependencies.leaseStore.fence(input.leaseId, input.epoch, input.fenceToken)) {
        return {
          ok: false,
          error: {
            token: 'stale-lease-fence',
            leaseId: input.leaseId,
            epoch: input.epoch,
          },
        };
      }

      return {
        ok: true,
        value: evaluateForRecord(record, dependencies.now(), createRepoSetupConfirmedIntent),
      };
    },
  };
};

export type {
  LocalBranchCreatedIntent,
  LocalBranchCreatedPayload,
  RepoSetupConfirmedIntent,
  RepoSetupConfirmedPayload,
  RepoSetupEvaluatedIntent,
  RepoSetupEvaluatedPayload,
  WorkspaceRepositoryAppendIntent,
  WorktreeLeaseCreatedIntent,
  WorktreeLeaseCreatedPayload,
} from './intents.js';
