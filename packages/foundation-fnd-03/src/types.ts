import type { Result } from '@kit-vnext/foundation-fnd-01';
import type { ArtifactRef, StorageRoot } from '@kit-vnext/foundation-fnd-02';

export type AbsolutePath = string;
export type RelativePath = string;
export type LocalRef = string;

export type WorkspaceClock = {
  now(): Date;
};

export type WorkspaceIdGenerator = {
  nextId(purpose: string): string;
};

export type SetupFreshness =
  | {
      readonly kind: 'marker-file';
      readonly path: RelativePath;
      readonly contentHash?: string;
    }
  | {
      readonly kind: 'path-set';
      readonly paths: readonly RelativePath[];
    }
  | {
      readonly kind: 'artifact-ref';
      readonly refName: string;
    };

export type DeclaredSetup = {
  readonly command: string;
  readonly workingDirectory: RelativePath;
  readonly freshness: SetupFreshness;
  readonly rerunPolicy: 'on-fresh-worktree' | 'when-stale' | 'always';
};

export type BranchPolicy = {
  readonly prefix: string;
  readonly includeRunId: boolean;
  readonly includeTaskId: boolean;
  readonly maxLength: number;
};

export type RepositoryRegistration = {
  readonly repoId: string;
  readonly repoRoot: AbsolutePath;
  readonly defaultBaseRef: LocalRef;
  readonly setup?: DeclaredSetup;
  readonly branchPolicy?: BranchPolicy;
};

export type RepositoryIdentity = {
  readonly repoId: string;
  readonly repoRoot: AbsolutePath;
  readonly gitDir: AbsolutePath;
  readonly defaultBaseRef: LocalRef;
};

export type WorktreeLeaseState =
  | 'planned'
  | 'leased'
  | 'branch-created'
  | 'setup-required'
  | 'ready'
  | 'finalized'
  | 'cleanup-pending'
  | 'cleanup-blocked'
  | 'cleaned';

export type WorktreeLease = {
  readonly leaseId: string;
  readonly epoch: number;
  readonly runId: string;
  readonly taskId: string;
  readonly repoId: string;
  readonly worktreePath: AbsolutePath;
  readonly baseRef: LocalRef;
  readonly baseSha: string;
  readonly branchName: string;
  readonly worktreeGitDir: AbsolutePath;
  readonly state: WorktreeLeaseState;
  readonly fenceToken: string;
  readonly setup?: DeclaredSetup;
  readonly finalizedEvidenceId?: string;
  readonly finalizedHeadSha?: string;
};

export type SetupFreshnessReason =
  | 'new-worktree'
  | 'marker-missing'
  | 'marker-mismatch'
  | 'paths-missing'
  | 'artifact-stale'
  | 'setup-freshness-unknown';

export type SetupEvaluation = {
  readonly leaseId: string;
  readonly setup?: DeclaredSetup;
  readonly fresh: boolean;
  readonly reason?: SetupFreshnessReason;
  readonly inspectedAt: string;
};

export type LocalGitEvidenceCommit = {
  readonly sha: string;
  readonly parentShas: readonly string[];
  readonly subject: string;
  readonly authoredAt: {
    readonly epochSeconds: number;
    readonly timezoneOffset: number;
  };
};

export type LocalGitEvidenceWorkingTree = {
  readonly clean: boolean;
  readonly stagedPaths: readonly string[];
  readonly unstagedPaths: readonly string[];
  readonly untrackedPaths: readonly string[];
};

export type LocalGitEvidence = {
  readonly evidenceId: string;
  readonly leaseId: string;
  readonly repoId: string;
  readonly worktreePath: AbsolutePath;
  readonly branchName: string;
  readonly inspectedAt: string;
  readonly baseSha: string;
  readonly mergeBaseSha: string;
  readonly headSha: string;
  readonly localCommits: readonly LocalGitEvidenceCommit[];
  readonly diff: {
    readonly fromSha: string;
    readonly toSha: string;
    readonly changedPaths: readonly string[];
    readonly statRef?: ArtifactRef;
  };
  readonly workingTree: LocalGitEvidenceWorkingTree;
  readonly evidenceRef?: ArtifactRef;
};

export type CleanupRequest = {
  readonly leaseId: string;
  readonly epoch: number;
  readonly fenceToken: string;
  readonly deleteLocalBranch: boolean;
  readonly expectedHeadSha?: string;
};

export type CleanupTombstone = {
  readonly leaseId: string;
  readonly state: 'cleaned';
  readonly cleanedAt: string;
  readonly worktreePath: AbsolutePath;
  readonly branchName: string;
  readonly expectedHeadSha?: string;
  readonly observedHeadSha?: string;
  readonly branchDisposition: 'retained-current-branch' | 'retained-by-policy' | 'deleted' | 'already-absent';
  readonly artifactRef: ArtifactRef;
};

export type CleanupResult =
  | CleanupTombstone
  | {
      readonly leaseId: string;
      readonly state: 'cleanup-blocked';
      readonly reason: 'dirty-worktree' | 'head-mismatch' | 'cleanup-blocked';
      readonly observedPath: AbsolutePath;
      readonly observedHeadSha?: string;
      readonly nextRetryAt: string;
      readonly operatorEscalationRequired: boolean;
    };

export type WorkspaceFailureReason =
  | 'repository-unknown'
  | 'repository-unavailable'
  | 'base-ref-unresolved'
  | 'worktree-path-conflict'
  | 'branch-conflict'
  | 'setup-freshness-unknown'
  | 'local-git-evidence-unavailable'
  | 'dirty-worktree'
  | 'stale-lease-fence'
  | 'cleanup-blocked'
  | 'lease-unavailable'
  | 'evidence-unknown';

export type WorkspaceFailure = {
  readonly kind: 'workspace-failure';
  readonly reason: WorkspaceFailureReason;
  readonly message: string;
  readonly leaseId?: string;
  readonly partialEvidence?: never;
};

export type LocalGitEvidenceFailure = WorkspaceFailure & {
  readonly reason: 'local-git-evidence-unavailable';
};

export type WorkspaceRepositoryOptions = {
  readonly repositories: readonly RepositoryRegistration[];
  readonly worktreeRoot: AbsolutePath;
  readonly storage: StorageRoot;
  readonly clock: WorkspaceClock;
  readonly idGenerator: WorkspaceIdGenerator;
  readonly leaseTtlMs: number;
};

export type WorkspaceRepository = {
  resolveRepository(repoRoot: AbsolutePath): Promise<Result<RepositoryIdentity, WorkspaceFailure>>;
  createLease(input: {
    readonly runId: string;
    readonly taskId: string;
    readonly repoId: string;
    readonly baseRef?: LocalRef;
  }): Promise<Result<WorktreeLease, WorkspaceFailure>>;
  getLease(leaseId: string): Promise<Result<WorktreeLease, WorkspaceFailure>>;
  evaluateSetup(leaseId: string): Promise<Result<SetupEvaluation, WorkspaceFailure>>;
  confirmSetup(input: {
    readonly leaseId: string;
    readonly epoch: number;
    readonly fenceToken: string;
  }): Promise<Result<SetupEvaluation, WorkspaceFailure>>;
  recordLocalGitEvidence(leaseId: string): Promise<Result<LocalGitEvidence, LocalGitEvidenceFailure>>;
  finalizeLease(input: {
    readonly leaseId: string;
    readonly evidenceId: string;
    readonly epoch: number;
    readonly fenceToken: string;
  }): Promise<Result<WorktreeLease, WorkspaceFailure>>;
  cleanupLease(input: CleanupRequest): Promise<Result<CleanupResult, WorkspaceFailure>>;
  getCleanupTombstone(leaseId: string): CleanupTombstone | undefined;
};

export const isWorkspaceFailure = (value: unknown): value is WorkspaceFailure =>
  typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'workspace-failure';

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const fail = (failure: Omit<WorkspaceFailure, 'kind'>): Result<never, WorkspaceFailure> => ({
  ok: false,
  error: { kind: 'workspace-failure', ...failure },
});
