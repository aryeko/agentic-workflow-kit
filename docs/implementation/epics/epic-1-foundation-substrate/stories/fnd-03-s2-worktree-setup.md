---
title: "fnd-03-s2-worktree-setup - worktree setup implementation story"
id: "fnd-03-s2-worktree-setup"
epic: 1
status: "story: draft"
design:
  - "docs/design/30-domain-reference/foundation/workspace-and-repository/README.md"
  - "docs/design/30-domain-reference/foundation/workspace-and-repository/events.md"
---

# fnd-03-s2-worktree-setup - Worktree Setup

## Purpose

Implement the local worktree lease lifecycle plus declared setup/freshness handoff without executing
setup commands or using remote state.

## Normative design

- `docs/design/30-domain-reference/foundation/workspace-and-repository/README.md`
- `docs/design/30-domain-reference/foundation/workspace-and-repository/events.md`
- `docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md`
- `docs/engineering/testing-policy.md`
- `docs/engineering/test-lanes.md`

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types: `WorkspaceRepository.createLease`, `evaluateSetup`, `confirmSetup`,
  `WorktreeLease`, `WorktreeLeaseState`, `DeclaredSetup`, `SetupEvaluation`,
  `SetupFreshnessReason`.
- Events / append intents: `WorktreeLeaseCreated`, `LocalBranchCreated`, `RepoSetupEvaluated`,
  `RepoSetupConfirmed`.
- Provider operations / commands: none; the setup command is returned for Execution Host to run later.
- Failure and degraded tokens: `worktree-path-conflict`, `setup-freshness-unknown`,
  `stale-lease-fence`, `base-ref-unresolved`, `branch-conflict`.
- Evidence records / attestations: worktree lease lifecycle transcript and setup freshness result.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Create isolated worktrees at `<worktreeRoot>/<repoId>/<runId>/` from a local `baseSha`.
- Create a local task branch with no upstream tracking ref.
- Persist `leaseId`, `epoch`, and in-process `fenceToken` backed by fnd-02 `LeaseCapability`.
- Evaluate declared setup freshness locally and transition to `setup-required` or `ready`.
- `confirmSetup` re-runs freshness after Execution Host setup and transitions to `ready` only when
  fresh.

## Out of scope

- Executing setup commands, process containment, or dependency installation.
- Local git evidence after worker changes, owned by `fnd-03-s3-local-git-evidence`.
- Cleanup settlement, owned by `fnd-03-s4-cleanup-settlement`.
- Remote fetch/push, PR, checks, review, or merge.

## Dependencies and frozen inputs

- Covers signals: Worktree lease lifecycle and cleanup state; Declared setup metadata and freshness
  evaluation handoff.
- Depends on: `fnd-03-s1-repository-branch`, `fnd-02-s3-lease-store`.
- Depended on by: `fnd-03-s3-local-git-evidence`, `fnd-03-s4-cleanup-settlement`.
- Shared shapes consumed: `fnd-03-s1-repository-branch/RepositoryIdentity`,
  `fnd-02-s3-lease-store/LeaseCapability`.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. Avoid "exactly as
specified."

- **AC-1** `createLease` resolves local `baseRef` to `baseSha`, creates an isolated worktree path, and
  creates a local task branch without fetching - evidence: local worktree fixture.
- **AC-2** `WorktreeLease` records `leaseId`, `epoch`, `runId`, `repoId`, `worktreePath`, `baseRef`,
  `baseSha`, `branchName`, `state`, and in-process `fenceToken` - evidence: lease shape test.
- **AC-3** Lifecycle transitions are limited to `planned`, `leased`, `branch-created`,
  `setup-required`, `ready`, `finalized`, `cleanup-pending`, `cleanup-blocked`, and `cleaned` -
  evidence: state transition test.
- **AC-4** `evaluateSetup` supports marker-file, path-set, and artifact-ref freshness and returns
  `new-worktree`, `marker-missing`, `marker-mismatch`, `paths-missing`, `artifact-stale`, or
  `setup-freshness-unknown` - evidence: setup freshness tests.
- **AC-5** `confirmSetup` transitions to `ready` only after local freshness re-evaluation is fresh;
  otherwise it remains `setup-required` - evidence: confirm setup tests.
- **AC-6** Stale or mismatched `fenceToken` returns `stale-lease-fence` before protected lease state
  changes - evidence: fence enforcement test.
- **AC-7** When the target `<worktreeRoot>/<repoId>/<runId>/` path already exists or is not owned by
  the lease, `createLease` refuses lease creation and returns `worktree-path-conflict` rather than
  reusing or overwriting the path - evidence: path-conflict fixture.
- **AC-8** When the local `baseRef` cannot be resolved to a local `baseSha`, `createLease` fails
  closed with `base-ref-unresolved` and attempts no fetch - evidence: missing-base-ref fixture.
- **AC-9** When the generated task branch already exists at a different commit, `createLease` refuses
  branch creation and returns `branch-conflict` - evidence: branch-conflict fixture.

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| Create isolated worktrees at `<worktreeRoot>/<repoId>/<runId>/` from a local `baseSha` | AC-1 |
| Create a local task branch with no upstream tracking ref | AC-1 |
| Persist `leaseId`, `epoch`, in-process `fenceToken` backed by fnd-02 `LeaseCapability` | AC-2 |
| Evaluate declared setup freshness locally; transition `setup-required` or `ready` | AC-4 |
| `confirmSetup` re-runs freshness and transitions to `ready` only when fresh | AC-5 |
| Spec surface: `WorktreeLease`, `WorktreeLeaseState` lifecycle | AC-2, AC-3 |
| Spec surface: `DeclaredSetup`, `SetupEvaluation`, `SetupFreshnessReason` | AC-4 |
| Spec surface: events `WorktreeLeaseCreated`, `LocalBranchCreated`, `RepoSetupEvaluated`, `RepoSetupConfirmed` | AC-1, AC-4, AC-5 |
| Spec surface: failure token `worktree-path-conflict` | AC-7 |
| Spec surface: failure token `setup-freshness-unknown` | AC-4, AC-5 |
| Spec surface: failure token `stale-lease-fence` | AC-6 |
| Spec surface: failure token `base-ref-unresolved` | AC-8 |
| Spec surface: failure token `branch-conflict` | AC-9 |

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `worktree-path-conflict` | Target path already exists or is not owned by the lease. | Refuse lease creation and report conflict. | AC-7 |
| `setup-freshness-unknown` | Freshness detector cannot be evaluated or remains stale after setup. | Keep lease `setup-required`; do not mark ready. | AC-4, AC-5 |
| `stale-lease-fence` | Caller fence token does not match durable lease. | Reject protected state transition. | AC-6 |
| `base-ref-unresolved` | Local base ref cannot resolve. | Fail closed and do not fetch. | AC-8 |
| `branch-conflict` | Task branch already exists at another commit. | Refuse branch creation. | AC-9 |

## Quality bar

- Coverage scope and threshold: worktree/setup modules at 90% minimum, aiming for 95%.
- Required tests, catalogued by AC and failure row: worktree fixture, lease shape, state transition,
  freshness, confirmation, and fence tests.
- Exact commands: `pnpm test:int -- packages/sdk/tests/foundation/workspace-repository/worktree/*.int.test.ts`;
  `pnpm check`; coverage with `pnpm coverage:baseline`.
- Determinism constraints: branch suffixes, run ids, task ids, and timestamps are injected.
- Dependency boundaries: no Execution Host, process, Forge, CI, credential, or remote git dependency.
- File-size or module-size constraints: worktree lifecycle and setup freshness modules remain
  separate if needed.
- Domain non-negotiables: Workspace records setup metadata; it never executes setup.

## Required reading

- `docs/design/30-domain-reference/foundation/workspace-and-repository/README.md`
- `docs/design/30-domain-reference/foundation/workspace-and-repository/events.md`
- `fnd-03-s1-repository-branch` and `fnd-02-s3-lease-store` story contracts
- `docs/engineering/test-lanes.md`

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The SDK worktree lifecycle and setup freshness modules plus event payloads, with the evidence pack.

## Evidence pack

- Test name or artifact proving each AC.
- Test name or artifact proving each failure/degraded outcome row.
- `pnpm check` result, unless the gate is blocked by an unrelated repository issue that is named.
- Coverage command and number for the stated scope.
- Sweep-grep results proving no process execution, remote git, Forge, CI, or credential fields.

## Boundaries and STOP conditions

- Package or module boundary: `packages/sdk/src/foundation/workspace-repository/worktree` and
  `setup`.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/foundation/workspace-repository/worktree/**`,
  `packages/sdk/src/foundation/workspace-repository/setup/**`,
  `packages/sdk/tests/foundation/workspace-repository/worktree/**`.
- Forbidden dependencies: no process spawning, Execution Host, Forge, CI, credential, remote git, or
  merge dependency.
- STOP when: the story requires running setup commands, fetching remotes, or interpreting cleanup
  policy beyond local lease state.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 1 - stories](./README.md) · **← Prev:** [fnd-03-s1-repository-branch - repository branch implementation story](./fnd-03-s1-repository-branch.md) · **Next →:** [fnd-03-s3-local-git-evidence - local git evidence implementation story](./fnd-03-s3-local-git-evidence.md)

<!-- /DOCS-NAV -->
