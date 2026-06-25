---
title: "plan-epic — charter and evals"
status: draft
last-reviewed: "2026-06-23"
---

# plan-epic

## Mandate

Author the *what* for one epic's stories — the Layer-3 story DAG and the Layer-4 story contracts — and
characterization-review them until every story is `ready`. One epic in; a frozen DAG and a set of
dispatch-ready contracts out.

## Why it exists

The worst delivery churn comes from a missing or imprecise *what* discovered during coding (Bucket 1).
`plan-epic` is the gate that catches it before any code exists: it forces every acceptance criterion to
trace to a frozen design line and runs an independent characterization review before flipping `ready`. It
is the architect and characterization-reviewer roles, operationalized for one epic at a time.

## Embodies / operates on

- Roles: [architect](../operating-model/architect.md) + [characterization-review](../operating-model/characterization-review.md) (Bucket 1).
- Layers: authors [Layer 3 — story DAG](../authoring-standard/40-story-dag.md) and
  [Layer 4 — story contract](../authoring-standard/50-story-contract.md); reads Layers 1–2 as frozen inputs.

## Input gate (refuse if unmet)

- A single named epic, resolved to its charter under `docs/implementation/epics/`, status `epic: ready`.
- Its included domains `frozen`; its design seams `frozen`.

Refuse, and report the exact blocker, on an ambiguous or missing epic, a non-ready charter, non-frozen
inputs, or the wrong worktree.

## Output gate (done means)

- `story-dag: frozen`, and every story `story: ready`.
- Coverage closed: every owned Story Group Signal maps to exactly one story id (or a named `split`), with
  the owning-story cells backfilled in the **epic charter README** — the authoring standard's oracle — not
  the global rollup.
- Whole-graph event/record producer reconciliation recorded in the DAG: every event/record named in the
  design seams or consumed by any story maps to exactly one declared producer node (this epic or a prior
  frozen one); no consumed event is orphaned.
- Each contract passes Gates 4–6: enumerated, falsifiable, self-contained ACs each with an evidence
  clause; a failure/degraded table whose cited ACs assert **that row's trigger and behavior** (not the
  happy path); a public-exposure AC + import path + public-import test for every exported shape;
  predicate-input coverage (consumed predicates) proving every runtime branch is decidable from declared
  inputs/events/projections/producer fields/resolvers; producer-closure coverage naming a declared source
  for every required field of every produced record/event and every required public symbol; design→AC
  completeness asserting every design-stated fail-closed invariant and emitted event maps to an AC; a
  numeric file-size budget; runnable sweeps whose forbidden-token set does not ban tokens the story's own
  ACs or design vocabulary require.
- Same-wave concurrency expressed via the same-logic rule (canonical in
  [`authoring-standard/40-story-dag.md`](../authoring-standard/40-story-dag.md)): each public-symbol
  story's owned pathset includes its own `index.ts` export line, and same-logic stories never share a
  wave — file-level granularity checked from owned pathsets, with an architect override + one-line
  rationale where file-level over-serializes.

The Gate-4 **[Proof-substrate match](../authoring-standard/50-story-contract.md#gate-4--authoring-ready)**
and **[Predicate-input closure — relational &
compound](../authoring-standard/50-story-contract.md#gate-4--authoring-ready)** boxes are the
authoring-time form of `plan-delivery`'s two
[readiness-contract preflights](./30-plan-delivery.md#readiness-contract-preflights): a contract that
ticks these boxes passes packaging, and the preflights are the backstop that catches a box left unticked
— not a second authority. Authoring-time and packaging-time read the same rule.

Then stop and hand off to `plan-delivery`.

## Boundaries (never)

- Write feature code or touch `packages/`.
- Build the execution package (plan, tracker, dispatch prompts) — that is `plan-delivery`.
- Assign concrete models or effort, or run the delivery loop.
- Edit `docs/design/` (frozen, wins on conflict) — escalate a design gap instead of inventing a requirement.
- Edit other epics' charters, DAGs, or contracts, or the included domain charters.

## Evals

| ID | Requirement | Sev | Modality |
|---|---|---|---|
| PE-1 | Triggers only to plan one named, `ready` epic's stories; refuses non-epic or not-ready-charter requests. | P1 | P/T |
| PE-2 | Produces Layer-3 + Layer-4 markdown only; never code, package, model/effort, or delivery. | P1 | S/P |
| PE-3 | A story reaches `ready` only after characterization review passes; the `ready` flag is evidence-backed, not asserted. | P1 | P |
| PE-4 | Coverage closes exactly-once and backfills the epic charter README's owning-story cells, not the domain rollup. | P1 | S/P |
| PE-5 | The DAG is frozen before any contract is authored; contracts are authored only against the frozen DAG. | P1 | P |
| PE-6 | Every contract passes Gates 4–6 (falsifiable ACs + evidence clause, failure table, predicate-input coverage, public-exposure AC + import path, file-size budget, sweeps). | P1 | S |
| PE-7 | Every AC traces to a frozen design line; a missing requirement is escalated as a design gap, never invented. | P1 | S/P |
| PE-8 | Output is the gate-1 handoff (`story-dag: frozen` + all `story: ready`); the skill stops without building the package. | P1 | P |
| PE-9 | Never edits `docs/design/` (frozen); a design gap is escalated, not edited around. | P1 | S/T |
| PE-10 | Never edits other epics' charters, DAGs, or contracts, or the included domain charters. | P1 | S/T |
| PE-11 | Refuses `story: ready` when an AC or failure trigger cannot be evaluated from declared request fields, consumed events/projections, producer-owned fields, or an in-scope resolver. | P1 | S/T |
| PE-12 | DAG frozen only after whole-graph event/record producer reconciliation: every event/record consumed by any story maps to one declared producer node (this epic or a prior frozen one); an orphaned consumed event is a Gate 3 failure. | P1 | S/P |
| PE-13 | Refuses `story: ready` when the predicate-input matrix is missing produced-obligations rows: every required field of every produced record/event and every required public symbol must name a declared source; a required output with no source is a blocking closure defect. | P1 | S/T |
| PE-14 | Refuses `story: ready` when any design-stated fail-closed invariant or emitted event for the story's signal has no covering AC (design→AC completeness). | P1 | S/T |
| PE-15 | Refuses `story: ready` when a runnable boundary sweep's forbidden-token set bans a token that appears in the story's own ACs or in the normative design vocabulary for that story's signal. | P1 | S/T |
| PE-16 | Refuses `story: ready` when a failure/degraded table row cites an AC that asserts a happy path or a different condition rather than that row's trigger and behavior. | P1 | S/T |
| PE-17 | Same-logic concurrency holds: a public-symbol story's owned pathset includes its own `index.ts` export line; same-wave stories share no logic-bearing file (file-level granularity from owned pathsets), and any file-level override carries a one-line architect rationale. | P1 | S |

The skill's own `EVALS.md` (when authored) operationalizes PE-1…PE-17 as test cases with a version pin.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Delivery pipeline — the skill spec](./README.md) · **← Prev:** [Delivery pipeline — flow, gates, and invariants](./10-pipeline-and-invariants.md) · **Next →:** [plan-delivery — charter and evals](./30-plan-delivery.md)

<!-- /DOCS-NAV -->
