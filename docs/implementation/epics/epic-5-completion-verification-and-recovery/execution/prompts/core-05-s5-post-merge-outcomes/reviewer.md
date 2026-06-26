# Reviewer Prompt - core-05-s5-post-merge-outcomes

## Assigned Routing

- Source story id: `core-05-s5-post-merge-outcomes`
- Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6
- Model class: `frontier-reviewer`
- Effort: `high`
- Suggested-tier floor: `elevated`
- Reasoning tier: `elevated`
- Routing rationale: review must independently verify AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 for post-merge lifecycle target classifier with exact-head fail-closed ambiguity handling; reviewer routing is fixed to `frontier-reviewer` by package rules.

## Original Scope

- Story id: `core-05-s5-post-merge-outcomes`
- Epic slug: `epic-5-completion-verification-and-recovery`
- Source story contract path: `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-05-s5-post-merge-outcomes.md`
- Acceptance criteria: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6
- Allowed pathset: `packages/sdk/src/core/completion/post-merge/**`, `packages/sdk/tests/core/completion/post-merge/**`, own `packages/sdk/src/index.ts` export lines
- Dependencies: `core-05-s1-completion-contracts`, `core-05-s4-forge-intents-and-blockers`
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus producer contracts listed in the source story.

### Acceptance Criteria

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

### Dependencies And Frozen Inputs

- Covers signals: post-merge outcome classification into lifecycle targets.
- Depends on: `core-05-s1-completion-contracts`, `core-05-s4-forge-intents-and-blockers`, Forge action
  result evidence DTOs, core-01 writer/lifecycle contracts.
- Depended on by: core-06 recovery snapshot assemblers and Epic 7.
- Shared shapes consumed: `core-05-s1/PostMergeOutcomeState`, `core-05-s4/MergeIntentRecorded`.
- Decision inputs consumed: Forge action result kind, exact-head proof, retryability, blocker/failure
  reason class, source action event id, `expectedHeadSha`.

### Non-Goals

- Performing Forge merge/enqueue/update operations.
- Recording lifecycle transitions; core-01 owns the lifecycle transition that cites this fact.
- Recovery classification over ambiguous or retryable outcomes (`core-06-s2`).

### STOP Conditions And Boundaries

- Package/module boundary: `packages/sdk/src/core/completion/post-merge/**`.
- Owned pathset: `packages/sdk/src/core/completion/post-merge/**`,
  `packages/sdk/tests/core/completion/post-merge/**`, and owned SDK export lines.
- Forbidden dependencies: concrete Forge clients, lifecycle transition recording, recovery modules.
- STOP when Forge result evidence cannot prove whether the exact head merged; return ambiguous instead.

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
| Confirmed merge mapping | AC-1 | `coverage:baseline` |
| Retryable refusal mapping | AC-2 | `coverage:baseline` |
| Blocked/failed mapping | AC-3 | `coverage:baseline` |
| Ambiguous outcome fail-closed mapping | AC-4 | `coverage:baseline` |
| `PostMergeOutcomeRecorded` fields | AC-5 | `coverage:baseline` |
| Public exports | AC-6 | `typecheck` |

## Failure and Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `post-merge-retryable-refused` | exact-head transient refusal | lifecycle target `merge-waiting` | AC-2 |
| `post-merge-blocked` | exact-head operator/policy blocker | lifecycle target `blocked` | AC-3 |
| `post-merge-failed` | invariant/auth/redaction/credential/impossible-method failure | lifecycle target `failed` | AC-3 |
| `post-merge-outcome-ambiguous` | missing, contradictory, unknown, unwritable, or not-exact-head result | never completed; lifecycle target `blocked` | AC-4 |



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

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source AC id or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside allowed paths. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - Completion, verification, and recovery](../../../README.md) · **← Prev:** [Implementer Prompt - core-05-s5-post-merge-outcomes](./implementer.md) · **Next →:** [Implementer Prompt - core-06-s1-recovery-contracts](../core-06-s1-recovery-contracts/implementer.md)

<!-- /DOCS-NAV -->
