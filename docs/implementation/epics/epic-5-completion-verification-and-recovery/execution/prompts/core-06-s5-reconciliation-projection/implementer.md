# Implementer Prompt - core-06-s5-reconciliation-projection

## Assigned Routing

- Source story id: `core-06-s5-reconciliation-projection`
- Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7
- Model class: `strong-coder`
- Effort: `high`
- Suggested-tier floor: `elevated`
- Reasoning tier: `elevated`
- Routing rationale: minimal compliant route. The frozen DAG sets an elevated floor, and event-log projection and blocked reconciliation safety boundary for operator surfaces; no critical/frontier escalation is authorized by the source contract.

## Exact Task

Implement `core-06-s5-reconciliation-projection` for epic `epic-5-completion-verification-and-recovery`: Record blocked reconciliation and fold recovery projection fields for operator attention and downstream surfaces.

Source story: `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-06-s5-reconciliation-projection.md`. Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7.

## Why It Matters

Record blocked reconciliation facts and fold the recovery projection that downstream operator surfaces use
for latest classification, active story-launch lease, duplicate status, latest plan, and parked state.

Downstream dependents: `Epic 7`. Dependency inputs and public contracts from this story must be stable before those dependents run.

## Required Reading

- `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-06-s5-reconciliation-projection.md`
- `docs/implementation/epics/epic-5-completion-verification-and-recovery/story-dag.md`
- Core-06 design files.
- `core-06-s1`, `core-06-s2`, `core-06-s3`, `core-06-s4`.
- Epic 3 core-01 replay/projection contracts.
- Runtime dependency commits: `{{DEPENDENCY_COMMITS}}` for producer stories listed below.

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

## Allowed Writes

- Package/module boundary: `packages/sdk/src/core/recovery/reconciliation/**` and
  `packages/sdk/src/core/recovery/projections/**`.
- Owned pathset: those source/test paths plus owned SDK export lines.
- Forbidden dependencies: provider clients, stores, filesystem/process/network APIs, Work Source writes,
  operator UI rendering.
- STOP when projection state would require reading anything other than replayed events and explicit
  inputs.

Every other write is forbidden, including execution package files, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, and unrelated SDK surfaces.

## Dependency Inputs

- Covers signals: blocked reconciliation records and recovery projection signals.
- Depends on: `core-06-s1`, `core-06-s2`, `core-06-s3`, `core-06-s4`, core-01 replay/projection contracts.
- Depended on by: Epic 7 operator attention, inspect, explain, and recovery surfaces.
- Shared shapes consumed: committed `RecoveryClassified`, `StoryLaunchLeaseAcquired`,
  `DuplicateLaunchBlocked`, `StaleLaunchClearanceRequested`, `StoryLaunchLeaseCleared`,
  `RecoveryActionPlanned`, `RecoveryActionApplied`, `ReconciliationBlocked`.
- Decision inputs consumed: event envelope type, event sequence/cursor, event payload fields, recovery
  state, parked reason/severity, evidence refs.

Execution-time dependency commits: `core-06-s1-recovery-contracts`, `core-06-s2-recovery-classifier`, `core-06-s3-launch-leases`, `core-06-s4-recovery-plan-apply`. Runtime execution must provide {{DEPENDENCY_COMMITS}} for producer stories that have reached tracker status merged.

## Non-Goals And STOP Conditions

- Recovery classification (`core-06-s2`), lease acquisition (`core-06-s3`), and plan/apply recording
  (`core-06-s4`).
- Operator UI rendering, Work Source status writes, provider controls, and scheduler behavior.

- Package/module boundary: `packages/sdk/src/core/recovery/reconciliation/**` and
  `packages/sdk/src/core/recovery/projections/**`.
- Owned pathset: those source/test paths plus owned SDK export lines.
- Forbidden dependencies: provider clients, stores, filesystem/process/network APIs, Work Source writes,
  operator UI rendering.
- STOP when projection state would require reading anything other than replayed events and explicit
  inputs.

Also STOP and report if source gaps, missing dependency inputs, required writes outside the owned pathset, or any need to reinterpret an AC appears.

## Implementation Constraints

The implementation constraints are the source-owned spec surface and responsibilities below. Do not introduce implementation choices outside this contract. Preserve deterministic, fail-closed, event-log, dependency-boundary, and public-import constraints exactly as written.

### Spec Surface

- Interfaces / types: `recordReconciliationBlocked`, `foldRecoveryProjection`.
- Events / append intents: `ReconciliationBlocked`.
- Provider operations / commands: none.
- Failure and degraded tokens: consumes `RecoveryState` and failure modes from `core-06-s1`.
- Evidence records / attestations: committed `RecoveryClassified` events from `core-06-s4`,
  story-launch lease records, recovery plan/apply records, evidence refs, cursor.

### Responsibilities

- Append `ReconciliationBlocked` with `runId`, `recoveryState`, `parkedReason`, `severity`,
  `evidenceRefs`, `cursor`, and `blockedAt` when recovery cannot safely apply.
- Ensure parked records carry operator-consumable summary/severity/evidence fields.
- Fold a pure replay recovery projection with latest classification by Run, active story-launch lease ref,
  duplicate-launch status, latest recovery plan, and parked flag.
- Never write projection state directly; projection is pure replay only.
- Treat ambiguous/corrupt/unwritable inputs as blocked/parked rather than guessed.

## Verification

The verification contract is the source-owned coverage matrix, quality bar, and evidence pack below. The repo gate is `pnpm check`; report exact command output or an explicit blocked reason.

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

## Commit Cadence

The implementer commits its own work in the story worktree, never the orchestrator:

- make the gate green (`pnpm check`) before every commit;
- make an impl-done commit when the story first proves out, then one commit per fix round;
- tag each commit with trailers `Story: core-06-s5-reconciliation-projection` and `Round: <n>`;
- on an orchestrator-reported merge-back conflict, rebase the story commits onto the track branch `HEAD`, re-prove with a green gate, and re-commit;
- report a real logic conflict instead of forcing a resolution.

The implementer commits only within the owned pathset in its own story worktree. It never pushes, opens or updates PRs, merges, closes contexts, edits the tracker, or marks stories complete.

## Delivery Report

Report changed files, AC coverage by AC id, per-round commit hashes, tests/checks run, evidence pack, open questions, and blockers. The report and per-round commits are evidence for review and merge-back.

## Mutation Limits

The implementer commits each round within the owned pathset in its own story worktree and rebases only on orchestrator request. It performs no pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - Completion, verification, and recovery](../../../README.md) · **← Prev:** [Reviewer Prompt - core-06-s4-recovery-plan-apply](../core-06-s4-recovery-plan-apply/reviewer.md) · **Next →:** [Reviewer Prompt - core-06-s5-reconciliation-projection](./reviewer.md)

<!-- /DOCS-NAV -->
