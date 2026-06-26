# Implementer Prompt - core-06-s1-recovery-contracts

## Assigned Routing

- Source story id: `core-06-s1-recovery-contracts`
- Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9
- Model class: `strong-coder`
- Effort: `high`
- Suggested-tier floor: `elevated`
- Reasoning tier: `elevated`
- Routing rationale: minimal compliant route. The frozen DAG sets an elevated floor, and public recovery contract and catalog producer consumed by all recovery behavior stories; no critical/frontier escalation is authorized by the source contract.

## Exact Task

Implement `core-06-s1-recovery-contracts` for epic `epic-5-completion-verification-and-recovery`: Produce recovery snapshot, classifier, plan, event payload, lease-key, projection, action, safety, and failure catalog types.

Source story: `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-06-s1-recovery-contracts.md`. Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9.

## Why It Matters

Produce the public recovery contract surface: snapshot, classifier, plan, record input, lease payload,
projection, recovery state/action/safety catalogs, and failure tokens consumed by recovery behavior
stories and Epic 7.

Downstream dependents: `core-06-s2-recovery-classifier`, `core-06-s3-launch-leases`, `core-06-s4-recovery-plan-apply`, `core-06-s5-reconciliation-projection`. Dependency inputs and public contracts from this story must be stable before those dependents run.

## Required Reading

- `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-06-s1-recovery-contracts.md`
- `docs/implementation/epics/epic-5-completion-verification-and-recovery/story-dag.md`
- Core-06 design files.
- `core-05-s1-completion-contracts`.
- Prior frozen core-01/core-02/core-04/fnd-02 contracts.
- Runtime dependency commits: `{{DEPENDENCY_COMMITS}}` for producer stories listed below.

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

## Allowed Writes

- Package/module boundary: `packages/sdk/src/core/recovery/contracts/**`.
- Owned pathset: `packages/sdk/src/core/recovery/contracts/**`,
  `packages/sdk/tests/core/recovery/contracts/**`, and owned SDK export lines.
- Forbidden dependencies: provider clients, process/filesystem/network APIs, manual state repair helpers,
  behavior imports from core-05.
- STOP when a field type requires a later-epic type or a core-05 state union not produced by
  `core-05-s1`.

Every other write is forbidden, including execution package files, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, and unrelated SDK surfaces.

## Dependency Inputs

- Covers signals: recovery evidence snapshot and classifier result records (snapshot/contract part);
  recovery taxonomy/action-safety/plan/lease/reconciliation payload contract parts.
- Depends on: `core-05-s1-completion-contracts`; prior frozen core-01, core-02, core-04, fnd-02, and
  provider-seam value types.
- Depended on by: `core-06-s2`, `core-06-s3`, `core-06-s4`, `core-06-s5`, Epic 7.
- Shared shapes consumed: `core-05-s1/CompletionDecisionState`, `MergeDecisionState`,
  `PostMergeOutcomeState`; core-01 `RunEventCursor`, `EvidenceEventRef`, projections; fnd-02
  `LeaseSnapshot`, `StorageHealth`; core-02 `CapabilityGateRecord`.
- Decision inputs consumed: none; type/catalog producer.

Execution-time dependency commits: `core-05-s1-completion-contracts`. Runtime execution must provide {{DEPENDENCY_COMMITS}} for producer stories that have reached tracker status merged.

## Non-Goals And STOP Conditions

- Classifier behavior, stable rule order, resume/restart predicates (`core-06-s2`).
- Lease acquisition/duplicate/stale clear behavior (`core-06-s3`).
- Planning/apply behavior (`core-06-s4`) and reconciliation/projection fold behavior (`core-06-s5`).
- Provider resume/terminate/refresh/release execution and concrete driver behavior.

- Package/module boundary: `packages/sdk/src/core/recovery/contracts/**`.
- Owned pathset: `packages/sdk/src/core/recovery/contracts/**`,
  `packages/sdk/tests/core/recovery/contracts/**`, and owned SDK export lines.
- Forbidden dependencies: provider clients, process/filesystem/network APIs, manual state repair helpers,
  behavior imports from core-05.
- STOP when a field type requires a later-epic type or a core-05 state union not produced by
  `core-05-s1`.

Also STOP and report if source gaps, missing dependency inputs, required writes outside the owned pathset, or any need to reinterpret an AC appears.

## Implementation Constraints

The implementation constraints are the source-owned spec surface and responsibilities below. Do not introduce implementation choices outside this contract. Preserve deterministic, fail-closed, event-log, dependency-boundary, and public-import constraints exactly as written.

### Spec Surface

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

### Responsibilities

- Declare the recovery snapshot and classifier/plan/record interfaces exactly once.
- Export runtime-frozen catalogs for recovery states, actions, action-safety classes, provider-control
  kinds, and failure/degraded modes.
- Declare all core-06 event payload shapes and recovery projection fields.
- Expose every public symbol through the SDK entrypoint and prove importability.
- Provide positive and negative type fixtures plus catalog exhaustiveness checks.

## Verification

The verification contract is the source-owned coverage matrix, quality bar, and evidence pack below. The repo gate is `pnpm check`; report exact command output or an explicit blocked reason.

### Coverage Matrix

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

- Positive and negative `type:fixtures` for every catalog, snapshot, and payload.
- Public-import test in AC-6.
- Runtime catalog coverage assertions in AC-5.
- `pnpm check` result.
- Boundary sweep:
  `grep -REn "Date\\.now|new Date\\(|Math\\.random|crypto\\.randomUUID|child_process|node:net|node:http|node:https|@octokit|from \"testkit\"|from \"@kit/testkit\"" packages/sdk/src/core/recovery/contracts packages/sdk/tests/core/recovery/contracts`
  returns zero matches except test-only fixtures.

## Commit Cadence

The implementer commits its own work in the story worktree, never the orchestrator:

- make the gate green (`pnpm check`) before every commit;
- make an impl-done commit when the story first proves out, then one commit per fix round;
- tag each commit with trailers `Story: core-06-s1-recovery-contracts` and `Round: <n>`;
- on an orchestrator-reported merge-back conflict, rebase the story commits onto the track branch `HEAD`, re-prove with a green gate, and re-commit;
- report a real logic conflict instead of forcing a resolution.

The implementer commits only within the owned pathset in its own story worktree. It never pushes, opens or updates PRs, merges, closes contexts, edits the tracker, or marks stories complete.

## Delivery Report

Report changed files, AC coverage by AC id, per-round commit hashes, tests/checks run, evidence pack, open questions, and blockers. The report and per-round commits are evidence for review and merge-back.

## Mutation Limits

The implementer commits each round within the owned pathset in its own story worktree and rebases only on orchestrator request. It performs no pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - Completion, verification, and recovery](../../../README.md) · **← Prev:** [Reviewer Prompt - core-05-s5-post-merge-outcomes](../core-05-s5-post-merge-outcomes/reviewer.md) · **Next →:** [Reviewer Prompt - core-06-s1-recovery-contracts](./reviewer.md)

<!-- /DOCS-NAV -->
