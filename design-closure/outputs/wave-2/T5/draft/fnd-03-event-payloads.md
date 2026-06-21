# Draft fnd-03 event payloads

Status: proposal draft only. Do not apply directly without architect review.

Sources:
- `docs/design/30-domain-reference/foundation/workspace-and-repository/README.md` sections 4-6 and 8-10 define fnd-03 worktree, setup, evidence, cleanup, events, failure modes, and open questions.
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md` sections 4-6 and `contracts.md` define the core-01 event envelope and append intent shape.
- `docs/design/30-domain-reference/core/completion-and-merge/README.md` sections 4-6 and `evidence-model-and-predicates.md` define core-05 consumption of `LocalGitEvidenceRecorded`.
- `docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md` sections 4-6 define fnd-02 lease capabilities, snapshots, and artifact ids.

## Event names

These payloads cover every event listed by fnd-03 section 6:

- `WorktreeLeaseCreated`
- `LocalBranchCreated`
- `RepoSetupEvaluated`
- `RepoSetupConfirmed`
- `LocalGitEvidenceRecorded`
- `WorktreeLeaseFinalized`
- `WorktreeCleanupRetryScheduled`
- `WorktreeCleanupCompleted`
- `WorktreeCleanupBlocked`

## Shared aliases

```ts
type AbsolutePath = string;
type RelativePath = string;
type LocalRef = string;
type GitSha = string;
type Iso8601Timestamp = string;
type ArtifactRefId = string;

type WorktreeLeaseState =
  | "planned"
  | "leased"
  | "branch-created"
  | "setup-required"
  | "ready"
  | "finalized"
  | "cleanup-pending"
  | "cleanup-blocked"
  | "cleaned";

type SetupFreshnessReason =
  | "new-worktree"
  | "marker-missing"
  | "marker-mismatch"
  | "paths-missing"
  | "artifact-stale"
  | "setup-freshness-unknown";

type DeclaredSetup = {
  command: string;
  workingDirectory: RelativePath;
  freshness:
    | { kind: "marker-file"; path: RelativePath; contentHash?: string }
    | { kind: "path-set"; paths: RelativePath[] }
    | { kind: "artifact-ref"; refName: string };
  rerunPolicy: "on-fresh-worktree" | "when-stale" | "always";
};

type LocalCommitSummary = {
  sha: GitSha;
  parentShas: GitSha[];
  subject: string;
  authoredAt: Iso8601Timestamp;
};

type BranchDisposition =
  | { kind: "deleted"; branchName: string; deletedAt: Iso8601Timestamp }
  | { kind: "retained"; branchName: string; reason: "requested" | "head-mismatch" | "checked-out" };

type CleanupBlockedReason =
  | "worktree-path-conflict"
  | "worktree-registration-present"
  | "dirty-worktree"
  | "branch-head-mismatch"
  | "branch-checked-out"
  | "stale-lease-fence"
  | "cleanup-io-failed";

type CleanupObservedState = {
  pathExists: boolean;
  worktreeRegistrationPresent: boolean;
  branchExists: boolean;
  branchCheckedOut: boolean;
  observedHeadSha?: GitSha;
  dirtyPaths: RelativePath[];
};
```

## Payloads

`fenceToken` is intentionally not present in any durable event payload. Fnd-03 returns it in the in-process `WorktreeLease` handle, but fnd-02 says token secrets are returned only in `LeaseCapability`; persisted snapshots expose only token digests.

```ts
type WorktreeLeaseCreatedPayload = {
  leaseId: string;
  epoch: number;
  runId: string;
  taskId: string;
  repoId: string;
  worktreePath: AbsolutePath;
  baseRef: LocalRef;
  baseSha: GitSha;
  state: "leased";
  leaseRecordDigest?: string;
};

type LocalBranchCreatedPayload = {
  leaseId: string;
  epoch: number;
  runId: string;
  taskId: string;
  repoId: string;
  worktreePath: AbsolutePath;
  branchName: string;
  baseSha: GitSha;
  state: "branch-created";
};

type RepoSetupEvaluatedPayload = {
  leaseId: string;
  epoch: number;
  repoId: string;
  worktreePath: AbsolutePath;
  setup: DeclaredSetup;
  evaluatedAt: Iso8601Timestamp;
  fresh: boolean;
  reason: SetupFreshnessReason;
  resultingState: "setup-required" | "ready";
};

type RepoSetupConfirmedPayload = {
  leaseId: string;
  epoch: number;
  repoId: string;
  worktreePath: AbsolutePath;
  setup: DeclaredSetup;
  confirmedAt: Iso8601Timestamp;
  fresh: boolean;
  reason: SetupFreshnessReason;
  resultingState: "setup-required" | "ready";
};

type LocalGitEvidenceRecordedPayload = {
  evidenceId: string;
  leaseId: string;
  repoId: string;
  worktreePath: AbsolutePath;
  branchName: string;
  inspectedAt: Iso8601Timestamp;

  baseSha: GitSha;
  mergeBaseSha: GitSha;
  headSha: GitSha;

  localCommits: LocalCommitSummary[];

  fromSha: GitSha;
  toSha: GitSha;
  changedPaths: RelativePath[];
  statRef?: ArtifactRefId;
  patchRef?: ArtifactRefId;

  clean: boolean;
  stagedPaths: RelativePath[];
  unstagedPaths: RelativePath[];
  untrackedPaths: RelativePath[];
};

type WorktreeLeaseFinalizedPayload = {
  leaseId: string;
  epoch: number;
  runId: string;
  repoId: string;
  worktreePath: AbsolutePath;
  branchName: string;
  evidenceId: string;
  headSha: GitSha;
  finalizedAt: Iso8601Timestamp;
  state: "finalized";
};

type WorktreeCleanupRetryScheduledPayload = {
  leaseId: string;
  epoch: number;
  repoId: string;
  worktreePath: AbsolutePath;
  branchName?: string;
  expectedHeadSha?: GitSha;
  reason: CleanupBlockedReason;
  observed: CleanupObservedState;
  nextRetryAt: Iso8601Timestamp;
  operatorEscalationRequired: boolean;
  state: "cleanup-blocked";
};

type WorktreeCleanupCompletedPayload = {
  leaseId: string;
  epoch: number;
  repoId: string;
  worktreePath: AbsolutePath;
  branchName?: string;
  expectedHeadSha?: GitSha;
  pathRemoved: true;
  worktreeRegistrationPresent: false;
  branchDisposition: BranchDisposition;
  cleanupTombstoneRef?: ArtifactRefId;
  cleanedAt: Iso8601Timestamp;
  state: "cleaned";
};

type WorktreeCleanupBlockedPayload = {
  leaseId: string;
  epoch: number;
  repoId: string;
  worktreePath: AbsolutePath;
  branchName?: string;
  expectedHeadSha?: GitSha;
  reason: CleanupBlockedReason;
  observed: CleanupObservedState;
  operatorEscalationRequired: boolean;
  blockedAt: Iso8601Timestamp;
  state: "cleanup-blocked";
};
```

## Core-05 consumption check

`LocalGitEvidenceRecordedPayload` intentionally keeps `headSha`, `changedPaths`, and `clean` as top-level fields. Core-05 cites `LocalGitEvidence.headSha`, `LocalGitEvidence.changedPaths`, and clean post-verify worktree evidence as the fields it needs for candidate-head selection, changed-file classification, and fail-closed dirty-worktree handling.

The rest of the payload is fnd-03 owned local-git evidence: identity, commit refs, local commit summaries, diff artifact refs, and staged/unstaged/untracked paths. It does not include remote refs, remote URLs, credentials, CI, review, merge state, or worker prose.

## Suggested envelope usage

Each record is appended as a core-01 `AppendIntent` with:

```ts
{
  domain: "fnd-03",
  type: "<one of the event names above>",
  durability: "durable",
  payload: /* payload type above */,
  occurredAt: "<producer observation time>"
}
```

If a fnd-03 event is batched with a lifecycle transition, core-01 may normalize the batch to `barrier` durability. That changes the committed envelope durability, not the fnd-03 payload shape.
