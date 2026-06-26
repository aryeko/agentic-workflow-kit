# Reviewer Prompt - core-06-s4-recovery-plan-apply

## Assigned Routing

- Source story id: `core-06-s4-recovery-plan-apply`
- Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8
- Model class: `frontier-reviewer`
- Effort: `high`
- Suggested-tier floor: `elevated`
- Reasoning tier: `elevated`
- Routing rationale: review must independently verify AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8 for auto-recover gate enforcement and provider-control handoff boundary; reviewer routing is fixed to `frontier-reviewer` by package rules.

## Original Scope

- Story id: `core-06-s4-recovery-plan-apply`
- Epic slug: `epic-5-completion-verification-and-recovery`
- Source story contract path: `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-06-s4-recovery-plan-apply.md`
- Acceptance criteria: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8
- Allowed pathset: `packages/sdk/src/core/recovery/plans/**`, `packages/sdk/tests/core/recovery/plans/**`, own `packages/sdk/src/index.ts` export lines
- Dependencies: `core-06-s1-recovery-contracts`, `core-06-s2-recovery-classifier`, `core-06-s3-launch-leases`
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus producer contracts listed in the source story.

### Acceptance Criteria

- **AC-1** `planRecoveryAction` emits a stable `planId` from exactly `{runId, policyRef,
  requestedAction, scope, classification.state, evaluatedThrough}` and selected action/lifecycle/control
  fields from the classification/action matrix - evidence: `coverage:baseline`
  `recovery-plan-deterministic-inputs`.
- **AC-2** Any `auto-safe` action in assisted mode records `requiresGate = "auto-recover"` and cannot be
  applied without a committed matching `CapabilityGateRecord`; denied/missing/mismatched gates park
  rather than apply - evidence: `coverage:baseline` fixtures `auto-recover-gate-required`,
  `auto-recover-gate-mismatch-blocks`, and `manual-mode-no-autonomy`.
- **AC-3** `RecoveryActionPlanned` includes `runId`, `planId`, `selectedAction`, optional
  `requiredGate`, optional `lifecycleTarget`, optional `providerControl`, `plannedAt`, and
  `sourceEventIds` - evidence: `coverage:baseline` `recovery-action-planned-fields`.
- **AC-4** `RecoveryActionApplied` is recorded only with supported provider-control evidence refs for
  `agent-resume`, `host-terminate`, `forge-refresh`, or `work-source-release`, plus optional gate ref -
  evidence: `coverage:baseline` table `recovery-action-applied-control-matrix`.
- **AC-8** `StoryLaunchLeaseCleared` is recorded only when the input classification state is
  `stale-launch-clearable`, the selected action is `clear-stale-launch`, the source
  `StaleLaunchClearanceRequested` key/epoch matches the active lease evidence, and a committed matching
  `auto-recover` gate authori

### Dependencies And Frozen Inputs

- Covers signals: recovery plan and applied action lifecycle recovery-edge signals.
- Depends on: `core-06-s1`, `core-06-s2`, `core-06-s3`, Epic 3 core-02 gate records, core-01 lifecycle
  rules.
- Depended on by: `core-06-s5`, Epic 7.
- Shared shapes consumed: `RecoveryClassification`, `RecoveryPlan`, lease records, `CapabilityGateRecord`.
- Decision inputs consumed: requested action, mode (`manual` or `assisted`), policy ref, capability
  scope, `evaluatedThrough`, classification state/action/safety, lease status, gate allow/deny,
  provider-control evidence refs, and stale-clearance request refs.

### Non-Goals

- Recovery classification (`core-06-s2`).
- Lease acquire/duplicate/stale-clearance request production (`core-06-s3`).
- Provider-control execution, Work Source mutation, and lifecycle transition append; those remain behind
  provider/core-01 contracts.
- ReconciliationBlocked/projection fold (`core-06-s5`).

### STOP Conditions And Boundaries

- Package/module boundary: `packages/sdk/src/core/recovery/plans/**`.
- Owned pathset: `packages/sdk/src/core/recovery/plans/**`,
  `packages/sdk/tests/core/recovery/plans/**`, and owned SDK export lines.
- Forbidden dependencies: provider clients, Work Source state writes, lifecycle transition append logic,
  scheduler/admission behavior.
- STOP when a requested recovery action lacks a design state/action/safety mapping or a required gate
  scope source.

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

- AC coverage by source AC id: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8.
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
| Deterministic recovery plan | AC-1 | `coverage:baseline` |
| `auto-recover` gate enforcement | AC-2 | `coverage:baseline` |
| `RecoveryActionPlanned` fields | AC-3 | `coverage:baseline` |
| `RecoveryActionApplied` fields/control evidence | AC-4 | `coverage:baseline` |
| Gated stale-launch clear event | AC-8 | `coverage:baseline` |
| Lifecycle recovery-edge allowlist | AC-5 | `coverage:baseline` |
| Append unwritable behavior | AC-6 | `coverage:baseline` |
| Public exports | AC-7 | `typecheck` |

## Failure and Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `operator-required` | autonomous gate absent or policy/mode does not permit autonomy | plan parks; no apply success | AC-2 |
| `log-unwritable` | plan/apply append fails | return blocked/unwritable failure | AC-6 |

## Validation Failure Modes

| failure mode | invalid fixture | required validation | proven by |
|---|---|---|---|
| illegal lifecycle edge | requested edge outside approved recovery set | reject the request and record no lifecycle request | AC-5 |
| unsupported provider control | control outside four design literals or missing evidence refs | reject the request and record no applied action | AC-4 |
| ungated stale launch clear | missing/mismatched gate, wrong classification/action, or mismatched lease epoch | reject the clear and record no `StoryLaunchLeaseCleared` | AC-8 |

- Coverage scope and threshold: `packages/sdk/src/core/recovery/plans/**`, 95% branch.
- Coverage command and instrumented lanes: `pnpm check` via `coverage:baseline`.
- Required tests: AC-1..AC-8 and every failure row.
- Public exposure: `sdk` import path plus AC-7 public-import test.
- Determinism constraints: injected `plannedAt`/`appliedAt`; deterministic plan id; no ambient clock/random.
- Dependency boundaries: provider controls are evidence refs only; no concrete provider imports or Work
  Source mutation.
- File-si

- Plan determinism, gate enforcement, plan/apply field, gated stale-launch clear, lifecycle allowlist,
  unwritable, and public-import tests.
- `pnpm check` result.
- Boundary sweep:
  `grep -REn "Date\\.now|new Date\\(|Math\\.random|crypto\\.randomUUID|AgentProvider|ExecutionHost|ForgeProvider|WorkSource|child_process|node:net|node:http|node:https|from \"testkit\"|from \"@kit/testkit\"" packages/sdk/src/core/recovery/plans packages/sdk/tests/core/recovery/plans`
  returns

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source AC id or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside allowed paths. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - Completion, verification, and recovery](../../../README.md) · **← Prev:** [Implementer Prompt - core-06-s4-recovery-plan-apply](./implementer.md) · **Next →:** [Implementer Prompt - core-06-s5-reconciliation-projection](../core-06-s5-reconciliation-projection/implementer.md)

<!-- /DOCS-NAV -->
