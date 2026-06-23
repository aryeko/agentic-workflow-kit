# Epic 4 Execution Package Plan

## Source Baseline

- Repo path: `/Users/aryekogan/repos/workflow-kit`.
- Package worktree path: `/Users/aryekogan/repos/workflow-kit/.worktrees/plan-delivery-epic4`.
- Base branch: `v-next`.
- Package branch: `codex/plan-delivery-epic4`.
- HEAD inspected: `4fa8136167f81e82bd907cd942c421db8889bf72`.
- Epic slug: `epic-4-human-control-and-liveness-loop`.
- Package author/date: Codex, 2026-06-23.
- Source inventory: frozen DAG plus 8 ready story contracts listed below; every package row and prompt cites its source story id and ordered AC ids.

Source files read:
- `AGENTS.md`
- `CLAUDE.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/README.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/README.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s1-approval-contracts.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s1-supervision-contracts.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s2-risk-and-decision.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s2-liveness-fold.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s3-pending-park-resume.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s3-timers-and-wait.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s4-grant-mapping-and-outcome.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s4-termination-handoff.md`

## Readiness Verdict

Ready. Gate 1 passed for `epic-4-human-control-and-liveness-loop`: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md` frontmatter is `status: "story-dag: frozen"`, every selected source contract frontmatter is `status: "story: ready"`, and all eight selected stories have stable ids, ordered AC ids, dependency data, owned pathsets, and DAG suggested-tier floors. The package is projectable without adding scope, changing ACs, reordering dependencies, changing owned pathsets, lowering suggested-tier floors, or binding provider-specific runtime model ids.

## Implementation-Readiness Evidence

`$plan-delivery` performed deterministic package validation and independent read-only review for this
execution package and marks it `ready_for_implementation`.

Sources reviewed:
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/README.md`
- the 8 selected ready story contracts listed in `Source files read`
- `.agents/skills/plan-delivery/references/source-readiness.md`
- `.agents/skills/plan-delivery/references/package-layout.md`
- `.agents/skills/plan-delivery/references/model-routing.md`
- `.agents/skills/plan-delivery/references/plan-artifact.md`
- `.agents/skills/plan-delivery/references/tracker-artifact.md`
- `.agents/skills/plan-delivery/references/implementer-prompt.md`
- `.agents/skills/plan-delivery/references/reviewer-prompt.md`
- `.agents/skills/plan-delivery/references/closeout-validation.md`

Selected stories covered:
- `core-03-s1-approval-contracts`
- `core-04-s1-supervision-contracts`
- `core-03-s2-risk-and-decision`
- `core-04-s2-liveness-fold`
- `core-03-s3-pending-park-resume`
- `core-04-s3-timers-and-wait`
- `core-03-s4-grant-mapping-and-outcome`
- `core-04-s4-termination-handoff`

Artifact checks performed:
- `plan.md`: confirmed the source baseline, source file inventory, readiness verdict, projection
  summary, wave order, prompt inventory, verification policy, downstream execution metadata, resume
  semantics, and stop point are present and project only from the frozen DAG plus selected ready story
  contracts.
- `tracker.md`: confirmed every selected story has exactly one row with story id, source AC ids, wave,
  dependencies, pending status, implementer routing, reviewer routing, prompt paths, reviewer verdict,
  gate evidence, commit hash, blockers, and notes columns; initial execution-only evidence cells remain
  blank by design.
- implementer prompts: confirmed all 8 selected stories have exactly one
  `execution/prompts/<story-id>/implementer.md`, each carrying assigned routing, exact task, why it
  matters, required reading, source ACs, allowed writes, dependency inputs, non-goals, STOP
  conditions, implementation constraints, verification, delivery report, and mutation limits.
- reviewer prompts: confirmed all 8 selected stories have exactly one
  `execution/prompts/<story-id>/reviewer.md`, each carrying assigned routing, original scope, runtime
  slots, review checklist, verdict format, and mutation limits.
- package layout: confirmed package artifacts live under
  `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/` and no extra prompt
  directory exists outside the selected source set.
- static checks: confirmed no scaffold marker text, provider-specific runtime model ids, runtime model
  aliases or versions, fake commit hashes, invalid tracker statuses, missing selected story prompt
  pairs, malformed design references, or prompt/source AC mismatches remain.

Independent reviewer verdict:
- Reviewer: Heisenberg (`019ef60d-86cc-79a2-9524-8d487721b1bb`), read-only.
- Scope: quality, correctness, compliance, and readiness for implementation against the plan-delivery
  references, closeout checklist, frozen DAG, selected ready story contracts, and generated execution
  package.
- Final reviewer result: `ready_for_implementation`; no blocking findings remained after the
  package-boundary repair and deterministic package checks.

Final verdict:
- `ready_for_implementation`

## Projection Summary

| story id | source AC ids | job | wave | dependencies | dependents | owned pathset | suggested-tier floor | routing |
|---|---|---|---|---|---|---|---|---|
| `core-03-s1-approval-contracts` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6` | Declare the approval value types, event payloads, projection shapes, interfaces, and failure-state catalog as the single approval contract producer. | 1 | none | `core-03-s2-risk-and-decision`, `core-03-s3-pending-park-resume`, `core-03-s4-grant-mapping-and-outcome` | `packages/sdk/src/core/approval/contracts/**`<br>`packages/sdk/tests/core/approval/contracts/**` | `elevated` | implementer: strong-coder; effort high; reasoning elevated; DAG floor elevated; rationale: core-03-s1-approval-contracts covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6` and carries public approval contract surface and single-producer value/event/projection/failure catalog consumed by later approval behavior stories and later epics.<br>reviewer: frontier-reviewer; effort high; reasoning elevated; DAG floor elevated; rationale: core-03-s1-approval-contracts covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6` and carries public approval contract surface and single-producer value/event/projection/failure catalog consumed by later approval behavior stories and later epics. |
| `core-04-s1-supervision-contracts` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` | Declare liveness/supervision value types, timer and wait inputs, event payloads, projection shapes, and failure-reason catalog. | 1 | none | `core-04-s2-liveness-fold`, `core-04-s3-timers-and-wait`, `core-04-s4-termination-handoff` | `packages/sdk/src/core/supervision/contracts/**`<br>`packages/sdk/tests/core/supervision/contracts/**` | `elevated` | implementer: strong-coder; effort high; reasoning elevated; DAG floor elevated; rationale: core-04-s1-supervision-contracts covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` and carries public supervision and liveness contract surface and single-producer value/event/projection/failure catalog consumed by later supervision behavior stories and later epics.<br>reviewer: frontier-reviewer; effort high; reasoning elevated; DAG floor elevated; rationale: core-04-s1-supervision-contracts covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` and carries public supervision and liveness contract surface and single-producer value/event/projection/failure catalog consumed by later supervision behavior stories and later epics. |
| `core-03-s2-risk-and-decision` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8` | Implement normalization, deterministic risk classification, v1 mode ladder, committed gate consumption, and pure decision output. | 2 | `core-03-s1-approval-contracts` | `core-03-s3-pending-park-resume`, `core-03-s4-grant-mapping-and-outcome` | `packages/sdk/src/core/approval/decision/**`<br>`packages/sdk/tests/core/approval/decision/**` | `elevated` | implementer: strong-coder; effort high; reasoning elevated; DAG floor elevated; rationale: core-03-s2-risk-and-decision covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8` and carries approval safety boundary over deterministic risk classification, committed capability-gate evidence, and fail-closed decision behavior.<br>reviewer: frontier-reviewer; effort high; reasoning elevated; DAG floor elevated; rationale: core-03-s2-risk-and-decision covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8` and carries approval safety boundary over deterministic risk classification, committed capability-gate evidence, and fail-closed decision behavior. |
| `core-04-s2-liveness-fold` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8` | Implement the pure liveness fold over committed event values plus sampled clock, including advancing and never-refresh event classes. | 2 | `core-04-s1-supervision-contracts` | `core-04-s3-timers-and-wait`, `core-04-s4-termination-handoff` | `packages/sdk/src/core/supervision/liveness/**`<br>`packages/sdk/tests/core/supervision/liveness/**` | `elevated` | implementer: strong-coder; effort high; reasoning elevated; DAG floor elevated; rationale: core-04-s2-liveness-fold covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8` and carries shared liveness reducer contract over committed evidence, explicit clock input, non-refresh event classification, and fail-closed supervision-lost states.<br>reviewer: frontier-reviewer; effort high; reasoning elevated; DAG floor elevated; rationale: core-04-s2-liveness-fold covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8` and carries shared liveness reducer contract over committed evidence, explicit clock input, non-refresh event classification, and fail-closed supervision-lost states. |
| `core-03-s3-pending-park-resume` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` | Persist pending approval before decision, compute live/final deadlines, park/resume/expire requests, and fold approval projections. | 3 | `core-03-s1-approval-contracts`, `core-03-s2-risk-and-decision` | `core-03-s4-grant-mapping-and-outcome` | `packages/sdk/src/core/approval/pending/**`<br>`packages/sdk/src/core/approval/projections/**`<br>`packages/sdk/tests/core/approval/pending/**`<br>`packages/sdk/tests/core/approval/projections/**` | `elevated` | implementer: strong-coder; effort high; reasoning elevated; DAG floor elevated; rationale: core-03-s3-pending-park-resume covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` and carries durable approval pending/resume behavior and projection contract over RunWriter, replay/projection inputs, deadlines, and fail-closed session/channel states.<br>reviewer: frontier-reviewer; effort high; reasoning elevated; DAG floor elevated; rationale: core-03-s3-pending-park-resume covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` and carries durable approval pending/resume behavior and projection contract over RunWriter, replay/projection inputs, deadlines, and fail-closed session/channel states. |
| `core-04-s3-timers-and-wait` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8` | Evaluate startup/idle/no-progress/per-tool/approval-SLA/max-runtime timers and wrap the Epic 3 cursor wait primitive without liveness side effects. | 3 | `core-04-s1-supervision-contracts`, `core-04-s2-liveness-fold` | `core-04-s4-termination-handoff` | `packages/sdk/src/core/supervision/timers/**`<br>`packages/sdk/src/core/supervision/wait/**`<br>`packages/sdk/tests/core/supervision/timers/**`<br>`packages/sdk/tests/core/supervision/wait/**` | `elevated` | implementer: strong-coder; effort high; reasoning elevated; DAG floor elevated; rationale: core-04-s3-timers-and-wait covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8` and carries supervision timer and cursor-wait boundary over liveness projections, explicit clock input, cursor validation, and no-side-effect wait semantics.<br>reviewer: frontier-reviewer; effort high; reasoning elevated; DAG floor elevated; rationale: core-04-s3-timers-and-wait covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8` and carries supervision timer and cursor-wait boundary over liveness projections, explicit clock input, cursor validation, and no-side-effect wait semantics. |
| `core-03-s4-grant-mapping-and-outcome` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` | Map policy grants to Agent `ScopedGrant`, answer or deny through Agent approval relay, and record outcome audit facts. | 4 | `core-03-s1-approval-contracts`, `core-03-s2-risk-and-decision`, `core-03-s3-pending-park-resume` | none | `packages/sdk/src/core/approval/grants/**`<br>`packages/sdk/src/core/approval/outcomes/**`<br>`packages/sdk/tests/core/approval/grants/**`<br>`packages/sdk/tests/core/approval/outcomes/**` | `elevated` | implementer: strong-coder; effort high; reasoning elevated; DAG floor elevated; rationale: core-03-s4-grant-mapping-and-outcome covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` and carries Agent provider-port handoff behavior for grant mapping, approval answer delivery, and outcome durability without concrete provider protocol coupling.<br>reviewer: frontier-reviewer; effort high; reasoning elevated; DAG floor elevated; rationale: core-03-s4-grant-mapping-and-outcome covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` and carries Agent provider-port handoff behavior for grant mapping, approval answer delivery, and outcome durability without concrete provider protocol coupling. |
| `core-04-s4-termination-handoff` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9` | Record supervisor lifecycle, supervision-lost, termination-requested, worker-terminated, and supervisor-stopped facts through `RunWriter` and Execution Host handoff. | 4 | `core-04-s1-supervision-contracts`, `core-04-s2-liveness-fold`, `core-04-s3-timers-and-wait` | none | `packages/sdk/src/core/supervision/termination/**`<br>`packages/sdk/tests/core/supervision/termination/**` | `elevated` | implementer: strong-coder; effort high; reasoning elevated; DAG floor elevated; rationale: core-04-s4-termination-handoff covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9` and carries Execution Host provider-port termination handoff and durable supervision fact boundary without concrete kill mechanics or recovery decisions.<br>reviewer: frontier-reviewer; effort high; reasoning elevated; DAG floor elevated; rationale: core-04-s4-termination-handoff covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9` and carries Execution Host provider-port termination handoff and durable supervision fact boundary without concrete kill mechanics or recovery decisions. |

## Execution Waves

The execution stage must follow the topological bands from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md`. A dependent story can start only after every direct dependency row is `done` in `tracker.md`; `approved_pending_gate`, reviewed, or committed-without-gate states do not unlock dependents.

| wave | stories |
|---|---|
| 1 | `core-03-s1-approval-contracts`, `core-04-s1-supervision-contracts` |
| 2 | `core-03-s2-risk-and-decision`, `core-04-s2-liveness-fold` |
| 3 | `core-03-s3-pending-park-resume`, `core-04-s3-timers-and-wait` |
| 4 | `core-03-s4-grant-mapping-and-outcome`, `core-04-s4-termination-handoff` |

## Prompt Inventory

| source story | source AC ids | implementer prompt | reviewer prompt |
|---|---|---|---|
| `core-03-s1-approval-contracts` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-03-s1-approval-contracts/implementer.md` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-03-s1-approval-contracts/reviewer.md` |
| `core-04-s1-supervision-contracts` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-04-s1-supervision-contracts/implementer.md` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-04-s1-supervision-contracts/reviewer.md` |
| `core-03-s2-risk-and-decision` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-03-s2-risk-and-decision/implementer.md` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-03-s2-risk-and-decision/reviewer.md` |
| `core-04-s2-liveness-fold` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-04-s2-liveness-fold/implementer.md` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-04-s2-liveness-fold/reviewer.md` |
| `core-03-s3-pending-park-resume` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-03-s3-pending-park-resume/implementer.md` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-03-s3-pending-park-resume/reviewer.md` |
| `core-04-s3-timers-and-wait` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-04-s3-timers-and-wait/implementer.md` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-04-s3-timers-and-wait/reviewer.md` |
| `core-03-s4-grant-mapping-and-outcome` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-03-s4-grant-mapping-and-outcome/implementer.md` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-03-s4-grant-mapping-and-outcome/reviewer.md` |
| `core-04-s4-termination-handoff` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-04-s4-termination-handoff/implementer.md` | `docs/implementation/epics/epic-4-human-control-and-liveness-loop/execution/prompts/core-04-s4-termination-handoff/reviewer.md` |

## Verification Policy

Each story must use the targeted checks, evidence-pack items, required sweeps, coverage expectations, and `pnpm check` gate from its source contract. The execution package does not add or relax checks. Worker and reviewer prompts carry the source `Quality bar` and `Evidence pack` sections for the relevant story, including public-import tests, forbidden-symbol or dependency sweeps, coverage commands, and failure/degraded evidence rows when the story contract names them.

## Downstream Execution Metadata

- Model class, effort, reasoning tier, suggested-tier floor, and routing rationale are abstract delivery-plan decisions.
- Provider-specific runtime model ids, aliases, and versions are selected later by `orchestrated-delivery` from live provider availability.
- Dependency validity comes from tracker `done` state plus committed dependency inputs in `{{DEPENDENCY_COMMITS}}`.
- Tracker update authority belongs to the execution stage; this package initializes state only.
- Commit boundaries follow each source story's owned pathset.
- Verifiable evidence wins over worker prose: git state, check output, and live review truth resolve conflicts.

## Resume Semantics

A later execution run resumes from `tracker.md` by reading each row's status, prompt paths, recorded gate evidence, reviewer verdict, commit hash, blockers, and notes. If tracker evidence conflicts with repository state, check output, or live review truth, the execution run must prefer repository state, check output, and live review truth. A dependency is resumable only when its row is `done` and its commit hash/evidence still match the implementation state being consumed.

## Stop Point

Package creation ends here. Feature implementation, worker dispatch, review, commits, pushes, PRs, merges, and delivery closeout begin only in a later execution run.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../README.md) · **← Prev:** [Epic 4 - Human control and liveness loop](../README.md) · **Next →:** [Implementer Prompt: core-03-s1-approval-contracts](./prompts/core-03-s1-approval-contracts/implementer.md)

<!-- /DOCS-NAV -->
