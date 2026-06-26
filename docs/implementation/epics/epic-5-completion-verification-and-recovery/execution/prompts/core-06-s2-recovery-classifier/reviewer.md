# Reviewer Prompt - core-06-s2-recovery-classifier

## Assigned Routing

- Source story id: `core-06-s2-recovery-classifier`
- Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8
- Model class: `frontier-reviewer`
- Effort: `high`
- Suggested-tier floor: `elevated`
- Reasoning tier: `elevated`
- Routing rationale: review must independently verify AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8 for pure recovery classifier safety boundary with stable rule order and fail-closed ambiguity handling; reviewer routing is fixed to `frontier-reviewer` by package rules.

## Original Scope

- Story id: `core-06-s2-recovery-classifier`
- Epic slug: `epic-5-completion-verification-and-recovery`
- Source story contract path: `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-06-s2-recovery-classifier.md`
- Acceptance criteria: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8
- Allowed pathset: `packages/sdk/src/core/recovery/classifier/**`, `packages/sdk/tests/core/recovery/classifier/**`, own `packages/sdk/src/index.ts` export lines
- Dependencies: `core-06-s1-recovery-contracts`, `core-05-s1-completion-contracts`
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus producer contracts listed in the source story.

### Acceptance Criteria

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

### Dependencies And Frozen Inputs

- Covers signals: classifier behavior part of recovery evidence snapshot and classifier result records;
  recovery taxonomy and stable failure ordering; action-safety classes; resume eligibility; restart
  eligibility.
- Depends on: `core-06-s1-recovery-contracts`, `core-05-s1-completion-contracts`, prior fro

### Non-Goals

- Lease acquisition and stale launch clearing behavior (`core-06-s3`).
- Capability gate recording and provider-control handoff (`core-06-s4`).
- Recovery projection fold and `ReconciliationBlocked` (`core-06-s5`).

### STOP Conditions And Boundaries

- Package/module boundary: `packages/sdk/src/core/recovery/classifier/**`.
- Owned pathset: `packages/sdk/src/core/recovery/classifier/**`,
  `packages/sdk/tests/core/recovery/classifier/**`, and owned SDK export lines.
- Forbidden dependencies: live providers, storage stores, run writer, mutable projections, ambient clock,
  random ids, process/network/filesystem APIs.
- STOP when any classifier branch value is not present in `RecoveryEvidenceSnapshot` or a fro

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
| Stable rule order | AC-1 | `coverage:baseline` |
| Action-safety matrix | AC-2 | `coverage:baseline` |
| Resume eligibility | AC-3 | `coverage:baseline` |
| Restart eligibility | AC-4 | `coverage:baseline` |
| Fail-closed ambiguous/degraded states | AC-5 | `coverage:baseline` |
| `RecoveryClassified` payload construction | AC-6 | `coverage:baseline` |
| Plan-id deterministic inputs | AC-7 | `coverage:baseline` |
| Public exports | AC-8 | `typecheck` |

## Failure and Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `lease-unavailable` | missing/stale/degraded lease guarantees | classify before ownership/restart rules | AC-1, AC-5 |
| `log-unwritable` / `log-corrupt` | replay/log health unusable in the supplied snapshot | classify fail closed | AC-1, AC-5 |
| `owner-ambiguous` | session linkage unknown or ambiguous | forbid resume/restart | AC-5 |
| `termination-ambiguous` | termination evidence ambiguous | forbid restart/clear/kill | AC-5 |
| `supervision-stale-ambiguous` | liveness/supervision stale ambiguity | operator-required/blocked classification | AC-5 |
| `merge-outcome-ambiguous` | core-05 post-merge state ambiguous | operator-required/blocked classification | AC-5 |
| `provider-evidence-gap` | provider evidence needed to decide is absent | operator-required/blocked classification | AC-5 |
| `manual-edits-forbidden` | manual artifact/log/lease/claim edit detected | forbidden classification | AC-5 |



- Coverage scope and threshold: `packages/sdk/src/core/recovery/classifier/**`, 95% branch.
- Coverage command and instrumented lanes: `pnpm check` via `coverage:baseline`.
- Required tests: AC-1..AC-8 and every failure row.
- Public exposure: `sdk` import path plus AC-8 public-import test.
- Determinism constraints: explicit `observedAt` input; no ambient clock/random/provider clients.
- Dependency boundaries: pure function over snapshot values; no lease store, run writer, provider, or
  core-05 evaluator calls.
- File-si

- Stable rule order, action-safety, resume, restart, failure-state, classified-payload, and plan-id tests.
- Public-import test in AC-8.
- `pnpm check` result.
- Boundary sweep:
  `grep -REn "Date\\.now|new Date\\(|Math\\.random|crypto\\.randomUUID|LeaseStore|RunWriter|AgentProvider|ExecutionHost|ForgeProvider|WorkSource|child_process|node:net|node:http|node:https|from \"testkit\"|from \"@kit/testkit\"" packages/sdk/src/core/recovery/classifier packages/sdk/tests/core/recovery/classifier`
  returns

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source AC id or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside allowed paths. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - Completion, verification, and recovery](../../../README.md) · **← Prev:** [Implementer Prompt - core-06-s2-recovery-classifier](./implementer.md) · **Next →:** [Implementer Prompt - core-06-s3-launch-leases](../core-06-s3-launch-leases/implementer.md)

<!-- /DOCS-NAV -->
