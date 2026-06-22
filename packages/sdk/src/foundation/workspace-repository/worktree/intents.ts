import type { AbsolutePath, GitSha, RelativePath } from '../repository/index.js';
import type { DeclaredSetup, SetupFreshnessReason } from '../setup/index.js';

type AppendIntentBase<TType extends string, TPayload> = {
  readonly domain: 'fnd-03';
  readonly type: TType;
  readonly occurredAt: string;
  readonly payload: TPayload;
  readonly durability: 'durable' | 'barrier';
  readonly correlationId?: string;
};

export type WorktreeLeaseCreatedPayload = {
  readonly leaseId: string;
  readonly epoch: number;
  readonly runId: string;
  readonly taskId: string;
  readonly repoId: string;
  readonly worktreePath: AbsolutePath;
  readonly baseRef: string;
  readonly baseSha: GitSha;
  readonly state: 'leased';
};

export type LocalBranchCreatedPayload = {
  readonly leaseId: string;
  readonly epoch: number;
  readonly runId: string;
  readonly taskId: string;
  readonly repoId: string;
  readonly worktreePath: AbsolutePath;
  readonly branchName: string;
  readonly baseSha: GitSha;
  readonly state: 'branch-created';
};

export type RepoSetupEvaluatedPayload = {
  readonly leaseId: string;
  readonly epoch: number;
  readonly repoId: string;
  readonly worktreePath: AbsolutePath;
  readonly setup: DeclaredSetup;
  readonly evaluatedAt: string;
  readonly fresh: boolean;
  readonly reason: SetupFreshnessReason;
  readonly resultingState: 'setup-required' | 'ready';
};

export type RepoSetupConfirmedPayload = {
  readonly leaseId: string;
  readonly epoch: number;
  readonly repoId: string;
  readonly worktreePath: AbsolutePath;
  readonly setup: DeclaredSetup;
  readonly confirmedAt: string;
  readonly fresh: boolean;
  readonly reason: SetupFreshnessReason;
  readonly resultingState: 'setup-required' | 'ready';
};

export type LocalCommitSummary = {
  readonly sha: GitSha;
  readonly parentShas: readonly GitSha[];
  readonly subject: string;
  readonly authoredAt: string;
};

export type LocalGitEvidenceRecordedPayload = {
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
  readonly statRef?: string;
  readonly patchRef?: string;
  readonly clean: boolean;
  readonly stagedPaths: readonly RelativePath[];
  readonly unstagedPaths: readonly RelativePath[];
  readonly untrackedPaths: readonly RelativePath[];
};

export type WorktreeLeaseCreatedIntent = AppendIntentBase<'WorktreeLeaseCreated', WorktreeLeaseCreatedPayload>;
export type LocalBranchCreatedIntent = AppendIntentBase<'LocalBranchCreated', LocalBranchCreatedPayload>;
export type RepoSetupEvaluatedIntent = AppendIntentBase<'RepoSetupEvaluated', RepoSetupEvaluatedPayload>;
export type RepoSetupConfirmedIntent = AppendIntentBase<'RepoSetupConfirmed', RepoSetupConfirmedPayload>;
export type LocalGitEvidenceRecordedIntent = AppendIntentBase<
  'LocalGitEvidenceRecorded',
  LocalGitEvidenceRecordedPayload
>;

export type WorkspaceRepositoryAppendIntent =
  | WorktreeLeaseCreatedIntent
  | LocalBranchCreatedIntent
  | RepoSetupEvaluatedIntent
  | RepoSetupConfirmedIntent
  | LocalGitEvidenceRecordedIntent;

const withEnvelope = <TType extends WorkspaceRepositoryAppendIntent['type'], TPayload>(
  type: TType,
  payload: TPayload,
  occurredAt: string,
  correlationId?: string,
): AppendIntentBase<TType, TPayload> => ({
  domain: 'fnd-03',
  type,
  occurredAt,
  payload,
  durability: 'durable',
  correlationId,
});

export const createWorktreeLeaseCreatedIntent = (
  payload: WorktreeLeaseCreatedPayload,
  occurredAt: string,
  correlationId?: string,
): WorktreeLeaseCreatedIntent => withEnvelope('WorktreeLeaseCreated', payload, occurredAt, correlationId);

export const createLocalBranchCreatedIntent = (
  payload: LocalBranchCreatedPayload,
  occurredAt: string,
  correlationId?: string,
): LocalBranchCreatedIntent => withEnvelope('LocalBranchCreated', payload, occurredAt, correlationId);

export const createRepoSetupEvaluatedIntent = (
  payload: RepoSetupEvaluatedPayload,
  occurredAt: string,
  correlationId?: string,
): RepoSetupEvaluatedIntent => withEnvelope('RepoSetupEvaluated', payload, occurredAt, correlationId);

export const createRepoSetupConfirmedIntent = (
  payload: RepoSetupConfirmedPayload,
  occurredAt: string,
  correlationId?: string,
): RepoSetupConfirmedIntent => withEnvelope('RepoSetupConfirmed', payload, occurredAt, correlationId);

export const createLocalGitEvidenceRecordedIntent = (
  payload: LocalGitEvidenceRecordedPayload,
  occurredAt: string,
  correlationId?: string,
): LocalGitEvidenceRecordedIntent => withEnvelope('LocalGitEvidenceRecorded', payload, occurredAt, correlationId);
