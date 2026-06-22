---
title: "fnd-03-s3-local-git-evidence - local git evidence implementation story"
id: "fnd-03-s3-local-git-evidence"
epic: 1
status: "story: draft"
design:
  - "docs/design/30-domain-reference/foundation/workspace-and-repository/README.md"
  - "docs/design/30-domain-reference/foundation/workspace-and-repository/events.md"
---

# fnd-03-s3-local-git-evidence - Local Git Evidence

## Purpose

Record local git evidence for branch state, commits, merge base, diff, and working tree state without
remote or worker-prose authority.

## Normative design

- `docs/design/30-domain-reference/foundation/workspace-and-repository/README.md`
- `docs/design/30-domain-reference/foundation/workspace-and-repository/events.md`
- `docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md`
- `docs/engineering/testing-policy.md`
- `docs/engineering/test-lanes.md`

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types: `WorkspaceRepository.recordLocalGitEvidence`, `LocalGitEvidence`,
  `LocalCommitSummary`, `ArtifactRefId`.
- Events / append intents: `LocalGitEvidenceRecorded`.
- Provider operations / commands: none.
- Failure and degraded tokens: `local-git-evidence-unavailable`, `dirty-worktree`,
  `stale-lease-fence`.
- Evidence records / attestations: local git evidence record with top-level `headSha`,
  `changedPaths`, and `clean`.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Inspect local branch existence, commits, `baseSha`, `mergeBaseSha`, `headSha`, diff, and working
  tree state.
- Store optional diff/stat artifacts through fnd-02 artifact refs.
- Keep `headSha`, `changedPaths`, and `clean` as top-level fields.
- Return `local-git-evidence-unavailable` instead of partial success when required local git evidence
  cannot be read.
- Exclude remote refs, URLs, credentials, CI, review, merge state, and worker prose.

## Out of scope

- Creating worktrees or task branches, owned by `fnd-03-s2-worktree-setup`.
- Cleanup settlement, owned by `fnd-03-s4-cleanup-settlement`.
- Completion or merge readiness decisions that consume evidence later.
- Remote git, Forge, CI, or process execution.

## Dependencies and frozen inputs

- Covers signals: Local git evidence for branch existence, commits, base/head SHAs, merge base, diff,
  and working tree state.
- Depends on: `fnd-03-s2-worktree-setup`, `fnd-02-s4-artifact-evidence`.
- Depended on by: `fnd-03-s4-cleanup-settlement`.
- Shared shapes consumed: `fnd-03-s2-worktree-setup/WorktreeLease`,
  `fnd-02-s4-artifact-evidence/ArtifactRef`.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. Avoid "exactly as
specified."

- **AC-1** `LocalGitEvidence` records `evidenceId`, `leaseId`, `repoId`, `worktreePath`,
  `branchName`, `inspectedAt`, `baseSha`, `mergeBaseSha`, and `headSha` - evidence: evidence shape
  test.
- **AC-2** Local commits include `sha`, `parentShas`, `subject`, and `authoredAt` for commits in the
  local branch range - evidence: commit summary fixture.
- **AC-3** Diff evidence records `fromSha`, `toSha`, `changedPaths`, and optional `statRef` and
  `patchRef` artifact refs - evidence: diff artifact fixture.
- **AC-4** Working tree state records `clean`, `stagedPaths`, `unstagedPaths`, and `untrackedPaths` -
  evidence: clean/dirty status fixtures.
- **AC-5** Missing branch, merge base, status, or diff returns `local-git-evidence-unavailable` and no
  partial success - evidence: unavailable evidence fixtures.
- **AC-6** Boundary tests prove no remote refs, remote URLs, credential material, CI state, review
  state, merge state, or worker prose appears in `LocalGitEvidence` - evidence: boundary sweep.
- **AC-7** When uncommitted paths exist and the caller requires a clean worktree, evidence records
  `clean=false` with the dirty paths in `stagedPaths`/`unstagedPaths`/`untrackedPaths` so consumers
  fail closed; recording is not silently treated as clean - evidence: dirty-worktree fixture.
- **AC-8** When the lease `fenceToken` is stale or mismatched before protected evidence recording,
  `recordLocalGitEvidence` returns `stale-lease-fence` and records no evidence - evidence: fence
  enforcement test.

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| Inspect branch existence, commits, `baseSha`, `mergeBaseSha`, `headSha` | AC-1, AC-2 |
| Inspect diff and working tree state | AC-3, AC-4 |
| Store optional diff/stat artifacts through fnd-02 artifact refs | AC-3 |
| Keep `headSha`, `changedPaths`, `clean` as top-level fields | AC-1, AC-3, AC-4 |
| Return `local-git-evidence-unavailable` instead of partial success | AC-5 |
| Exclude remote refs, URLs, credentials, CI, review, merge state, worker prose | AC-6 |
| Spec surface: `LocalGitEvidence`, `LocalCommitSummary`, `ArtifactRefId` | AC-1, AC-2, AC-3 |
| Spec surface: event `LocalGitEvidenceRecorded` | AC-1 |
| Spec surface: failure token `local-git-evidence-unavailable` | AC-5 |
| Spec surface: failure token `dirty-worktree` | AC-7 |
| Spec surface: failure token `stale-lease-fence` | AC-8 |

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `local-git-evidence-unavailable` | Branch, merge base, status, or diff cannot be read. | Return failure and no partial evidence. | AC-5 |
| `dirty-worktree` | Uncommitted paths exist when clean state is required by the caller. | Record dirty paths and let consumers fail closed. | AC-7 |
| `stale-lease-fence` | Lease fence is stale before protected evidence recording. | Reject evidence recording. | AC-8 |

## Quality bar

- Coverage scope and threshold: local evidence modules at 90% minimum, aiming for 95%.
- Required tests, catalogued by AC and failure row: evidence shape, commit summary, diff artifact,
  clean/dirty status, unavailable evidence, and boundary sweep tests.
- Exact commands: `pnpm test:int -- packages/sdk/tests/foundation/workspace-repository/evidence/*.int.test.ts`;
  `pnpm check`; coverage with `pnpm coverage:baseline`.
- Determinism constraints: fixtures use local temp repositories with fixed author dates and commit
  subjects.
- Dependency boundaries: no remote git, Forge, process execution beyond local git fixture helper,
  credentials, CI, review, or merge imports.
- File-size or module-size constraints: commit, diff, status, and boundary shaping remain focused.
- Domain non-negotiables: evidence is read-only local inspection.

## Required reading

- `docs/design/30-domain-reference/foundation/workspace-and-repository/README.md`
- `docs/design/30-domain-reference/foundation/workspace-and-repository/events.md`
- `fnd-03-s2-worktree-setup` and `fnd-02-s4-artifact-evidence` story contracts
- `docs/engineering/test-lanes.md`

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The SDK local git evidence modules and `LocalGitEvidenceRecorded` payload, plus the evidence pack.

## Evidence pack

- Test name or artifact proving each AC.
- Test name or artifact proving each failure/degraded outcome row.
- `pnpm check` result, unless the gate is blocked by an unrelated repository issue that is named.
- Coverage command and number for the stated scope.
- Sweep-grep results for remote refs, remote URLs, credentials, CI, review, merge state, and worker
  prose fields.

## Boundaries and STOP conditions

- Package or module boundary: `packages/sdk/src/foundation/workspace-repository/evidence`.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/foundation/workspace-repository/evidence/**`,
  `packages/sdk/tests/foundation/workspace-repository/evidence/**`.
- Forbidden dependencies: no Forge, remote git, CI, credential, review, merge, or worker-prose
  dependency.
- STOP when: local evidence capture needs remote hosted state, CI checks, PR metadata, or process
  execution outside local test fixtures.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 1 - stories](./README.md) · **← Prev:** [fnd-03-s2-worktree-setup - worktree setup implementation story](./fnd-03-s2-worktree-setup.md) · **Next →:** [fnd-03-s4-cleanup-settlement - cleanup settlement implementation story](./fnd-03-s4-cleanup-settlement.md)

<!-- /DOCS-NAV -->
