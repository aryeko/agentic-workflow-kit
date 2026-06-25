# Epic 4 Execution Package Plan

## Source Baseline

- Repo path: `/Users/aryekogan/repos/workflow-kit`.
- Package worktree path: `/Users/aryekogan/repos/workflow-kit/.worktrees/plan-delivery-epic4`.
- Base branch: `v-next`.
- Package branch: `plan-delivery-epic4`.
- HEAD inspected: `3dd044d9b91d5970d29d0d6c6d0265a33796b3c8`.
- Epic slug: `epic-4-human-control-and-liveness-loop`.
- Package author/date: Codex, 2026-06-25.
- Source inventory: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md` plus the 8 ready source story contracts listed below. Every story row and prompt cites source story id and source AC ids.

Source files read:
- `AGENTS.md`
- `CLAUDE.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/README.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/README.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s1-approval-contracts.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s1-supervision-contracts.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s2-normalize-risk-decision.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s2-liveness-fold.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s3-pending-park-resume.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s3-timers-wait.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s4-grants-outcomes.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s4-termination-facts.md`
- `.agents/skills/plan-delivery/references/source-readiness.md`
- `.agents/skills/plan-delivery/references/package-layout.md`
- `.agents/skills/plan-delivery/references/model-routing.md`
- `.agents/skills/plan-delivery/references/plan-artifact.md`
- `.agents/skills/plan-delivery/references/tracker-artifact.md`
- `.agents/skills/plan-delivery/references/implementer-prompt.md`
- `.agents/skills/plan-delivery/references/reviewer-prompt.md`
- `.agents/skills/plan-delivery/references/closeout-validation.md`
- `docs/implementation-authoring/delivery-pipeline/30-plan-delivery.md`

## Readiness Verdict

Ready. Gate 1 passed for `epic-4-human-control-and-liveness-loop`: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md` is `status: "story-dag: frozen"`, every selected source contract is `status: "story: ready"`, and all selected stories have stable ids, ordered AC ids, dependency data, owned pathsets, source scope, and DAG suggested-tier floors. No selected STOP condition or predicate input overlaps an AC or failure/degraded trigger without a declared source value. The package is projectable without adding scope, changing ACs, reordering dependencies, changing owned pathsets, lowering suggested-tier floors, or binding provider-specific runtime model ids.

## Implementation-Readiness Evidence

`$plan-delivery` performed deterministic package validation and independent read-only review for this execution package and marks it `ready_for_implementation`.

Selected stories covered:
- `core-03-s1-approval-contracts` from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s1-approval-contracts.md` covering `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`
- `core-04-s1-supervision-contracts` from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s1-supervision-contracts.md` covering `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`
- `core-03-s2-normalize-risk-decision` from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s2-normalize-risk-decision.md` covering `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, `AC-14`
- `core-04-s2-liveness-fold` from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s2-liveness-fold.md` covering `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`
- `core-03-s3-pending-park-resume` from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s3-pending-park-resume.md` covering `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`
- `core-04-s3-timers-wait` from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s3-timers-wait.md` covering `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`
- `core-03-s4-grants-outcomes` from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s4-grants-outcomes.md` covering `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`
- `core-04-s4-termination-facts` from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s4-termination-facts.md` covering `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`

Artifact checks performed:
- `plan.md`: source baseline, readiness verdict, projection summary, execution waves, prompt inventory, verification policy, downstream execution metadata, resume semantics, and stop point are present and project only from the frozen DAG plus selected ready contracts.
- `tracker.md`: every selected story has one canonical tracker row with initial `ready` status, empty runtime evidence fields, source story id, source AC ids, dependency wave, prompt paths, routing, and `merged` unlock semantics.
- Implementer prompts: all 8 selected stories have exactly one `execution/prompts/<story-id>/implementer.md` with assigned routing, exact task, required reading, source ACs, allowed writes, dependency inputs, non-goals, STOP conditions, implementation constraints, verification, delivery report, and mutation limits.
- Reviewer prompts: all 8 selected stories have exactly one `execution/prompts/<story-id>/reviewer.md` with assigned routing, original scope, runtime slots, checklist, verdict format, and mutation limits.
- Package layout: the package contains 18 execution files, one plan, one tracker, and 16 prompts under `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/`.
- Static checks: no provider-specific runtime model ids, fake tracker commit hashes, invalid tracker statuses, missing prompt pairs, extra prompt directories, scaffold markers, or prompt/source AC mismatches remain.
- Docs navigation: `pnpm docs:nav` updated generated nav blocks, and `pnpm docs:nav:check` reported `Nav up to date (287 files)`.

Independent reviewer verdict:
- Reviewer: Chandrasekhar (`019f0083-c66e-7ee2-8267-d2673618b365`), read-only.
- Scope: quality, correctness, compliance, and readiness against the plan-delivery references, closeout checklist, frozen DAG, selected ready story contracts, generated execution package, and docs-nav side effects.
- Result: no blocking findings. The reviewer judged the docs-nav README changes acceptable generated navigation maintenance, not a package-boundary blocker, because they are confined to generated `DOCS-NAV` blocks.

Final verdict:
- `ready_for_implementation`

## Projection Summary

| story id | source AC ids | job | wave | dependencies | dependents | owned pathset | suggested-tier floor | routing |
|---|---|---|---|---|---|---|---|---|
| `core-03-s1-approval-contracts` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` | Produce all approval value types, event payloads, projections, binding shapes, interfaces, and failure catalog. | 1 | none | `core-03-s2-normalize-risk-decision`, `core-03-s3-pending-park-resume`, `core-03-s4-grants-outcomes` | `packages/sdk/src/core/approval/contracts/**`<br>`packages/sdk/tests/core/approval/contracts/**`<br>`packages/sdk/src/index.ts (own export lines)` | `elevated` | implementer: strong-coder; effort high; reasoning elevated; reviewer: frontier-reviewer; effort high; reasoning elevated; rationale: source story `core-03-s1-approval-contracts` covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` and carries public approval contract producer and failure catalog consumed by later approval behavior stories and later epics. |
| `core-04-s1-supervision-contracts` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` | Produce supervision/liveness value types, timer/wait inputs, event payloads, projections, and reason catalog. | 1 | none | `core-04-s2-liveness-fold`, `core-04-s3-timers-wait`, `core-04-s4-termination-facts` | `packages/sdk/src/core/supervision/contracts/**`<br>`packages/sdk/tests/core/supervision/contracts/**`<br>`packages/sdk/src/index.ts (own export lines)` | `elevated` | implementer: strong-coder; effort high; reasoning elevated; reviewer: frontier-reviewer; effort high; reasoning elevated; rationale: source story `core-04-s1-supervision-contracts` covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` and carries public supervision/liveness contract producer and reason catalog consumed by later supervision behavior stories and later epics. |
| `core-03-s2-normalize-risk-decision` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, `AC-14` | Normalize approval requests, classify risk with explicit time, record risk and decision facts, and apply the v1 ladder. | 2 | `core-03-s1-approval-contracts` | `core-03-s3-pending-park-resume`, `core-03-s4-grants-outcomes` | `packages/sdk/src/core/approval/decision/**`<br>`packages/sdk/tests/core/approval/decision/**`<br>`packages/sdk/src/index.ts (own export lines)` | `elevated` | implementer: strong-coder; effort high; reasoning elevated; reviewer: frontier-reviewer; effort high; reasoning elevated; rationale: source story `core-03-s2-normalize-risk-decision` covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, `AC-14` and carries approval safety boundary over deterministic risk classification, committed gate evidence, barrier decision facts, and fail-closed behavior. |
| `core-04-s2-liveness-fold` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9` | Fold committed current-session events plus clock into liveness state and event-class facts. | 2 | `core-04-s1-supervision-contracts` | `core-04-s3-timers-wait`, `core-04-s4-termination-facts` | `packages/sdk/src/core/supervision/liveness/**`<br>`packages/sdk/tests/core/supervision/liveness/**`<br>`packages/sdk/src/index.ts (own export lines)` | `elevated` | implementer: strong-coder; effort high; reasoning elevated; reviewer: frontier-reviewer; effort high; reasoning elevated; rationale: source story `core-04-s2-liveness-fold` covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9` and carries shared liveness reducer over committed evidence, explicit clock input, non-refresh classification, and fail-closed supervision-lost states. |
| `core-03-s3-pending-park-resume` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9` | Persist request and pending facts, produce park decisions, resume or expire pending approvals, and fold projections. | 3 | `core-03-s1-approval-contracts`, `core-03-s2-normalize-risk-decision` | `core-03-s4-grants-outcomes` | `packages/sdk/src/core/approval/pending/**`<br>`packages/sdk/src/core/approval/projections/**`<br>`packages/sdk/tests/core/approval/pending/**`<br>`packages/sdk/tests/core/approval/projections/**`<br>`packages/sdk/src/index.ts (own export lines)` | `elevated` | implementer: strong-coder; effort high; reasoning elevated; reviewer: frontier-reviewer; effort high; reasoning elevated; rationale: source story `core-03-s3-pending-park-resume` covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9` and carries durable approval pending/resume behavior and projection contract over RunWriter, replay/projection inputs, deadlines, and fail-closed session/channel states. |
| `core-04-s3-timers-wait` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9` | Evaluate six supervision timers and wrap Epic 3 cursor wait without liveness side effects. | 3 | `core-04-s1-supervision-contracts`, `core-04-s2-liveness-fold` | `core-04-s4-termination-facts` | `packages/sdk/src/core/supervision/timers/**`<br>`packages/sdk/src/core/supervision/wait/**`<br>`packages/sdk/tests/core/supervision/timers/**`<br>`packages/sdk/tests/core/supervision/wait/**`<br>`packages/sdk/src/index.ts (own export lines)` | `elevated` | implementer: strong-coder; effort high; reasoning elevated; reviewer: frontier-reviewer; effort high; reasoning elevated; rationale: source story `core-04-s3-timers-wait` covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9` and carries supervision timer and cursor-wait boundary over liveness projections, explicit clock input, cursor validation, and no-side-effect wait semantics. |
| `core-03-s4-grants-outcomes` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8` | Map policy grants to Agent ScopedGrant, answer or deny through Agent relay, and record outcomes. | 4 | `core-03-s1-approval-contracts`, `core-03-s2-normalize-risk-decision`, `core-03-s3-pending-park-resume` | none | `packages/sdk/src/core/approval/grants/**`<br>`packages/sdk/src/core/approval/outcomes/**`<br>`packages/sdk/tests/core/approval/grants/**`<br>`packages/sdk/tests/core/approval/outcomes/**`<br>`packages/sdk/src/index.ts (own export lines)` | `elevated` | implementer: strong-coder; effort high; reasoning elevated; reviewer: frontier-reviewer; effort high; reasoning elevated; rationale: source story `core-03-s4-grants-outcomes` covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8` and carries Agent provider-port handoff behavior for grant mapping, approval answer delivery, and outcome durability without concrete provider coupling. |
| `core-04-s4-termination-facts` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10` | Append supervisor lifecycle/lost/termination facts and hand stale owned workers to Execution Host. | 4 | `core-04-s1-supervision-contracts`, `core-04-s2-liveness-fold`, `core-04-s3-timers-wait` | none | `packages/sdk/src/core/supervision/termination/**`<br>`packages/sdk/tests/core/supervision/termination/**`<br>`packages/sdk/src/index.ts (own export lines)` | `elevated` | implementer: strong-coder; effort high; reasoning elevated; reviewer: frontier-reviewer; effort high; reasoning elevated; rationale: source story `core-04-s4-termination-facts` covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10` and carries Execution Host provider-port termination handoff and durable supervision fact boundary without concrete kill mechanics or recovery decisions. |

## Execution Waves

The execution stage must follow the topological bands from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md`. A dependent story can start only after every direct dependency row is `merged` in `tracker.md`: the dependency implementation commits have been approved, merged back to the track branch, and recorded with merge-back evidence. `approved`, `in_review`, or committed-without-merge states do not unlock dependents.

| wave | stories |
|---|---|
| 1 | `core-03-s1-approval-contracts`, `core-04-s1-supervision-contracts` |
| 2 | `core-03-s2-normalize-risk-decision`, `core-04-s2-liveness-fold` |
| 3 | `core-03-s3-pending-park-resume`, `core-04-s3-timers-wait` |
| 4 | `core-03-s4-grants-outcomes`, `core-04-s4-termination-facts` |

## Prompt Inventory

| source story | source AC ids | implementer prompt | reviewer prompt |
|---|---|---|---|
| `core-03-s1-approval-contracts` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-03-s1-approval-contracts/implementer.md` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-03-s1-approval-contracts/reviewer.md` |
| `core-04-s1-supervision-contracts` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-04-s1-supervision-contracts/implementer.md` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-04-s1-supervision-contracts/reviewer.md` |
| `core-03-s2-normalize-risk-decision` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, `AC-14` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-03-s2-normalize-risk-decision/implementer.md` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-03-s2-normalize-risk-decision/reviewer.md` |
| `core-04-s2-liveness-fold` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-04-s2-liveness-fold/implementer.md` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-04-s2-liveness-fold/reviewer.md` |
| `core-03-s3-pending-park-resume` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-03-s3-pending-park-resume/implementer.md` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-03-s3-pending-park-resume/reviewer.md` |
| `core-04-s3-timers-wait` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-04-s3-timers-wait/implementer.md` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-04-s3-timers-wait/reviewer.md` |
| `core-03-s4-grants-outcomes` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-03-s4-grants-outcomes/implementer.md` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-03-s4-grants-outcomes/reviewer.md` |
| `core-04-s4-termination-facts` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-04-s4-termination-facts/implementer.md` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-04-s4-termination-facts/reviewer.md` |

## Verification Policy

Each story must use the targeted checks, evidence-pack items, required sweeps, coverage expectations, and `pnpm check` gate from its source contract. The package does not add or relax checks. Worker and reviewer prompts carry the source quality bar, failure/degraded rows, public import test, boundary sweeps, and source AC ids.

## Downstream Execution Metadata

- Model class, effort, reasoning tier, suggested-tier floor, and routing rationale are abstract delivery-plan decisions.
- Provider-specific runtime model ids, aliases, and versions are selected later by `orchestrated-delivery` from live provider availability.
- Dependency validity comes from tracker `merged` state and the producer story merge-back recorded in `tracker.md`.
- Tracker write authority belongs to the orchestrator during execution.
- Implementers commit each round in their story worktree; the orchestrator merges approved stories back to the track branch and writes tracker state, but commits no story content itself.
- Commit boundaries follow each source story owned pathset.
- Verifiable evidence wins over worker prose: git state, check output, and live review truth resolve conflicts.

## Resume Semantics

A later execution run resumes from `tracker.md` by reading each row status, round, per-round records, blocker, merge-back hash, gate evidence, prompt paths, and notes. If tracker evidence conflicts with repository state, check output, or live review truth, the run must prefer repository state, check output, and live review truth. A dependency is resumable only when its row is `merged` and the recorded merge-back still contains the dependency implementation being consumed.

## Stop Point

Package creation ends here. Feature implementation, worker dispatch, review, commits, pushes, PRs, merges, and delivery closeout begin only in a later execution run.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../README.md) · **← Prev:** [Epic 4 - Human control and liveness loop](../README.md) · **Next →:** [Implementer Prompt: core-03-s1-approval-contracts](./prompts/core-03-s1-approval-contracts/implementer.md)

<!-- /DOCS-NAV -->
