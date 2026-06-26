# Epic 5 Execution Plan

## Source Baseline

- Repo path: `/Users/aryekogan/repos/workflow-kit`
- Worktree path: `/Users/aryekogan/repos/workflow-kit/.worktrees/plan-delivery-epic5`
- Base branch: `origin/v-next`
- HEAD inspected: `9ee76b0`
- Epic slug: `epic-5-completion-verification-and-recovery`
- Package author/date: Codex, 2026-06-26
- Source inventory: frozen DAG plus all ten selected ready story contracts.
- Source files read:
  - `AGENTS.md`
  - `CLAUDE.md`
  - `docs/implementation/epics/epic-5-completion-verification-and-recovery/README.md`
  - `docs/implementation/epics/epic-5-completion-verification-and-recovery/story-dag.md`
  - `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-05-s1-completion-contracts.md`
  - `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-05-s2-completion-evidence.md`
  - `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-05-s3-merge-readiness.md`
  - `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-05-s4-forge-intents-and-blockers.md`
  - `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-05-s5-post-merge-outcomes.md`
  - `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-06-s1-recovery-contracts.md`
  - `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-06-s2-recovery-classifier.md`
  - `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-06-s3-launch-leases.md`
  - `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-06-s4-recovery-plan-apply.md`
  - `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-06-s5-reconciliation-projection.md`

## Readiness Verdict

Verdict: `ready` for package projection. Gate 1 source readiness passed: the Epic 5 DAG frontmatter is `status: "story-dag: frozen"`, all ten selected story contracts are `status: "story: ready"`, every story has stable AC ids, owned pathsets, dependencies, and elevated suggested-tier floors, and no selected STOP condition overlaps a selected AC in a way that requires source repair.

Source-readiness preflights passed for package projection:

- PD-9 substrate presence: catalog-producing stories require runtime-frozen `as const` values plus coverage or type fixtures where coverage lanes are named.
- PD-10 predicate inputs: story predicate matrices name concrete request fields, producer fields, event/projection inputs, or owned resolver outputs for selected ACs.
- PD-11 failure-token/catalog closure: core-05 tokens are owned by `core-05-s1-completion-contracts`; core-06 recovery/action/safety tokens are owned by `core-06-s1-recovery-contracts`; consumers cite those producers.

## Projection Summary

| story id | source AC ids | job | wave | dependencies | dependents | owned pathset | suggested-tier floor | routing |
|---|---|---|---|---|---|---|---|---|
| `core-05-s1-completion-contracts` | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10 | Produce completion/merge value types, state catalogs, event payloads, evaluator interfaces, and failure-token catalogs. | 1 | none | `core-05-s2-completion-evidence`, `core-05-s3-merge-readiness`, `core-05-s4-forge-intents-and-blockers`, `core-05-s5-post-merge-outcomes`, `core-06-s1-recovery-contracts`, `core-06-s2-recovery-classifier` | `packages/sdk/src/core/completion/contracts/**`, `packages/sdk/tests/core/completion/contracts/**`, own `packages/sdk/src/index.ts` export lines | elevated | implementer: strong-coder/high/elevated; reviewer: frontier-reviewer/high/elevated. Rationale: core-05-s1-completion-contracts covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10 and has DAG floor elevated; minimal compliant routing is elevated because public SDK contract and runtime catalog producer consumed by every core-05 behavior story and core-06 recovery. |
| `core-05-s2-completion-evidence` | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9 | Select candidate head, evaluate protected-policy/changed-file gate, verify freshness, and append completion decisions. | 2 | `core-05-s1-completion-contracts` | `core-05-s3-merge-readiness`, `core-05-s4-forge-intents-and-blockers` | `packages/sdk/src/core/completion/evidence/**`, `packages/sdk/tests/core/completion/evidence/**`, own `packages/sdk/src/index.ts` export lines | elevated | implementer: strong-coder/high/elevated; reviewer: frontier-reviewer/high/elevated. Rationale: core-05-s2-completion-evidence covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9 and has DAG floor elevated; minimal compliant routing is elevated because fail-closed exact-head completion predicate over committed evidence and barrier append behavior. |
| `core-05-s3-merge-readiness` | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 | Evaluate fail-closed merge readiness over completion, policy, Forge evidence, checks, reviews, protection, freshness, and capability gates. | 3 | `core-05-s1-completion-contracts`, `core-05-s2-completion-evidence` | `core-05-s4-forge-intents-and-blockers` | `packages/sdk/src/core/completion/merge-readiness/**`, `packages/sdk/tests/core/completion/merge-readiness/**`, own `packages/sdk/src/index.ts` export lines | elevated | implementer: strong-coder/high/elevated; reviewer: frontier-reviewer/high/elevated. Rationale: core-05-s3-merge-readiness covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 and has DAG floor elevated; minimal compliant routing is elevated because merge readiness safety boundary and capability-gated all-true predicate. |
| `core-05-s4-forge-intents-and-blockers` | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 | Record exact-head Forge operation intents, merge intents, and blocker-evidence PR intents without implying completion or merge. | 4 | `core-05-s1-completion-contracts`, `core-05-s2-completion-evidence`, `core-05-s3-merge-readiness` | `core-05-s5-post-merge-outcomes` | `packages/sdk/src/core/completion/intents/**`, `packages/sdk/tests/core/completion/intents/**`, own `packages/sdk/src/index.ts` export lines | elevated | implementer: strong-coder/high/elevated; reviewer: frontier-reviewer/high/elevated. Rationale: core-05-s4-forge-intents-and-blockers covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 and has DAG floor elevated; minimal compliant routing is elevated because exact-head operation intent boundary that separates blocker publication from merge actions. |
| `core-05-s5-post-merge-outcomes` | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 | Classify Forge merge action results into post-merge outcome facts and lifecycle targets. | 5 | `core-05-s1-completion-contracts`, `core-05-s4-forge-intents-and-blockers` | `Epic 7`, `core-06 snapshot consumers` | `packages/sdk/src/core/completion/post-merge/**`, `packages/sdk/tests/core/completion/post-merge/**`, own `packages/sdk/src/index.ts` export lines | elevated | implementer: strong-coder/high/elevated; reviewer: frontier-reviewer/high/elevated. Rationale: core-05-s5-post-merge-outcomes covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 and has DAG floor elevated; minimal compliant routing is elevated because post-merge lifecycle target classifier with exact-head fail-closed ambiguity handling. |
| `core-06-s1-recovery-contracts` | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9 | Produce recovery snapshot, classifier, plan, event payload, lease-key, projection, action, safety, and failure catalog types. | 2 | `core-05-s1-completion-contracts` | `core-06-s2-recovery-classifier`, `core-06-s3-launch-leases`, `core-06-s4-recovery-plan-apply`, `core-06-s5-reconciliation-projection` | `packages/sdk/src/core/recovery/contracts/**`, `packages/sdk/tests/core/recovery/contracts/**`, own `packages/sdk/src/index.ts` export lines | elevated | implementer: strong-coder/high/elevated; reviewer: frontier-reviewer/high/elevated. Rationale: core-06-s1-recovery-contracts covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9 and has DAG floor elevated; minimal compliant routing is elevated because public recovery contract and catalog producer consumed by all recovery behavior stories. |
| `core-06-s2-recovery-classifier` | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8 | Implement pure stable-order recovery classifier, action-safety matrix, resume/restart eligibility, and deterministic plan-id inputs. | 3 | `core-06-s1-recovery-contracts`, `core-05-s1-completion-contracts` | `core-06-s4-recovery-plan-apply`, `core-06-s5-reconciliation-projection` | `packages/sdk/src/core/recovery/classifier/**`, `packages/sdk/tests/core/recovery/classifier/**`, own `packages/sdk/src/index.ts` export lines | elevated | implementer: strong-coder/high/elevated; reviewer: frontier-reviewer/high/elevated. Rationale: core-06-s2-recovery-classifier covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8 and has DAG floor elevated; minimal compliant routing is elevated because pure recovery classifier safety boundary with stable rule order and fail-closed ambiguity handling. |
| `core-06-s3-launch-leases` | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 | Enforce story-launch lease acquisition, duplicate blocking, and stale launch clearance requests. | 3 | `core-06-s1-recovery-contracts` | `core-06-s4-recovery-plan-apply`, `core-06-s5-reconciliation-projection` | `packages/sdk/src/core/recovery/leases/**`, `packages/sdk/tests/core/recovery/leases/**`, own `packages/sdk/src/index.ts` export lines | elevated | implementer: strong-coder/high/elevated; reviewer: frontier-reviewer/high/elevated. Rationale: core-06-s3-launch-leases covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 and has DAG floor elevated; minimal compliant routing is elevated because lease coordination safety boundary with epoch fencing and duplicate launch prevention. |
| `core-06-s4-recovery-plan-apply` | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8 | Plan recovery actions, require auto-recover gates for autonomous actions, hand off provider controls, and record applied actions/lifecycle recovery edges. | 4 | `core-06-s1-recovery-contracts`, `core-06-s2-recovery-classifier`, `core-06-s3-launch-leases` | `core-06-s5-reconciliation-projection` | `packages/sdk/src/core/recovery/plans/**`, `packages/sdk/tests/core/recovery/plans/**`, own `packages/sdk/src/index.ts` export lines | elevated | implementer: strong-coder/high/elevated; reviewer: frontier-reviewer/high/elevated. Rationale: core-06-s4-recovery-plan-apply covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8 and has DAG floor elevated; minimal compliant routing is elevated because auto-recover gate enforcement and provider-control handoff boundary. |
| `core-06-s5-reconciliation-projection` | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 | Record blocked reconciliation and fold recovery projection fields for operator attention and downstream surfaces. | 5 | `core-06-s1-recovery-contracts`, `core-06-s2-recovery-classifier`, `core-06-s3-launch-leases`, `core-06-s4-recovery-plan-apply` | `Epic 7` | `packages/sdk/src/core/recovery/reconciliation/**`, `packages/sdk/src/core/recovery/projections/**`, `packages/sdk/tests/core/recovery/reconciliation/**`, `packages/sdk/tests/core/recovery/projections/**`, own `packages/sdk/src/index.ts` export lines | elevated | implementer: strong-coder/high/elevated; reviewer: frontier-reviewer/high/elevated. Rationale: core-06-s5-reconciliation-projection covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 and has DAG floor elevated; minimal compliant routing is elevated because event-log projection and blocked reconciliation safety boundary for operator surfaces. |

## Execution Waves

A dependent story can start only after every dependency is `merged` in `tracker.md`: its per-round commits have been merged back to the track branch and the merge-back hash has been recorded.

| wave | stories | dispatch rule |
|---|---|---|
| 1 | `core-05-s1-completion-contracts` | Dependencies must be tracker status `merged` before a dependent starts. |
| 2 | `core-05-s2-completion-evidence`, `core-06-s1-recovery-contracts` | Dependencies must be tracker status `merged` before a dependent starts. |
| 3 | `core-05-s3-merge-readiness`, `core-06-s2-recovery-classifier`, `core-06-s3-launch-leases` | Dependencies must be tracker status `merged` before a dependent starts. |
| 4 | `core-05-s4-forge-intents-and-blockers`, `core-06-s4-recovery-plan-apply` | Dependencies must be tracker status `merged` before a dependent starts. |
| 5 | `core-05-s5-post-merge-outcomes`, `core-06-s5-reconciliation-projection` | Dependencies must be tracker status `merged` before a dependent starts. |

## Prompt Inventory

| story id | source AC ids | implementer prompt | reviewer prompt |
|---|---|---|---|
| `core-05-s1-completion-contracts` | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10 | `docs/implementation/epics/epic-5-completion-verification-and-recovery/execution/prompts/core-05-s1-completion-contracts/implementer.md` | `docs/implementation/epics/epic-5-completion-verification-and-recovery/execution/prompts/core-05-s1-completion-contracts/reviewer.md` |
| `core-05-s2-completion-evidence` | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9 | `docs/implementation/epics/epic-5-completion-verification-and-recovery/execution/prompts/core-05-s2-completion-evidence/implementer.md` | `docs/implementation/epics/epic-5-completion-verification-and-recovery/execution/prompts/core-05-s2-completion-evidence/reviewer.md` |
| `core-05-s3-merge-readiness` | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 | `docs/implementation/epics/epic-5-completion-verification-and-recovery/execution/prompts/core-05-s3-merge-readiness/implementer.md` | `docs/implementation/epics/epic-5-completion-verification-and-recovery/execution/prompts/core-05-s3-merge-readiness/reviewer.md` |
| `core-05-s4-forge-intents-and-blockers` | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 | `docs/implementation/epics/epic-5-completion-verification-and-recovery/execution/prompts/core-05-s4-forge-intents-and-blockers/implementer.md` | `docs/implementation/epics/epic-5-completion-verification-and-recovery/execution/prompts/core-05-s4-forge-intents-and-blockers/reviewer.md` |
| `core-05-s5-post-merge-outcomes` | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 | `docs/implementation/epics/epic-5-completion-verification-and-recovery/execution/prompts/core-05-s5-post-merge-outcomes/implementer.md` | `docs/implementation/epics/epic-5-completion-verification-and-recovery/execution/prompts/core-05-s5-post-merge-outcomes/reviewer.md` |
| `core-06-s1-recovery-contracts` | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9 | `docs/implementation/epics/epic-5-completion-verification-and-recovery/execution/prompts/core-06-s1-recovery-contracts/implementer.md` | `docs/implementation/epics/epic-5-completion-verification-and-recovery/execution/prompts/core-06-s1-recovery-contracts/reviewer.md` |
| `core-06-s2-recovery-classifier` | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8 | `docs/implementation/epics/epic-5-completion-verification-and-recovery/execution/prompts/core-06-s2-recovery-classifier/implementer.md` | `docs/implementation/epics/epic-5-completion-verification-and-recovery/execution/prompts/core-06-s2-recovery-classifier/reviewer.md` |
| `core-06-s3-launch-leases` | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 | `docs/implementation/epics/epic-5-completion-verification-and-recovery/execution/prompts/core-06-s3-launch-leases/implementer.md` | `docs/implementation/epics/epic-5-completion-verification-and-recovery/execution/prompts/core-06-s3-launch-leases/reviewer.md` |
| `core-06-s4-recovery-plan-apply` | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8 | `docs/implementation/epics/epic-5-completion-verification-and-recovery/execution/prompts/core-06-s4-recovery-plan-apply/implementer.md` | `docs/implementation/epics/epic-5-completion-verification-and-recovery/execution/prompts/core-06-s4-recovery-plan-apply/reviewer.md` |
| `core-06-s5-reconciliation-projection` | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 | `docs/implementation/epics/epic-5-completion-verification-and-recovery/execution/prompts/core-06-s5-reconciliation-projection/implementer.md` | `docs/implementation/epics/epic-5-completion-verification-and-recovery/execution/prompts/core-06-s5-reconciliation-projection/reviewer.md` |

## Verification Policy

Every story carries its source contract's targeted checks, evidence-pack requirements, boundary sweep, and repo gate. The execution stage must preserve those bars exactly:

- Type/catalog producer stories use `type:fixtures`, `typecheck`, and `coverage:baseline` where the contract names runtime-frozen catalog substrate.
- Behavior stories use `coverage:baseline` table/property fixtures for every AC and failure/degraded row plus `typecheck` public-import tests.
- Each implementer must run the contract's boundary sweep and `pnpm check` before committing each round, or report the exact blocked reason.
- Reviewers must reject ACs whose proof is only a manual or one-off command outside the standing gate named by the contract.

## Downstream Execution Metadata

- Model class, effort, reasoning tier, and routing rationale are abstract plan decisions.
- Provider-specific runtime model IDs are selected later by `orchestrated-delivery`; this package does not bind them.
- The DAG floor for every story is `elevated`; implementers use `strong-coder` with `high` effort as the minimal compliant route, not a stronger default.
- Reviewer routing uses `frontier-reviewer` with `high` effort because every story touches public contracts, fail-closed predicates, conformance fixtures, or safety boundaries.
- Dependency validity comes from tracker `merged` state and the producer's track-branch merge-back.
- Tracker write authority belongs to the orchestrator in the execution stage.
- The implementer commits each round in its story worktree; the orchestrator merges approved stories back to the track branch and writes the tracker. The orchestrator commits no story content itself.
- Commit boundaries follow owned pathsets.
- Verifiable evidence wins over worker prose.

## Resume Semantics

A later run resumes by reading existing tracker rows, per-round commit hashes, merge-back hashes, and gate evidence. If tracker notes conflict with git state, check output, or live review truth, the execution stage must prefer git state, check output, and live review truth. A story with dependency rows not yet `merged` remains locked even if a producer is implemented, reviewed, or approved.

## Implementation-Readiness Evidence

- Sources reviewed: `docs/implementation/epics/epic-5-completion-verification-and-recovery/README.md`, `docs/implementation/epics/epic-5-completion-verification-and-recovery/story-dag.md`, all ten story contracts, repo `AGENTS.md`, and `CLAUDE.md`.
- Selected stories covered: `core-05-s1-completion-contracts`, `core-05-s2-completion-evidence`, `core-05-s3-merge-readiness`, `core-05-s4-forge-intents-and-blockers`, `core-05-s5-post-merge-outcomes`, `core-06-s1-recovery-contracts`, `core-06-s2-recovery-classifier`, `core-06-s3-launch-leases`, `core-06-s4-recovery-plan-apply`, `core-06-s5-reconciliation-projection`.
- Artifact checks performed before independent review: source status and AC/pathset/dependency inventory, routing floor check, prompt-pair completeness, tracker initial-state check, runtime model ID exclusion check, and PD-9/PD-10/PD-11 source-readiness preflight.
- Independent reviewer verdict: no blocking findings; reviewer confirmed package completeness,
  projection trace, PD-9/PD-10/PD-11 source-readiness claims, minimal elevated implementer routing,
  reviewer routing, dependency unlock semantics, and absence of provider-specific runtime model ids.
- Final verdict: `ready_for_implementation`.

## Stop Point

Package creation ends here. Feature implementation, implementation worker dispatch, tracker mutation beyond initial `ready` rows, commits, pushes, PRs, merges, and execution closeout belong only to a later execution run.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - Completion, verification, and recovery](../README.md) · **← Prev:** [Epic 5 - Completion, verification, and recovery](../README.md) · **Next →:** [Implementer Prompt - core-05-s1-completion-contracts](./prompts/core-05-s1-completion-contracts/implementer.md)

<!-- /DOCS-NAV -->
