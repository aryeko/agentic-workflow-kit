# Implementer Prompt - core-06-s2-recovery-classifier

## Assigned Routing

- Source story id: `core-06-s2-recovery-classifier`
- Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8
- Model class: `strong-coder`
- Effort: `high`
- Suggested-tier floor: `elevated`
- Reasoning tier: `elevated`
- Routing rationale: minimal compliant route. The frozen DAG sets an elevated floor, and pure recovery classifier safety boundary with stable rule order and fail-closed ambiguity handling; no critical/frontier escalation is authorized by the source contract.

## Exact Task

Implement `core-06-s2-recovery-classifier` for epic `epic-5-completion-verification-and-recovery`: Implement pure stable-order recovery classifier, action-safety matrix, resume/restart eligibility, and deterministic plan-id inputs.

Source story: `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-06-s2-recovery-classifier.md`. Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8.

## Why It Matters

Implement the pure deterministic recovery classifier, stable failure ordering, action-safety matrix,
resume/restart eligibility, and deterministic plan-id input rule over a supplied
`RecoveryEvidenceSnapshot`.

Downstream dependents: `core-06-s4-recovery-plan-apply`, `core-06-s5-reconciliation-projection`. Dependency inputs and public contracts from this story must be stable before those dependents run.

## Required Reading

- `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-06-s2-recovery-classifier.md`
- `docs/implementation/epics/epic-5-completion-verification-and-recovery/story-dag.md`
- Core-06 design files.
- `core-06-s1-recovery-contracts`.
- `core-05-s1-completion-contracts`.
- Runtime dependency commits: `{{DEPENDENCY_COMMITS}}` for producer stories listed below.

## Acceptance Criteria

- **AC-1** `classifyRecovery` applies the design stable rule order exactly: terminal/log/lease/duplicate
  errors are evaluated before ownership/session, retryable completion/merge evidence, stale launch, and
  restart rules - evidence: `coverage:baseline` table `recovery-stable-rule-order` with multi-hit
  fixtures proving first-match precedence.
- **AC-2** The action-safety matrix maps every `RecoveryState` to the exact `ActionSafetyClass` and
  recommended `RecoveryAction`, and `auto-safe` rows still carry `requiredGate === "auto-recover"` -
  evidence: `coverage:baseline` exhaustive matrix `recovery-action-safety-matrix`.
- **AC-3** Resume eligibility returns `owned-session-resumable` only for current non-superseded owned
  sessions with positive resume evidence and no conflicting terminal evidence - evidence:
  `coverage:baseline` fixtures `resume-owned-positive`, `resume-superseded-denied`, and
  `resume-conflicting-terminal-denied`.
- **AC-4** Restart eligibility returns `safe-empty-restartable` only after active launch/writer/owner,
  unverified termination, pending approval, and Work Source claim evidence are all safe/empty/released -
  evidence: `coverage:baseline` fixture matrix `restart-safe-empty-only`.
- **AC-5** Ambiguous, corrupt, unwritable, lease-degraded, owner-ambiguous, termination-ambiguous,
  supervision-stale, merge-outcome-ambiguous, provider-gap, and manual-edit conditions fail closed to the
  exact recovery state literals from `core-06-s1` - evidence: `coverage:baseline`
  `recovery-fail-closed-state-matrix`.
- **AC-6** `RecoveryClassified` payload construction returns `runId`, `recoveryState`, `actionSafety`,
  `recommendedAction`, `classifierRuleVersion`, `cursor`, `evidenceRefs`, and caller-supplied
  `classifiedAt` without using `RunWriter`; append failure handling is outside this pure classifier story -
  evidence: `coverage:baseline` `recovery-classified-payload-fields`.
- **AC-7** Plan-id inputs exclude clock/random values and use only `{runId, policyRef, requestedAction,
  scope, classification.state, evaluatedThrough}` - evidence: `coverage:baseline`
  `plan-id-input-determinism` asserts identical inputs yield identical digest source and changed
  `observedAt` does not change it.
- **AC-8** Public SDK importability exposes classifier helpers through this story's export lines -
  evidence: `typecheck` public-import test.

## Allowed Writes

- Package/module boundary: `packages/sdk/src/core/recovery/classifier/**`.
- Owned pathset: `packages/sdk/src/core/recovery/classifier/**`,
  `packages/sdk/tests/core/recovery/classifier/**`, and owned SDK export lines.
- Forbidden dependencies: live providers, storage stores, run writer, mutable projections, ambient clock,
  random ids, process/network/filesystem APIs.
- STOP when any classifier branch value is not present in `RecoveryEvidenceSnapshot` or a frozen
  producer field.

Every other write is forbidden, including execution package files, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, and unrelated SDK surfaces.

## Dependency Inputs

- Covers signals: classifier behavior part of recovery evidence snapshot and classifier result records;
  recovery taxonomy and stable failure ordering; action-safety classes; resume eligibility; restart
  eligibility.
- Depends on: `core-06-s1-recovery-contracts`, `core-05-s1-completion-contracts`, prior frozen
  liveness/termination facts and core-01 projections.
- Depended on by: `core-06-s4`, `core-06-s5`, Epic 7.
- Shared shapes consumed: `core-06-s1/RecoveryEvidenceSnapshot`, `RecoveryClassification`,
  `RecoveryState`, `ActionSafetyClass`, `RecoveryAction`.
- Decision inputs consumed: snapshot lifecycle state, replay/log health, lease health, story-launch
  lease expiry/holder, session linkage, liveness, termination evidence, completion/merge/post-merge
  states, provider gaps, Work Source claim evidence, `observedAt`.

Execution-time dependency commits: `core-06-s1-recovery-contracts`, `core-05-s1-completion-contracts`. Runtime execution must provide {{DEPENDENCY_COMMITS}} for producer stories that have reached tracker status merged.

## Non-Goals And STOP Conditions

- Lease acquisition and stale launch clearing behavior (`core-06-s3`).
- Capability gate recording and provider-control handoff (`core-06-s4`).
- Recovery projection fold and `ReconciliationBlocked` (`core-06-s5`).

- Package/module boundary: `packages/sdk/src/core/recovery/classifier/**`.
- Owned pathset: `packages/sdk/src/core/recovery/classifier/**`,
  `packages/sdk/tests/core/recovery/classifier/**`, and owned SDK export lines.
- Forbidden dependencies: live providers, storage stores, run writer, mutable projections, ambient clock,
  random ids, process/network/filesystem APIs.
- STOP when any classifier branch value is not present in `RecoveryEvidenceSnapshot` or a frozen
  producer field.

Also STOP and report if source gaps, missing dependency inputs, required writes outside the owned pathset, or any need to reinterpret an AC appears.

## Implementation Constraints

The implementation constraints are the source-owned spec surface and responsibilities below. Do not introduce implementation choices outside this contract. Preserve deterministic, fail-closed, event-log, dependency-boundary, and public-import constraints exactly as written.

### Spec Surface

- Interfaces / types: `classifyRecovery`, `classifyActionSafety`, `deriveRecoveryPlanIdInput`.
- Events / append intents: none; this story returns pure `RecoveryClassification` and
  `RecoveryClassified` payload values for a caller-owned append path.
- Provider operations / commands: none.
- Failure and degraded tokens: consumes `core-06-s1` recovery state/action/safety catalogs verbatim.
- Evidence records / attestations: consumes `RecoveryEvidenceSnapshot`, liveness/termination facts,
  core-05 completion/merge/post-merge states, lease snapshots, provider evidence refs, and core-02
  `auto-recover` gate concept as snapshot values.

### Responsibilities

- Classify snapshots according to the stable rule order, returning the first matching recovery state.
- Apply the action-safety matrix exactly, with `auto-safe` only as a candidate requiring a later
  committed `auto-recover` gate.
- Reject resume unless a current non-superseded owned session has positive provider evidence and no
  conflicting terminal evidence.
- Reject restart unless `safe-empty-restartable` evidence proves no active launch/writer/owner,
  no unverified termination, no pending approval, and Work Source claim empty or released.
- Produce `RecoveryClassified` payload values with classifier rule version, cursor, evidence refs, and
  caller-supplied `classifiedAt`; do not append them.
- Define deterministic plan-id input values over `{runId, policyRef, requestedAction, scope,
  classification.state, evaluatedThrough}` without clock or random input.

## Verification

The verification contract is the source-owned coverage matrix, quality bar, and evidence pack below. The repo gate is `pnpm check`; report exact command output or an explicit blocked reason.

### Coverage Matrix

| Responsibility / spec-surface item | Proven by | Standing gate lane |
|---|---|---|
| Stable rule order | AC-1 | `coverage:baseline` |
| Action-safety matrix | AC-2 | `coverage:baseline` |
| Resume eligibility | AC-3 | `coverage:baseline` |
| Restart eligibility | AC-4 | `coverage:baseline` |
| Fail-closed ambiguous/degraded states | AC-5 | `coverage:baseline` |
| `RecoveryClassified` payload construction | AC-6 | `coverage:baseline` |
| Plan-id deterministic inputs | AC-7 | `coverage:baseline` |
| Public exports | AC-8 | `typecheck` |

- Coverage scope and threshold: `packages/sdk/src/core/recovery/classifier/**`, 95% branch.
- Coverage command and instrumented lanes: `pnpm check` via `coverage:baseline`.
- Required tests: AC-1..AC-8 and every failure row.
- Public exposure: `sdk` import path plus AC-8 public-import test.
- Determinism constraints: explicit `observedAt` input; no ambient clock/random/provider clients.
- Dependency boundaries: pure function over snapshot values; no lease store, run writer, provider, or
  core-05 evaluator calls.
- File-size budget: 260 lines per file; split rule-order and action-safety helpers before 400 lines;
  800 hard cap.
- Domain non-negotiables: no blind relaunch; ambiguous evidence fails closed.

- Stable rule order, action-safety, resume, restart, failure-state, classified-payload, and plan-id tests.
- Public-import test in AC-8.
- `pnpm check` result.
- Boundary sweep:
  `grep -REn "Date\\.now|new Date\\(|Math\\.random|crypto\\.randomUUID|LeaseStore|RunWriter|AgentProvider|ExecutionHost|ForgeProvider|WorkSource|child_process|node:net|node:http|node:https|from \"testkit\"|from \"@kit/testkit\"" packages/sdk/src/core/recovery/classifier packages/sdk/tests/core/recovery/classifier`
  returns zero matches except type-only imports where explicitly allowed by tests.

## Commit Cadence

The implementer commits its own work in the story worktree, never the orchestrator:

- make the gate green (`pnpm check`) before every commit;
- make an impl-done commit when the story first proves out, then one commit per fix round;
- tag each commit with trailers `Story: core-06-s2-recovery-classifier` and `Round: <n>`;
- on an orchestrator-reported merge-back conflict, rebase the story commits onto the track branch `HEAD`, re-prove with a green gate, and re-commit;
- report a real logic conflict instead of forcing a resolution.

The implementer commits only within the owned pathset in its own story worktree. It never pushes, opens or updates PRs, merges, closes contexts, edits the tracker, or marks stories complete.

## Delivery Report

Report changed files, AC coverage by AC id, per-round commit hashes, tests/checks run, evidence pack, open questions, and blockers. The report and per-round commits are evidence for review and merge-back.

## Mutation Limits

The implementer commits each round within the owned pathset in its own story worktree and rebases only on orchestrator request. It performs no pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - Completion, verification, and recovery](../../../README.md) · **← Prev:** [Reviewer Prompt - core-06-s1-recovery-contracts](../core-06-s1-recovery-contracts/reviewer.md) · **Next →:** [Reviewer Prompt - core-06-s2-recovery-classifier](./reviewer.md)

<!-- /DOCS-NAV -->
