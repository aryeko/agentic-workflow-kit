---
title: "core-06-s5-reconciliation-projection implementation story"
id: "core-06-s5-reconciliation-projection"
epic: 5
status: "story: ready"
design:
  - "docs/design/30-domain-reference/core/recovery-and-reconciliation/README.md"
  - "docs/design/30-domain-reference/core/recovery-and-reconciliation/recovery-model.md"
---

# core-06-s5-reconciliation-projection

## Purpose

Record blocked reconciliation facts and fold the recovery projection that downstream operator surfaces use
for latest classification, active story-launch lease, duplicate status, latest plan, and parked state.

## Normative Design

- `docs/design/30-domain-reference/core/recovery-and-reconciliation/README.md`
- `docs/design/30-domain-reference/core/recovery-and-reconciliation/recovery-model.md`
- `docs/implementation/epics/epic-5-completion-verification-and-recovery/story-dag.md`

If these sources do not answer a contract question, this story is not ready.

## Spec Surface

- Interfaces / types: `recordReconciliationBlocked`, `foldRecoveryProjection`.
- Events / append intents: `ReconciliationBlocked`.
- Provider operations / commands: none.
- Failure and degraded tokens: consumes `RecoveryState` and failure modes from `core-06-s1`.
- Evidence records / attestations: `RecoveryClassified`, story-launch lease records, recovery plan/apply
  records, evidence refs, cursor.

## Responsibilities

- Append `ReconciliationBlocked` with `runId`, `recoveryState`, `parkedReason`, `severity`,
  `evidenceRefs`, `cursor`, and `blockedAt` when recovery cannot safely apply.
- Ensure parked records carry operator-consumable summary/severity/evidence fields.
- Fold a pure replay recovery projection with latest classification by Run, active story-launch lease ref,
  duplicate-launch status, latest recovery plan, and parked flag.
- Never write projection state directly; projection is pure replay only.
- Treat ambiguous/corrupt/unwritable inputs as blocked/parked rather than guessed.

## Out of Scope

- Recovery classification (`core-06-s2`), lease acquisition (`core-06-s3`), and plan/apply recording
  (`core-06-s4`).
- Operator UI rendering, Work Source status writes, provider controls, and scheduler behavior.

## Dependencies and Frozen Inputs

- Covers signals: blocked reconciliation records and recovery projection signals.
- Depends on: `core-06-s1`, `core-06-s2`, `core-06-s3`, `core-06-s4`, core-01 replay/projection contracts.
- Depended on by: Epic 7 operator attention, inspect, explain, and recovery surfaces.
- Shared shapes consumed: `RecoveryClassified`, `StoryLaunchLeaseAcquired`, `DuplicateLaunchBlocked`,
  `StoryLaunchLeaseCleared`, `RecoveryActionPlanned`, `RecoveryActionApplied`, `ReconciliationBlocked`.
- Decision inputs consumed: event envelope type, event sequence/cursor, event payload fields, recovery
  state, parked reason/severity, evidence refs.

## Acceptance Criteria

- **AC-1** `recordReconciliationBlocked` appends `ReconciliationBlocked` with the exact design fields,
  and `severity` is limited to `operator-attention` or `info` - evidence: `coverage:baseline`
  `reconciliation-blocked-fields-and-severity`.
- **AC-2** Blocked reconciliation records are produced for operator-required or forbidden classifications
  when no supported safe apply path exists, and they cite the classification evidence refs - evidence:
  `coverage:baseline` fixtures `operator-required-parks` and `forbidden-blocks`.
- **AC-3** `foldRecoveryProjection` returns latest classification by Run, active story-launch lease ref,
  duplicate-launch status, latest recovery plan, and parked flag from replay only - evidence:
  `coverage:baseline` `recovery-projection-fields-from-replay`.
- **AC-4** `StoryLaunchLeaseCleared` clears the active lease ref only when the event's key/epoch matches
  the active lease; mismatched clear events leave the projection unchanged and record no guessed cleanup -
  evidence: `coverage:baseline` fixtures `lease-clear-matching-epoch` and
  `lease-clear-mismatched-epoch-ignored`.
- **AC-5** Projection folding is deterministic by event sequence and never reads mutable stores,
  provider clients, Work Source state, or wall clock - evidence: `coverage:baseline`
  `recovery-projection-deterministic-replay` asserts identical event list returns deep-equal projection.
- **AC-6** Append failures for `ReconciliationBlocked` return blocked/unwritable failure and do not
  mutate projections - evidence: `coverage:baseline` `reconciliation-blocked-unwritable`.
- **AC-7** Public SDK importability exposes reconciliation/projection helpers through this story's export
  lines - evidence: `typecheck` public-import test.

## Coverage Matrix

| Responsibility / spec-surface item | Proven by | Standing gate lane |
|---|---|---|
| `ReconciliationBlocked` fields/severity | AC-1 | `coverage:baseline` |
| Operator-required/forbidden parking | AC-2 | `coverage:baseline` |
| Recovery projection fields | AC-3 | `coverage:baseline` |
| Lease clear epoch matching | AC-4 | `coverage:baseline` |
| Pure replay determinism | AC-5 | `coverage:baseline` |
| Append unwritable behavior | AC-6 | `coverage:baseline` |
| Public exports | AC-7 | `typecheck` |

## Predicate-Input Matrix

### Consumed Predicates

| AC or failure row | Predicate / branch value | Declared source value | Producer / resolver | Verdict |
|---|---|---|---|---|
| AC-1 | severity literal and parked fields | request severity, reason, cursor, evidence refs | request + `core-06-s1` | decidable |
| AC-2 | no safe apply path | `RecoveryClassification.actionSafety`, plan/apply status | `core-06-s2`, `core-06-s4` | decidable |
| AC-3 | latest projection fields | replay event sequence and payloads | core-01 replay + core-06 event producers | decidable |
| AC-4 | lease clear key/epoch matches active lease | active lease projection and clear payload | `core-06-s3` events | decidable |
| AC-5 | deterministic replay | ordered event list | core-01 replay input | decidable |
| AC-6 | append result | `RunWriter.appendBarrier` result | core-01 writer | decidable |

### Produced Obligations

| Produced record/event/symbol | Required field or symbol | Declared source | Verdict |
|---|---|---|---|
| `ReconciliationBlocked` | `schema`, `runId`, `recoveryState`, `parkedReason`, `severity`, `evidenceRefs`, `cursor`, `blockedAt` | constant schema, classification/request fields, evidence refs, cursor, injected clock | closed |
| `RecoveryProjection` | latest classification, active lease, duplicate status, latest plan, parked flag | replayed core-06 event payloads | closed |
| Public symbols | export lines | owned source plus SDK barrel lines | closed |

## Failure and Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `operator-required` | classification cannot safely apply without operator | append `ReconciliationBlocked` | AC-2 |
| `forbidden` | action is forbidden by classification | append `ReconciliationBlocked` or leave terminal blocked | AC-2 |
| `log-unwritable` | blocked record append fails | no success record and projection remains replay-only | AC-6 |

## Validation Failure Modes

| failure mode | invalid fixture | required validation | proven by |
|---|---|---|---|
| stale or mismatched lease clear | clear payload key or epoch differs from the active lease projection | ignore the clear event for projection; do not guess cleanup | AC-4 |

## Quality Bar

- Coverage scope and threshold: `packages/sdk/src/core/recovery/reconciliation/**` and
  `packages/sdk/src/core/recovery/projections/**`, 95% branch.
- Coverage command and instrumented lanes: `pnpm check` via `coverage:baseline`.
- Required tests: AC-1..AC-7 and every failure row.
- Public exposure: `sdk` import path plus AC-7 public-import test.
- Determinism constraints: projection is pure replay; no wall-clock read except injected `blockedAt`.
- Dependency boundaries: no provider/store/Work Source mutation; no operator rendering.
- File-size budget: 260 lines per file; split reconciliation and projection modules before 400 lines;
  800 hard cap.
- Domain non-negotiables: projections are derived from the event log, not mutable state.

## Required Reading

- Core-06 design files.
- `core-06-s1`, `core-06-s2`, `core-06-s3`, `core-06-s4`.
- Epic 3 core-01 replay/projection contracts.

## Deliverable

The `packages/sdk/src/core/recovery/reconciliation/**` and
`packages/sdk/src/core/recovery/projections/**` modules, tests, fixtures, and SDK export lines.

## Evidence Pack

- Reconciliation field, parking, projection, lease-clear, determinism, unwritable, and public-import tests.
- `pnpm check` result.
- Boundary sweep:
  `grep -REn "Date\\.now|new Date\\(|Math\\.random|crypto\\.randomUUID|LeaseStore|AgentProvider|ExecutionHost|ForgeProvider|WorkSource|fs\\.|child_process|node:net|node:http|node:https|from \"testkit\"|from \"@kit/testkit\"" packages/sdk/src/core/recovery/reconciliation packages/sdk/src/core/recovery/projections packages/sdk/tests/core/recovery/reconciliation packages/sdk/tests/core/recovery/projections`
  returns zero matches except test-only fixtures.

## Boundaries and STOP Conditions

- Package/module boundary: `packages/sdk/src/core/recovery/reconciliation/**` and
  `packages/sdk/src/core/recovery/projections/**`.
- Owned pathset: those source/test paths plus owned SDK export lines.
- Forbidden dependencies: provider clients, stores, filesystem/process/network APIs, Work Source writes,
  operator UI rendering.
- STOP when projection state would require reading anything other than replayed events and explicit
  inputs.

## Characterization Review Evidence

- Design -> AC completeness: blocked reconciliation payload, projection fields, replay-only invariant,
  lease clear safety, and unwritable behavior map to AC-1..AC-6.
- Producer closure: all `ReconciliationBlocked` and projection fields have sources.
- Sweep vocabulary: forbidden tokens do not ban normative recovery projection names.
- Failure-token/catalog closure: recovery states/failure modes are produced by `core-06-s1`.
- Verdict: ready.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - stories](./README.md) · **← Prev:** [core-06-s4-recovery-plan-apply implementation story](./core-06-s4-recovery-plan-apply.md) · **Next →:** [Epic 5 - story DAG](../story-dag.md)

<!-- /DOCS-NAV -->
