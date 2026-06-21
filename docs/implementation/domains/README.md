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

Use this shape for every domain charter:

- `What` - the implementation-planning responsibility in plain language.
- `Why` - why the domain matters to the rebuild sequence.
- `Does Not Own` - nearby concerns that belong to another domain, epic, or story group.
- `Inputs And Dependencies` - direct design dependencies and prerequisite planning artifacts.
- `Downstream Epics` - milestone epics that consume this domain.
- `Story Group Signals` - likely story groups this domain will shape, without acceptance criteria or
  implementation HOW.

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
