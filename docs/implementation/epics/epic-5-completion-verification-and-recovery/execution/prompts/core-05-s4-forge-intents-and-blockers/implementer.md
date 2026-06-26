# Implementer Prompt - core-05-s4-forge-intents-and-blockers

## Assigned Routing

- Source story id: `core-05-s4-forge-intents-and-blockers`
- Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6
- Model class: `strong-coder`
- Effort: `high`
- Suggested-tier floor: `elevated`
- Reasoning tier: `elevated`
- Routing rationale: minimal compliant route. The frozen DAG sets an elevated floor, and exact-head operation intent boundary that separates blocker publication from merge actions; no critical/frontier escalation is authorized by the source contract.

## Exact Task

Implement `core-05-s4-forge-intents-and-blockers` for epic `epic-5-completion-verification-and-recovery`: Record exact-head Forge operation intents, merge intents, and blocker-evidence PR intents without implying completion or merge.

Source story: `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-05-s4-forge-intents-and-blockers.md`. Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6.

## Why It Matters

Record exact-head Forge operation intents, merge intents, and blocker-evidence PR intents as durable
barrier events while keeping blocker publication separate from task completion or merge readiness.

Downstream dependents: `core-05-s5-post-merge-outcomes`. Dependency inputs and public contracts from this story must be stable before those dependents run.

## Required Reading

- `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-05-s4-forge-intents-and-blockers.md`
- `docs/implementation/epics/epic-5-completion-verification-and-recovery/story-dag.md`
- Core-05 design files.
- `core-05-s1`, `core-05-s2`, `core-05-s3`.
- Runtime dependency commits: `{{DEPENDENCY_COMMITS}}` for producer stories listed below.

## Acceptance Criteria

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

## Allowed Writes

- Package/module boundary: `packages/sdk/src/core/completion/intents/**`.
- Owned pathset: `packages/sdk/src/core/completion/intents/**`,
  `packages/sdk/tests/core/completion/intents/**`, and owned SDK export lines.
- Forbidden dependencies: Forge execution clients, network/process/git APIs, recovery modules.
- STOP when a caller asks this story to perform a real push, PR, enqueue, merge, or update-branch rather
  than record a durable intent.

Every other write is forbidden, including execution package files, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, and unrelated SDK surfaces.

## Dependency Inputs

- Covers signals: Forge operation intent and merge intent records with `expectedHeadSha`;
  blocker-evidence PR intent separation from task completion or merge readiness.
- Depends on: `core-05-s1`, `core-05-s2`, `core-05-s3`, core-01 writer, fnd-01 push/PR/merge policy.
- Depended on by: `core-05-s5-post-merge-outcomes`, Epic 6 Forge driver stories, Epic 7 operator
  composition.
- Shared shapes consumed: `CompletionDecisionRecorded`, `MergeDecisionRecorded`,
  `core-05-s1` intent payloads and blocker-eligible state catalog.
- Decision inputs consumed: completion/merge state, `headSha`, `expectedHeadSha`, policy
  `runnerMayPush`, `runnerMayOpenPr`, `runnerMayMerge`, merge decision event id, gate event id.

Execution-time dependency commits: `core-05-s1-completion-contracts`, `core-05-s2-completion-evidence`, `core-05-s3-merge-readiness`. Runtime execution must provide {{DEPENDENCY_COMMITS}} for producer stories that have reached tracker status merged.

## Non-Goals And STOP Conditions

- Executing Forge operations or inspecting Forge live state.
- Completion and merge predicate evaluation (`core-05-s2`, `core-05-s3`).
- Post-merge result classification (`core-05-s5`).

- Package/module boundary: `packages/sdk/src/core/completion/intents/**`.
- Owned pathset: `packages/sdk/src/core/completion/intents/**`,
  `packages/sdk/tests/core/completion/intents/**`, and owned SDK export lines.
- Forbidden dependencies: Forge execution clients, network/process/git APIs, recovery modules.
- STOP when a caller asks this story to perform a real push, PR, enqueue, merge, or update-branch rather
  than record a durable intent.

Also STOP and report if source gaps, missing dependency inputs, required writes outside the owned pathset, or any need to reinterpret an AC appears.

## Implementation Constraints

The implementation constraints are the source-owned spec surface and responsibilities below. Do not introduce implementation choices outside this contract. Preserve deterministic, fail-closed, event-log, dependency-boundary, and public-import constraints exactly as written.

### Spec Surface

- Interfaces / types: `recordForgeOperationIntent`, `recordMergeIntent`,
  `recordBlockerEvidenceIntent`.
- Events / append intents: `ForgeOperationIntentRecorded`, `MergeIntentRecorded`.
- Provider operations / commands: none; this story records intent only. Forge performs writes later.
- Failure and degraded tokens: consumes blocker-eligible core-05 catalogs and `merge-intent-unwritable`.
- Evidence records / attestations: consumes exact-head completion and merge decisions, clean local git
  evidence, push/PR policy booleans, `auto-merge` gate event id, and Forge refs.

### Responsibilities

- Record `push-branch`, `upsert-pr`, `publish-blocker-evidence`, and `update-branch` Forge operation
  intents with `expectedHeadSha`.
- Record `enqueue` or `merge` merge intents only after a `merge-ready` decision, policy, gate event id,
  and exact-head evidence are present.
- Permit blocker-evidence PR intents only for explicitly eligible completion/merge states and safe exact
  head; never for ambiguous/missing/dirty local evidence, outside allowlist, unwritable events, Forge
  unavailable write paths, or any merge operation.
- Fail closed when intent append is unwritable.

## Verification

The verification contract is the source-owned coverage matrix, quality bar, and evidence pack below. The repo gate is `pnpm check`; report exact command output or an explicit blocked reason.

### Coverage Matrix

| Responsibility / spec-surface item | Proven by | Standing gate lane |
|---|---|---|
| Exact-head Forge operation intent kinds | AC-1 | `coverage:baseline` |
| Merge intent readiness gate | AC-2 | `coverage:baseline` |
| Blocker eligible states | AC-3 | `coverage:baseline` |
| Blocker forbidden states | AC-4 | `coverage:baseline` |
| Intent append unwritable behavior | AC-5 | `coverage:baseline` |
| Public SDK exports | AC-6 | `typecheck` |

- Coverage scope and threshold: `packages/sdk/src/core/completion/intents/**`, 95% branch.
- Coverage command and instrumented lanes: `pnpm check` via `coverage:baseline`.
- Required tests: AC-1..AC-6 and every failure row.
- Public exposure: `sdk` import path plus AC-6 public-import test.
- Determinism constraints: no ambient time except injected `recordedAt`; no Forge execution.
- Dependency boundaries: may consume provider DTOs as evidence refs only; no concrete provider import.
- File-size budget: 240 lines per file; split blocker matrix before 400 lines; 800 hard cap.
- Domain non-negotiables: intent before action; exact-head binding; blocker PR is not completion/merge.

- Intent kind, merge-ready, blocker-eligible, blocker-forbidden, and unwritable fixtures.
- Public-import test in AC-6.
- `pnpm check` result.
- Boundary sweep:
  `grep -REn "Date\\.now|new Date\\(|Math\\.random|crypto\\.randomUUID|@octokit|node:http|node:https|child_process|simple-git|merge\\(|enqueue\\(|from \"testkit\"|from \"@kit/testkit\"" packages/sdk/src/core/completion/intents packages/sdk/tests/core/completion/intents`
  returns zero matches except test fixture names where asserted.

## Commit Cadence

The implementer commits its own work in the story worktree, never the orchestrator:

- make the gate green (`pnpm check`) before every commit;
- make an impl-done commit when the story first proves out, then one commit per fix round;
- tag each commit with trailers `Story: core-05-s4-forge-intents-and-blockers` and `Round: <n>`;
- on an orchestrator-reported merge-back conflict, rebase the story commits onto the track branch `HEAD`, re-prove with a green gate, and re-commit;
- report a real logic conflict instead of forcing a resolution.

The implementer commits only within the owned pathset in its own story worktree. It never pushes, opens or updates PRs, merges, closes contexts, edits the tracker, or marks stories complete.

## Delivery Report

Report changed files, AC coverage by AC id, per-round commit hashes, tests/checks run, evidence pack, open questions, and blockers. The report and per-round commits are evidence for review and merge-back.

## Mutation Limits

The implementer commits each round within the owned pathset in its own story worktree and rebases only on orchestrator request. It performs no pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - Completion, verification, and recovery](../../../README.md) · **← Prev:** [Reviewer Prompt - core-05-s3-merge-readiness](../core-05-s3-merge-readiness/reviewer.md) · **Next →:** [Reviewer Prompt - core-05-s4-forge-intents-and-blockers](./reviewer.md)

<!-- /DOCS-NAV -->
