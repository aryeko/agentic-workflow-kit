import type { AbsolutePath, GitSha, RepositoryIdentity } from '../repository/index.js';
import {
  type BranchDisposition,
  type CleanupBlockedReason,
  type CleanupLeaseRecord,
  cleanupLeaseRecord,
  finalizeLeaseRecord,
  type CleanupRequest,
  type CleanupResult,
  type CleanupRuntimeDependencies,
  type FinalizeLeaseInput,
  type FinalizeLeaseResult,
} from './index.js';

type SettlementLease = {
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

type CleanupObserved = {
  readonly pathExists: boolean;
  readonly worktreeRegistrationPresent: boolean;
  readonly branchExists: boolean;
  readonly branchCheckedOut: boolean;
  readonly dirtyPaths: readonly string[];
};

type AppendIntent = {
  readonly domain: 'fnd-03';
  readonly type: string;
  readonly occurredAt: string;
  readonly payload: unknown;
  readonly durability: 'durable' | 'barrier';
  readonly correlationId?: string;
};

type CleanupBlockedIntentFactory = (input: {
  readonly lease: {
    readonly leaseId: string;
    readonly epoch: number;
    readonly repoId: string;
    readonly worktreePath: AbsolutePath;
    readonly branchName: string;
  };
  readonly reason: CleanupBlockedReason;
  readonly observed: CleanupObserved;
  readonly now: string;
  readonly nextRetryAt: string;
  readonly operatorEscalationRequired: boolean;
  readonly expectedHeadSha?: GitSha;
}) => readonly AppendIntent[];

export const createCleanupBlockedIntents = (input: {
  readonly lease: {
    readonly leaseId: string;
    readonly epoch: number;
    readonly repoId: string;
    readonly worktreePath: AbsolutePath;
    readonly branchName: string;
  };
  readonly reason: CleanupBlockedReason;
  readonly observed: CleanupObserved;
  readonly now: string;
  readonly nextRetryAt: string;
  readonly operatorEscalationRequired: boolean;
  readonly expectedHeadSha?: GitSha;
  readonly createRetryScheduledIntent: (input: {
    readonly leaseId: string;
    readonly epoch: number;
    readonly repoId: string;
    readonly worktreePath: AbsolutePath;
    readonly branchName: string;
    readonly expectedHeadSha?: GitSha;
    readonly reason: CleanupBlockedReason;
    readonly observed: CleanupObserved;
    readonly nextRetryAt: string;
    readonly operatorEscalationRequired: boolean;
  }) => AppendIntent;
  readonly createBlockedIntent: (input: {
    readonly leaseId: string;
    readonly epoch: number;
    readonly repoId: string;
    readonly worktreePath: AbsolutePath;
    readonly branchName: string;
    readonly expectedHeadSha?: GitSha;
    readonly reason: CleanupBlockedReason;
    readonly observed: CleanupObserved;
    readonly operatorEscalationRequired: boolean;
    readonly blockedAt: string;
  }) => AppendIntent;
}): readonly AppendIntent[] => [
  input.createRetryScheduledIntent({
    leaseId: input.lease.leaseId,
    epoch: input.lease.epoch,
    repoId: input.lease.repoId,
    worktreePath: input.lease.worktreePath,
    branchName: input.lease.branchName,
    expectedHeadSha: input.expectedHeadSha,
    reason: input.reason,
    observed: input.observed,
    nextRetryAt: input.nextRetryAt,
    operatorEscalationRequired: input.operatorEscalationRequired,
  }),
  input.createBlockedIntent({
    leaseId: input.lease.leaseId,
    epoch: input.lease.epoch,
    repoId: input.lease.repoId,
    worktreePath: input.lease.worktreePath,
    branchName: input.lease.branchName,
    expectedHeadSha: input.expectedHeadSha,
    reason: input.reason,
    observed: input.observed,
    operatorEscalationRequired: input.operatorEscalationRequired,
    blockedAt: input.now,
  }),
];

type FinalizeHandlerDependencies<
  TLease extends SettlementLease,
  TRecord extends CleanupLeaseRecord & { readonly lease: TLease },
> = {
  readonly getRecord: (leaseId: string) => TRecord | undefined;
  readonly persistRecord: (record: TRecord) => void;
  readonly repository: RepositoryIdentity;
  readonly runtime: CleanupRuntimeDependencies;
  readonly now: () => string;
  readonly leaseStoreFence: (leaseId: string, epoch: number, token: string) => boolean;
  readonly updateLeaseState: (lease: TLease, state: TLease['state']) => TLease;
  readonly createFinalizedIntent: (input: {
    readonly lease: TLease;
    readonly evidenceId: string;
    readonly headSha: GitSha;
    readonly occurredAt: string;
  }) => AppendIntent;
};

type CleanupHandlerDependencies<
  TLease extends SettlementLease,
  TRecord extends CleanupLeaseRecord & { readonly lease: TLease },
> = {
  readonly getRecord: (leaseId: string) => TRecord | undefined;
  readonly persistRecord: (record: TRecord) => void;
  readonly repository: RepositoryIdentity;
  readonly runtime: CleanupRuntimeDependencies;
  readonly now: () => string;
  readonly leaseStoreFence: (leaseId: string, epoch: number, token: string) => boolean;
  readonly retryDelayMs: number;
  readonly updateLeaseState: (lease: TLease, state: TLease['state']) => TLease;
  readonly createCleanupBlockedIntents: CleanupBlockedIntentFactory;
  readonly createCleanupCompletedIntent: (input: {
    readonly lease: TLease;
    readonly branchDisposition: BranchDisposition;
    readonly expectedHeadSha?: GitSha;
    readonly cleanupTombstoneRef?: string;
    readonly cleanedAt: string;
  }) => AppendIntent;
};

const addMs = (timestamp: string, deltaMs: number): string =>
  new globalThis.Date(new globalThis.Date(timestamp).getTime() + deltaMs).toISOString();

export const createFinalizeLeaseHandler = <
  TLease extends SettlementLease,
  TRecord extends CleanupLeaseRecord & { readonly lease: TLease },
>(
  dependencies: FinalizeHandlerDependencies<TLease, TRecord>,
) => {
  return (input: FinalizeLeaseInput): FinalizeLeaseResult => {
    const record = dependencies.getRecord(input.leaseId);

    if (record === undefined) {
      return {
        ok: false,
        error: {
          token: 'lease-not-found',
          leaseId: input.leaseId,
        },
      };
    }

    if (!dependencies.leaseStoreFence(input.leaseId, input.epoch, input.fenceToken)) {
      return {
        ok: false,
        error: {
          token: 'stale-lease-fence',
          leaseId: input.leaseId,
          epoch: input.epoch,
        },
      };
    }

    const finalized = finalizeLeaseRecord({
      record,
      repository: dependencies.repository,
      request: input,
      runtime: dependencies.runtime,
    });

    if (!finalized.ok) {
      return finalized;
    }

    const occurredAt = dependencies.now();
    const lease = dependencies.updateLeaseState(record.lease as TLease, 'finalized' as TLease['state']);
    dependencies.persistRecord({
      ...record,
      lease,
      finalizedEvidence: finalized.evidence,
    });

    return {
      ok: true,
      value: {
        lease,
        evidence: finalized.evidence,
        appendIntents: [
          dependencies.createFinalizedIntent({
            lease,
            evidenceId: finalized.evidence.evidenceId,
            headSha: finalized.evidence.headSha,
            occurredAt,
          }),
        ],
      },
    };
  };
};

export const createCleanupLeaseHandler = <
  TLease extends SettlementLease,
  TRecord extends CleanupLeaseRecord & { readonly lease: TLease },
>(
  dependencies: CleanupHandlerDependencies<TLease, TRecord>,
) => {
  return (input: CleanupRequest): CleanupResult => {
    const record = dependencies.getRecord(input.leaseId);

    if (record === undefined) {
      return {
        ok: false,
        error: {
          token: 'lease-not-found',
          leaseId: input.leaseId,
        },
      };
    }

    if (!dependencies.leaseStoreFence(input.leaseId, input.epoch, input.fenceToken)) {
      const occurredAt = dependencies.now();
      const nextRetryAt = addMs(occurredAt, dependencies.retryDelayMs);
      const observed = {
        pathExists: false,
        worktreeRegistrationPresent: false,
        branchExists: false,
        branchCheckedOut: false,
        dirtyPaths: [],
      } as const;
      const appendIntents = dependencies.createCleanupBlockedIntents({
        lease: record.lease,
        reason: 'stale-lease-fence',
        observed,
        now: occurredAt,
        nextRetryAt,
        operatorEscalationRequired: false,
        expectedHeadSha: input.expectedHeadSha,
      });

      return {
        ok: false,
        error: {
          token: 'stale-lease-fence',
          lease: dependencies.updateLeaseState(record.lease as TLease, 'cleanup-blocked' as TLease['state']),
          reason: 'stale-lease-fence',
          observed,
          nextRetryAt,
          operatorEscalationRequired: false,
          appendIntents,
        },
      };
    }

    if (record.lease.state !== 'finalized' || record.finalizedEvidence === undefined) {
      const occurredAt = dependencies.now();
      const nextRetryAt = addMs(occurredAt, dependencies.retryDelayMs);
      const observed = {
        pathExists: false,
        worktreeRegistrationPresent: false,
        branchExists: false,
        branchCheckedOut: false,
        dirtyPaths: [],
      } as const;
      const appendIntents = dependencies.createCleanupBlockedIntents({
        lease: record.lease,
        reason: 'cleanup-not-finalized',
        observed,
        now: occurredAt,
        nextRetryAt,
        operatorEscalationRequired: false,
        expectedHeadSha: input.expectedHeadSha,
      });

      return {
        ok: false,
        error: {
          token: 'cleanup-blocked',
          lease: dependencies.updateLeaseState(record.lease as TLease, 'cleanup-blocked' as TLease['state']),
          reason: 'cleanup-not-finalized',
          observed,
          nextRetryAt,
          operatorEscalationRequired: false,
          appendIntents,
        },
      };
    }

    const cleanupResult = cleanupLeaseRecord({
      record,
      repository: dependencies.repository,
      request: input,
      runtime: dependencies.runtime,
      buildBlockedIntents: dependencies.createCleanupBlockedIntents,
      buildCompletedIntent: ({ lease, branchDisposition, expectedHeadSha, cleanupTombstoneRef, cleanedAt }) =>
        dependencies.createCleanupCompletedIntent({
          lease: lease as TLease,
          branchDisposition,
          expectedHeadSha,
          cleanupTombstoneRef,
          cleanedAt,
        }),
    });

    if (!cleanupResult.ok) {
      if ('lease' in cleanupResult.error) {
        dependencies.persistRecord({
          ...record,
          lease: cleanupResult.error.lease,
        });
      }
      return cleanupResult;
    }

    dependencies.persistRecord({
      ...record,
      lease: cleanupResult.value.lease,
    });

    return cleanupResult;
  };
};
