---
title: "Story DAG — Layer 3"
status: draft
last-reviewed: "2026-06-22"
---

# Story DAG (Layer 3)

> **Audience** — architect (authoring) · characterization reviewer (grading).
> **Job** — the structural step between a frozen epic charter and its story contracts. It **orders
> dispatch-ready stories within one epic**: one node = one reviewable story a single builder finishes and a
> verifier grades; edges = shared-contract / seam dependencies. Structure and order, not DONE detail — we
> slice before we spec, so the signal→story partition and the shared-contract producers are reviewable
> before a single contract is written.
> **To author one** — copy [`_templates/story-dag.md`](_templates/story-dag.md), satisfy the rules below,
> then tick every box in [Gate 3](#gate-3--ready-to-freeze).

The per-epic DAG lives at `epics/epic-<n>/story-dag.md`; it is the story-level analogue of
[`domain-dag.md`](../../implementation/domain-dag.md) and [`epic-dag.md`](../../implementation/epic-dag.md).

## Shape

Frontmatter carries `title`, `epic`, `status` (`story-dag: draft|ready|frozen`), `last-reviewed`. The body
mirrors the higher DAGs:

- **Sources** — this epic's charter and the domain charters it includes.
- **Reading rules** — what a node is and what an edge means (below).
- **Story nodes** — table: `story id | one-line job | domain(s) | claimed signals it covers`.
- **Dependency table** — intra-epic edges: `story → stories it depends on`, each edge naming the shared
  contract that creates it.
- A `mermaid` graph and topological bands, as the other DAGs do.

## Node and edge

- **Node = one story** = one dispatch-ready, reviewable unit a single builder finishes and a verifier
  grades. It owns one coherent surface.
- **Edge = intra-epic dependency** = B depends on A because B consumes a contract A produces (type / event /
  port / evidence shape). Name that contract on the edge. The graph must be **acyclic**.

## Slicing: signals → stories

Start from the signals the epic owns per domain (its `Per-domain expectations` table). Then:

- Default to **one story per cohesive signal**, or per tight cluster sharing one surface and one test lane.
- Group signals into one story **only** when they are the same surface and would share most tests. Do not
  bundle unrelated signals to shrink node count.
- Split one signal into multiple stories **only** when it is genuinely two deliverables; record the parts as
  `split(<parts>)` in the epic coverage table so it stays exactly-once.
- Every owned signal maps to exactly one node (or named `split` parts). On freeze, backfill the epic
  charter's `Owning story` column from `TBD` to real ids.

**Epic with no included domains** (e.g. Epic 0 — substrate and guardrails): slice from the epic's
**`Outputs`** instead — each Output (package skeleton, dependency guardrails, solution wiring, templates,
the check gate) becomes one story or a tight cluster, by the same one-deliverable-per-node rule. Gate 3
still applies, reading "signal" as "Output line" and "covered" against the Outputs list.

## Sizing heuristic — 3–10 ACs

A right-sized story:

- owns one module / surface and lands as **one reviewable PR**;
- carries a falsifiable AC set — roughly **3–10 ACs**; far more, or spanning two packages → probably two
  stories;
- if it cannot carry even one falsifiable AC, it is **too small** — fold it into its producer or consumer.

Sizing is a judgment call; the DAG makes it reviewable by showing the slice explicitly.

## Shared contracts — one producer per shape

When several stories consume the same type / event / port (e.g. `core-02`..`core-07` all consume `core-01`'s
run event envelope), **exactly one** story is the **producer** that defines the shape; the rest are
**consumers** that cite it verbatim. This is R5's "name the shape once" given a home:

- Mark the producer node; put a dependency edge from every consumer to it.
- The shared shape lives in the **producer story's spec surface**. Consumers reference
  `<producer-story>/<type>` **verbatim** and never redeclare it.
- Record the **public import path** the consumer will use (package export / barrel); exposing the shape on
  that path is part of the producer's public-exposure AC. A type a consumer cannot import through the
  intended path is **not delivered**, even if it exists privately.
- A shared shape with two producers is a defect — exactly one node owns it.

**Catalog / invariant owners vs behavior owners.** A signal can own a **catalog** (failure-token set, audit
record shape) or an **invariant** (e.g. "every start has a matching finish and destroy, or the run
degrades") while *different* stories own the **behaviors** that raise those tokens or uphold the invariant.
Name the split so a behavior does not fall between two stories:

- The catalog / invariant story owns the token set and the record / invariant AC, and is the cited producer.
- Each behavior story cites the producer's token verbatim and carries its own AC proving the behavior that
  raises the token (and a failure row for it).
- Neither side may leave the behavior unowned: a token with no behavior **and** no behavior story is dead;
  a behavior with no token is unrecorded. Both are defects.

A story's **responsibilities may not cross the signal boundary** the DAG assigned it. A responsibility that
reaches into another story's signal (the `destroy`-in-the-wrong-story defect) moves to the owning story.

## Delivery readiness

Author the DAG to dispatch cleanly into a plan-first orchestrator (e.g. the `orchestrated-delivery` skill):

- **Bands are waves.** Topological bands are the delivery waves; nodes in a band share no edge and run in
  parallel. An edge is a hard gate — a node starts only after its dependencies are committed.
- **One ownership scope per node.** Each story owns one path boundary (the files / globs it may create or
  modify), recorded as the story's owned pathset, so the orchestrator stages and commits strictly that
  pathset.
- **Shared-file collisions are the orchestrator's job, not the author's.** Pathsets may overlap on a shared
  file (e.g. a barrel); the author does not force disjoint pathsets. The orchestrator isolates each story in
  its own worktree and merges approved pathsets at commit. Planning supplies accurate per-story pathsets and
  the public-exposure ACs — not a shared-file owner.
- **Phase boundaries are readiness gates.** A later phase may consume an earlier phase's shape only once it
  is exported and importable through its intended public path. State this exported-and-importable
  phase-boundary condition so a consumer is never dispatched against a private-only seam.
- **Suggested tier (optional).** A node may carry a suggested tier — `light` / `standard` / `elevated` — to
  hint implementer / reviewer effort. A node that needs more than the top tier is mis-sized: decompose it,
  do not escalate effort. The orchestrator treats this tier as the **floor**.

## Gate 3 — ready to freeze

A story DAG is ready to freeze only when all hold; an empty box means not ready, and its story contracts
must not be authored.

- [ ] **Coverage closed.** Every signal the epic owns (per its `Per-domain expectations`) maps to exactly
      one story node or named `split` parts; the epic table's `Owning story` column is backfilled from `TBD`
      to real ids, with none left `TBD`.
- [ ] **No invented nodes.** No story node exists without a source signal it covers.
- [ ] **Single producer per shared shape.** Every cross-story type / event / port has exactly one producer
      node; consumers cite it, none redeclare.
- [ ] **Acyclic, labelled edges.** The dependency graph is acyclic and every edge names the contract that
      creates it.
- [ ] **Defensible sizing.** No node bundles unrelated signals; no node is too thin to carry a falsifiable
      AC.
- [ ] **Dispatch-ready.** Each node names one owned pathset and sits in a topological band (its delivery
      wave); every edge is a commit-gate a delivery orchestrator can enforce.
- [ ] **Seams are importable.** Every cross-story shape records the public import path its consumers use, and
      the producer node carries the public-exposure AC that exposes it there; phase boundaries state the
      exported-and-importable condition a later wave depends on.
