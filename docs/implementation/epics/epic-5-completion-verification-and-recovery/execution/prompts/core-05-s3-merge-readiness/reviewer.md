# Reviewer Prompt - core-05-s3-merge-readiness

## Assigned Routing

- Source story id: `core-05-s3-merge-readiness`
- Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7
- Model class: `frontier-reviewer`
- Effort: `high`
- Suggested-tier floor: `elevated`
- Reasoning tier: `elevated`
- Routing rationale: review must independently verify AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 for merge readiness safety boundary and capability-gated all-true predicate; reviewer routing is fixed to `frontier-reviewer` by package rules.

## Original Scope

- Story id: `core-05-s3-merge-readiness`
- Epic slug: `epic-5-completion-verification-and-recovery`
- Source story contract path: `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-05-s3-merge-readiness.md`
- Acceptance criteria: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7
- Allowed pathset: `packages/sdk/src/core/completion/merge-readiness/**`, `packages/sdk/tests/core/completion/merge-readiness/**`, own `packages/sdk/src/index.ts` export lines
- Dependencies: `core-05-s1-completion-contracts`, `core-05-s2-completion-evidence`
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus producer contracts listed in the source story.

### Acceptance Criteria

- **AC-1** `mergeAllowed` returns `merge-ready` only when all eleven design predicate conditions are
  true for the same `headSha` - evidence: `coverage:baseline` property test
  `merge-all-conditions-required` toggles each condition false and asserts not ready.
- **AC-2** Missing, failed, or stale required checks from Forge protection/ruleset evidence return
  `merge-required-check-missing` or `merge-required-check-failed` exactly - evidence:
  `coverage:baseline` fixtures `required-check-missing` and `required-check-failed`.
- **AC-3** Missing approval, unresolved required review threads, stale protection/ruleset evidence,
  stale branch/head/base evidence, Forge unavailability, and denied/missing capability gate each map to
  their exact `MergeDecisionState` literal - evidence: `coverage:baseline`
  `merge-denial-state-matrix` covers every deny literal.
- **AC-4** The `auto-merge` gate is accepted only when the committed `CapabilityGateRecord` matches the
  same `headSha`, PR/provider scope, policy ref, and evidence refs - evidence:
  `coverage:baseline` fixtures `gate-same-scope-allow` and `gate-head-mismatch-denied`.
- **AC-5** `MergeDecisionRecorded` includes `runId`, `state`, `headSha`, `completionEventId`,
  optional `gateRef`, `forgeRefs`, and `evaluatedAt`; append failure returns
  `merge-intent-unwritable` and no success payload - evidence: `coverage:baseline`
  `merge-decision-append-fields` and `merge-decision-unwritable`.
- **AC-6** Public SDK importability exposes `evaluateMergeReadiness` and `mergeAllowed` through this
  story's export lines - evidence: `typecheck` public-import test.
- **AC-7** Disabled merge policy and ambiguous/missing merge head evidence map to exact deny literals:
  `merge-policy-disabled` and `merge-head-ambiguous` - evidence: `coverage:baseline` fixtures
  `merge-policy-disabled` and `merge-head-ambiguous`.

### Dependencies And Frozen Inputs

- Covers signals: merge readiness predicate over policy, checks, review/thread evidence, branch
  freshness, protection, and capability gate records.
- Depends on: `core-05-s1-completion-contracts`, `core-05-s2-completion-evidence`, prior fro

### Non-Goals

- Completion decision production (`core-05-s2`).
- Forge operation/merge intent recording (`core-05-s4`) and Forge action execution.
- Post-merge outcome mapping (`core-05-s5`).

### STOP Conditions And Boundaries

- Package/module boundary: `packages/sdk/src/core/completion/merge-readiness/**`.
- Owned pathset: `packages/sdk/src/core/completion/merge-readiness/**`,
  `packages/sdk/tests/core/completion/merge-readiness/**`, and owned SDK export lines.
- Forbidden dependencies: concrete Forge drivers, network/process/git APIs, completion-evidence
  behavior rewrites, recovery modules.
- STOP when a merge predicate branch value is represented only as a ref/hash/citation without a field or
  resolver that supplies the actual decision value.

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

- AC coverage by source AC id: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7.
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
| All-true merge predicate | AC-1 | `coverage:baseline` |
| Required check semantics | AC-2 | `coverage:baseline` |
| Deny-state mapping | AC-3 | `coverage:baseline` |
| `auto-merge` gate scope match | AC-4 | `coverage:baseline` |
| `MergeDecisionRecorded` append shape/unwritable failure | AC-5 | `coverage:baseline` |
| Public exports | AC-6 | `typecheck` |
| Policy disabled and ambiguous head deny states | AC-7 | `coverage:baseline` |

## Failure and Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `merge-policy-disabled` | resolved merge policy has `runnerMayMerge` false or selected merge method disallowed | deny merge readiness | AC-7 |
| `merge-required-check-missing` | required check absent from exact-head Forge evidence | deny merge readiness | AC-2 |
| `merge-required-check-failed` | required check present but not successful | deny merge readiness | AC-2 |
| `merge-review-not-approved` | required review approval absent | deny merge readiness | AC-3 |
| `merge-unresolved-review-threads` | required thread resolution absent | deny merge readiness | AC-3 |
| `merge-protection-snapshot-stale` | protection/ruleset evidence stale or not inspectable | deny merge readiness | AC-3 |
| `merge-branch-not-fresh` | PR/branch/base evidence does not match head | deny merge readiness | AC-3 |
| `merge-head-ambiguous` | local, PR, branch, or action-observed head evidence cannot resolve to one exact candidate head | deny merge readiness | AC-7 |
| `merge-forge-unavailable` | required Forge evidence unavailable | deny merge readiness | AC-3 |
| `merge-capability-denied` | committed `auto-merge` gate absent, denied, or scope mismatched | deny merge readiness | AC-4 |
| `merge-intent-unwritable` | merge decision append fails | no success fact | AC-5 |



- Coverage scope and threshold: `packages/sdk/src/core/completion/merge-readiness/**`, 95% branch.
- Coverage command and instrumented lanes: `pnpm check` via `coverage:baseline`.
- Required tests: AC-1 property test and AC-2..AC-7 table fixtures.
- Public exposure: `sdk` import path plus AC-6 public-import test.
- Determinism constraints: injected `evaluatedAt`; no ambient clock or live Forge/CI/PR calls.
- Dependency boundaries: consumes Forge evidence DTOs but never imports a concrete Forge driver.
- File-si

- Property/table tests for every merge predicate and deny state.
- Public-import test in AC-6.
- `pnpm check` result.
- Boundary sweep:
  `grep -REn "Date\\.now|new Date\\(|Math\\.random|crypto\\.randomUUID|@octokit|node:http|node:https|child_process|simple-git|from \"testkit\"|from \"@kit/testkit\"" packages/sdk/src/core/completion/merge-readiness packages/sdk/tests/core/completion/merge-readiness`
  returns

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source AC id or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside allowed paths. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - Completion, verification, and recovery](../../../README.md) · **← Prev:** [Implementer Prompt - core-05-s3-merge-readiness](./implementer.md) · **Next →:** [Implementer Prompt - core-05-s4-forge-intents-and-blockers](../core-05-s4-forge-intents-and-blockers/implementer.md)

<!-- /DOCS-NAV -->
