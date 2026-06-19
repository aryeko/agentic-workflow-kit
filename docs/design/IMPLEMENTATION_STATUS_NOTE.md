---
title: kit-vnext — implementation status note
status: high-level design
last-reviewed: "2026-06-19"
---

# Implementation status note

This documentation bundle covers the design corpus only. It intentionally excludes implementation
wave charters, readiness tracking, review history, and historical research material. Those are
maintained separately.

## What is in this bundle

- The orientation layer: mission, requirements, vocabulary, conventions, and this reading structure.
- The architecture layer: runtime model, event log, capability model, provider seams, gates, recovery,
  and observability.
- The SDK and packaging layer: package structure, boundary rules, provider interface model, and
  dependency matrix.
- The full domain-level design specs, under `docs/design/30-domain-reference/`. These remain
  authoritative for low-level design regardless of implementation wave status.
- Accepted design decisions, under `docs/design/40-decisions/`.

## What is not in this bundle

Wave charters, implementation readiness matrices, wave-scoped reviews, and historical research notes
were excluded by design. If a migrated design file originally linked to readiness material, that link
now resolves here instead.

## Where to find implementation state

Implementation planning, wave charters, and readiness tracking are maintained separately from this
design corpus. Consult the project's issue tracker or the implementation planning documents for
current wave status.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [design corpus overview](./README.md) · **← Prev:** [architecture decisions](./40-decisions/accepted-decisions.md) · **Next →:** [Engineering Policy Index](../engineering/README.md)

<!-- /DOCS-NAV -->
