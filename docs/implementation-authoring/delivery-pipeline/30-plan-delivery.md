---
title: "plan-delivery — charter and evals"
status: draft
last-reviewed: "2026-06-23"
---

# plan-delivery

## Mandate

Project a frozen epic's `ready` story contracts into a runtime-executable **execution package** — a plan,
a tracker, and a decision-complete implementer + reviewer prompt per story, with model class and effort
assigned — and mark it `ready_for_implementation`. Add the *how*; carry the *what* unchanged.

## Why it exists

It is the bridge the operating model does not name. Without it, the orchestrator would have to derive
dispatch prompts, model/effort routing, and a durable tracker at runtime — re-deciding under execution
pressure exactly the things that should be fixed beforehand, with no durable record across compaction.
`plan-delivery` moves that work to plan time so the executor stays a pure executor, low-tier workers get
prompts they can act on cold, and the run survives resume. It is justified **only** under the projection
invariant: it translates, it does not re-author.

## The projection invariant — this skill's reason to refuse

The package is a faithful 1:1 projection of the `ready` contracts (invariant I4 in
[10-pipeline-and-invariants.md](./10-pipeline-and-invariants.md)). Every prompt, tracker row, and routing
decision traces to a contract the architect already froze. `plan-delivery` may decide *how to say it to a
worker* and *what class of model and effort to spend*; it may not decide scope, acceptance criteria,
dependency order, or the suggested-tier floor — those are the architect's, already fixed. To keep the
projection mechanically auditable, every prompt and tracker row records the story id and acceptance-
criteria ids it projects from; an element that cites no source contract is exactly the defect this
invariant catches. If a contract is too vague to project without inventing, that is a planning defect:
stop and route it back to `plan-epic`; do not paper over it.

## Embodies / operates on

- Role: none in the operating model — it is the authoring→execution bridge.
- Inputs: the frozen DAG + `ready` Layer-4 contracts. Output: a docs-only `execution/` package.

## Input gate (refuse if unmet)

- `story-dag: frozen`, and every selected story `story: ready`.

Refuse, and route back to `plan-epic`, on a non-frozen DAG, any non-ready selected story, a contract too
underspecified to project without inventing, or a self-blocking ready contract whose STOP conditions name
a missing fact needed by one of its ACs or failure/degraded triggers.

## Output gate (done means)

- A complete package: a plan, a tracker, and per-story implementer + reviewer prompts; the prompts are
  decision-complete — a low-tier worker needs no other document to act.
- Every prompt and tracker row cites the story id and AC ids it realizes — the projection trace that
  makes the invariant auditable.
- Each story carries an abstract model class and effort, and a reasoning tier at or above the contract's
  suggested-tier floor (the floor is carried unchanged; the reasoning ladder adds `critical` above the
  DAG's `elevated`), with rationale; no concrete provider IDs (those bind at runtime).
- A deep-readiness verdict marks the package `ready_for_implementation`, naming the sources reviewed, the
  stories covered, the per-artifact checks performed, and the final verdict.

## Boundaries (never)

- Re-decide scope, ACs, dependency order, or tier — projection only.
- Write feature code, dispatch workers, or run the delivery loop.
- Edit design or planning artifacts outside the `execution/` package.
- Bind concrete provider model IDs — that is `orchestrated-delivery`'s call.

## Evals

| ID | Requirement | Sev | Modality |
|---|---|---|---|
| PD-1 | Triggers only on a frozen DAG with `ready` selected stories; refuses and routes back otherwise. | P1 | P/T |
| PD-2 | Projection invariant holds: every package element cites the source story id + AC ids it projects from and traces 1:1 to a `ready` contract; introduces no new scope, AC, dependency order, or tier. | P1 | S/T |
| PD-3 | Produces a complete package (plan, tracker, per-story implementer + reviewer prompts); the prompts are decision-complete. | P1 | S/P |
| PD-4 | Assigns abstract model class + effort per story with rationale, and a reasoning tier ≥ the contract's suggested-tier floor (floor carried unchanged); no concrete provider IDs. | P1 | S |
| PD-5 | Marks `ready_for_implementation` only with a deep-readiness verdict (sources, stories, per-artifact checks, final verdict). | P1 | S/P |
| PD-6 | Never writes code, dispatches workers, or edits artifacts outside the package. | P1 | S |
| PD-7 | The package is durable — self-contained and resumable from recorded evidence, not session prose. | P2 | S |
| PD-8 | Refuses a `story: ready` contract whose STOP conditions, unresolved predicate inputs, or package-blocking vagueness overlap selected ACs; routes the source repair to `plan-epic` before packaging. | P1 | S/T |

The skill's own `EVALS.md` (when authored) operationalizes PD-1…PD-8 as test cases with a version pin.
PD-2 is the load-bearing one: it is what keeps the bridge from bypassing the characterization gate.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Delivery pipeline — the skill spec](./README.md) · **← Prev:** [plan-epic — charter and evals](./20-plan-epic.md) · **Next →:** [orchestrated-delivery — charter and evals](./40-orchestrated-delivery.md)

<!-- /DOCS-NAV -->
