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
a missing fact needed by one of its ACs or failure/degraded triggers. Three **readiness-contract
preflights** - substrate-presence, predicate-input, and failure-token/catalog closure - also gate the
verdict; see [Readiness-contract preflights](#readiness-contract-preflights). They read the frozen DAG,
contracts, and manifests, never code on disk.

## Readiness-contract preflights

Three static checks run before `ready_for_implementation`, reading the frozen DAG, each selected
contract's **spec-surface manifest and AC text - never globbing the owned src pathset**. The pathset is *empty until
implementation*, so a code-on-disk glob has nothing to read at plan time and would misfire on every
contracts story; the manifest is the only artifact that exists at this layer, and the authoring standard
makes the contract *declare* there what these checks read. Each preflight is a mechanical instance of
*[Readiness is reconstructed, not
asserted](../authoring-standard/10-principles.md#readiness-is-reconstructed-not-asserted)* — the verdict
is rebuilt from the manifest, not taken from a prose claim — and mirrors a Gate-4 box the architect
already ticked, so authoring-time and packaging-time agree. Each is the packaging-time **reconstruction**
of the Gate-4 box it mirrors — the verdict rebuilt from the contract text and spec-surface manifest, not
asserted — the same reconstruct-don't-assert discipline the existing self-blocking-contract refusal
applies; it is the same per-sub-predicate / substrate-emission work as the box, run again at packaging
time, not a cheaper heuristic.

- **substrate-presence preflight.** Refuse `ready_for_implementation` if a quality bar names a coverage
  lane (matches `coverage … statements|branches`) while the spec-surface manifest declares **no
  runtime-value export** — no `export const` catalog, `as const`, enum, or function in the manifest
  (only types/interfaces / event-payload interfaces). A retained type-only marker (`type-only producer`,
  "declares … raises none at runtime") is **corroborating context, not an independent trigger**: a story
  that mints runtime `as const` catalogs but keeps the marker — the blessed *Value, not behavior* pattern
  ([testing-policy.md](../../engineering/testing-policy.md#proof-substrate)) — has a runtime-value export
  and **passes**. Keying the refusal on substrate emission (not the marker) is what keeps the preflight
  aligned with the Gate-4 **Proof-substrate match** box, which keys off the same. Erased types give V8
  `0/0` → 100% ≥ the threshold: a **vacuously green** lane that proves nothing, undetectable by any
  threshold or runtime gate. Reason string emitted on refusal:
  > `proof-substrate mismatch: AC quality bar names a statement/branch coverage lane but the spec-surface manifest declares only types/interfaces with no runtime-value export (no export const / as const / enum / function); erased types give V8 0/0 → 100%, a vacuously green lane. Route back to plan-epic to amend the source story to either (a) mint runtime as const catalogs + derived union types, or (b) drop the coverage lane for type:fixtures + public-import + negative compile fixtures.`

  Cites the **[Proof-substrate match](../authoring-standard/50-story-contract.md#gate-4--authoring-ready)**
  Gate-4 box, the proof-substrate invariant
  ([engineering/testing-policy.md](../../engineering/testing-policy.md#proof-substrate)), and **LSN-29**.

- **predicate-input preflight.** Refuse if any AC closure row names an input **category** ("normalized
  request", "replay/projections") instead of a concrete `Producer/Type.field`, **or** if any relational
  sub-predicate is unsourced. Decompose every compound AC into its sub-predicates first; for each
  relational sub-predicate (keyword `inside|outside|contained|matches|broader-than|subset-of`, matching
  the Gate-4 list) **both** operands must cite a concrete declared field in the closure row. Count **per
  sub-predicate, not per AC**: a compound AC whose row names ≥2 fields *in total* but leaves one operand
  of one sub-predicate unsourced still refuses — a per-AC field count would wrongly pass it. A two-operand
  predicate with one operand unsourced is what a tests-passing approximation silently **fails open** on.
  Reason string emitted on refusal:
  > `predicate-input gap: AC <id> closure row names an input category, not a concrete Producer/Type.field — or a relational sub-predicate leaves an operand unsourced (counted per sub-predicate, not per AC). Route back to plan-epic; closure rows must cite a concrete Producer/Type.field for BOTH operands of every relational/compound sub-predicate.`

  Cites the **[Predicate-input closure — relational &
  compound](../authoring-standard/50-story-contract.md#gate-4--authoring-ready)** Gate-4 box (strengthened
  R6) and **LSN-30**.

- **failure-token/catalog closure preflight.** Build an inventory for the selected package: every shared
  failure / degraded / validation catalog or union named in the frozen DAG, every producer story catalog,
  and every token consumed by selected story failure tables. Refuse `ready_for_implementation` if any
  consumer token is unowned, maps to multiple producers, is not a member of the cited producer catalog, or
  carries a stronger meaning than the frozen design / catalog. Also refuse if the producer story does not
  enumerate the exact literals in enforced fixtures / catalog tests; a catalog described only by prose is
  not package-ready. Reason string emitted on refusal:
  > `failure-token/catalog closure gap: token <token> consumed by <story> is unowned, ambiguous, absent from the cited producer catalog, stronger than design, or the producer catalog lacks enforced exact-literal fixtures/tests. Route back to plan-epic; consumers cannot invent failure/degraded/validation tokens during packaging or implementation.`

  Cites the **[Failure-token/catalog closure](../authoring-standard/50-story-contract.md#gate-4--authoring-ready)**
  Gate-4 box, the Gate-3
  **[Whole-graph failure-token/catalog reconciliation](../authoring-standard/40-story-dag.md#gate-3--ready-to-freeze)**
  box, and **LSN-31**.

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

## Canonical tracker schema

The tracker is the durable, resumable record of a delivery's stories. `plan-delivery` authors it as part
of the execution package; `orchestrated-delivery` updates it at runtime. This is the **canonical schema**
— other layers (the [orchestrator role](../operating-model/orchestrator.md), the
[orchestrated-delivery charter](./40-orchestrated-delivery.md)) reference it rather than restating it.

Each tracker row records one story with these fields:

| field | values / content |
|---|---|
| `status` | lifecycle: `ready` → `in_progress` → `in_review` → (`blocked` \| `approved`) → `merged` |
| `round` | current review round, `1`–`5` (the cap; see the [reviewer](../operating-model/reviewer.md) and [orchestrator](../operating-model/orchestrator.md) specs) |
| per-round record | for each round: the implementer's commit hash + the reviewer's verdict (`APPROVE`, or `BLOCKING` with finding refs) |
| `blocked` reason | on cap-exhaustion or escalation: which AC or finding blocked, and the escalation target (architect) |
| `merge` | the track-branch merge-back commit hash |
| `gate` | pointer to the last green `pnpm check` evidence |
| wave / dependencies | the story's dependency wave and the producer stories it waits on |
| model class + effort | the abstract routing assigned per story (no concrete provider IDs) |
| prompt paths | the implementer + reviewer prompt files projected for the story |
| notes | projection trace (story id + AC ids) and any routing rationale |

The status lifecycle is the contract between the roles: a story is `in_review` while the
implementer/reviewer loop runs, becomes `approved` when the reviewer returns APPROVE, `blocked` when the
5-round cap is hit and the story is escalated, and `merged` once the orchestrator merges its commits back
to the track branch.

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
| PD-9 | substrate-presence preflight: refuses `ready_for_implementation` when a quality bar names a statement/branch coverage lane while the spec-surface manifest declares no runtime-value export (a retained type-only marker alone does not trigger — an `as const` catalog passes); reads the manifest, not the pathset. | P1 | S/T |
| PD-10 | predicate-input preflight: refuses when an AC closure row names an input category not a concrete `Producer/Type.field`, or any relational sub-predicate leaves an operand unsourced (per sub-predicate, not per AC); reads the manifest, not the pathset. | P1 | S/T |
| PD-11 | failure-token/catalog closure preflight: refuses `ready_for_implementation` when any selected story consumes a failure / degraded / validation token that is unowned, ambiguous, absent from the cited producer catalog, stronger than design, or backed only by prose instead of enforced exact-literal fixtures / catalog tests. | P1 | S/T |

The skill's own `EVALS.md` (when authored) operationalizes PD-1..PD-11 as test cases with a version pin.
PD-2 is the load-bearing one: it is what keeps the bridge from bypassing the characterization gate.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Delivery pipeline — the skill spec](./README.md) · **← Prev:** [plan-epic — charter and evals](./20-plan-epic.md) · **Next →:** [orchestrated-delivery — charter and evals](./40-orchestrated-delivery.md)

<!-- /DOCS-NAV -->
