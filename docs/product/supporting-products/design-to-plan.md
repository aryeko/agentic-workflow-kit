---
title: "Design → plan (supporting product)"
status: draft — product overview
last-reviewed: "2026-06-27"
---

# Design → plan (supporting product)

Design → plan is the supporting product that turns a **design** into a **package-ready
execution plan** — the decomposed, dependency-ordered, evidence-bearing work that
[Jig](../jig.md) consumes. It **produces output conformant to** Jig's one hard input schema;
Jig owns that schema, and this is the seam between the two products. Its output is the same
thing Jig requires: a plan that says what the stories are, in what order, with falsifiable
acceptance criteria and the evidence that proves them. Bring-your-own plan is welcome as long
as it meets the schema; design → plan is the strong default that encodes the author's planning
experience for everyone who doesn't already have one.

This document is a **product-level overview**: what design → plan does _for you_ and _why it
matters_, not how it is built. The kit's existing planning skills (`plan-epic`,
`plan-delivery`, `plan-delivery-track`) are prior art and a supporting reference here, not a
re-architecture; this doc describes the product at altitude, in terms of what it produces, not
the files it writes.

## Why design → plan

**Jig is only as good as the plan you feed it.** Jig's whole promise is _faithful_ execution —
and faithful execution of a weak plan yields weak software, fast. Jig will not rescue a plan
that decomposed the work badly, drew the dependencies wrong, or set a "done" bar that proves
nothing. So plan quality is not a detail downstream of Jig; it is _where the quality of the
result is won_, before Jig ever runs. This is the product that wins it.

Contrast the raw-agent path. Hand a coding agent a design and a goal, and it will quietly make
two decisions you never reviewed: **how to break the work apart** and **what counts as done.**
It improvises the decomposition as it goes, and it grades its own homework against a bar it set
itself. Both decisions shape the result more than any single line of code — and both vanish
into the run, unexamined. Design → plan makes them **explicit and checkable up front**: the
decomposition becomes a reviewable dependency graph, and "done" becomes falsifiable acceptance
criteria backed by evidence Jig's gates can actually check. You review the _plan_ — the part
that sets direction — once, instead of trying to reconstruct it from the diff afterward.

Like the other supporting products, design → plan is **optional**: a strong default, not a
mandate. The author doesn't claim to be the best planner — only to have encoded a planning
discipline worth starting from. Override it, tune it, or replace it with your own plan; the
package is what makes the promise, and this product raises your odds of a good input to it.

## Responsibilities

Design → plan is a **producer**, so it is organized around what it is responsible for putting
into the plan — five responsibilities, each with intended behavior and ID'd requirements. The
through-line is the **evidence thread**: design → plan writes the checkable acceptance criteria
and evidence clauses, and Jig's gates check _exactly those_. That producer/consumer seam for
evidence is as load-bearing as the schema seam itself.

### A Jig-conformant execution plan

**Intended behavior.** The output of design → plan is, end to end, a plan that satisfies Jig's
one hard input schema — the single strict contract in the suite. design → plan **produces
output conformant to** that schema; it does not own it and does not co-own it. Jig owns the
schema, design → plan targets it, and that one-directional relationship is the seam that keeps
the two products independently evolvable.

**Product requirements.**

- **PLAN-1.** The output **conforms to Jig's execution-plan schema** — Jig's one
  system-enforced floor (see [Jig](../jig.md), enforce-vs-guide tier 1). A plan that does not
  conform is not a valid input, and design → plan's job is to always produce one that is.
- **PLAN-2. The schema is the seam, and it is one-directional.** Jig defines what a valid plan
  is; design → plan produces to that definition. Neither the field-level shape of the schema
  (owned by Jig, out of scope here) nor design → plan's internal method needs to know the other
  beyond this contract.
- **PLAN-3. Bring-your-own plan is a first-class path.** Any plan that meets the schema is a
  valid Jig input, whoever produced it. design → plan is the default producer, not a gatekeeper;
  the kit **enables and supports** here, it does not limit.

### Decomposition into stories + dependency order

**Intended behavior.** design → plan reads the design and decomposes it into **right-sized
stories** with **explicit dependencies between them** — a dependency-ordered graph, not a flat
list. This is the structure Jig leans on to do two of its best tricks: isolate a failure to the
story that caused it and everything downstream, and run everything independent in parallel.

**Product requirements.**

- **DAG-1. Stories are right-sized units of work.** Each is small enough to implement, verify,
  and review as one coherent change — not a vague epic, not a single keystroke.
- **DAG-2. Dependencies are explicit and ordered.** The plan states which stories depend on
  which, forming a directed graph. Independent work is _visibly_ independent; downstream work is
  _visibly_ downstream.
- **DAG-3. The graph is what makes Jig's isolation and concurrency real.** Explicit dependencies
  are the input to Jig's fault-isolation — a blocked story halts only itself and what depends on
  it (see [Jig](../jig.md), guarantee 3 **ISO-1**) — and to its concurrency, where the plan's independent
  stories are what Jig is allowed to run at once (guarantee 2, **CFG-4**). A plan with hidden or missing
  dependencies degrades both; getting the graph right is the planner's responsibility, not
  something Jig can recover after the fact.

### Falsifiable acceptance criteria + evidence clauses

**Intended behavior.** Every story carries **falsifiable acceptance criteria** — checkable,
observable conditions, not prose intentions — and the **evidence clauses** that say what proof
satisfies each one. This is the part Jig's gates actually consume: "done" is defined here, in
checkable form, and Jig checks it against real evidence rather than the agent's word.

**Product requirements.**

- **AC-1. Acceptance criteria are falsifiable, not prose.** Each criterion states an observable
  condition that can be shown true or false — not an aspiration ("works well") but a check
  ("this command exits 0," "this behavior is observable in the records"). A criterion you cannot
  fail is not a criterion.
- **AC-2. Each criterion carries an evidence clause.** The plan says _what proof_ closes each
  criterion — the passing check, the test, the observable record — so the gate has something
  concrete to verify.
- **AC-3. These ACs are exactly what Jig's gates check.** design → plan is the _producer_ of the
  bar; Jig is the _consumer_. Jig merges on independent evidence, never on assertion (see
  [Jig](../jig.md), guarantee 1 **MERGE-1**), and the records of what was checked are the same records you
  inspect (guarantee 5 **SEE-1**, **SEE-3**). The criteria written here are what those gates evaluate —
  the evidence seam that parallels the schema seam.
- **AC-4. Prose-only safeguards reproduce defects — write checkable boxes.** This is the hard
  lesson the product encodes, not an aside. A safeguard expressed only as prose guidance gets
  skipped, misread, or quietly weakened, and the same defect class comes back. The discipline is
  to turn each safeguard into a **mechanically checkable box** with a defined input and proof.
  Watch the known failure modes the kit has paid for: **predicate-input sourcing** (an AC whose
  inputs aren't actually derivable from what the story produces is unprovable) and **closure**
  (a criterion that reads as covered but leaves a real path unchecked). A plan that states good
  intentions in prose has not done this job; one that states falsifiable, evidenced criteria
  has.

### Per-story work profile (proposed)

**Intended behavior.** Beyond _what_ each story is, design → plan **proposes how to realize
it** — a per-story work profile: which model, how much effort, and the prompt strategy for that
story and role. This encodes planning judgment that a flat plan throws away: some stories are
routine and some are load-bearing and hard, and they don't deserve the same horsepower. The
plan proposes; it does not decide.

**Product requirements.**

- **PROF-1. The plan proposes per-story realization.** For each story, design → plan can suggest
  a model class, an effort level, and a prompt approach suited to that story's difficulty and
  role — the planner's read of where the hard parts are.
- **PROF-2. The proposal composes with the user's work-profile config; the user owns the final
  say.** Jig's work profile (see [Jig](../jig.md), guarantee 2 **CFG-2**) is the user's track-scoped control
  over model, effort, and prompt strategy, and it is freely tunable. design → plan's per-story
  proposal **feeds into** that — a reasoned default the user can accept, tune, or override. The
  plan contributes a recommendation; the user's configuration and policy decide what actually
  runs (Jig _computes_ the realized run from config plus plan — guarantee 2 **CFG-4**). design → plan does
  not seize ownership of the work profile; it informs it.

### A versioned generation guideline

**Intended behavior.** design → plan derives stories, acceptance criteria, and prompts from the
design by a **versioned, consistent guideline** — a documented method, under version, that maps
design to plan the same way every time. That is what makes a plan _legible_: you can trace why a
story exists, or why a prompt says what it says, back to the design and the guideline that
produced it.

**Product requirements.**

- **GEN-1. Generation follows a documented, versioned guideline.** The path from design to
  stories/ACs/prompts is a stated method under version, not ad hoc per run — so the same design
  yields a consistent plan, and the plan stays explainable.
- **GEN-2. Traceability, not just output.** Because the guideline is versioned and consistent,
  you can trace any story or prompt back to the design feature it serves and the rule that
  derived it. This is the precondition for plans that stay learnable as they evolve — and it
  feeds the suite's learning-loop traceability.
- **GEN-3. Recommended, not enforced.** The generation guideline sits in the suite's _guide_
  tier, not the _enforce_ tier (see the [product README](../README.md)'s versioned-generation
  note and [Jig](../jig.md), guarantee 2 **CFG-8**). Ignore it and you trade away legibility in how the plan
  traces back to the design; the kit won't stop you.

## Per track

A design → plan output is a plan **for a track** — one independent line of work, with its own
design upstream and its own policy and work profile downstream. A repo runs **many tracks in
parallel**, each with its own plan, advancing at its own pace. Nothing in design → plan forces a
single plan across a repo: a plan is scoped to its track exactly as the track's design, policy,
and work profile are. See [Tracks — parallel independent work](../concepts.md).

## Honest edges

- **It's optional, and it's a default — not a mandate.** design → plan encodes one planner's
  discipline as a strong starting point. Bring your own plan instead and Jig accepts it, as long
  as it meets the schema. The product earns its place by raising your odds of a good plan, not by
  being the only way to get one.
- **A plan is only as good as the design it's given.** design → plan decomposes and proves
  against the design it receives. A weak, ambiguous, or wrong design produces a faithful plan of
  the wrong thing — the discipline here sharpens a sound design into checkable work; it does not
  substitute for the design decisions upstream (see [Product → design](product-to-design.md)).
- **Falsifiable ACs are a discipline, not a guarantee the tool can force.** design → plan can
  structure criteria to be checkable and can flag the known defect classes — but a careless
  author can still write a criterion that passes vacuously or sources inputs it doesn't have. The
  tool encodes and enforces the _shape_; the _substance_ of each check is still the author's to
  set well. (This mirrors Jig's own honest edge: the kit guarantees the shape of the gate; the
  strength of the gate is yours.)

## Cross-links

- **The seam to Jig is the schema.** design → plan produces output conformant to Jig's
  execution-plan schema; Jig owns it (see [Jig](../jig.md), enforce-vs-guide tier 1). One
  contract, one direction.
- **Per track.** A plan is a plan _for a track_; a repo runs many in parallel — see
  [Tracks](../concepts.md).
- **ACs and evidence are what Jig's gates check.** The criteria and evidence clauses written
  here are exactly what Jig evaluates at merge-on-evidence ([Jig](../jig.md), guarantee 1 **MERGE-1**) and
  surfaces in its records (guarantee 5 **SEE-1**, **SEE-3**) — the evidence seam alongside the schema seam.
- **The dependency graph feeds Jig's isolation and concurrency.** Explicit story dependencies
  are the input to fault-isolation (guarantee 3 **ISO-1**) and parallel execution (guarantee 2 **CFG-4**).
- **The per-story work profile composes with config.** design → plan's proposal feeds Jig's
  track-scoped work profile ([Jig](../jig.md), guarantee 2 **CFG-2**), which the user owns.
- **The generation guideline feeds the learning loop's traceability.** A versioned guideline
  ([product README](../README.md); [Jig](../jig.md), guarantee 2 **CFG-8**) is what lets the learning loop
  trace a defect back to the rule that produced the plan.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Product definition](../README.md) · **← Prev:** [Tracks — parallel independent work](../concepts.md) · **Next →:** [Product → design (supporting product)](./product-to-design.md)

<!-- /DOCS-NAV -->
