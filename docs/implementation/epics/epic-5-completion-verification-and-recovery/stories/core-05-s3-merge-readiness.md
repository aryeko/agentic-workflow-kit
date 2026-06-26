---
title: "core-05-s3-merge-readiness implementation story"
id: "core-05-s3-merge-readiness"
epic: 5
status: "story: ready"
design:
  - "docs/design/30-domain-reference/core/completion-and-merge/README.md"
  - "docs/design/30-domain-reference/core/completion-and-merge/evidence-model-and-predicates.md"
---

# core-05-s3-merge-readiness

## Purpose

Evaluate the fail-closed merge predicate and append `MergeDecisionRecorded` only when completion,
policy, Forge, review/thread, branch freshness, protection, verification, and capability gate evidence
all match the candidate head.

## Normative Design

- `docs/design/30-domain-reference/core/completion-and-merge/README.md`
- `docs/design/30-domain-reference/core/completion-and-merge/evidence-model-and-predicates.md`
- `docs/implementation/epics/epic-5-completion-verification-and-recovery/story-dag.md`

If these sources do not answer a contract question, this story is not ready.

## Spec Surface

- Interfaces / types: `evaluateMergeReadiness`, `mergeAllowed`.
- Events / append intents: `MergeDecisionRecorded`.
- Provider operations / commands: none; consumes committed Forge evidence only.
- Failure and degraded tokens: consumes `core-05-s1/MergeDecisionState` verbatim.
- Evidence records / attestations: `CompletionDecisionRecorded`, Forge PR/check/review/thread/protection
  evidence refs, policy evidence, branch freshness evidence, `CapabilityGateRecord(auto-merge)`.

## Responsibilities

- Require a prior `completion-verified` decision for the same candidate head.
- Check the entire design merge predicate as an all-true rule; any false, missing, stale,
  contradictory, ambiguous, or unwritable input returns the named deny state.
- Require required checks from Forge branch-protection and ruleset evidence when policy requires CI.
- Require review approvals and resolved threads when policy requires them.
- Require a committed `CapabilityGateRecord` allowing `auto-merge` for the same head, PR/provider scope,
  policy ref, and evidence refs.
- Append `MergeDecisionRecorded` at barrier durability or return `merge-intent-unwritable` for append
  failure.

## Out of Scope

- Completion decision production (`core-05-s2`).
- Forge operation/merge intent recording (`core-05-s4`) and Forge action execution.
- Post-merge outcome mapping (`core-05-s5`).

## Dependencies and Frozen Inputs

- Covers signals: merge readiness predicate over policy, checks, review/thread evidence, branch
  freshness, protection, and capability gate records.
- Depends on: `core-05-s1-completion-contracts`, `core-05-s2-completion-evidence`, prior frozen Forge
  evidence DTOs, core-02 gate record contracts, fnd-01 merge policy.
- Depended on by: `core-05-s4-forge-intents-and-blockers`.
- Shared shapes consumed: `core-05-s1/MergeDecisionState`, `core-05-s2/CompletionDecisionRecorded`.
- Decision inputs consumed: completion state/head, policy `runnerMayMerge`, selected merge method,
  local git clean head, changed-file gate result, verification freshness, Forge PR/branch/protection
  evidence heads, required checks, review approval, thread state, `CapabilityGateRecord` fields.

## Acceptance Criteria

- **AC-1** `mergeAllowed` returns `merge-ready` only when all eleven design predicate conditions are
  true for the same `headSha` - evidence: `coverage:baseline` property test
  `merge-all-conditions-required` toggles each condition false and asserts not ready.
- **AC-2** Missing, failed, or stale required checks from Forge protection/ruleset evidence return
  `merge-required-check-missing` or `merge-required-check-failed` exactly - evidence:
  `coverage:baseline` fixtures `required-check-missing` and `required-check-failed`.
- **AC-3** Missing approval, unresolved required review threads, stale protection/ruleset evidence,
  stale branch/head/base evidence, Forge unavailability, and denied/missing capability gate each map to
  their exact `MergeDecisionState` literal - evidence: `coverage:baseline`
  `merge-denial-state-matrix` covers every deny literal.
- **AC-4** The `auto-merge` gate is accepted only when the committed `CapabilityGateRecord` matches the
  same `headSha`, PR/provider scope, policy ref, and evidence refs - evidence:
  `coverage:baseline` fixtures `gate-same-scope-allow` and `gate-head-mismatch-denied`.
- **AC-5** `MergeDecisionRecorded` includes `runId`, `state`, `headSha`, `completionEventId`,
  optional `gateRef`, `forgeRefs`, and `evaluatedAt`; append failure returns
  `merge-intent-unwritable` and no success payload - evidence: `coverage:baseline`
  `merge-decision-append-fields` and `merge-decision-unwritable`.
- **AC-6** Public SDK importability exposes `evaluateMergeReadiness` and `mergeAllowed` through this
  story's export lines - evidence: `typecheck` public-import test.
- **AC-7** Disabled merge policy and ambiguous/missing merge head evidence map to exact deny literals:
  `merge-policy-disabled` and `merge-head-ambiguous` - evidence: `coverage:baseline` fixtures
  `merge-policy-disabled` and `merge-head-ambiguous`.

## Coverage Matrix

| Responsibility / spec-surface item | Proven by | Standing gate lane |
|---|---|---|
| All-true merge predicate | AC-1 | `coverage:baseline` |
| Required check semantics | AC-2 | `coverage:baseline` |
| Deny-state mapping | AC-3 | `coverage:baseline` |
| `auto-merge` gate scope match | AC-4 | `coverage:baseline` |
| `MergeDecisionRecorded` append shape/unwritable failure | AC-5 | `coverage:baseline` |
| Public exports | AC-6 | `typecheck` |
| Policy disabled and ambiguous head deny states | AC-7 | `coverage:baseline` |

## Predicate-Input Matrix

### Consumed Predicates

| AC or failure row | Predicate / branch value | Declared source value | Producer / resolver | Verdict |
|---|---|---|---|---|
| AC-1 | completion is verified | `CompletionDecisionRecorded.state` and `headSha` | `core-05-s2` | decidable |
| AC-1 | merge policy permits method | resolved fnd-01 policy fields | fnd-01 policy producer | decidable |
| AC-2 | required checks present/successful | Forge branch-protection and ruleset evidence fields | Forge port evidence | decidable |
| AC-3 | review/thread/protection/branch/Forge freshness | Forge evidence head and status fields | Forge port evidence | decidable |
| AC-4 | gate matches action scope | `CapabilityGateRecord` scope, head, policy, evidence refs | Epic 3 core-02 | decidable |
| AC-5 | append result | `RunWriter.appendBarrier` result | core-01 writer | decidable |
| AC-7 | policy disabled and head ambiguity | resolved merge policy and local/Forged head evidence fields | fnd-01, fnd-03, Forge evidence | decidable |

### Produced Obligations

| Produced record/event/symbol | Required field or symbol | Declared source | Verdict |
|---|---|---|---|
| `MergeDecisionRecorded` | `schema` | constant schema string | closed |
| `MergeDecisionRecorded` | `runId`, `headSha`, `completionEventId`, `evaluatedAt` | request input, completion event, injected clock | closed |
| `MergeDecisionRecorded` | `state`, `gateRef`, `forgeRefs` | owned merge evaluator result and consumed evidence refs | closed |
| Public symbols | export lines | owned source plus owned SDK barrel lines | closed |

## Failure and Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `merge-policy-disabled` | resolved merge policy has `runnerMayMerge` false or selected merge method disallowed | deny merge readiness | AC-7 |
| `merge-required-check-missing` | required check absent from exact-head Forge evidence | deny merge readiness | AC-2 |
| `merge-required-check-failed` | required check present but not successful | deny merge readiness | AC-2 |
| `merge-review-not-approved` | required review approval absent | deny merge readiness | AC-3 |
| `merge-unresolved-review-threads` | required thread resolution absent | deny merge readiness | AC-3 |
| `merge-protection-snapshot-stale` | protection/ruleset evidence stale or not inspectable | deny merge readiness | AC-3 |
| `merge-branch-not-fresh` | PR/branch/base evidence does not match head | deny merge readiness | AC-3 |
| `merge-head-ambiguous` | local, PR, branch, or action-observed head evidence cannot resolve to one exact candidate head | deny merge readiness | AC-7 |
| `merge-forge-unavailable` | required Forge evidence unavailable | deny merge readiness | AC-3 |
| `merge-capability-denied` | committed `auto-merge` gate absent, denied, or scope mismatched | deny merge readiness | AC-4 |
| `merge-intent-unwritable` | merge decision append fails | no success fact | AC-5 |

## Quality Bar

- Coverage scope and threshold: `packages/sdk/src/core/completion/merge-readiness/**`, 95% branch.
- Coverage command and instrumented lanes: `pnpm check` via `coverage:baseline`.
- Required tests: AC-1 property test and AC-2..AC-7 table fixtures.
- Public exposure: `sdk` import path plus AC-6 public-import test.
- Determinism constraints: injected `evaluatedAt`; no ambient clock or live Forge/CI/PR calls.
- Dependency boundaries: consumes Forge evidence DTOs but never imports a concrete Forge driver.
- File-size budget: 260 lines per source/test file; split predicate helpers before 400 lines; 800 hard cap.
- Domain non-negotiables: any missing, stale, contradictory, ambiguous, or unwritable input fails closed.

## Required Reading

- Core-05 design files.
- `core-05-s1-completion-contracts` and `core-05-s2-completion-evidence`.
- Epic 3 core-02 gate evaluator and record contracts.

## Deliverable

The `packages/sdk/src/core/completion/merge-readiness/**` module, tests, fixtures, and SDK export lines.

## Evidence Pack

- Property/table tests for every merge predicate and deny state.
- Public-import test in AC-6.
- `pnpm check` result.
- Boundary sweep:
  `grep -REn "Date\\.now|new Date\\(|Math\\.random|crypto\\.randomUUID|@octokit|node:http|node:https|child_process|simple-git|from \"testkit\"|from \"@kit/testkit\"" packages/sdk/src/core/completion/merge-readiness packages/sdk/tests/core/completion/merge-readiness`
  returns zero matches except test-only fixtures.

## Boundaries and STOP Conditions

- Package/module boundary: `packages/sdk/src/core/completion/merge-readiness/**`.
- Owned pathset: `packages/sdk/src/core/completion/merge-readiness/**`,
  `packages/sdk/tests/core/completion/merge-readiness/**`, and owned SDK export lines.
- Forbidden dependencies: concrete Forge drivers, network/process/git APIs, completion-evidence
  behavior rewrites, recovery modules.
- STOP when a merge predicate branch value is represented only as a ref/hash/citation without a field or
  resolver that supplies the actual decision value.

## Characterization Review Evidence

- Design -> AC completeness: every merge predicate condition and fail-closed deny state maps to AC-1..AC-7.
- Producer closure: `MergeDecisionRecorded` fields have sources above.
- Sweep vocabulary: forbidden tokens do not ban merge-state literals.
- Failure-token/catalog closure: all consumed merge tokens are produced by `core-05-s1`.
- Verdict: ready.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - stories](./README.md) · **← Prev:** [core-05-s2-completion-evidence implementation story](./core-05-s2-completion-evidence.md) · **Next →:** [core-05-s4-forge-intents-and-blockers implementation story](./core-05-s4-forge-intents-and-blockers.md)

<!-- /DOCS-NAV -->
