import type { RepositoryIdentity } from '../repository/index.js';
import type {
  ArtifactRefId,
  LocalCommitSummary,
  LocalGitEvidence,
  LocalGitEvidenceRecorder,
  LocalGitEvidenceRecorderInput,
  LocalGitEvidenceRecorderResult,
  WorktreeLease,
} from '../worktree/index.js';

export type LocalGitEvidenceUnavailableReason =
  | 'branch-missing'
  | 'merge-base-unavailable'
  | 'status-unavailable'
  | 'diff-unavailable';

export type LocalGitWorkingTreeState = {
  readonly stagedPaths: readonly string[];
  readonly unstagedPaths: readonly string[];
  readonly untrackedPaths: readonly string[];
};

export type LocalGitDiffSnapshot = {
  readonly fromSha: string;
  readonly toSha: string;
  readonly changedPaths: readonly string[];
  readonly statContent?: string;
  readonly patchContent?: string;
};

export type LocalGitEvidenceSnapshot = {
  readonly headSha: string;
  readonly mergeBaseSha: string;
  readonly localCommits: readonly LocalCommitSummary[];
  readonly diff: LocalGitDiffSnapshot;
  readonly workingTree: LocalGitWorkingTreeState;
};

export type LocalGitEvidenceInspectorResult =
  | { readonly ok: true; readonly value: LocalGitEvidenceSnapshot }
  | { readonly ok: false; readonly reason: LocalGitEvidenceUnavailableReason };

export type LocalGitEvidenceInspectorInput = {
  readonly lease: WorktreeLease;
  readonly repository: RepositoryIdentity;
};

export interface LocalGitEvidenceInspector {
  inspect(input: LocalGitEvidenceInspectorInput): LocalGitEvidenceInspectorResult;
}

export type LocalGitEvidenceArtifactKind = 'stat' | 'patch';

export type LocalGitEvidenceArtifactInput = {
  readonly kind: LocalGitEvidenceArtifactKind;
  readonly content: string;
  readonly lease: WorktreeLease;
  readonly repository: RepositoryIdentity;
};

export interface LocalGitEvidenceArtifactRecorder {
  record(input: LocalGitEvidenceArtifactInput): ArtifactRefId | undefined;
}

export type CreateLocalGitEvidenceRecorderOptions = {
  readonly now: () => string;
  readonly inspector: LocalGitEvidenceInspector;
  readonly artifactRecorder?: LocalGitEvidenceArtifactRecorder;
  readonly createEvidenceId?: (input: {
    readonly lease: WorktreeLease;
    readonly repository: RepositoryIdentity;
    readonly inspectedAt: string;
    readonly headSha: string;
  }) => string;
};

const createDefaultEvidenceId = (input: {
  readonly lease: WorktreeLease;
  readonly inspectedAt: string;
  readonly headSha: string;
}): string => `local-git-evidence:${input.lease.leaseId}:${input.headSha}:${input.inspectedAt}`;

const uniqueSortedPaths = (paths: readonly string[]): readonly string[] =>
  [...new Set(paths)].sort((left, right) => left.localeCompare(right));

const toLocalGitEvidence = (
  input: LocalGitEvidenceRecorderInput,
  snapshot: LocalGitEvidenceSnapshot,
  inspectedAt: string,
  artifactRecorder?: LocalGitEvidenceArtifactRecorder,
  createEvidenceId: CreateLocalGitEvidenceRecorderOptions['createEvidenceId'] = createDefaultEvidenceId,
): LocalGitEvidence => {
  const stagedPaths = uniqueSortedPaths(snapshot.workingTree.stagedPaths);
  const unstagedPaths = uniqueSortedPaths(snapshot.workingTree.unstagedPaths);
  const untrackedPaths = uniqueSortedPaths(snapshot.workingTree.untrackedPaths);
  const changedPaths = uniqueSortedPaths(snapshot.diff.changedPaths);
  const statRef =
    snapshot.diff.statContent === undefined
      ? undefined
      : artifactRecorder?.record({
          kind: 'stat',
          content: snapshot.diff.statContent,
          lease: input.lease,
          repository: input.repository,
        });
  const patchRef =
    snapshot.diff.patchContent === undefined
      ? undefined
      : artifactRecorder?.record({
          kind: 'patch',
          content: snapshot.diff.patchContent,
          lease: input.lease,
          repository: input.repository,
        });

  return {
    evidenceId:
      createEvidenceId({
        lease: input.lease,
        repository: input.repository,
        inspectedAt,
        headSha: snapshot.headSha,
      }) ?? createDefaultEvidenceId({ lease: input.lease, inspectedAt, headSha: snapshot.headSha }),
    leaseId: input.lease.leaseId,
    repoId: input.repository.repoId,
    worktreePath: input.lease.worktreePath,
    branchName: input.lease.branchName,
    inspectedAt,
    baseSha: input.lease.baseSha,
    mergeBaseSha: snapshot.mergeBaseSha,
    headSha: snapshot.headSha,
    localCommits: snapshot.localCommits,
    fromSha: snapshot.diff.fromSha,
    toSha: snapshot.diff.toSha,
    changedPaths,
    statRef,
    patchRef,
    clean: stagedPaths.length === 0 && unstagedPaths.length === 0 && untrackedPaths.length === 0,
    stagedPaths,
    unstagedPaths,
    untrackedPaths,
  };
};

export const createLocalGitEvidenceRecorder = (
  options: CreateLocalGitEvidenceRecorderOptions,
): LocalGitEvidenceRecorder => ({
  record(input): LocalGitEvidenceRecorderResult {
    const inspected = options.inspector.inspect(input);

    if (!inspected.ok) {
      return {
        ok: false,
        error: {
          token: 'local-git-evidence-unavailable',
          leaseId: input.lease.leaseId,
        },
      };
    }

    return {
      ok: true,
      value: toLocalGitEvidence(
        input,
        inspected.value,
        options.now(),
        options.artifactRecorder,
        options.createEvidenceId,
      ),
    };
  },
});
