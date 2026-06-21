---
title: kit-vnext — implementation status note
status: high-level design
last-reviewed: "2026-06-19"
---

# Implementation status note

This documentation bundle covers the design corpus only. It intentionally excludes implementation
frontier charters, readiness tracking, review history, and historical research material. Those are
maintained separately.

## What is in this bundle

- The orientation layer: mission, requirements, vocabulary, conventions, and this reading structure.
- The architecture layer: runtime model, event log, capability model, provider seams, gates, recovery,
  and observability.
- The SDK and packaging layer: package structure, boundary rules, provider interface model, and
  dependency matrix.
- The full domain-level design specs, under `docs/design/30-domain-reference/`. These remain
  authoritative for low-level design regardless of implementation frontier status.
- Accepted design decisions, under `docs/design/40-decisions/`.

## What is not in this bundle

Frontier charters, implementation readiness matrices, frontier-scoped reviews, and historical research notes
were excluded by design. If a migrated design file originally linked to readiness material, that link
now resolves here instead.

## Where to find implementation state

Implementation contract docs are maintained outside this design corpus in
[`../implementation/`](../implementation/). That folder defines dependency frontiers, story-contract
authoring rules, readiness evidence, and migration tracking. Execution process, prompts, PR policy,
and review-loop mechanics remain outside the design corpus and outside the implementation contract.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [design corpus overview](./README.md) · **← Prev:** [architecture decisions](./40-decisions/accepted-decisions.md) · **Next →:** [implementation contract](../implementation/README.md)

<!-- /DOCS-NAV -->
