# Reviewer Prompt - core-06-s1-recovery-contracts

## Assigned Routing

- Source story id: `core-06-s1-recovery-contracts`
- Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9
- Model class: `frontier-reviewer`
- Effort: `high`
- Suggested-tier floor: `elevated`
- Reasoning tier: `elevated`
- Routing rationale: review must independently verify AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9 for public recovery contract and catalog producer consumed by all recovery behavior stories; reviewer routing is fixed to `frontier-reviewer` by package rules.

## Original Scope

- Story id: `core-06-s1-recovery-contracts`
- Epic slug: `epic-5-completion-verification-and-recovery`
- Source story contract path: `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-06-s1-recovery-contracts.md`
- Acceptance criteria: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9
- Allowed pathset: `packages/sdk/src/core/recovery/contracts/**`, `packages/sdk/tests/core/recovery/contracts/**`, own `packages/sdk/src/index.ts` export lines
- Dependencies: `core-05-s1-completion-contracts`
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus producer contracts listed in the source story.

### Acceptance Criteria

- **AC-1** `RecoveryState` contains exactly `clean-terminal`, `owned-session-resumable`,
  `evidence-refresh-retryable`, `owned-worker-stale-terminable`, `safe-empty-restartable`,
  `stale-launch-clearable`, `operator-approval-needed`, `lease-unavailable`, `log-unwritable`,
  `log-corrupt`, `launch-duplicate-active`, `owner-ambiguous`, `termination-ambiguous`,
  `supervision-stale-ambiguous`, `merge-outcome-ambiguous`, `provider-evidence-gap`,
  `manual-edits-forbidden`, and `terminal-no-recovery` - evidence: `type:fixtures` exhaustive switch
  over the exact literals.
- **AC-2** `ActionSafetyClass` and `RecoveryAction` contain exactly the design literals (`auto-safe`,
  `operator-required`, `forbidden`; `none`, `resume-owned-session`, `retry-evidence-refresh`,
  `request-termination`, `restart-from-cleared-state`, `clear-stale-launch`, `park-for-operator`,
  `block-run`, `fail-run`) - evidence: `type:fixtures` exhaustive catalog fixture.
- **AC-3** `RecoveryEvidenceSnapshot` requires `runId`, `evaluatedThrough`, `observedAt`, state and
  launch projections, lease health, `evidenceRefs`, and `providerGaps`, and uses core-05 state unions
  for optional completion facts without redeclaring them - evidence: `type:fixtures` positive
  constructor plus negative fixture `snapshot-redeclared-completion-state-rejected`.
- **AC-4** Every core-06 event payload type requires the design schema fields, including lease epochs
  only on lease events, classifier rule version/cursor on `RecoveryClassified`, plan/action fields on
  plan/apply events, and parked fields on `ReconciliationBlocked` - evidence: `type:fixtures`
  `core06-payload-shape-matrix`.
- **AC-7** The provider-control catalog contains exactly `agent-resume`, `host-terminate`,
  `forge-refresh`, and `work-source-release` - evidence: `type:fixtures` exhaustive switch plus
  negative fixture `provider-control-unknown-rejected`.
- **AC-8** `RecoveryProjection` requires latest classification by Run, active `story-launch` lease ref,
  duplicate-launch status, latest recovery plan, and parked flag - evidence: `type:fixtures` positive
  projection constructor plus negative fixture `recovery-projection-missing-parked-flag`.
- **AC-9** `RecoveryCoordinator`, `RecoveryPlanInput`, `RecoveryRecordInput`, and `RecoveryPlan` require the
  design fields consumed by planning/apply stories: run/policy/scope inputs, requested action, source
  classification, evaluated-through cursor, selected action, required gate, lifecycle target,
  provider-control handoff, and source event ids - evidence: `type:fixtures` positive constructors plus
  negative fixtures `recovery-plan-input-missing-policy`, `recovery-record-input-missing-source-events`,
  `recovery-plan-missing-selected-action`, and `recovery-coordinator-wrong-method-shape`.
- **AC-5** Runtime catalogs are fro

### Dependencies And Frozen Inputs

- Covers signals: recovery evidence snapshot and classifier result records (snapshot/contract part);
  recovery taxonomy/action-safety/plan/lease/reconciliation payload contract parts.
- Depends on: `core-05-s1-completion-contracts`; prior fro

### Non-Goals

- Classifier behavior, stable rule order, resume/restart predicates (`core-06-s2`).
- Lease acquisition/duplicate/stale clear behavior (`core-06-s3`).
- Planning/apply behavior (`core-06-s4`) and reconciliation/projection fold behavior (`core-06-s5`).
- Provider resume/terminate/refresh/release execution and concrete driver behavior.

### STOP Conditions And Boundaries

- Package/module boundary: `packages/sdk/src/core/recovery/contracts/**`.
- Owned pathset: `packages/sdk/src/core/recovery/contracts/**`,
  `packages/sdk/tests/core/recovery/contracts/**`, and owned SDK export lines.
- Forbidden dependencies: provider clients, process/filesystem/network APIs, manual state repair helpers,
  behavior imports from core-05.
- STOP when a field type requires a later-epic type or a core-05 state union not produced by
  `core-05-s1`.

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

- AC coverage by source AC id: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9.
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
| Recovery state catalog | AC-1 | `type:fixtures` |
| Action and safety catalogs | AC-2 | `type:fixtures` |
| Snapshot shape and core-05 type consumption | AC-3 | `type:fixtures` |
| Event payload shapes | AC-4 | `type:fixtures` |
| Provider-control catalog | AC-7 | `type:fixtures` |
| Recovery projection shape | AC-8 | `type:fixtures` |
| Coordinator, plan input, record input, and plan shapes | AC-9 | `type:fixtures` |
| Runtime-fro

## Failure and Degraded Outcomes

This story is the authoritative producer catalog for core-06 recovery states, action classes, actions,
and failure/degraded modes.

| token | trigger | required behavior | proven by |
|---|---|---|---|
| recovery state catalog mismatch | implementation omits, renames, or adds a recovery state | `type:fixtures` fails exhaustiveness | AC-1 |
| action/safety catalog mismatch | implementation omits, renames, or adds action or safety literal | `type:fixtures` fails exhaustiveness | AC-2 |
| snapshot shape invalid | required snapshot field missing or completion state redeclared | named negative fixture fails | AC-3 |
| payload shape invalid | event payload lacks required design field or has lease epoch on wrong event | named negative fixture fails | AC-4 |
| provider-control catalog mismatch | implementation omits, renames, or adds a provider-control literal | `type:fixtures` fails exhaustiveness | AC-7 |
| recovery projection shape invalid | required projection field is missing | named negative fixture fails | AC-8 |
| coordinator/plan shape invalid | required coordinator, plan input, record input, or plan field is missing | named negative fixture fails | AC-9 |



- Coverage scope and threshold: contract runtime catalogs, 90% statement/branch minimum.
- Coverage command and instrumented lanes: `pnpm check` via `type:fixtures`, `typecheck`, and
  `coverage:baseline`.
- Required tests: AC-1..AC-9 plus every failure row.
- Public exposure: `sdk` import path plus AC-6 public-import test.
- Determinism constraints: no ambient clock/random/provider clients; type/catalog only.
- Dependency boundaries: consumes prior fro

- Positive and negative `type:fixtures` for every catalog, snapshot, and payload.
- Public-import test in AC-6.
- Runtime catalog coverage assertions in AC-5.
- `pnpm check` result.
- Boundary sweep:
  `grep -REn "Date\\.now|new Date\\(|Math\\.random|crypto\\.randomUUID|child_process|node:net|node:http|node:https|@octokit|from \"testkit\"|from \"@kit/testkit\"" packages/sdk/src/core/recovery/contracts packages/sdk/tests/core/recovery/contracts`
  returns

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source AC id or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside allowed paths. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - Completion, verification, and recovery](../../../README.md) · **← Prev:** [Implementer Prompt - core-06-s1-recovery-contracts](./implementer.md) · **Next →:** [Implementer Prompt - core-06-s2-recovery-classifier](../core-06-s2-recovery-classifier/implementer.md)

<!-- /DOCS-NAV -->
