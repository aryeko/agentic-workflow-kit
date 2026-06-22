---
title: kit-vnext - domain implementation charters
status: draft
last-reviewed: "2026-06-22"
---

# Domain implementation charters

Domain charters are compact implementation-planning cards derived from the design corpus. They do
not replace domain designs, add requirements, or decide how implementation works.

Each charter answers:

- what the domain owns for implementation planning;
- why the domain exists in the implementation plan;
- what the domain does not own;
- which dependencies and downstream epics it shapes.

The normative source remains [`../../design/30-domain-reference/`](../../design/30-domain-reference/).
When a charter conflicts with design, design wins and the charter must be corrected.

## Charter Shape

A domain charter carries frontmatter with `id`, `layer`, `status`, `source-design` (the normative
design README it derives from), and `last-reviewed`. The body uses this shape, in order:

- `What` - the implementation-planning responsibility in plain language. Names the spec surface the
  domain owns, using the design's own type/event/token names where it helps a later story author.
- `Why` - why the domain matters to the rebuild sequence and what it unblocks.
- `Does Not Own` - nearby concerns that belong elsewhere, each attributed to the owning domain, epic,
  or story group by id. This boundary is load-bearing: every story under the domain inherits it.
- `Inputs And Dependencies` - the `source-design` README, direct domain dependencies (or `none`), and
  the planning artifacts that order the work. Layer-specific lines are expected and allowed: provider
  charters split SDK vs testkit inputs; core charters name their implementation DAG band.
- `Downstream Epics` - milestone epics that consume this domain.
- `Story Group Signals` - likely story groups this domain will shape, without acceptance criteria or
  implementation HOW.

The DAGs own dependency edges. [`../domain-dag.md`](../domain-dag.md) is authoritative for domain
edges and [`../epic-dag.md`](../epic-dag.md) for epic edges. A charter names its direct dependencies
and downstream epics for readability, but must not contradict the DAGs or re-argue their rationale.
When they disagree, the DAG wins and the charter is corrected.

## Charter readiness check

A domain charter is planning-ready only when its four-item readiness check passes (boundary crisp;
signals trace to design; altitude holds; edges defer to the DAGs). That check is the canonical Gate 1
in [`../work-item-authoring-guide.md`](../work-item-authoring-guide.md#readiness-check-gate-1), which
defines all three planning layers — domain charter, epic charter, story contract — and the lesson each
layer encodes. Author and grade charters against Gate 1 there; do not duplicate it here.

## Layers

- [Foundation](foundation/README.md)
- [Providers](providers/README.md)
- [Core](core/README.md)
- [Edge](edge/README.md)

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [implementation contract](../README.md) · **← Prev:** [epic dependency DAG](../epic-dag.md) · **Next →:** [foundation domain charters](./foundation/README.md)

**Children:** [foundation domain charters](./foundation/README.md) · [provider domain charters](./providers/README.md) · [core domain charters](./core/README.md) · [edge domain charters](./edge/README.md)

<!-- /DOCS-NAV -->
