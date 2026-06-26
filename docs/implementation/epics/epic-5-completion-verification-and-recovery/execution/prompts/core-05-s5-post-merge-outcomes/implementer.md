# Implementer Prompt - core-05-s5-post-merge-outcomes

## Assigned Routing

- Source story id: `core-05-s5-post-merge-outcomes`
- Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6
- Model class: `strong-coder`
- Effort: `high`
- Suggested-tier floor: `elevated`
- Reasoning tier: `elevated`
- Routing rationale: minimal compliant route. The frozen DAG sets an elevated floor, and post-merge lifecycle target classifier with exact-head fail-closed ambiguity handling; no critical/frontier escalation is authorized by the source contract.

## Exact Task

Implement `core-05-s5-post-merge-outcomes` for epic `epic-5-completion-verification-and-recovery`: Classify Forge merge action results into post-merge outcome facts and lifecycle targets.

Source story: `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-05-s5-post-merge-outcomes.md`. Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6.

## Why It Matters

Classify committed Forge merge action results into `PostMergeOutcomeRecorded` facts and lifecycle targets
without treating merge intent, prose, or ambiguous Forge state as completion.

Downstream dependents: `Epic 7`, `core-06 snapshot consumers`. Dependency inputs and public contracts from this story must be stable before those dependents run.

## Required Reading

- `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-05-s5-post-merge-outcomes.md`
- `docs/implementation/epics/epic-5-completion-verification-and-recovery/story-dag.md`
- Core-05 design files.
- `core-05-s1-completion-contracts` and `core-05-s4-forge-intents-and-blockers`.
- Runtime dependency commits: `{{DEPENDENCY_COMMITS}}` for producer stories listed below.

## Acceptance Criteria

- **AC-1** Successful Forge merge or queue completion proves the PR merged at `expectedHeadSha` and maps
  to `post-merge-confirmed` plus lifecycle target `completed` - evidence: `coverage:baseline` fixture
  `post-merge-confirmed-exact-head`.
- **AC-2** Exact-head retryable refusals such as transient rate limit, temporary queue unavailable, or
  update-branch required map to `post-merge-retryable-refused` and lifecycle target `merge-waiting` -
  evidence: `coverage:baseline` table `post-merge-retryable-refusals`.
- **AC-3** Exact-head operator/policy blockers map to `post-merge-blocked` and lifecycle target
  `blocked`; provider invariant/auth/redaction/credential/impossible-method failures map to
  `post-merge-failed` and lifecycle target `failed` - evidence: `coverage:baseline`
  `post-merge-blocked-failed-matrix`.
- **AC-4** Missing, unwritable, not-bound-to-`expectedHeadSha`, unknown, or contradictory Forge action
  results map to `post-merge-outcome-ambiguous` and never to `completed` - evidence:
  `coverage:baseline` table `post-merge-ambiguous-never-completed`.
- **AC-5** `PostMergeOutcomeRecorded` includes source action event id, exact head evidence refs, outcome
  state, lifecycle target, and evaluated time; append failure returns no success fact - evidence:
  `coverage:baseline` fixture `post-merge-record-fields` and `post-merge-record-unwritable`.
- **AC-6** Public SDK importability exposes the classifier and recorder through this story's export lines
  - evidence: `typecheck` public-import test.

## Allowed Writes

- Package/module boundary: `packages/sdk/src/core/completion/post-merge/**`.
- Owned pathset: `packages/sdk/src/core/completion/post-merge/**`,
  `packages/sdk/tests/core/completion/post-merge/**`, and owned SDK export lines.
- Forbidden dependencies: concrete Forge clients, lifecycle transition recording, recovery modules.
- STOP when Forge result evidence cannot prove whether the exact head merged; return ambiguous instead.

Every other write is forbidden, including execution package files, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, and unrelated SDK surfaces.

## Dependency Inputs

- Covers signals: post-merge outcome classification into lifecycle targets.
- Depends on: `core-05-s1-completion-contracts`, `core-05-s4-forge-intents-and-blockers`, Forge action
  result evidence DTOs, core-01 writer/lifecycle contracts.
- Depended on by: core-06 recovery snapshot assemblers and Epic 7.
- Shared shapes consumed: `core-05-s1/PostMergeOutcomeState`, `core-05-s4/MergeIntentRecorded`.
- Decision inputs consumed: Forge action result kind, exact-head proof, retryability, blocker/failure
  reason class, source action event id, `expectedHeadSha`.

Execution-time dependency commits: `core-05-s1-completion-contracts`, `core-05-s4-forge-intents-and-blockers`. Runtime execution must provide {{DEPENDENCY_COMMITS}} for producer stories that have reached tracker status merged.

## Non-Goals And STOP Conditions

- Performing Forge merge/enqueue/update operations.
- Recording lifecycle transitions; core-01 owns the lifecycle transition that cites this fact.
- Recovery classification over ambiguous or retryable outcomes (`core-06-s2`).

- Package/module boundary: `packages/sdk/src/core/completion/post-merge/**`.
- Owned pathset: `packages/sdk/src/core/completion/post-merge/**`,
  `packages/sdk/tests/core/completion/post-merge/**`, and owned SDK export lines.
- Forbidden dependencies: concrete Forge clients, lifecycle transition recording, recovery modules.
- STOP when Forge result evidence cannot prove whether the exact head merged; return ambiguous instead.

Also STOP and report if source gaps, missing dependency inputs, required writes outside the owned pathset, or any need to reinterpret an AC appears.

## Implementation Constraints

## Spec Surface

- Interfaces / types: `classifyPostMergeOutcome`, `recordPostMergeOutcome`.
- Events / append intents: `PostMergeOutcomeRecorded`.
- Provider operations / commands: none; consumes committed Forge action result evidence only.
- Failure and degraded tokens: consumes `PostMergeOutcomeState` from `core-05-s1`.
- Evidence records / attestations: `MergeIntentRecorded`, Forge merge/refusal/action result evidence,
  exact-head refs.

## Responsibilities

- Map Forge merged/queue success at `expectedHeadSha` to `post-merge-confirmed` and lifecycle target
  `completed`.
- Map exact-head retryable refusals to `post-merge-retryable-refused` and lifecycle target
  `merge-waiting`.
- Map exact-head operator/policy blockers to `post-merge-blocked` and lifecycle target `blocked`.
- Map provider invariant/auth/redaction/credential/impossible-method failures to `post-merge-failed`
  and lifecycle target `failed`.
- Map missing, unwritable, not-exact-head, unknown, or contradictory action results to
  `post-merge-outcome-ambiguous` and lifecycle target `blocked`.
- Append `PostMergeOutcomeRecorded` with exact head evidence and source action event id.

Do not introduce implementation choices outside the source contract. Preserve deterministic, fail-closed, event-log, dependency-boundary, and public-import constraints exactly as written.

## Verification

## Coverage Matrix

| Responsibility / spec-surface item | Proven by | Standing gate lane |
|---|---|---|
| Confirmed merge mapping | AC-1 | `coverage:baseline` |
| Retryable refusal mapping | AC-2 | `coverage:baseline` |
| Blocked/failed mapping | AC-3 | `coverage:baseline` |
| Ambiguous outcome fail-closed mapping | AC-4 | `coverage:baseline` |
| `PostMergeOutcomeRecorded` fields | AC-5 | `coverage:baseline` |
| Public exports | AC-6 | `typecheck` |

- Coverage scope and threshold: `packages/sdk/src/core/completion/post-merge/**`, 95% branch.
- Coverage command and instrumented lanes: `pnpm check` via `coverage:baseline`.
- Required tests: AC-1..AC-6 and every outcome row.
- Public exposure: `sdk` import path plus AC-6 public-import test.
- Determinism constraints: injected `evaluatedAt`; no live Forge calls or ambient clock.
- Dependency boundaries: consumes Forge action result DTOs only; no concrete Forge driver import.
- File-si

- Outcome mapping table tests and append field tests.
- Public-import test in AC-6.
- `pnpm check` result.
- Boundary sweep:
  `grep -REn "Date\\.now|new Date\\(|Math\\.random|crypto\\.randomUUID|@octokit|node:http|node:https|child_process|simple-git|from \"testkit\"|from \"@kit/testkit\"" packages/sdk/src/core/completion/post-merge packages/sdk/tests/core/completion/post-merge`
  returns

The repo gate is `pnpm check`. Report exact command output or an explicit blocked reason.

## Commit Cadence

The implementer commits its own work in the story worktree, never the orchestrator:

- make the gate green (`pnpm check`) before every commit;
- make an impl-done commit when the story first proves out, then one commit per fix round;
- tag each commit with trailers `Story: core-05-s5-post-merge-outcomes` and `Round: <n>`;
- on an orchestrator-reported merge-back conflict, rebase the story commits onto the track branch `HEAD`, re-prove with a green gate, and re-commit;
- report a real logic conflict instead of forcing a resolution.

The implementer commits only within the owned pathset in its own story worktree. It never pushes, opens or updates PRs, merges, closes contexts, edits the tracker, or marks stories complete.

## Delivery Report

Report changed files, AC coverage by AC id, per-round commit hashes, tests/checks run, evidence pack, open questions, and blockers. The report and per-round commits are evidence for review and merge-back.

## Mutation Limits

The implementer commits each round within the owned pathset in its own story worktree and rebases only on orchestrator request. It performs no pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - Completion, verification, and recovery](../../../README.md) · **← Prev:** [Reviewer Prompt - core-05-s4-forge-intents-and-blockers](../core-05-s4-forge-intents-and-blockers/reviewer.md) · **Next →:** [Reviewer Prompt - core-05-s5-post-merge-outcomes](./reviewer.md)

<!-- /DOCS-NAV -->
