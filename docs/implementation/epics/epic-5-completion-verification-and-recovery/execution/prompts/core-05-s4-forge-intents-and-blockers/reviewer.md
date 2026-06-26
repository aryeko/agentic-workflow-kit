# Reviewer Prompt - core-05-s4-forge-intents-and-blockers

## Assigned Routing

- Source story id: `core-05-s4-forge-intents-and-blockers`
- Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6
- Model class: `frontier-reviewer`
- Effort: `high`
- Suggested-tier floor: `elevated`
- Reasoning tier: `elevated`
- Routing rationale: review must independently verify AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 for exact-head operation intent boundary that separates blocker publication from merge actions; reviewer routing is fixed to `frontier-reviewer` by package rules.

## Original Scope

- Story id: `core-05-s4-forge-intents-and-blockers`
- Epic slug: `epic-5-completion-verification-and-recovery`
- Source story contract path: `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-05-s4-forge-intents-and-blockers.md`
- Acceptance criteria: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6
- Allowed pathset: `packages/sdk/src/core/completion/intents/**`, `packages/sdk/tests/core/completion/intents/**`, own `packages/sdk/src/index.ts` export lines
- Dependencies: `core-05-s1-completion-contracts`, `core-05-s2-completion-evidence`, `core-05-s3-merge-readiness`
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus producer contracts listed in the source story.

### Acceptance Criteria

- **AC-1** Forge operation intents require a clean unambiguous `expectedHeadSha` and record only
  `push-branch`, `upsert-pr`, `publish-blocker-evidence`, or `update-branch` operation kinds - evidence:
  `coverage:baseline` fixture `forge-operation-intent-kind-and-head`.
- **AC-2** Merge intents are recorded only for `enqueue` or `merge` after `MergeDecisionRecorded.state
  === "merge-ready"` with matching `headSha`, policy ref, gate event id, and merge decision event id -
  evidence: `coverage:baseline` fixtures `merge-intent-ready` and `merge-intent-not-ready-rejected`.
- **AC-3** Blocker-evidence PR intents are allowed only for the exact eligible states listed by
  `core-05-s1` and policy `runnerMayPush && runnerMayOpenPr`; they carry
  `purpose = "blocker-evidence-pr"` and never `enqueue` or `merge` - evidence:
  `coverage:baseline` table `blocker-intent-eligible-state-matrix`.
- **AC-4** Blocker-evidence PR intents are rejected for `event-log-unwritable`,
  `merge-intent-unwritable`, `head-ambiguous`, `merge-head-ambiguous`, missing/dirty local evidence,
  `changed-files-outside-allowlist`, `changed-file-policy-absent`, Forge-unavailable write paths, or
  any merge intent operation - evidence: `coverage:baseline` table
  `blocker-intent-forbidden-state-matrix`.
- **AC-5** Unwritable paths return exact producer-owned tokens: `event-log-unwritable` for
  `ForgeOperationIntentRecorded` append failure or an already unwritable completion-decision input, and
  `merge-intent-unwritable` for `MergeIntentRecorded` append failure, with no success event - evidence:
  `coverage:baseline` fixture `intent-append-unwritable`.
- **AC-6** Public SDK importability exposes the three intent recorders through this story's export
  lines - evidence: `typecheck` public-import test.

### Dependencies And Frozen Inputs

- Covers signals: Forge operation intent and merge intent records with `expectedHeadSha`;
  blocker-evidence PR intent separation from task completion or merge readiness.
- Depends on: `core-05-s1`, `core-05-s2`, `core-05-s3`, core-01 writer, fnd-01 push/PR/merge policy.
- Depended on by: `core-05-s5-post-merge-outcomes`, Epic 6 Forge driver stories, Epic 7 operator
  composition.
- Shared shapes consumed: `CompletionDecisionRecorded`, `MergeDecisionRecorded`,
  `core-05-s1` intent payloads and blocker-eligible state catalog.
- Decision inputs consumed: completion/merge state, `headSha`, `expectedHeadSha`, policy
  `runnerMayPush`, `runnerMayOpenPr`, `runnerMayMerge`, merge decision event id, gate event id.

### Non-Goals

- Executing Forge operations or inspecting Forge live state.
- Completion and merge predicate evaluation (`core-05-s2`, `core-05-s3`).
- Post-merge result classification (`core-05-s5`).

### STOP Conditions And Boundaries

- Package/module boundary: `packages/sdk/src/core/completion/intents/**`.
- Owned pathset: `packages/sdk/src/core/completion/intents/**`,
  `packages/sdk/tests/core/completion/intents/**`, and owned SDK export lines.
- Forbidden dependencies: Forge execution clients, network/process/git APIs, recovery modules.
- STOP when a caller asks this story to perform a real push, PR, enqueue, merge, or update-branch rather
  than record a durable intent.

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check all of the following against the original source story and runtime evidence:

- AC coverage by source AC id: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6.
- Each AC names and is re-proven by its standing gate lane; treat proof that is only manual, one-off, or outside the standing gate as BLOCKING.
- Failure, degraded, and validation rows from the story contract.
- Evidence pack completeness.
- Public API and import paths.
- Dependency boundaries and committed dependency inputs.
- Stale names and sibling occurrences.
- Tests and sweeps.
- Scope control against allowed writes.
- Repo conventions and mutation limits.

## Coverage Matrix

| Responsibility / spec-surface item | Proven by | Standing gate lane |
|---|---|---|
| Exact-head Forge operation intent kinds | AC-1 | `coverage:baseline` |
| Merge intent readiness gate | AC-2 | `coverage:baseline` |
| Blocker eligible states | AC-3 | `coverage:baseline` |
| Blocker forbidden states | AC-4 | `coverage:baseline` |
| Intent append unwritable behavior | AC-5 | `coverage:baseline` |
| Public SDK exports | AC-6 | `typecheck` |

## Failure and Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `merge-intent-unwritable` | merge intent append fails | do not call Forge; return unwritable failure | AC-5 |
| `event-log-unwritable` | Forge operation intent append fails or consumed completion decision is already unwritable | do not call Forge; return unwritable failure | AC-5 |
| `head-ambiguous` | completion decision has no single exact head | no blocker intent | AC-4 |
| `merge-head-ambiguous` | merge decision has no single exact head | no blocker intent | AC-4 |
| `workspace-dirty` | local git evidence is dirty | no blocker intent | AC-4 |
| `changed-files-outside-allowlist` | changed paths are outside allowlist | no blocker intent | AC-4 |
| `changed-file-policy-absent` | required changed-file policy is absent | no blocker intent | AC-4 |
| `merge-forge-unavailable` | Forge write path is unavailable | no blocker intent | AC-4 |
| `merge-ready` | merge decision is already ready | no blocker intent; merge intent path must use AC-2 | AC-2, AC-3 |



- Coverage scope and threshold: `packages/sdk/src/core/completion/intents/**`, 95% branch.
- Coverage command and instrumented lanes: `pnpm check` via `coverage:baseline`.
- Required tests: AC-1..AC-6 and every failure row.
- Public exposure: `sdk` import path plus AC-6 public-import test.
- Determinism constraints: no ambient time except injected `recordedAt`; no Forge execution.
- Dependency boundaries: may consume provider DTOs as evidence refs only; no concrete provider import.
- File-si

- Intent kind, merge-ready, blocker-eligible, blocker-forbidden, and unwritable fixtures.
- Public-import test in AC-6.
- `pnpm check` result.
- Boundary sweep:
  `grep -REn "Date\\.now|new Date\\(|Math\\.random|crypto\\.randomUUID|@octokit|node:http|node:https|child_process|simple-git|merge\\(|enqueue\\(|from \"testkit\"|from \"@kit/testkit\"" packages/sdk/src/core/completion/intents packages/sdk/tests/core/completion/intents`
  returns

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source AC id or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside allowed paths. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - Completion, verification, and recovery](../../../README.md) · **← Prev:** [Implementer Prompt - core-05-s4-forge-intents-and-blockers](./implementer.md) · **Next →:** [Implementer Prompt - core-05-s5-post-merge-outcomes](../core-05-s5-post-merge-outcomes/implementer.md)

<!-- /DOCS-NAV -->
