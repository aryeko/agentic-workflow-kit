---
title: "core-06-s4-recovery-plan-apply implementation story"
id: "core-06-s4-recovery-plan-apply"
epic: 5
status: "story: ready"
design:
  - "docs/design/30-domain-reference/core/recovery-and-reconciliation/README.md"
  - "docs/design/30-domain-reference/core/recovery-and-reconciliation/recovery-model.md"
---

# core-06-s4-recovery-plan-apply

## Purpose

Plan recovery actions from classified evidence, require `auto-recover` gates for autonomous actions,
record provider-control handoff outcomes, and emit lifecycle recovery-edge requests as appended facts.

## Normative Design

- `docs/design/30-domain-reference/core/recovery-and-reconciliation/README.md`
- `docs/design/30-domain-reference/core/recovery-and-reconciliation/recovery-model.md`
- `docs/implementation/epics/epic-5-completion-verification-and-recovery/story-dag.md`

If these sources do not answer a contract question, this story is not ready.

## Spec Surface

- Interfaces / types: `planRecoveryAction`, `recordRecoveryPlan`, `recordRecoveryActionApplied`.
- Events / append intents: `RecoveryActionPlanned`, `RecoveryActionApplied`.
- Provider operations / commands: provider-control handoff references only (`agent-resume`,
  `host-terminate`, `forge-refresh`, `work-source-release`); no concrete provider implementation.
- Failure and degraded tokens: consumes `auto-recover` gate requirement, `RecoveryState`,
  `ActionSafetyClass`, `RecoveryAction`, and `log-unwritable`/blocked states from `core-06-s1`.
- Evidence records / attestations: `RecoveryClassified`, story-launch records, `CapabilityGateRecord`,
  provider-control evidence refs, lifecycle cursor.

## Responsibilities

- Build deterministic `RecoveryPlan` values from `RecoveryPlanInput` and `RecoveryClassification`.
- Require a committed core-02 `auto-recover` gate for any autonomous `auto-safe` action before applied
  control is recorded.
- Record `RecoveryActionPlanned` with selected action, required gate, lifecycle target, and provider
  control where applicable.
- Record `RecoveryActionApplied` only after supported provider-control evidence is supplied.
- Request only approved lifecycle recovery edges:
  `runner-verifying -> running`, `forge-waiting -> runner-verifying`,
  `merge-waiting -> forge-waiting`, `settling -> merge-waiting`, or terminal `blocked`/`failed`.

## Out of Scope

- Recovery classification (`core-06-s2`).
- Lease acquire/stale-clear record production (`core-06-s3`).
- Provider-control execution, Work Source mutation, and lifecycle transition append; those remain behind
  provider/core-01 contracts.
- ReconciliationBlocked/projection fold (`core-06-s5`).

## Dependencies and Frozen Inputs

- Covers signals: recovery plan and applied action lifecycle recovery-edge signals.
- Depends on: `core-06-s1`, `core-06-s2`, `core-06-s3`, Epic 3 core-02 gate records, core-01 lifecycle
  rules.
- Depended on by: `core-06-s5`, Epic 7.
- Shared shapes consumed: `RecoveryClassification`, `RecoveryPlan`, lease records, `CapabilityGateRecord`.
- Decision inputs consumed: requested action, mode (`manual` or `assisted`), policy ref, capability
  scope, `evaluatedThrough`, classification state/action/safety, lease status, gate allow/deny,
  provider-control evidence refs.

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
- **AC-5** Lifecycle recovery-edge requests are limited to the approved edges listed in design and cite
  recovery event ids; illegal edges fail closed - evidence: `coverage:baseline`
  `recovery-lifecycle-edge-allowlist`.
- **AC-6** Append failures for plan/apply records return blocked/unwritable failure and no success record
  - evidence: `coverage:baseline` `recovery-plan-apply-unwritable`.
- **AC-7** Public SDK importability exposes planning/apply helpers through this story's export lines -
  evidence: `typecheck` public-import test.

## Coverage Matrix

| Responsibility / spec-surface item | Proven by | Standing gate lane |
|---|---|---|
| Deterministic recovery plan | AC-1 | `coverage:baseline` |
| `auto-recover` gate enforcement | AC-2 | `coverage:baseline` |
| `RecoveryActionPlanned` fields | AC-3 | `coverage:baseline` |
| `RecoveryActionApplied` fields/control evidence | AC-4 | `coverage:baseline` |
| Lifecycle recovery-edge allowlist | AC-5 | `coverage:baseline` |
| Append unwritable behavior | AC-6 | `coverage:baseline` |
| Public exports | AC-7 | `typecheck` |

## Predicate-Input Matrix

### Consumed Predicates

| AC or failure row | Predicate / branch value | Declared source value | Producer / resolver | Verdict |
|---|---|---|---|---|
| AC-1 | selected action and plan id inputs | `RecoveryPlanInput` fields and `RecoveryClassification.state` | request + `core-06-s2` | decidable |
| AC-2 | auto-recover gate matches action scope | `CapabilityGateRecord` scope, mode, evidence refs | Epic 3 core-02 | decidable |
| AC-3 | plan event fields | plan result, source event ids, injected clock | owned planner | decidable |
| AC-4 | applied control supported and evidenced | provider-control kind and evidence refs | provider seam evidence | decidable |
| AC-5 | lifecycle edge legal | current/target lifecycle states and recovery event ids | core-01 lifecycle + owned plan | decidable |
| AC-6 | append result | `RunWriter.appendBarrier` result | core-01 writer | decidable |

### Produced Obligations

| Produced record/event/symbol | Required field or symbol | Declared source | Verdict |
|---|---|---|---|
| `RecoveryActionPlanned` | `runId`, `planId`, `selectedAction`, `requiredGate`, `lifecycleTarget`, `providerControl`, `plannedAt`, `sourceEventIds` | request, owned plan, classification, injected clock, source refs | closed |
| `RecoveryActionApplied` | `runId`, `planId`, `appliedControl`, `gateRef`, `appliedEvidenceRefs`, `appliedAt`, `sourceEventIds` | plan, gate record, provider evidence refs, injected clock, source refs | closed |
| Public symbols | export lines | owned source plus SDK barrel lines | closed |

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

## Quality Bar

- Coverage scope and threshold: `packages/sdk/src/core/recovery/plans/**`, 95% branch.
- Coverage command and instrumented lanes: `pnpm check` via `coverage:baseline`.
- Required tests: AC-1..AC-7 and every failure row.
- Public exposure: `sdk` import path plus AC-7 public-import test.
- Determinism constraints: injected `plannedAt`/`appliedAt`; deterministic plan id; no ambient clock/random.
- Dependency boundaries: provider controls are evidence refs only; no concrete provider imports or Work
  Source mutation.
- File-size budget: 260 lines per file; split plan/apply/edge helpers before 400 lines; 800 hard cap.
- Domain non-negotiables: auto-safe is not authorization; committed gate is required.

## Required Reading

- Core-06 design files.
- `core-06-s1`, `core-06-s2`, `core-06-s3`.
- Epic 3 core-02 gate contracts and core-01 lifecycle contracts.

## Deliverable

The `packages/sdk/src/core/recovery/plans/**` module, tests, fixtures, and SDK export lines.

## Evidence Pack

- Plan determinism, gate enforcement, plan/apply field, lifecycle allowlist, unwritable, and public-import tests.
- `pnpm check` result.
- Boundary sweep:
  `grep -REn "Date\\.now|new Date\\(|Math\\.random|crypto\\.randomUUID|AgentProvider|ExecutionHost|ForgeProvider|WorkSource|child_process|node:net|node:http|node:https|from \"testkit\"|from \"@kit/testkit\"" packages/sdk/src/core/recovery/plans packages/sdk/tests/core/recovery/plans`
  returns zero matches except type-only names in tests.

## Boundaries and STOP Conditions

- Package/module boundary: `packages/sdk/src/core/recovery/plans/**`.
- Owned pathset: `packages/sdk/src/core/recovery/plans/**`,
  `packages/sdk/tests/core/recovery/plans/**`, and owned SDK export lines.
- Forbidden dependencies: provider clients, Work Source state writes, lifecycle transition append logic,
  scheduler/admission behavior.
- STOP when a requested recovery action lacks a design state/action/safety mapping or a required gate
  scope source.

## Characterization Review Evidence

- Design -> AC completeness: plan, gate, apply, provider control, lifecycle edge, and append failure
  obligations map to AC-1..AC-6.
- Producer closure: all plan/apply event fields have sources.
- Sweep vocabulary: forbidden tokens do not ban normative provider-control names.
- Failure-token/catalog closure: states/actions/safety classes are from `core-06-s1`.
- Verdict: ready.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - stories](./README.md) · **← Prev:** [core-06-s3-launch-leases implementation story](./core-06-s3-launch-leases.md) · **Next →:** [core-06-s5-reconciliation-projection implementation story](./core-06-s5-reconciliation-projection.md)

<!-- /DOCS-NAV -->
