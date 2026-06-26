---
title: "core-06-s2-recovery-classifier implementation story"
id: "core-06-s2-recovery-classifier"
epic: 5
status: "story: ready"
design:
  - "docs/design/30-domain-reference/core/recovery-and-reconciliation/README.md"
  - "docs/design/30-domain-reference/core/recovery-and-reconciliation/recovery-model.md"
---

# core-06-s2-recovery-classifier

## Purpose

Implement the pure deterministic recovery classifier, stable failure ordering, action-safety matrix,
resume/restart eligibility, and deterministic plan-id input rule over a supplied
`RecoveryEvidenceSnapshot`.

## Normative Design

- `docs/design/30-domain-reference/core/recovery-and-reconciliation/README.md`
- `docs/design/30-domain-reference/core/recovery-and-reconciliation/recovery-model.md`
- `docs/implementation/epics/epic-5-completion-verification-and-recovery/story-dag.md`

If these sources do not answer a contract question, this story is not ready.

## Spec Surface

- Interfaces / types: `classifyRecovery`, `classifyActionSafety`, `deriveRecoveryPlanIdInput`.
- Events / append intents: none; this story returns pure `RecoveryClassification` and
  `RecoveryClassified` payload values for a caller-owned append path.
- Provider operations / commands: none.
- Failure and degraded tokens: consumes `core-06-s1` recovery state/action/safety catalogs verbatim.
- Evidence records / attestations: consumes `RecoveryEvidenceSnapshot`, liveness/termination facts,
  core-05 completion/merge/post-merge states, lease snapshots, provider evidence refs, and core-02
  `auto-recover` gate concept as snapshot values.

## Responsibilities

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

## Out of Scope

- Lease acquisition and stale launch clearing behavior (`core-06-s3`).
- Capability gate recording and provider-control handoff (`core-06-s4`).
- Recovery projection fold and `ReconciliationBlocked` (`core-06-s5`).

## Dependencies and Frozen Inputs

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

## Predicate-Input Matrix

### Consumed Predicates

| AC or failure row | Predicate / branch value | Declared source value | Producer / resolver | Verdict |
|---|---|---|---|---|
| AC-1 | stable rule order conditions | snapshot state/log/lease/session/liveness/completion/provider fields | `core-06-s1/RecoveryEvidenceSnapshot` | decidable |
| AC-2 | safety class for state | `RecoveryState` literal | `core-06-s1` catalog | decidable |
| AC-3 | current owned resumable session | snapshot launch/session linkage, liveness, provider resume evidence | core-01/core-04/provider evidence fields | decidable |
| AC-4 | safe empty restart | lease status, owner/session/termination/approval/claim evidence | fnd-02, core-04, core-03, Work Source evidence | decidable |
| AC-5 | ambiguous/degraded condition | explicit snapshot gap/health/ambiguity fields | snapshot fields | decidable |
| AC-6 | classified payload fields | classifier result, snapshot cursor/evidence refs, caller-supplied `classifiedAt` | owned classifier result + snapshot | decidable |
| AC-7 | deterministic plan id source | request `runId`, `policyRef`, `requestedAction`, `scope`, classification state, cursor | request + classifier result | decidable |

### Produced Obligations

| Produced record/event/symbol | Required field or symbol | Declared source | Verdict |
|---|---|---|---|
| `RecoveryClassified` | `schema`, `runId`, `recoveryState`, `actionSafety`, `recommendedAction` | owned classifier result | closed |
| `RecoveryClassified` | `classifierRuleVersion`, `cursor`, `evidenceRefs`, `classifiedAt` | version constant, snapshot cursor/evidence refs, injected clock | closed |
| Public symbols | export lines | owned source plus SDK barrel lines | closed |

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

## Quality Bar

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

## Required Reading

- Core-06 design files.
- `core-06-s1-recovery-contracts`.
- `core-05-s1-completion-contracts`.

## Deliverable

The `packages/sdk/src/core/recovery/classifier/**` module, tests, fixtures, and SDK export lines.

## Evidence Pack

- Stable rule order, action-safety, resume, restart, failure-state, classified-payload, and plan-id tests.
- Public-import test in AC-8.
- `pnpm check` result.
- Boundary sweep:
  `grep -REn "Date\\.now|new Date\\(|Math\\.random|crypto\\.randomUUID|LeaseStore|RunWriter|AgentProvider|ExecutionHost|ForgeProvider|WorkSource|child_process|node:net|node:http|node:https|from \"testkit\"|from \"@kit/testkit\"" packages/sdk/src/core/recovery/classifier packages/sdk/tests/core/recovery/classifier`
  returns zero matches except type-only imports where explicitly allowed by tests.

## Boundaries and STOP Conditions

- Package/module boundary: `packages/sdk/src/core/recovery/classifier/**`.
- Owned pathset: `packages/sdk/src/core/recovery/classifier/**`,
  `packages/sdk/tests/core/recovery/classifier/**`, and owned SDK export lines.
- Forbidden dependencies: live providers, storage stores, run writer, mutable projections, ambient clock,
  random ids, process/network/filesystem APIs.
- STOP when any classifier branch value is not present in `RecoveryEvidenceSnapshot` or a frozen
  producer field.

## Characterization Review Evidence

- Design -> AC completeness: stable order, action-safety, resume/restart, ambiguous/fail-closed modes,
  classifier payload, and plan-id determinism map to AC-1..AC-7.
- Producer closure: `RecoveryClassified` fields have sources above.
- Pure/value/classifier boundary: AC-6 produces only return payload values for a caller-owned append
  path; the spec surface names no `RunWriter`, append intent, lease store, provider client, or mutable
  projection obligation. Writer/apply responsibilities remain in `core-06-s4` and reconciliation
  projection responsibilities remain in `core-06-s5`.
- Safety-action provenance: AC-2 may mark rows `auto-safe` only as candidate classifications carrying
  `requiredGate === "auto-recover"`; no recovery, clear, apply, auto-retry, provider-control, or
  lifecycle-edge action is executed or recorded by this pure classifier story.
- Sweep vocabulary: forbidden tokens do not ban normative recovery literals.
- Failure-token/catalog closure: all consumed states/actions are produced by `core-06-s1`.
- Verdict: ready.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - stories](./README.md) · **← Prev:** [core-06-s1-recovery-contracts implementation story](./core-06-s1-recovery-contracts.md) · **Next →:** [core-06-s3-launch-leases implementation story](./core-06-s3-launch-leases.md)

<!-- /DOCS-NAV -->
