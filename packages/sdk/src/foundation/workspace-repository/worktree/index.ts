import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import type { ArtifactRef } from '../../storage/artifacts/index.js';
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
  type RelativePath,
  type RepositoryIdentity,
} from '../repository/index.js';
import {
  createSetupDependencies,
  evaluateDeclaredSetup,
  type DeclaredSetup,
  type SetupDependencies,
  type SetupEvaluation,
} from '../setup/index.js';
import type {
  CleanupGitDependencies,
  CleanupRequest,
  CleanupResult,
  CleanupRuntimeDependencies,
  FinalizeLeaseInput,
  FinalizeLeaseResult,
} from '../cleanup/index.js';
import {
  createCleanupBlockedIntents as buildCleanupBlockedIntents,
  createCleanupLeaseHandler,
  createFinalizeLeaseHandler,
} from '../cleanup/worktree-settlement.js';

import {
  createLocalBranchCreatedIntent,
  createLocalGitEvidenceRecordedIntent,
  createWorktreeCleanupBlockedIntent,
  createWorktreeCleanupCompletedIntent,
  createWorktreeCleanupRetryScheduledIntent,
  createRepoSetupConfirmedIntent,
  createRepoSetupEvaluatedIntent,
  createWorktreeLeaseCreatedIntent,
  createWorktreeLeaseFinalizedIntent,
  type LocalCommitSummary,
  type LocalGitEvidenceRecordedPayload,
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

export type RecordLocalGitEvidenceInput = {
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

export type ArtifactRefId = ArtifactRef['id'];

export type LocalGitEvidence = {
  readonly evidenceId: string;
  readonly leaseId: string;
  readonly repoId: string;
  readonly worktreePath: AbsolutePath;
  readonly branchName: string;
  readonly inspectedAt: string;
  readonly baseSha: GitSha;
  readonly mergeBaseSha: GitSha;
  readonly headSha: GitSha;
  readonly localCommits: readonly LocalCommitSummary[];
  readonly fromSha: GitSha;
  readonly toSha: GitSha;
  readonly changedPaths: readonly RelativePath[];
  readonly statRef?: ArtifactRefId;
  readonly patchRef?: ArtifactRefId;
  readonly clean: boolean;
  readonly stagedPaths: readonly RelativePath[];
  readonly unstagedPaths: readonly RelativePath[];
  readonly untrackedPaths: readonly RelativePath[];
};

export type LocalGitEvidenceUnavailable = {
  readonly token: 'local-git-evidence-unavailable';
  readonly leaseId: string;
};

export type LocalGitEvidenceRecorderResult =
  | { readonly ok: true; readonly value: LocalGitEvidence }
  | { readonly ok: false; readonly error: LocalGitEvidenceUnavailable };

export type LocalGitEvidenceRecorderInput = {
  readonly lease: WorktreeLease;
  readonly repository: RepositoryIdentity;
};

export interface LocalGitEvidenceRecorder {
  record(input: LocalGitEvidenceRecorderInput): LocalGitEvidenceRecorderResult;
}

export type RecordLocalGitEvidenceSuccess = {
  readonly evidence: LocalGitEvidence;
  readonly appendIntents: readonly WorkspaceRepositoryAppendIntent[];
};

export type RecordLocalGitEvidenceError = LeaseNotFound | StaleLeaseFence | LocalGitEvidenceUnavailable;

export type RecordLocalGitEvidenceResult =
  | { readonly ok: true; readonly value: RecordLocalGitEvidenceSuccess }
  | { readonly ok: false; readonly error: RecordLocalGitEvidenceError };

export interface WorkspaceRepository {
  createLease(input: CreateLeaseInput): WorkspaceRepositoryResult;
  evaluateSetup(leaseId: string): WorkspaceRepositoryResult;
  confirmSetup(input: ConfirmSetupInput): WorkspaceRepositoryResult;
  recordLocalGitEvidence(input: RecordLocalGitEvidenceInput): RecordLocalGitEvidenceResult;
  finalizeLease(input: FinalizeLeaseInput): FinalizeLeaseResult;
  cleanupLease(input: CleanupRequest): CleanupResult;
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
} & CleanupGitDependencies;

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
  readonly localGitEvidenceRecorder?: LocalGitEvidenceRecorder;
  readonly cleanupDependencies?: Partial<Pick<CleanupRuntimeDependencies, 'retryDelayMs' | 'writeCleanupTombstone'>>;
  readonly setupDependencies?: Partial<SetupDependencies>;
};

type StoredLeaseRecord = {
  readonly lease: WorktreeLease;
  readonly setup: DeclaredSetup;
  readonly setupEvaluatedAtLeastOnce: boolean;
  readonly latestEvidence?: LocalGitEvidence;
  readonly finalizedEvidence?: LocalGitEvidence;
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

const toLocalGitEvidenceRecordedPayload = (evidence: LocalGitEvidence): LocalGitEvidenceRecordedPayload => ({
  evidenceId: evidence.evidenceId,
  leaseId: evidence.leaseId,
  repoId: evidence.repoId,
  worktreePath: evidence.worktreePath,
  branchName: evidence.branchName,
  inspectedAt: evidence.inspectedAt,
  baseSha: evidence.baseSha,
  mergeBaseSha: evidence.mergeBaseSha,
  headSha: evidence.headSha,
  localCommits: evidence.localCommits,
  fromSha: evidence.fromSha,
  toSha: evidence.toSha,
  changedPaths: evidence.changedPaths,
  statRef: evidence.statRef,
  patchRef: evidence.patchRef,
  clean: evidence.clean,
  stagedPaths: evidence.stagedPaths,
  unstagedPaths: evidence.unstagedPaths,
  untrackedPaths: evidence.untrackedPaths,
});

export const createWorkspaceRepository = (dependencies: WorkspaceRepositoryDependencies): WorkspaceRepository => {
  const setupDependencies = createSetupDependencies(dependencies.setupDependencies);
  const localGitEvidenceRecorder: LocalGitEvidenceRecorder = dependencies.localGitEvidenceRecorder ?? {
    record: ({ lease }) => ({
      ok: false,
      error: {
        token: 'local-git-evidence-unavailable',
        leaseId: lease.leaseId,
      },
    }),
  };
  const records = new Map<string, StoredLeaseRecord>();

  const persistRecord = (record: StoredLeaseRecord): void => {
    records.set(record.lease.leaseId, record);
  };

  const cleanupRuntime: CleanupRuntimeDependencies = {
    ...dependencies.git,
    now: dependencies.now,
    retryDelayMs: dependencies.cleanupDependencies?.retryDelayMs ?? 300_000,
    writeCleanupTombstone: dependencies.cleanupDependencies?.writeCleanupTombstone,
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
      latestEvidence: record.latestEvidence,
      finalizedEvidence: record.finalizedEvidence,
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
        latestEvidence: undefined,
        finalizedEvidence: undefined,
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

    recordLocalGitEvidence(input) {
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

      const recordedEvidence = localGitEvidenceRecorder.record({
        lease: record.lease,
        repository: dependencies.repository,
      });

      if (!recordedEvidence.ok) {
        return recordedEvidence;
      }

      const occurredAt = dependencies.now();
      persistRecord({
        ...record,
        latestEvidence: recordedEvidence.value,
      });

      return {
        ok: true,
        value: {
          evidence: recordedEvidence.value,
          appendIntents: [
            createLocalGitEvidenceRecordedIntent(toLocalGitEvidenceRecordedPayload(recordedEvidence.value), occurredAt),
          ],
        },
      };
    },

    finalizeLease: createFinalizeLeaseHandler<WorktreeLease, StoredLeaseRecord>({
      getRecord: (leaseId) => records.get(leaseId),
      persistRecord: (record) => {
        persistRecord(record as StoredLeaseRecord);
      },
      repository: dependencies.repository,
      runtime: cleanupRuntime,
      now: dependencies.now,
      leaseStoreFence: (leaseId, epoch, token) => dependencies.leaseStore.fence(leaseId, epoch, token),
      updateLeaseState: (lease, state) => updateLeaseState(lease, state as WorktreeLeaseState),
      createFinalizedIntent: ({ lease, evidenceId, headSha, occurredAt }) =>
        createWorktreeLeaseFinalizedIntent(
          {
            leaseId: lease.leaseId,
            epoch: lease.epoch,
            runId: lease.runId,
            repoId: lease.repoId,
            worktreePath: lease.worktreePath,
            branchName: lease.branchName,
            evidenceId,
            headSha,
            finalizedAt: occurredAt,
            state: 'finalized',
          },
          occurredAt,
        ),
    }),

    cleanupLease: createCleanupLeaseHandler<WorktreeLease, StoredLeaseRecord>({
      getRecord: (leaseId) => records.get(leaseId),
      persistRecord: (record) => {
        persistRecord(record as StoredLeaseRecord);
      },
      repository: dependencies.repository,
      runtime: cleanupRuntime,
      now: dependencies.now,
      leaseStoreFence: (leaseId, epoch, token) => dependencies.leaseStore.fence(leaseId, epoch, token),
      retryDelayMs: cleanupRuntime.retryDelayMs,
      updateLeaseState: (lease, state) => updateLeaseState(lease, state as WorktreeLeaseState),
      createCleanupBlockedIntents: (input) =>
        buildCleanupBlockedIntents({
          ...input,
          createRetryScheduledIntent: (payload) =>
            createWorktreeCleanupRetryScheduledIntent({ ...payload, state: 'cleanup-blocked' }, input.now),
          createBlockedIntent: (payload) =>
            createWorktreeCleanupBlockedIntent({ ...payload, state: 'cleanup-blocked' }, input.now),
        }),
      createCleanupCompletedIntent: ({ lease, branchDisposition, expectedHeadSha, cleanupTombstoneRef, cleanedAt }) =>
        createWorktreeCleanupCompletedIntent(
          {
            leaseId: lease.leaseId,
            epoch: lease.epoch,
            repoId: lease.repoId,
            worktreePath: lease.worktreePath,
            branchName: lease.branchName,
            expectedHeadSha,
            pathRemoved: true,
            worktreeRegistrationPresent: false,
            branchDisposition,
            cleanupTombstoneRef,
            cleanedAt,
            state: 'cleaned',
          },
          cleanedAt,
        ),
    }),
  };
};

export type {
  LocalBranchCreatedIntent,
  LocalBranchCreatedPayload,
  LocalCommitSummary,
  LocalGitEvidenceRecordedIntent,
  LocalGitEvidenceRecordedPayload,
  RepoSetupConfirmedIntent,
  RepoSetupConfirmedPayload,
  RepoSetupEvaluatedIntent,
  RepoSetupEvaluatedPayload,
  WorkspaceRepositoryAppendIntent,
  WorktreeCleanupBlockedIntent,
  WorktreeCleanupBlockedPayload,
  WorktreeCleanupCompletedIntent,
  WorktreeCleanupCompletedPayload,
  WorktreeCleanupRetryScheduledIntent,
  WorktreeCleanupRetryScheduledPayload,
  WorktreeLeaseCreatedIntent,
  WorktreeLeaseCreatedPayload,
  WorktreeLeaseFinalizedIntent,
  WorktreeLeaseFinalizedPayload,
} from './intents.js';

export type {
  BranchDisposition,
  CleanupBlockedError,
  CleanupBlockedReason,
  CleanupObservedState,
  CleanupRequest,
  CleanupResult,
  FinalizeLeaseError,
  FinalizeLeaseInput,
  FinalizeLeaseResult,
  FinalizeLeaseSuccess,
} from '../cleanup/index.js';
