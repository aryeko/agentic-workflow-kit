# Reviewer Prompt - core-06-s5-reconciliation-projection

## Assigned Routing

- Source story id: `core-06-s5-reconciliation-projection`
- Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7
- Model class: `frontier-reviewer`
- Effort: `high`
- Suggested-tier floor: `elevated`
- Reasoning tier: `elevated`
- Routing rationale: review must independently verify AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 for event-log projection and blocked reconciliation safety boundary for operator surfaces; reviewer routing is fixed to `frontier-reviewer` by package rules.

## Original Scope

- Story id: `core-06-s5-reconciliation-projection`
- Epic slug: `epic-5-completion-verification-and-recovery`
- Source story contract path: `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-06-s5-reconciliation-projection.md`
- Acceptance criteria: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7
- Allowed pathset: `packages/sdk/src/core/recovery/reconciliation/**`, `packages/sdk/src/core/recovery/projections/**`, `packages/sdk/tests/core/recovery/reconciliation/**`, `packages/sdk/tests/core/recovery/projections/**`, own `packages/sdk/src/index.ts` export lines
- Dependencies: `core-06-s1-recovery-contracts`, `core-06-s2-recovery-classifier`, `core-06-s3-launch-leases`, `core-06-s4-recovery-plan-apply`
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus producer contracts listed in the source story.

### Acceptance Criteria

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

### Dependencies And Frozen Inputs

- Covers signals: blocked reconciliation records and recovery projection signals.
- Depends on: `core-06-s1`, `core-06-s2`, `core-06-s3`, `core-06-s4`, core-01 replay/projection contracts.
- Depended on by: Epic 7 operator attention, inspect, explain, and recovery surfaces.
- Shared shapes consumed: committed `RecoveryClassified`, `StoryLaunchLeaseAcquired`,
  `DuplicateLaunchBlocked`, `StaleLaunchClearanceRequested`, `StoryLaunchLeaseCleared`,
  `RecoveryActionPlanned`, `RecoveryActionApplied`, `ReconciliationBlocked`.
- Decision inputs consumed: event envelope type, event sequence/cursor, event payload fields, recovery
  state, parked reason/severity, evidence refs.

### Non-Goals

- Recovery classification (`core-06-s2`), lease acquisition (`core-06-s3`), and plan/apply recording
  (`core-06-s4`).
- Operator UI rendering, Work Source status writes, provider controls, and scheduler behavior.

### STOP Conditions And Boundaries

- Package/module boundary: `packages/sdk/src/core/recovery/reconciliation/**` and
  `packages/sdk/src/core/recovery/projections/**`.
- Owned pathset: those source/test paths plus owned SDK export lines.
- Forbidden dependencies: provider clients, stores, filesystem/process/network APIs, Work Source writes,
  operator UI rendering.
- STOP when projection state would require reading anything other than replayed events and explicit
  inputs.

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

### Coverage Matrix

| Responsibility / spec-surface item | Proven by | Standing gate lane |
|---|---|---|
| `ReconciliationBlocked` fields/severity | AC-1 | `coverage:baseline` |
| Operator-required/forbidden parking | AC-2 | `coverage:baseline` |
| Recovery projection fields | AC-3 | `coverage:baseline` |
| Lease clear epoch matching | AC-4 | `coverage:baseline` |
| Pure replay determinism | AC-5 | `coverage:baseline` |
| Append unwritable behavior | AC-6 | `coverage:baseline` |
| Public exports | AC-7 | `typecheck` |

### Failure and Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `operator-required` | classification cannot safely apply without operator | append `ReconciliationBlocked` | AC-2 |
| `forbidden` | action is forbidden by classification | append `ReconciliationBlocked` or leave terminal blocked | AC-2 |
| `log-unwritable` | blocked record append fails | no success record and projection remains replay-only | AC-6 |

### Validation Failure Modes

| failure mode | invalid fixture | required validation | proven by |
|---|---|---|---|
| stale or mismatched lease clear | clear payload key or epoch differs from the active lease projection | ignore the clear event for projection; do not guess cleanup | AC-4 |

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

- Reconciliation field, parking, projection, lease-clear, determinism, unwritable, and public-import tests.
- `pnpm check` result.
- Boundary sweep:
  `grep -REn "Date\\.now|new Date\\(|Math\\.random|crypto\\.randomUUID|LeaseStore|AgentProvider|ExecutionHost|ForgeProvider|WorkSource|fs\\.|child_process|node:net|node:http|node:https|from \"testkit\"|from \"@kit/testkit\"" packages/sdk/src/core/recovery/reconciliation packages/sdk/src/core/recovery/projections packages/sdk/tests/core/recovery/reconciliation packages/sdk/tests/core/recovery/projections`
  returns zero matches except test-only fixtures.

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source AC id or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside allowed paths. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - Completion, verification, and recovery](../../../README.md) · **← Prev:** [Implementer Prompt - core-06-s5-reconciliation-projection](./implementer.md) · **Next →:** [Epic 5 Execution Tracker](../../tracker.md)

<!-- /DOCS-NAV -->
