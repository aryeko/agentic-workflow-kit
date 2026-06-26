# Implementer Prompt - core-05-s3-merge-readiness

## Assigned Routing

- Source story id: `core-05-s3-merge-readiness`
- Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7
- Model class: `strong-coder`
- Effort: `high`
- Suggested-tier floor: `elevated`
- Reasoning tier: `elevated`
- Routing rationale: minimal compliant route. The frozen DAG sets an elevated floor, and merge readiness safety boundary and capability-gated all-true predicate; no critical/frontier escalation is authorized by the source contract.

## Exact Task

Implement `core-05-s3-merge-readiness` for epic `epic-5-completion-verification-and-recovery`: Evaluate fail-closed merge readiness over completion, policy, Forge evidence, checks, reviews, protection, freshness, and capability gates.

Source story: `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-05-s3-merge-readiness.md`. Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7.

## Why It Matters

Evaluate the fail-closed merge predicate and append `MergeDecisionRecorded` only when completion,
policy, Forge, review/thread, branch freshness, protection, verification, and capability gate evidence
all match the candidate head.

Downstream dependents: `core-05-s4-forge-intents-and-blockers`. Dependency inputs and public contracts from this story must be stable before those dependents run.

## Required Reading

- `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-05-s3-merge-readiness.md`
- `docs/implementation/epics/epic-5-completion-verification-and-recovery/story-dag.md`
- Core-05 design files.
- `core-05-s1-completion-contracts` and `core-05-s2-completion-evidence`.
- Epic 3 core-02 gate evaluator and record contracts.
- Runtime dependency commits: `{{DEPENDENCY_COMMITS}}` for producer stories listed below.

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

## Allowed Writes

- Package/module boundary: `packages/sdk/src/core/completion/merge-readiness/**`.
- Owned pathset: `packages/sdk/src/core/completion/merge-readiness/**`,
  `packages/sdk/tests/core/completion/merge-readiness/**`, and owned SDK export lines.
- Forbidden dependencies: concrete Forge drivers, network/process/git APIs, completion-evidence
  behavior rewrites, recovery modules.
- STOP when a merge predicate branch value is represented only as a ref/hash/citation without a field or
  resolver that supplies the actual decision value.

Every other write is forbidden, including execution package files, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, and unrelated SDK surfaces.

## Dependency Inputs

- Covers signals: merge readiness predicate over policy, checks, review/thread evidence, branch
  freshness, protection, and capability gate records.
- Depends on: `core-05-s1-completion-contracts`, `core-05-s2-completion-evidence`, prior fro

Execution-time dependency commits: `core-05-s1-completion-contracts`, `core-05-s2-completion-evidence`. Runtime execution must provide {{DEPENDENCY_COMMITS}} for producer stories that have reached tracker status merged.

## Non-Goals And STOP Conditions

- Completion decision production (`core-05-s2`).
- Forge operation/merge intent recording (`core-05-s4`) and Forge action execution.
- Post-merge outcome mapping (`core-05-s5`).

- Package/module boundary: `packages/sdk/src/core/completion/merge-readiness/**`.
- Owned pathset: `packages/sdk/src/core/completion/merge-readiness/**`,
  `packages/sdk/tests/core/completion/merge-readiness/**`, and owned SDK export lines.
- Forbidden dependencies: concrete Forge drivers, network/process/git APIs, completion-evidence
  behavior rewrites, recovery modules.
- STOP when a merge predicate branch value is represented only as a ref/hash/citation without a field or
  resolver that supplies the actual decision value.

Also STOP and report if source gaps, missing dependency inputs, required writes outside the owned pathset, or any need to reinterpret an AC appears.

## Implementation Constraints

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

Do not introduce implementation choices outside the source contract. Preserve deterministic, fail-closed, event-log, dependency-boundary, and public-import constraints exactly as written.

## Verification

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

- Coverage scope and threshold: `packages/sdk/src/core/completion/merge-readiness/**`, 95% branch.
- Coverage command and instrumented lanes: `pnpm check` via `coverage:baseline`.
- Required tests: AC-1 property test and AC-2..AC-7 table fixtures.
- Public exposure: `sdk` import path plus AC-6 public-import test.
- Determinism constraints: injected `evaluatedAt`; no ambient clock or live Forge/CI/PR calls.
- Dependency boundaries: consumes Forge evidence DTOs but never imports a concrete Forge driver.
- File-si

- Property/table tests for every merge predicate and deny state.
- Public-import test in AC-6.
- `pnpm check` result.
- Boundary sweep:
  `grep -REn "Date\\.now|new Date\\(|Math\\.random|crypto\\.randomUUID|@octokit|node:http|node:https|child_process|simple-git|from \"testkit\"|from \"@kit/testkit\"" packages/sdk/src/core/completion/merge-readiness packages/sdk/tests/core/completion/merge-readiness`
  returns

The repo gate is `pnpm check`. Report exact command output or an explicit blocked reason.

## Commit Cadence

The implementer commits its own work in the story worktree, never the orchestrator:

- make the gate green (`pnpm check`) before every commit;
- make an impl-done commit when the story first proves out, then one commit per fix round;
- tag each commit with trailers `Story: core-05-s3-merge-readiness` and `Round: <n>`;
- on an orchestrator-reported merge-back conflict, rebase the story commits onto the track branch `HEAD`, re-prove with a green gate, and re-commit;
- report a real logic conflict instead of forcing a resolution.

The implementer commits only within the owned pathset in its own story worktree. It never pushes, opens or updates PRs, merges, closes contexts, edits the tracker, or marks stories complete.

## Delivery Report

Report changed files, AC coverage by AC id, per-round commit hashes, tests/checks run, evidence pack, open questions, and blockers. The report and per-round commits are evidence for review and merge-back.

## Mutation Limits

The implementer commits each round within the owned pathset in its own story worktree and rebases only on orchestrator request. It performs no pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - Completion, verification, and recovery](../../../README.md) · **← Prev:** [Reviewer Prompt - core-05-s2-completion-evidence](../core-05-s2-completion-evidence/reviewer.md) · **Next →:** [Reviewer Prompt - core-05-s3-merge-readiness](./reviewer.md)

<!-- /DOCS-NAV -->
