---
title: "core-06-s1-recovery-contracts implementation story"
id: "core-06-s1-recovery-contracts"
epic: 5
status: "story: ready"
design:
  - "docs/design/30-domain-reference/core/recovery-and-reconciliation/README.md"
  - "docs/design/30-domain-reference/core/recovery-and-reconciliation/recovery-model.md"
---

# core-06-s1-recovery-contracts

## Purpose

Produce the public recovery contract surface: snapshot, classifier, plan, record input, lease payload,
projection, recovery state/action/safety catalogs, and failure tokens consumed by recovery behavior
stories and Epic 7.

## Normative Design

- `docs/design/30-domain-reference/core/recovery-and-reconciliation/README.md`
- `docs/design/30-domain-reference/core/recovery-and-reconciliation/recovery-model.md`
- `docs/implementation/epics/epic-5-completion-verification-and-recovery/story-dag.md`
- `docs/engineering/testing-policy.md`

If these sources do not answer a contract question, this story is not ready.

## Spec Surface

- Interfaces / types: `RecoveryCoordinator`, `RecoveryEvidenceSnapshot`, `RecoveryClassification`,
  `RecoveryPlanInput`, `RecoveryRecordInput`, `RecoveryPlan`, `RecoveryProjection`, `RecoveryState`,
  `ActionSafetyClass`, `RecoveryAction`.
- Events / append intents: payload types for `StoryLaunchLeaseAcquired`, `DuplicateLaunchBlocked`,
  `RecoveryClassified`, `RecoveryActionPlanned`, `RecoveryActionApplied`,
  `StaleLaunchClearanceRequested`, `StoryLaunchLeaseCleared`, and `ReconciliationBlocked`.
- Provider operations / commands: provider-control literal union `agent-resume`, `host-terminate`,
  `forge-refresh`, `work-source-release`; no provider client.
- Failure and degraded tokens: exact recovery state/failure/action/safety catalogs from the design.
- Evidence records / attestations: consumes core-01 cursor/evidence refs/projections, core-05 state
  unions, fnd-02 lease snapshot/storage health, and core-02 gate records as value types.

## Responsibilities

- Declare the recovery snapshot and classifier/plan/record interfaces exactly once.
- Export runtime-frozen catalogs for recovery states, actions, action-safety classes, provider-control
  kinds, and failure/degraded modes.
- Declare all core-06 event payload shapes and recovery projection fields.
- Expose every public symbol through the SDK entrypoint and prove importability.
- Provide positive and negative type fixtures plus catalog exhaustiveness checks.

## Out of Scope

- Classifier behavior, stable rule order, resume/restart predicates (`core-06-s2`).
- Lease acquisition/duplicate/stale clear behavior (`core-06-s3`).
- Planning/apply behavior (`core-06-s4`) and reconciliation/projection fold behavior (`core-06-s5`).
- Provider resume/terminate/refresh/release execution and concrete driver behavior.

## Dependencies and Frozen Inputs

- Covers signals: recovery evidence snapshot and classifier result records (snapshot/contract part);
  recovery taxonomy/action-safety/plan/lease/reconciliation payload contract parts.
- Depends on: `core-05-s1-completion-contracts`; prior frozen core-01, core-02, core-04, fnd-02, and
  provider-seam value types.
- Depended on by: `core-06-s2`, `core-06-s3`, `core-06-s4`, `core-06-s5`, Epic 7.
- Shared shapes consumed: `core-05-s1/CompletionDecisionState`, `MergeDecisionState`,
  `PostMergeOutcomeState`; core-01 `RunEventCursor`, `EvidenceEventRef`, projections; fnd-02
  `LeaseSnapshot`, `StorageHealth`; core-02 `CapabilityGateRecord`.
- Decision inputs consumed: none; type/catalog producer.

## Acceptance Criteria

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
- **AC-5** Runtime catalogs are frozen substrate, not erased-only aliases - evidence:
  `coverage:baseline` asserts `Object.isFrozen(RECOVERY_STATES) === true`, plus equivalent action and
  safety catalog assertions.
- **AC-6** Public SDK importability exposes every Spec Surface symbol through this story's export lines -
  evidence: `typecheck` public-import test.

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
| Runtime-frozen catalogs | AC-5 | `coverage:baseline` |
| Public SDK exports | AC-6 | `typecheck` |

## Predicate-Input Matrix

### Consumed Predicates

| AC or failure row | Predicate / branch value | Declared source value | Producer / resolver | Verdict |
|---|---|---|---|---|
| AC-1..AC-2 | catalog membership | design literals | owned catalog constants | decidable |
| AC-3 | snapshot field types resolve | prior frozen core/foundation types and `core-05-s1` state unions | upstream producers | decidable |
| AC-4 | payload field presence | owned type declarations and fixtures | owned pathset files | decidable |
| AC-7 | provider-control catalog membership | design provider-control literals | owned catalog constants | decidable |
| AC-8 | projection field presence | design projection fields | owned type declarations and fixtures | decidable |
| AC-9 | coordinator/plan/record field presence | design planning and record input fields consumed by `core-06-s4` | owned type declarations and fixtures | decidable |
| AC-5 | runtime frozen catalog value | owned `as const` exports | owned pathset files | decidable |
| AC-6 | public import path | SDK barrel export lines | owned pathset files | decidable |

### Produced Obligations

| Produced record/event/symbol | Required field or symbol | Declared source | Verdict |
|---|---|---|---|
| Public SDK symbols in Spec Surface | export line | owned `packages/sdk/src/index.ts` line and owned contracts source | closed |
| Runtime catalogs | every recovery state/action/safety/failure literal | explicit design literals | closed |
| Event payload types | required schema and fields | owned TypeScript declarations from design | closed |

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

## Quality Bar

- Coverage scope and threshold: contract runtime catalogs, 90% statement/branch minimum.
- Coverage command and instrumented lanes: `pnpm check` via `type:fixtures`, `typecheck`, and
  `coverage:baseline`.
- Required tests: AC-1..AC-9 plus every failure row.
- Public exposure: `sdk` import path plus AC-6 public-import test.
- Determinism constraints: no ambient clock/random/provider clients; type/catalog only.
- Dependency boundaries: consumes prior frozen value types and `core-05-s1` state unions; no behavior
  imports from core-05 or provider drivers.
- File-size budget: 240 lines per source/test file; split catalogs and payload fixtures before 400
  lines; 800 hard cap.
- Domain non-negotiables: recovery facts are appended events; no manual repair shape.

## Required Reading

- Core-06 design files.
- `core-05-s1-completion-contracts`.
- Prior frozen core-01/core-02/core-04/fnd-02 contracts.

## Deliverable

The `packages/sdk/src/core/recovery/contracts/**` public contract module, tests, fixtures, and SDK
export lines.

## Evidence Pack

- Positive and negative `type:fixtures` for every catalog, snapshot, and payload.
- Public-import test in AC-6.
- Runtime catalog coverage assertions in AC-5.
- `pnpm check` result.
- Boundary sweep:
  `grep -REn "Date\\.now|new Date\\(|Math\\.random|crypto\\.randomUUID|child_process|node:net|node:http|node:https|@octokit|from \"testkit\"|from \"@kit/testkit\"" packages/sdk/src/core/recovery/contracts packages/sdk/tests/core/recovery/contracts`
  returns zero matches except test-only fixtures.

## Boundaries and STOP Conditions

- Package/module boundary: `packages/sdk/src/core/recovery/contracts/**`.
- Owned pathset: `packages/sdk/src/core/recovery/contracts/**`,
  `packages/sdk/tests/core/recovery/contracts/**`, and owned SDK export lines.
- Forbidden dependencies: provider clients, process/filesystem/network APIs, manual state repair helpers,
  behavior imports from core-05.
- STOP when a field type requires a later-epic type or a core-05 state union not produced by
  `core-05-s1`.

## Characterization Review Evidence

- Design -> AC completeness: all recovery types, payloads, provider-control catalogs, projection
  surfaces, coordinator, plan input, record input, and plan shapes map to AC-1..AC-9.
- Producer closure: every public symbol and payload field has a source row.
- Sweep vocabulary: forbidden tokens do not ban normative recovery literals.
- Failure-token/catalog closure: this story owns the exact core-06 catalogs consumed by later stories.
- Verdict: ready.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - stories](./README.md) · **← Prev:** [core-05-s5-post-merge-outcomes implementation story](./core-05-s5-post-merge-outcomes.md) · **Next →:** [core-06-s2-recovery-classifier implementation story](./core-06-s2-recovery-classifier.md)

<!-- /DOCS-NAV -->
