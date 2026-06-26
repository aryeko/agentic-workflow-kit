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

Plan recovery actions from classified evidence, append the committed classification record, require
`auto-recover` gates for autonomous actions, record provider-control handoff outcomes, and emit
lifecycle recovery-edge requests as appended facts.

## Normative Design

- `docs/design/30-domain-reference/core/recovery-and-reconciliation/README.md`
- `docs/design/30-domain-reference/core/recovery-and-reconciliation/recovery-model.md`
- `docs/implementation/epics/epic-5-completion-verification-and-recovery/story-dag.md`

If these sources do not answer a contract question, this story is not ready.

## Spec Surface

- Interfaces / types: `planRecoveryAction`, `recordRecoveryClassified`, `recordRecoveryPlan`,
  `recordRecoveryActionApplied`.
- Events / append intents: `RecoveryClassified`, `RecoveryActionPlanned`, `RecoveryActionApplied`,
  `StoryLaunchLeaseCleared`.
- Provider operations / commands: provider-control handoff references only (`agent-resume`,
  `host-terminate`, `forge-refresh`, `work-source-release`); no concrete provider implementation.
- Failure and degraded tokens: consumes `auto-recover` gate requirement, `RecoveryState`,
  `ActionSafetyClass`, `RecoveryAction`, and `log-unwritable`/blocked states from `core-06-s1`.
- Evidence records / attestations: `core-06-s2` `RecoveryClassified` payload values,
  story-launch records, `CapabilityGateRecord`, provider-control evidence refs, lifecycle cursor.

## Responsibilities

- Build deterministic `RecoveryPlan` values from `RecoveryPlanInput` and `RecoveryClassification`.
- Append the `RecoveryClassified` barrier event from the pure `core-06-s2` payload before requesting an
  `auto-recover` gate or recording unattended plan/apply facts.
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

## Out of Scope

- Recovery classification (`core-06-s2`).
- Lease acquire/duplicate/stale-clearance request production (`core-06-s3`).
- Provider-control execution, Work Source mutation, and lifecycle transition append; those remain behind
  provider/core-01 contracts.
- ReconciliationBlocked/projection fold (`core-06-s5`).

## Dependencies and Frozen Inputs

- Covers signals: committed recovery classification record, recovery plan, and applied action lifecycle
  recovery-edge signals.
- Depends on: `core-06-s1`, `core-06-s2`, `core-06-s3`, Epic 3 core-02 gate records, core-01 lifecycle
  rules.
- Depended on by: `core-06-s5`, Epic 7.
- Shared shapes consumed: `RecoveryClassification`, `RecoveryClassified` payload values,
  `RecoveryPlan`, lease records, `CapabilityGateRecord`.
- Decision inputs consumed: requested action, mode (`manual` or `assisted`), policy ref, capability
  scope, `evaluatedThrough`, classification state/action/safety, lease status, gate allow/deny,
  provider-control evidence refs, and stale-clearance request refs.

## Acceptance Criteria

- **AC-1** `planRecoveryAction` emits a stable `planId` from exactly `{runId, policyRef,
  requestedAction, scope, classification.state, evaluatedThrough}` and selected action/lifecycle/control
  fields from the classification/action matrix - evidence: `coverage:baseline`
  `recovery-plan-deterministic-inputs`.
- **AC-2** Any `auto-safe` action in assisted mode records `requiresGate = "auto-recover"` and cannot be
  applied without a committed matching `CapabilityGateRecord`; denied/missing/mismatched gates park
  rather than apply - evidence: `coverage:baseline` fixtures `auto-recover-gate-required`,
  `auto-recover-gate-mismatch-blocks`, and `manual-mode-no-autonomy`.
- **AC-9** `recordRecoveryClassified` appends the `RecoveryClassified` payload returned by
  `core-06-s2` with its classifier rule version, cursor, evidence refs, and source classification
  values before any unattended `auto-recover` gate request, `RecoveryActionPlanned`, or
  `RecoveryActionApplied` success - evidence: `coverage:baseline`
  `recovery-classified-committed-before-plan-apply`.
- **AC-3** `RecoveryActionPlanned` includes `runId`, `planId`, `selectedAction`, optional
  `requiredGate`, optional `lifecycleTarget`, optional `providerControl`, `plannedAt`, and
  `sourceEventIds`, including the committed `RecoveryClassified` event id - evidence:
  `coverage:baseline` `recovery-action-planned-fields`.
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
- **AC-6** Append failures for classification/plan/apply records return blocked/unwritable failure and
  no success record - evidence: `coverage:baseline` `recovery-plan-apply-unwritable`.
- **AC-7** Public SDK importability exposes planning/apply helpers through this story's export lines -
  evidence: `typecheck` public-import test.

## Coverage Matrix

| Responsibility / spec-surface item | Proven by | Standing gate lane |
|---|---|---|
| Deterministic recovery plan | AC-1 | `coverage:baseline` |
| `auto-recover` gate enforcement | AC-2 | `coverage:baseline` |
| `RecoveryClassified` committed barrier event | AC-9 | `coverage:baseline` |
| `RecoveryActionPlanned` fields | AC-3 | `coverage:baseline` |
| `RecoveryActionApplied` fields/control evidence | AC-4 | `coverage:baseline` |
| Gated stale-launch clear event | AC-8 | `coverage:baseline` |
| Lifecycle recovery-edge allowlist | AC-5 | `coverage:baseline` |
| Append unwritable behavior | AC-6 | `coverage:baseline` |
| Public exports | AC-7 | `typecheck` |

## Predicate-Input Matrix

### Consumed Predicates

| AC or failure row | Predicate / branch value | Declared source value | Producer / resolver | Verdict |
|---|---|---|---|---|
| AC-1 | selected action and plan id inputs | `RecoveryPlanInput` fields and `RecoveryClassification.state` | request + `core-06-s2` | decidable |
| AC-2 | auto-recover gate matches action scope | `CapabilityGateRecord` scope, mode, evidence refs | Epic 3 core-02 | decidable |
| AC-9 | committed classification barrier precedes gated plan/apply | `core-06-s2` `RecoveryClassified` payload, source classification values, cursor, evidence refs, append result | `core-06-s2` + core-01 writer | decidable |
| AC-3 | plan event fields | plan result, source event ids, injected clock | owned planner | decidable |
| AC-4 | applied control supported and evidenced | provider-control kind and evidence refs | provider seam evidence | decidable |
| AC-8 | stale launch clear authorized | `stale-launch-clearable` classification, `clear-stale-launch` action, matching clearance request key/epoch, committed `auto-recover` gate | `core-06-s2`, `core-06-s3`, Epic 3 core-02 | decidable |
| AC-5 | lifecycle edge legal | current/target lifecycle states and recovery event ids | core-01 lifecycle + owned plan | decidable |
| AC-6 | append result | `RunWriter.appendBarrier` result | core-01 writer | decidable |

### Produced Obligations

| Produced record/event/symbol | Required field or symbol | Declared source | Verdict |
|---|---|---|---|
| `RecoveryClassified` | `schema`, `runId`, `recoveryState`, `actionSafety`, `recommendedAction`, `classifierRuleVersion`, `cursor`, `evidenceRefs`, `classifiedAt` | `core-06-s2` payload, caller-owned append request, injected clock/source refs | closed |
| `RecoveryActionPlanned` | `runId`, `planId`, `selectedAction`, `requiredGate`, `lifecycleTarget`, `providerControl`, `plannedAt`, `sourceEventIds` | request, owned plan, classification, injected clock, source refs | closed |
| `RecoveryActionApplied` | `runId`, `planId`, `appliedControl`, `gateRef`, `appliedEvidenceRefs`, `appliedAt`, `sourceEventIds` | plan, gate record, provider evidence refs, injected clock, source refs | closed |
| `StoryLaunchLeaseCleared` | `runId`, `storyLaunchKey`, `clearedLeaseEpoch`, `clearedAt`, `sourceEventIds` | stale-clearance request, matching gate record, plan/apply result, injected clock, source refs | closed |
| Public symbols | export lines | owned source plus SDK barrel lines | closed |

## Failure and Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `operator-required` | autonomous gate absent or policy/mode does not permit autonomy | plan parks; no apply success | AC-2 |
| `log-unwritable` | classification/plan/apply append fails | return blocked/unwritable failure | AC-6 |

## Validation Failure Modes

| failure mode | invalid fixture | required validation | proven by |
|---|---|---|---|
| illegal lifecycle edge | requested edge outside approved recovery set | reject the request and record no lifecycle request | AC-5 |
| unsupported provider control | control outside four design literals or missing evidence refs | reject the request and record no applied action | AC-4 |
| ungated stale launch clear | missing/mismatched gate, wrong classification/action, or mismatched lease epoch | reject the clear and record no `StoryLaunchLeaseCleared` | AC-8 |

## Safety Action Provenance

| unattended action surface | classification producer | committed classification record producer | required committed gate / record | proven by |
|---|---|---|---|---|
| `resume-owned-session`, `retry-evidence-refresh`, `request-termination`, or `restart-from-cleared-state` apply | `core-06-s2/RecoveryClassification` with matching state, selected action, `actionSafety`, and `requiredGate` when auto-safe | `core-06-s4/RecoveryClassified` barrier event append from the `core-06-s2` payload | Epic 3 `CapabilityGateRecord(auto-recover)` matching action scope, policy/mode, and evidence refs before any `RecoveryActionApplied` success | AC-9, AC-2, AC-4 |
| provider-control handoff evidence | `core-06-s2/RecoveryClassification` plus owned `RecoveryPlan` selected action/control | `core-06-s4/RecoveryClassified` barrier event id cited by the plan source ids | committed plan source ids plus supported provider-control evidence refs; no concrete provider client is called by this story | AC-9, AC-3, AC-4 |
| `clear-stale-launch` / `StoryLaunchLeaseCleared` | `core-06-s2/RecoveryClassification.state === "stale-launch-clearable"` and selected action `clear-stale-launch` | `core-06-s4/RecoveryClassified` barrier event append from the stale-launch classification payload | `core-06-s3/StaleLaunchClearanceRequested` matching key/epoch plus committed Epic 3 `CapabilityGateRecord(auto-recover)` | AC-9, AC-8 |
| lifecycle recovery-edge request | owned `RecoveryPlan` selected from `core-06-s2` classification | `core-06-s4/RecoveryClassified` barrier event id cited by the plan/apply source ids | committed recovery event ids cite the plan/apply source; core-01 owns the actual lifecycle transition append | AC-9, AC-5 |

## Quality Bar

- Coverage scope and threshold: `packages/sdk/src/core/recovery/plans/**`, 95% branch.
- Coverage command and instrumented lanes: `pnpm check` via `coverage:baseline`.
- Required tests: AC-1..AC-9 and every failure row.
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

- Classification append ordering, plan determinism, gate enforcement, plan/apply field, gated
  stale-launch clear, lifecycle allowlist, unwritable, and public-import tests.
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

- Design -> AC completeness: classification barrier append, plan, gate, apply, gated stale-launch clear,
  provider control, lifecycle edge, and append failure obligations map to AC-1..AC-9.
- Producer closure: all classification, plan, and apply event fields have sources.
- Safety-action provenance: the table above maps every unattended recovery, provider-control apply,
  stale-launch clear, and lifecycle recovery-edge request to the `core-06-s2` classification producer,
  the `core-06-s4` committed classification record producer, plus a committed `auto-recover` gate or
  relevant committed plan/apply record.
- Sweep vocabulary: forbidden tokens do not ban normative provider-control names.
- Failure-token/catalog closure: states/actions/safety classes are from `core-06-s1`.
- Verdict: ready.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - stories](./README.md) · **← Prev:** [core-06-s3-launch-leases implementation story](./core-06-s3-launch-leases.md) · **Next →:** [core-06-s5-reconciliation-projection implementation story](./core-06-s5-reconciliation-projection.md)

<!-- /DOCS-NAV -->
