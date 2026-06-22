---
title: "fnd-03-s1-repository-branch - repository branch implementation story"
id: "fnd-03-s1-repository-branch"
epic: 1
status: "story: draft"
design:
  - "docs/design/30-domain-reference/foundation/workspace-and-repository/README.md"
  - "docs/design/30-domain-reference/foundation/workspace-and-repository/events.md"
---

# fnd-03-s1-repository-branch - Repository Branch

## Purpose

Define local-only repository identity, task branch naming, and API boundary checks before worktree
and evidence stories build on them.

## Normative design

- `docs/design/30-domain-reference/foundation/workspace-and-repository/README.md`
- `docs/design/30-domain-reference/foundation/workspace-and-repository/events.md`
- `docs/design/10-architecture/architecture.md` section 5 seam boundaries.
- `docs/engineering/testing-policy.md`
- `docs/engineering/dependency-policy.md`

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types: `RepositoryIdentity`, `AbsolutePath`, `RelativePath`, `LocalRef`, `GitSha`,
  local branch model, public boundary predicates.
- Events / append intents: none.
- Provider operations / commands: none.
- Failure and degraded tokens: `base-ref-unresolved`, `branch-conflict`.
- Evidence records / attestations: boundary check report proving no remote, credential, process, CI,
  PR, check, review, or merge fields.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Define `RepositoryIdentity` as `{ repoId, repoRoot, gitDir, defaultBaseRef }` with absolute local
  paths only.
- Define deterministic local task branch naming from `{ repoId, runId, taskId }` and configured
  prefix/collision rules from fnd-03 design.
- Reject remote names, hosted repository ids, remote URLs, credentials, CI, PR, check, review, merge,
  process, or containment fields at the public boundary.
- Consume fnd-01 policy only by citing `PolicyLayer` and `ResolvedPolicy`; do not invent repository
  policy fields absent from fnd-01 design.

## Out of scope

- Worktree lease lifecycle and setup freshness, owned by `fnd-03-s2-worktree-setup`.
- Local git evidence capture, owned by `fnd-03-s3-local-git-evidence`.
- Cleanup settlement, owned by `fnd-03-s4-cleanup-settlement`.
- Remote Forge operations, process execution, CI, or credential flows.

## Dependencies and frozen inputs

- Covers signals: Repository identity and local-only branch model; Boundary checks proving no remote,
  credential, process, CI, PR, check, review, or merge fields.
- Depends on: `fnd-01-s1-config-schema`, `fnd-01-s2-policy-resolution`.
- Depended on by: `fnd-03-s2-worktree-setup`.
- Shared shapes consumed: `fnd-01-s1-config-schema/PolicyLayer`,
  `fnd-01-s2-policy-resolution/ResolvedPolicy`.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. Avoid "exactly as
specified."

- **AC-1** `RepositoryIdentity` contains only `repoId`, absolute `repoRoot`, absolute `gitDir`, and
  local `defaultBaseRef` - evidence: API shape test.
- **AC-2** Remote URL, remote ref, hosted repo id, credential, CI, PR, check, review, merge, process,
  and containment fields are not representable in the public API - evidence: boundary type test.
- **AC-3** Branch names are generated deterministically from `repoId`, `runId`, and `taskId` with the
  configured prefix, run/task inclusion, max length, and collision suffix - evidence: branch naming
  table test.
- **AC-4** A missing local base ref returns `base-ref-unresolved` and never fetches - evidence:
  local-ref fixture.
- **AC-5** A generated branch that already exists at a different commit returns `branch-conflict` -
  evidence: branch conflict fixture.
- **AC-6** Boundary sweeps prove no remote, credential, process, CI, PR, check, review, or merge
  symbols appear in fnd-03 public types - evidence: sweep artifact.

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| Define `RepositoryIdentity` as `{ repoId, repoRoot, gitDir, defaultBaseRef }`, absolute local paths only | AC-1 |
| Deterministic local task branch naming from `{ repoId, runId, taskId }` plus prefix/collision rules | AC-3 |
| Reject remote/credential/CI/PR/check/review/merge/process/containment fields at public boundary | AC-2 |
| Consume fnd-01 policy only by citing `PolicyLayer` and `ResolvedPolicy` | AC-3 |
| Spec surface: `RepositoryIdentity`, `AbsolutePath`, `RelativePath`, `LocalRef`, `GitSha`, local branch model, boundary predicates | AC-1, AC-2, AC-3 |
| Spec surface: failure token `base-ref-unresolved` | AC-4 |
| Spec surface: failure token `branch-conflict` | AC-5 |
| Spec surface: boundary check report proving no remote/credential/process/CI/PR/check/review/merge fields | AC-2, AC-6 |

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `base-ref-unresolved` | Local base ref or commit cannot be resolved. | Fail closed and do not fetch. | AC-4 |
| `branch-conflict` | Generated local branch exists at a different commit. | Refuse branch creation and report conflict. | AC-5 |

## Quality bar

- Coverage scope and threshold: repository identity, branch naming, and boundary modules at 90%
  minimum, aiming for 95%.
- Required tests, catalogued by AC and failure row: API shape, boundary, branch naming, local-ref,
  conflict, and sweep tests.
- Exact commands: `pnpm test:unit -- packages/sdk/tests/foundation/workspace-repository/boundary/*.unit.test.ts`;
  `pnpm check`; coverage with `pnpm coverage:baseline`.
- Determinism constraints: branch naming uses injected collision suffix input; no ambient randomness.
- Dependency boundaries: workspace-repository imports only Foundation policy/storage shapes, not
  Forge, Execution Host, process, credentials, or CI.
- File-size or module-size constraints: branch naming and boundary tests remain focused modules.
- Domain non-negotiables: local git only.

## Required reading

- `docs/design/30-domain-reference/foundation/workspace-and-repository/README.md`
- `docs/design/30-domain-reference/foundation/workspace-and-repository/events.md`
- `docs/design/10-architecture/architecture.md` section 5
- `fnd-01-s1-config-schema` and `fnd-01-s2-policy-resolution` story contracts

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The SDK repository identity and branch model modules plus boundary tests, with the evidence pack.

## Evidence pack

- Test name or artifact proving each AC.
- Test name or artifact proving each failure/degraded outcome row.
- `pnpm check` result, unless the gate is blocked by an unrelated repository issue that is named.
- Coverage command and number for the stated scope.
- Sweep-grep results for remote, credential, process, CI, PR, check, review, and merge fields.

## Boundaries and STOP conditions

- Package or module boundary: `packages/sdk/src/foundation/workspace-repository/repository`,
  `branch`, and `boundary`.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/foundation/workspace-repository/repository/**`,
  `packages/sdk/src/foundation/workspace-repository/branch/**`,
  `packages/sdk/src/foundation/workspace-repository/boundary/**`,
  `packages/sdk/tests/foundation/workspace-repository/boundary/**`.
- Forbidden dependencies: no remote git, Forge, Execution Host, process, credential, CI, PR, check,
  review, or merge dependency.
- STOP when: a consumer needs remote state or repository policy fields not named by fnd-01/fnd-03.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 1 - stories](./README.md) · **← Prev:** [fnd-02-s5-filesystem-conformance - filesystem conformance implementation story](./fnd-02-s5-filesystem-conformance.md) · **Next →:** [fnd-03-s2-worktree-setup - worktree setup implementation story](./fnd-03-s2-worktree-setup.md)

<!-- /DOCS-NAV -->
