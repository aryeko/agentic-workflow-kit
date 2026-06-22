import { existsSync, rmSync } from 'node:fs';

import type { RepositoryIdentity, GitSha, RelativePath, AbsolutePath } from '../repository/index.js';

type ArtifactRefId = string;

type CleanupAppendIntent = {
  readonly domain: 'fnd-03';
  readonly type: string;
  readonly occurredAt: string;
  readonly payload: unknown;
  readonly durability: 'durable' | 'barrier';
  readonly correlationId?: string;
};

type CleanupLease = {
  readonly leaseId: string;
  readonly epoch: number;
  readonly runId: string;
  readonly repoId: string;
  readonly worktreePath: AbsolutePath;
  readonly baseRef: string;
  readonly baseSha: GitSha;
  readonly branchName: string;
  readonly state: string;
  readonly fenceToken: string;
};

type CleanupEvidence = {
  readonly evidenceId: string;
  readonly leaseId: string;
  readonly repoId: string;
  readonly worktreePath: AbsolutePath;
  readonly branchName: string;
  readonly inspectedAt: string;
  readonly baseSha: GitSha;
  readonly headSha: GitSha;
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

export type FinalizeLeaseInput = {
  readonly leaseId: string;
  readonly evidenceId: string;
  readonly epoch: number;
  readonly fenceToken: string;
};

export type FinalizeLeaseSuccess = {
  readonly lease: CleanupLease;
  readonly evidence: CleanupEvidence;
  readonly appendIntents: readonly CleanupAppendIntent[];
};

export type FinalizeLeaseError =
  | {
      readonly token: 'lease-not-found';
      readonly leaseId: string;
    }
  | {
      readonly token: 'stale-lease-fence';
      readonly leaseId: string;
      readonly epoch: number;
    }
  | {
      readonly token: 'local-git-evidence-unavailable';
      readonly leaseId: string;
    };

export type FinalizeLeaseResult =
  | { readonly ok: true; readonly value: FinalizeLeaseSuccess }
  | { readonly ok: false; readonly error: FinalizeLeaseError };

export type CleanupRequest = {
  readonly leaseId: string;
  readonly epoch: number;
  readonly fenceToken: string;
  readonly deleteLocalBranch: boolean;
  readonly expectedHeadSha?: GitSha;
};

export type BranchDisposition =
  | { readonly kind: 'deleted'; readonly branchName: string; readonly deletedAt: string }
  | {
      readonly kind: 'retained';
      readonly branchName: string;
      readonly reason: 'requested' | 'head-mismatch' | 'checked-out';
    };

export type CleanupBlockedReason =
  | 'cleanup-not-finalized'
  | 'worktree-path-conflict'
  | 'worktree-registration-present'
  | 'dirty-worktree'
  | 'branch-head-mismatch'
  | 'branch-checked-out'
  | 'stale-lease-fence'
  | 'cleanup-io-failed';

export type CleanupObservedState = {
  readonly pathExists: boolean;
  readonly worktreeRegistrationPresent: boolean;
  readonly branchExists: boolean;
  readonly branchCheckedOut: boolean;
  readonly observedHeadSha?: GitSha;
  readonly dirtyPaths: readonly RelativePath[];
};

export type CurrentWorktreeStatus = {
  readonly stagedPaths: readonly RelativePath[];
  readonly unstagedPaths: readonly RelativePath[];
  readonly untrackedPaths: readonly RelativePath[];
};

export type CleanupBlockedError = {
  readonly token: 'cleanup-blocked' | 'stale-lease-fence' | 'dirty-worktree' | 'worktree-path-conflict';
  readonly lease: CleanupLease;
  readonly reason: CleanupBlockedReason;
  readonly observed: CleanupObservedState;
  readonly nextRetryAt: string;
  readonly operatorEscalationRequired: boolean;
  readonly appendIntents: readonly CleanupAppendIntent[];
};

export type CleanupSuccess = {
  readonly lease: CleanupLease;
  readonly branchDisposition: BranchDisposition;
  readonly cleanupTombstoneRef?: ArtifactRefId;
  readonly appendIntents: readonly CleanupAppendIntent[];
};

export type CleanupResult =
  | { readonly ok: true; readonly value: CleanupSuccess }
  | {
      readonly ok: false;
      readonly error:
        | {
            readonly token: 'lease-not-found';
            readonly leaseId: string;
          }
        | CleanupBlockedError;
    };

export type CleanupTombstoneWriterInput = {
  readonly lease: CleanupLease;
  readonly repository: RepositoryIdentity;
  readonly evidence?: CleanupEvidence;
  readonly branchDisposition: BranchDisposition;
  readonly expectedHeadSha?: GitSha;
  readonly cleanedAt: string;
};

export interface CleanupTombstoneWriter {
  writeCleanupTombstone(input: CleanupTombstoneWriterInput): ArtifactRefId | undefined;
}

export type CleanupGitDependencies = {
  readonly getWorktreeHeadSha?: (input: {
    readonly repository: RepositoryIdentity;
    readonly worktreePath: AbsolutePath;
    readonly branchName: string;
  }) => GitSha | undefined;
  readonly getCurrentWorktreeStatus?: (input: {
    readonly repository: RepositoryIdentity;
    readonly worktreePath: AbsolutePath;
    readonly branchName: string;
  }) => CurrentWorktreeStatus | undefined;
  readonly isWorktreePathOwnedByLease?: (input: {
    readonly repository: RepositoryIdentity;
    readonly worktreePath: AbsolutePath;
    readonly branchName: string;
  }) => boolean;
  readonly isWorktreeRegistrationPresent?: (input: {
    readonly repository: RepositoryIdentity;
    readonly worktreePath: AbsolutePath;
  }) => boolean;
  readonly pruneWorktreeRegistration?: (input: {
    readonly repository: RepositoryIdentity;
    readonly worktreePath: AbsolutePath;
  }) => boolean;
  readonly removeWorktreePath?: (input: {
    readonly repository: RepositoryIdentity;
    readonly worktreePath: AbsolutePath;
  }) => void;
  readonly getBranchHeadSha?: (input: {
    readonly repository: RepositoryIdentity;
    readonly branchName: string;
  }) => GitSha | undefined;
  readonly listBranchCheckoutPaths?: (input: {
    readonly repository: RepositoryIdentity;
    readonly branchName: string;
  }) => readonly AbsolutePath[];
  readonly deleteLocalBranch?: (input: {
    readonly repository: RepositoryIdentity;
    readonly branchName: string;
    readonly expectedHeadSha: GitSha;
  }) => void;
};

export type CleanupRuntimeDependencies = CleanupGitDependencies & {
  readonly now: () => string;
  readonly retryDelayMs: number;
  readonly writeCleanupTombstone?: CleanupTombstoneWriter['writeCleanupTombstone'];
};

export type CleanupLeaseRecord = {
  readonly lease: CleanupLease;
  readonly latestEvidence?: CleanupEvidence;
  readonly finalizedEvidence?: CleanupEvidence;
};

const addMs = (timestamp: string, deltaMs: number): string =>
  new globalThis.Date(new globalThis.Date(timestamp).getTime() + deltaMs).toISOString();

const uniqueSortedPaths = (paths: readonly RelativePath[]): readonly RelativePath[] =>
  [...new Set(paths)].sort((left, right) => left.localeCompare(right));

const toBlockedToken = (reason: CleanupBlockedReason): CleanupBlockedError['token'] => {
  if (reason === 'stale-lease-fence') {
    return 'stale-lease-fence';
  }

  if (reason === 'dirty-worktree') {
    return 'dirty-worktree';
  }

  if (reason === 'worktree-path-conflict') {
    return 'worktree-path-conflict';
  }

  return 'cleanup-blocked';
};

const requiresOperator = (reason: CleanupBlockedReason): boolean =>
  reason !== 'stale-lease-fence' && reason !== 'cleanup-io-failed' && reason !== 'cleanup-not-finalized';

const defaultPathExists = (worktreePath: AbsolutePath): boolean => existsSync(worktreePath);

const defaultRemovePath = (worktreePath: AbsolutePath): void => {
  rmSync(worktreePath, { recursive: true, force: true });
};

const buildObservedState = (input?: Partial<CleanupObservedState>): CleanupObservedState => ({
  pathExists: input?.pathExists ?? false,
  worktreeRegistrationPresent: input?.worktreeRegistrationPresent ?? false,
  branchExists: input?.branchExists ?? false,
  branchCheckedOut: input?.branchCheckedOut ?? false,
  observedHeadSha: input?.observedHeadSha,
  dirtyPaths: uniqueSortedPaths(input?.dirtyPaths ?? []),
});

export const createCleanupBlockedError = (input: {
  readonly lease: CleanupLease;
  readonly reason: CleanupBlockedReason;
  readonly observed?: Partial<CleanupObservedState>;
  readonly now: string;
  readonly retryDelayMs: number;
  readonly appendIntents: readonly CleanupAppendIntent[];
}): CleanupBlockedError => ({
  token: toBlockedToken(input.reason),
  lease: { ...input.lease, state: 'cleanup-blocked' },
  reason: input.reason,
  observed: buildObservedState(input.observed),
  nextRetryAt: addMs(input.now, input.retryDelayMs),
  operatorEscalationRequired: requiresOperator(input.reason),
  appendIntents: input.appendIntents,
});

export const finalizeLeaseRecord = (input: {
  readonly record: CleanupLeaseRecord;
  readonly repository: RepositoryIdentity;
  readonly request: FinalizeLeaseInput;
  readonly runtime: Pick<CleanupRuntimeDependencies, 'getWorktreeHeadSha'>;
}):
  | { readonly ok: true; readonly evidence: CleanupEvidence }
  | { readonly ok: false; readonly error: FinalizeLeaseError } => {
  const evidence = input.record.latestEvidence;

  if (evidence === undefined || evidence.evidenceId !== input.request.evidenceId) {
    return {
      ok: false,
      error: {
        token: 'local-git-evidence-unavailable',
        leaseId: input.record.lease.leaseId,
      },
    };
  }

  const observedHeadSha = input.runtime.getWorktreeHeadSha?.({
    repository: input.repository,
    worktreePath: input.record.lease.worktreePath,
    branchName: input.record.lease.branchName,
  });

  if (observedHeadSha === undefined || observedHeadSha !== evidence.headSha) {
    return {
      ok: false,
      error: {
        token: 'local-git-evidence-unavailable',
        leaseId: input.record.lease.leaseId,
      },
    };
  }

  return {
    ok: true,
    evidence,
  };
};

export const cleanupLeaseRecord = (input: {
  readonly record: CleanupLeaseRecord;
  readonly repository: RepositoryIdentity;
  readonly request: CleanupRequest;
  readonly runtime: CleanupRuntimeDependencies;
  readonly buildBlockedIntents: (input: {
    readonly lease: CleanupLease;
    readonly reason: CleanupBlockedReason;
    readonly observed: CleanupObservedState;
    readonly now: string;
    readonly nextRetryAt: string;
    readonly operatorEscalationRequired: boolean;
    readonly expectedHeadSha?: GitSha;
  }) => readonly CleanupAppendIntent[];
  readonly buildCompletedIntent: (input: {
    readonly lease: CleanupLease;
    readonly branchDisposition: BranchDisposition;
    readonly expectedHeadSha?: GitSha;
    readonly cleanupTombstoneRef?: ArtifactRefId;
    readonly cleanedAt: string;
  }) => CleanupAppendIntent;
}): CleanupResult => {
  const occurredAt = input.runtime.now();
  const nextRetryAt = addMs(occurredAt, input.runtime.retryDelayMs);

  if (input.record.lease.state !== 'finalized' || input.record.finalizedEvidence === undefined) {
    const observed = buildObservedState({
      pathExists: defaultPathExists(input.record.lease.worktreePath),
      worktreeRegistrationPresent:
        input.runtime.isWorktreeRegistrationPresent?.({
          repository: input.repository,
          worktreePath: input.record.lease.worktreePath,
        }) ?? false,
    });
    const appendIntents = input.buildBlockedIntents({
      lease: input.record.lease,
      reason: 'cleanup-not-finalized',
      observed,
      now: occurredAt,
      nextRetryAt,
      operatorEscalationRequired: requiresOperator('cleanup-not-finalized'),
      expectedHeadSha: input.request.expectedHeadSha,
    });
    return {
      ok: false,
      error: createCleanupBlockedError({
        lease: input.record.lease,
        reason: 'cleanup-not-finalized',
        observed,
        now: occurredAt,
        retryDelayMs: input.runtime.retryDelayMs,
        appendIntents,
      }),
    };
  }

  const evidence = input.record.finalizedEvidence;
  const pathExists = defaultPathExists(input.record.lease.worktreePath);
  const registrationPresentBeforePrune =
    input.runtime.isWorktreeRegistrationPresent?.({
      repository: input.repository,
      worktreePath: input.record.lease.worktreePath,
    }) ?? false;
  const currentWorktreeStatus = pathExists
    ? input.runtime.getCurrentWorktreeStatus?.({
        repository: input.repository,
        worktreePath: input.record.lease.worktreePath,
        branchName: input.record.lease.branchName,
      })
    : undefined;
  const dirtyPaths = uniqueSortedPaths(
    currentWorktreeStatus === undefined
      ? [...(evidence?.stagedPaths ?? []), ...(evidence?.unstagedPaths ?? []), ...(evidence?.untrackedPaths ?? [])]
      : [
          ...currentWorktreeStatus.stagedPaths,
          ...currentWorktreeStatus.unstagedPaths,
          ...currentWorktreeStatus.untrackedPaths,
        ],
  );

  if (dirtyPaths.length > 0) {
    const observed = buildObservedState({
      pathExists,
      worktreeRegistrationPresent: registrationPresentBeforePrune,
      dirtyPaths,
    });
    const appendIntents = input.buildBlockedIntents({
      lease: input.record.lease,
      reason: 'dirty-worktree',
      observed,
      now: occurredAt,
      nextRetryAt,
      operatorEscalationRequired: requiresOperator('dirty-worktree'),
      expectedHeadSha: input.request.expectedHeadSha,
    });
    return {
      ok: false,
      error: createCleanupBlockedError({
        lease: input.record.lease,
        reason: 'dirty-worktree',
        observed,
        now: occurredAt,
        retryDelayMs: input.runtime.retryDelayMs,
        appendIntents,
      }),
    };
  }

  if (
    pathExists &&
    !(
      input.runtime.isWorktreePathOwnedByLease?.({
        repository: input.repository,
        worktreePath: input.record.lease.worktreePath,
        branchName: input.record.lease.branchName,
      }) ?? true
    )
  ) {
    const observed = buildObservedState({
      pathExists: true,
      worktreeRegistrationPresent: registrationPresentBeforePrune,
    });
    const appendIntents = input.buildBlockedIntents({
      lease: input.record.lease,
      reason: 'worktree-path-conflict',
      observed,
      now: occurredAt,
      nextRetryAt,
      operatorEscalationRequired: requiresOperator('worktree-path-conflict'),
      expectedHeadSha: input.request.expectedHeadSha,
    });
    return {
      ok: false,
      error: createCleanupBlockedError({
        lease: input.record.lease,
        reason: 'worktree-path-conflict',
        observed,
        now: occurredAt,
        retryDelayMs: input.runtime.retryDelayMs,
        appendIntents,
      }),
    };
  }

  try {
    if (pathExists) {
      if (input.runtime.removeWorktreePath !== undefined) {
        input.runtime.removeWorktreePath({
          repository: input.repository,
          worktreePath: input.record.lease.worktreePath,
        });
      } else {
        defaultRemovePath(input.record.lease.worktreePath);
      }
    }
  } catch {
    const observed = buildObservedState({
      pathExists: true,
      worktreeRegistrationPresent: registrationPresentBeforePrune,
    });
    const appendIntents = input.buildBlockedIntents({
      lease: input.record.lease,
      reason: 'cleanup-io-failed',
      observed,
      now: occurredAt,
      nextRetryAt,
      operatorEscalationRequired: requiresOperator('cleanup-io-failed'),
      expectedHeadSha: input.request.expectedHeadSha,
    });
    return {
      ok: false,
      error: createCleanupBlockedError({
        lease: input.record.lease,
        reason: 'cleanup-io-failed',
        observed,
        now: occurredAt,
        retryDelayMs: input.runtime.retryDelayMs,
        appendIntents,
      }),
    };
  }

  const pruneSucceeded =
    input.runtime.pruneWorktreeRegistration?.({
      repository: input.repository,
      worktreePath: input.record.lease.worktreePath,
    }) ?? true;
  const registrationPresentAfterPrune =
    input.runtime.isWorktreeRegistrationPresent?.({
      repository: input.repository,
      worktreePath: input.record.lease.worktreePath,
    }) ?? false;

  if (!pruneSucceeded || registrationPresentAfterPrune) {
    const observed = buildObservedState({
      pathExists: defaultPathExists(input.record.lease.worktreePath),
      worktreeRegistrationPresent: registrationPresentAfterPrune,
    });
    const appendIntents = input.buildBlockedIntents({
      lease: input.record.lease,
      reason: 'worktree-registration-present',
      observed,
      now: occurredAt,
      nextRetryAt,
      operatorEscalationRequired: requiresOperator('worktree-registration-present'),
      expectedHeadSha: input.request.expectedHeadSha,
    });
    return {
      ok: false,
      error: createCleanupBlockedError({
        lease: input.record.lease,
        reason: 'worktree-registration-present',
        observed,
        now: occurredAt,
        retryDelayMs: input.runtime.retryDelayMs,
        appendIntents,
      }),
    };
  }

  let branchDisposition: BranchDisposition = {
    kind: 'retained',
    branchName: input.record.lease.branchName,
    reason: 'requested',
  };
  const branchHeadSha = input.runtime.getBranchHeadSha?.({
    repository: input.repository,
    branchName: input.record.lease.branchName,
  });

  if (input.request.deleteLocalBranch && input.request.expectedHeadSha !== undefined && branchHeadSha !== undefined) {
    if (branchHeadSha !== input.request.expectedHeadSha) {
      const observed = buildObservedState({
        branchExists: true,
        observedHeadSha: branchHeadSha,
      });
      const appendIntents = input.buildBlockedIntents({
        lease: input.record.lease,
        reason: 'branch-head-mismatch',
        observed,
        now: occurredAt,
        nextRetryAt,
        operatorEscalationRequired: requiresOperator('branch-head-mismatch'),
        expectedHeadSha: input.request.expectedHeadSha,
      });
      return {
        ok: false,
        error: createCleanupBlockedError({
          lease: input.record.lease,
          reason: 'branch-head-mismatch',
          observed,
          now: occurredAt,
          retryDelayMs: input.runtime.retryDelayMs,
          appendIntents,
        }),
      };
    }

    const checkedOutPaths =
      input.runtime.listBranchCheckoutPaths?.({
        repository: input.repository,
        branchName: input.record.lease.branchName,
      }) ?? [];

    if (checkedOutPaths.length > 0) {
      const observed = buildObservedState({
        branchExists: true,
        branchCheckedOut: true,
        observedHeadSha: branchHeadSha,
      });
      const appendIntents = input.buildBlockedIntents({
        lease: input.record.lease,
        reason: 'branch-checked-out',
        observed,
        now: occurredAt,
        nextRetryAt,
        operatorEscalationRequired: requiresOperator('branch-checked-out'),
        expectedHeadSha: input.request.expectedHeadSha,
      });
      return {
        ok: false,
        error: createCleanupBlockedError({
          lease: input.record.lease,
          reason: 'branch-checked-out',
          observed,
          now: occurredAt,
          retryDelayMs: input.runtime.retryDelayMs,
          appendIntents,
        }),
      };
    }

    try {
      input.runtime.deleteLocalBranch?.({
        repository: input.repository,
        branchName: input.record.lease.branchName,
        expectedHeadSha: input.request.expectedHeadSha,
      });
    } catch {
      const observed = buildObservedState({
        branchExists: true,
        observedHeadSha: branchHeadSha,
      });
      const appendIntents = input.buildBlockedIntents({
        lease: input.record.lease,
        reason: 'cleanup-io-failed',
        observed,
        now: occurredAt,
        nextRetryAt,
        operatorEscalationRequired: requiresOperator('cleanup-io-failed'),
        expectedHeadSha: input.request.expectedHeadSha,
      });
      return {
        ok: false,
        error: createCleanupBlockedError({
          lease: input.record.lease,
          reason: 'cleanup-io-failed',
          observed,
          now: occurredAt,
          retryDelayMs: input.runtime.retryDelayMs,
          appendIntents,
        }),
      };
    }

    branchDisposition = {
      kind: 'deleted',
      branchName: input.record.lease.branchName,
      deletedAt: occurredAt,
    };
  }

  try {
    const cleanupTombstoneRef = input.runtime.writeCleanupTombstone?.({
      lease: input.record.lease,
      repository: input.repository,
      evidence,
      branchDisposition,
      expectedHeadSha: input.request.expectedHeadSha,
      cleanedAt: occurredAt,
    });

    return {
      ok: true,
      value: {
        lease: {
          ...input.record.lease,
          state: 'cleaned',
        },
        branchDisposition,
        cleanupTombstoneRef,
        appendIntents: [
          input.buildCompletedIntent({
            lease: input.record.lease,
            branchDisposition,
            expectedHeadSha: input.request.expectedHeadSha,
            cleanupTombstoneRef,
            cleanedAt: occurredAt,
          }),
        ],
      },
    };
  } catch {
    const observed = buildObservedState({
      pathExists: false,
      worktreeRegistrationPresent: false,
      branchExists: branchHeadSha !== undefined,
      observedHeadSha: branchHeadSha,
    });
    const appendIntents = input.buildBlockedIntents({
      lease: input.record.lease,
      reason: 'cleanup-io-failed',
      observed,
      now: occurredAt,
      nextRetryAt,
      operatorEscalationRequired: requiresOperator('cleanup-io-failed'),
      expectedHeadSha: input.request.expectedHeadSha,
    });
    return {
      ok: false,
      error: createCleanupBlockedError({
        lease: input.record.lease,
        reason: 'cleanup-io-failed',
        observed,
        now: occurredAt,
        retryDelayMs: input.runtime.retryDelayMs,
        appendIntents,
      }),
    };
  }
};
