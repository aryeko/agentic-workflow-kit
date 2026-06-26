# Implementer Prompt - core-06-s4-recovery-plan-apply

## Assigned Routing

- Source story id: `core-06-s4-recovery-plan-apply`
- Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8
- Model class: `strong-coder`
- Effort: `high`
- Suggested-tier floor: `elevated`
- Reasoning tier: `elevated`
- Routing rationale: minimal compliant route. The frozen DAG sets an elevated floor, and auto-recover gate enforcement and provider-control handoff boundary; no critical/frontier escalation is authorized by the source contract.

## Exact Task

Implement `core-06-s4-recovery-plan-apply` for epic `epic-5-completion-verification-and-recovery`: Plan recovery actions, require auto-recover gates for autonomous actions, hand off provider controls, and record applied actions/lifecycle recovery edges.

Source story: `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-06-s4-recovery-plan-apply.md`. Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8.

## Why It Matters

Plan recovery actions from classified evidence, require `auto-recover` gates for autonomous actions,
record provider-control handoff outcomes, and emit lifecycle recovery-edge requests as appended facts.

Downstream dependents: `core-06-s5-reconciliation-projection`. Dependency inputs and public contracts from this story must be stable before those dependents run.

## Required Reading

- `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-06-s4-recovery-plan-apply.md`
- `docs/implementation/epics/epic-5-completion-verification-and-recovery/story-dag.md`
- Core-06 design files.
- `core-06-s1`, `core-06-s2`, `core-06-s3`.
- Epic 3 core-02 gate contracts and core-01 lifecycle contracts.
- Runtime dependency commits: `{{DEPENDENCY_COMMITS}}` for producer stories listed below.

## Acceptance Criteria

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
  `auto-recover` gate authorizes the assisted clear - evidence: `coverage:baseline`
  `stale-launch-clear-gated-apply-matrix`.
- **AC-5** Lifecycle recovery-edge requests are limited to the approved edges listed in design and cite
  recovery event ids; illegal edges fail closed - evidence: `coverage:baseline`
  `recovery-lifecycle-edge-allowlist`.
- **AC-6** Append failures for plan/apply records return blocked/unwritable failure and no success record
  - evidence: `coverage:baseline` `recovery-plan-apply-unwritable`.
- **AC-7** Public SDK importability exposes planning/apply helpers through this story's export lines -
  evidence: `typecheck` public-import test.

## Allowed Writes

- Package/module boundary: `packages/sdk/src/core/recovery/plans/**`.
- Owned pathset: `packages/sdk/src/core/recovery/plans/**`,
  `packages/sdk/tests/core/recovery/plans/**`, and owned SDK export lines.
- Forbidden dependencies: provider clients, Work Source state writes, lifecycle transition append logic,
  scheduler/admission behavior.
- STOP when a requested recovery action lacks a design state/action/safety mapping or a required gate
  scope source.

Every other write is forbidden, including execution package files, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, and unrelated SDK surfaces.

## Dependency Inputs

- Covers signals: recovery plan and applied action lifecycle recovery-edge signals.
- Depends on: `core-06-s1`, `core-06-s2`, `core-06-s3`, Epic 3 core-02 gate records, core-01 lifecycle
  rules.
- Depended on by: `core-06-s5`, Epic 7.
- Shared shapes consumed: `RecoveryClassification`, `RecoveryPlan`, lease records, `CapabilityGateRecord`.
- Decision inputs consumed: requested action, mode (`manual` or `assisted`), policy ref, capability
  scope, `evaluatedThrough`, classification state/action/safety, lease status, gate allow/deny,
  provider-control evidence refs, and stale-clearance request refs.

Execution-time dependency commits: `core-06-s1-recovery-contracts`, `core-06-s2-recovery-classifier`, `core-06-s3-launch-leases`. Runtime execution must provide {{DEPENDENCY_COMMITS}} for producer stories that have reached tracker status merged.

## Non-Goals And STOP Conditions

- Recovery classification (`core-06-s2`).
- Lease acquire/duplicate/stale-clearance request production (`core-06-s3`).
- Provider-control execution, Work Source mutation, and lifecycle transition append; those remain behind
  provider/core-01 contracts.
- ReconciliationBlocked/projection fold (`core-06-s5`).

- Package/module boundary: `packages/sdk/src/core/recovery/plans/**`.
- Owned pathset: `packages/sdk/src/core/recovery/plans/**`,
  `packages/sdk/tests/core/recovery/plans/**`, and owned SDK export lines.
- Forbidden dependencies: provider clients, Work Source state writes, lifecycle transition append logic,
  scheduler/admission behavior.
- STOP when a requested recovery action lacks a design state/action/safety mapping or a required gate
  scope source.

Also STOP and report if source gaps, missing dependency inputs, required writes outside the owned pathset, or any need to reinterpret an AC appears.

## Implementation Constraints

The implementation constraints are the source-owned spec surface and responsibilities below. Do not introduce implementation choices outside this contract. Preserve deterministic, fail-closed, event-log, dependency-boundary, and public-import constraints exactly as written.

### Spec Surface

- Interfaces / types: `planRecoveryAction`, `recordRecoveryPlan`, `recordRecoveryActionApplied`.
- Events / append intents: `RecoveryActionPlanned`, `RecoveryActionApplied`, `StoryLaunchLeaseCleared`.
- Provider operations / commands: provider-control handoff references only (`agent-resume`,
  `host-terminate`, `forge-refresh`, `work-source-release`); no concrete provider implementation.
- Failure and degraded tokens: consumes `auto-recover` gate requirement, `RecoveryState`,
  `ActionSafetyClass`, `RecoveryAction`, and `log-unwritable`/blocked states from `core-06-s1`.
- Evidence records / attestations: `RecoveryClassified`, story-launch records, `CapabilityGateRecord`,
  provider-control evidence refs, lifecycle cursor.

### Responsibilities

- Build deterministic `RecoveryPlan` values from `RecoveryPlanInput` and `RecoveryClassification`.
- Require a committed core-02 `auto-recover` gate for any autonomous `auto-safe` action before applied
  control is recorded.
- Record `RecoveryActionPlanned` with selected action, required gate, lifecycle target, and provider
  control where applicable.
- Record `RecoveryActionApplied` only after supported provider-control evidence is supplied.
- Record `StoryLaunchLeaseCleared` only for a `stale-launch-clearable` classification whose
  `clear-stale-launch` action has a committed matching `auto-recover` gate and a cited
  `StaleLaunchClearanceRequested` event from `core-06-s3`.
- Request only approved lifecycle recovery edges:
  `runner-verifying -> running`, `forge-waiting -> runner-verifying`,
  `merge-waiting -> forge-waiting`, `settling -> merge-waiting`, or terminal `blocked`/`failed`.

## Verification

The verification contract is the source-owned coverage matrix, quality bar, and evidence pack below. The repo gate is `pnpm check`; report exact command output or an explicit blocked reason.

### Coverage Matrix

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

- Coverage scope and threshold: `packages/sdk/src/core/recovery/plans/**`, 95% branch.
- Coverage command and instrumented lanes: `pnpm check` via `coverage:baseline`.
- Required tests: AC-1..AC-8 and every failure row.
- Public exposure: `sdk` import path plus AC-7 public-import test.
- Determinism constraints: injected `plannedAt`/`appliedAt`; deterministic plan id; no ambient clock/random.
- Dependency boundaries: provider controls are evidence refs only; no concrete provider imports or Work
  Source mutation.
- File-size budget: 260 lines per file; split plan/apply/edge helpers before 400 lines; 800 hard cap.
- Domain non-negotiables: auto-safe is not authorization; committed gate is required.

- Plan determinism, gate enforcement, plan/apply field, gated stale-launch clear, lifecycle allowlist,
  unwritable, and public-import tests.
- `pnpm check` result.
- Boundary sweep:
  `grep -REn "Date\\.now|new Date\\(|Math\\.random|crypto\\.randomUUID|AgentProvider|ExecutionHost|ForgeProvider|WorkSource|child_process|node:net|node:http|node:https|from \"testkit\"|from \"@kit/testkit\"" packages/sdk/src/core/recovery/plans packages/sdk/tests/core/recovery/plans`
  returns zero matches except type-only names in tests.

## Commit Cadence

The implementer commits its own work in the story worktree, never the orchestrator:

- make the gate green (`pnpm check`) before every commit;
- make an impl-done commit when the story first proves out, then one commit per fix round;
- tag each commit with trailers `Story: core-06-s4-recovery-plan-apply` and `Round: <n>`;
- on an orchestrator-reported merge-back conflict, rebase the story commits onto the track branch `HEAD`, re-prove with a green gate, and re-commit;
- report a real logic conflict instead of forcing a resolution.

The implementer commits only within the owned pathset in its own story worktree. It never pushes, opens or updates PRs, merges, closes contexts, edits the tracker, or marks stories complete.

## Delivery Report

Report changed files, AC coverage by AC id, per-round commit hashes, tests/checks run, evidence pack, open questions, and blockers. The report and per-round commits are evidence for review and merge-back.

## Mutation Limits

The implementer commits each round within the owned pathset in its own story worktree and rebases only on orchestrator request. It performs no pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - Completion, verification, and recovery](../../../README.md) · **← Prev:** [Reviewer Prompt - core-06-s3-launch-leases](../core-06-s3-launch-leases/reviewer.md) · **Next →:** [Reviewer Prompt - core-06-s4-recovery-plan-apply](./reviewer.md)

<!-- /DOCS-NAV -->
