---
title: "fnd-03-s4-cleanup-settlement - cleanup settlement implementation story"
id: "fnd-03-s4-cleanup-settlement"
epic: 1
status: "story: ready"
design:
  - "docs/design/30-domain-reference/foundation/workspace-and-repository/README.md"
  - "docs/design/30-domain-reference/foundation/workspace-and-repository/events.md"
---

# fnd-03-s4-cleanup-settlement - Cleanup Settlement

## Purpose

Settle local worktree cleanup with tombstones, blocked cleanup records, and missing/moved worktree
handling without inferring remote merge state.

## Normative design

- `docs/design/30-domain-reference/foundation/workspace-and-repository/README.md`
- `docs/design/30-domain-reference/foundation/workspace-and-repository/events.md`
- `docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md`
- `docs/engineering/testing-policy.md`
- `docs/engineering/test-lanes.md`

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types: `WorkspaceRepository.finalizeLease`, `cleanupLease`, `CleanupRequest`,
  `CleanupResult`, `BranchDisposition`, `CleanupBlockedReason`, `CleanupObservedState`.
- Events / append intents: `WorktreeLeaseFinalized`, `WorktreeCleanupRetryScheduled`,
  `WorktreeCleanupCompleted`, `WorktreeCleanupBlocked`.
- Provider operations / commands: none.
- Failure and degraded tokens: `cleanup-blocked`, `stale-lease-fence`, `dirty-worktree`,
  `worktree-path-conflict`.
- Evidence records / attestations: cleanup tombstone ref, retry record, blocked cleanup record.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Finalize only after local evidence has been recorded for the current `headSha`.
- Fence finalize and cleanup by `leaseId`, `epoch`, and `fenceToken`.
- Remove leased worktree path, prune local worktree registration, and optionally delete local branch
  only when `expectedHeadSha` still matches finalized evidence.
- Tombstone missing or moved worktrees only after confirming registration is absent or pruned.
- Record blocked cleanup reasons, observed state, next retry time, and operator escalation flag.

## Out of scope

- Inferring remote merge state or deleting remote branches.
- Capturing local git evidence, owned by `fnd-03-s3-local-git-evidence`.
- Recovery policy above blocked cleanup records.
- Process killing, CI, Forge, credentials, or remote state.

## Dependencies and frozen inputs

- Covers signals: Cleanup tombstones, blocked cleanup records, and missing or moved worktree
  settlement.
- Depends on: `fnd-03-s2-worktree-setup`, `fnd-03-s3-local-git-evidence`,
  `fnd-02-s3-lease-store`, `fnd-02-s4-artifact-evidence`.
- Depended on by: later completion and recovery stories.
- Shared shapes consumed: `fnd-03-s2-worktree-setup/WorktreeLease`,
  `fnd-03-s3-local-git-evidence/LocalGitEvidence`, `fnd-02-s3-lease-store/LeaseCapability`,
  `fnd-02-s4-artifact-evidence/ArtifactRef`.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. Avoid "exactly as
specified."

- **AC-1** `finalizeLease` requires matching `leaseId`, `epoch`, `fenceToken`, and recorded evidence
  for current `headSha` - evidence: finalize fence test.
- **AC-2** `cleanupLease` removes the worktree path and prunes local registration before writing a
  durable cleanup tombstone - evidence: cleanup happy-path fixture.
- **AC-3** Local branch deletion occurs only when requested, branch head equals `expectedHeadSha`, and
  the branch is not checked out by any known worktree - evidence: branch disposition tests.
- **AC-4** Missing or moved worktree paths are settled by tombstone only after registration absence or
  pruning is confirmed - evidence: missing/moved fixture.
- **AC-5** When the cleanup path exists but is not owned by the lease, `cleanupLease` blocks with
  `CleanupBlockedReason` `worktree-path-conflict`, records `CleanupObservedState`, and leaves the
  lease unsettled - evidence: path-conflict blocked fixture.
- **AC-6** When the worktree registration is still present and cannot be confirmed absent or pruned,
  `cleanupLease` blocks with `CleanupBlockedReason` `worktree-registration-present`, records observed
  state, and does not tombstone - evidence: registration-present blocked fixture.
- **AC-7** When dirty paths remain during cleanup, `cleanupLease` blocks with `CleanupBlockedReason`
  `dirty-worktree`, records the dirty paths in observed state, and leaves the lease unsettled until
  operator disposition or new local evidence - evidence: dirty-path blocked fixture.
- **AC-8** When the branch head does not equal `expectedHeadSha`, `cleanupLease` blocks branch
  deletion with `CleanupBlockedReason` `branch-head-mismatch`, records observed `observedHeadSha`, and
  leaves the lease unsettled - evidence: head-mismatch blocked fixture.
- **AC-9** When the branch is checked out by a known worktree, `cleanupLease` blocks branch deletion
  with `CleanupBlockedReason` `branch-checked-out` and records observed state - evidence: checked-out
  blocked fixture.
- **AC-10** When the cleanup or finalize `fenceToken` does not match the durable lease, the protected
  state transition is rejected with `CleanupBlockedReason` `stale-lease-fence` and no path, branch, or
  tombstone write occurs - evidence: stale-fence blocked fixture.
- **AC-11** When a cleanup I/O operation fails, `cleanupLease` blocks with `CleanupBlockedReason`
  `cleanup-io-failed`, records observed state and retry/escalation data, and leaves the lease
  unsettled - evidence: io-failed blocked fixture.
- **AC-12** Cleanup never reads remote state or infers merge status - evidence: boundary sweep.

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| Finalize only after local evidence recorded for current `headSha` | AC-1 |
| Fence finalize and cleanup by `leaseId`, `epoch`, `fenceToken` | AC-1, AC-10 |
| Remove path, prune registration, optional branch delete on `expectedHeadSha` match | AC-2, AC-3 |
| Tombstone missing/moved worktrees only after registration absent or pruned | AC-4 |
| Record blocked reasons, observed state, next retry time, escalation flag | AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11 |
| Spec surface: `finalizeLease`, `cleanupLease`, `CleanupRequest`, `CleanupResult` | AC-1, AC-2 |
| Spec surface: `BranchDisposition` | AC-3 |
| Spec surface: `CleanupBlockedReason` members | AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11 |
| Spec surface: `CleanupObservedState` | AC-5, AC-6, AC-7, AC-8, AC-9, AC-11 |
| Spec surface: events `WorktreeLeaseFinalized`, `WorktreeCleanupCompleted`, `WorktreeCleanupBlocked`, `WorktreeCleanupRetryScheduled` | AC-1, AC-2, AC-5, AC-11 |
| Spec surface: failure token `cleanup-blocked` | AC-5, AC-6, AC-7, AC-8, AC-9, AC-11 |
| Spec surface: failure token `stale-lease-fence` | AC-10 |
| Spec surface: failure token `dirty-worktree` | AC-7 |
| Spec surface: failure token `worktree-path-conflict` | AC-5 |

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `cleanup-blocked` | Worktree, branch, or head SHA no longer matches finalized lease. | Record observed state, retry/escalation data, and leave lease unsettled. | AC-5, AC-6, AC-8, AC-9, AC-11 |
| `stale-lease-fence` | Cleanup or finalize fence token does not match durable lease. | Reject protected state transition. | AC-1, AC-10 |
| `dirty-worktree` | Dirty paths remain during cleanup. | Block cleanup until operator disposition or new local evidence. | AC-7 |
| `worktree-path-conflict` | Cleanup path exists but is not owned by the lease. | Block cleanup and record observed state. | AC-5 |

## Quality bar

- Coverage scope and threshold: cleanup/finalization modules at 90% minimum, aiming for 95%.
- Coverage command and instrumented lane(s): integration helper scope must be measured with `pnpm exec vitest run --project integration --coverage --passWithNoTests -- packages/sdk/tests/foundation/workspace-repository/cleanup/*.int.test.ts`; unit-only `pnpm coverage:baseline` is not sufficient for this story.
- Required tests, catalogued by AC and failure row: finalize fence, happy-path cleanup, branch
  disposition, missing/moved, blocked cleanup, and boundary sweep tests.
- Exact commands: `pnpm test:int -- packages/sdk/tests/foundation/workspace-repository/cleanup/*.int.test.ts`;
  `pnpm check`; coverage with `pnpm exec vitest run --project integration --coverage --passWithNoTests -- packages/sdk/tests/foundation/workspace-repository/cleanup/*.int.test.ts` for integration helper scope.
- Determinism constraints: retry times, timestamps, and fixture SHAs are injected.
- Dependency boundaries: no remote git, Forge, process execution, credentials, CI, review, or merge
  dependency.
- File-size or module-size constraints: finalize, cleanup, branch disposition, and blocked-record
  builders remain focused modules.
- Domain non-negotiables: cleanup is local-only and unsettled until tombstone records final state.

## Required reading

- `docs/design/30-domain-reference/foundation/workspace-and-repository/README.md`
- `docs/design/30-domain-reference/foundation/workspace-and-repository/events.md`
- `fnd-03-s2-worktree-setup`, `fnd-03-s3-local-git-evidence`, `fnd-02-s3-lease-store`, and
  `fnd-02-s4-artifact-evidence` story contracts

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The SDK cleanup/finalization modules and cleanup event payloads, plus the evidence pack.

## Evidence pack

- Test name or artifact proving each AC.
- Test name or artifact proving each failure/degraded outcome row.
- Negative fixture or equivalent failing assertion proving every rejection, degraded, or fail-closed
  claim named by an AC or failure row.
- `pnpm check` result, unless the gate is blocked by an unrelated repository issue that is named.
- Coverage command, instrumented lane(s), and number for the stated scope.
- Sweep-grep results proving cleanup has no remote, Forge, CI, credential, review, merge, or process
  dependency.

## Boundaries and STOP conditions

- Package or module boundary: `packages/sdk/src/foundation/workspace-repository/cleanup`.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/foundation/workspace-repository/cleanup/**`,
  `packages/sdk/tests/foundation/workspace-repository/cleanup/**`.
- Forbidden dependencies: no remote state, Forge, process, credential, CI, PR, review, or merge code.
- STOP when: cleanup requires knowing whether a remote branch/PR was merged, killing processes, or
  fetching hosted repository state.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 1 - stories](./README.md) · **← Prev:** [fnd-03-s3-local-git-evidence - local git evidence implementation story](./fnd-03-s3-local-git-evidence.md) · **Next →:** [fnd-04-s1-credential-refs - credential refs implementation story](./fnd-04-s1-credential-refs.md)

<!-- /DOCS-NAV -->
