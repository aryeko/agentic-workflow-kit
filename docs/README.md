---
title: kit-vnext — documentation home
status: high-level design
last-reviewed: "2026-06-19"
---

# agentic-workflow-kit documentation

This documentation set is organized as a guided descent from product intent down to domain
implementation details. A reader stops at the depth their task requires, without reading the
full corpus.

## Recommended reading path

| Step | Location | Purpose |
|---|---|---|
| 1 | [Design overview](design/README.md) | Entry point for the design corpus — start here |
| 2 | [Orientation](design/00-orientation/README.md) | Mission, requirements, vocabulary, conventions |
| 3 | [Architecture](design/10-architecture/README.md) | Runtime model, state model, provider seams, gates, recovery |
| 4 | [SDK and packaging](design/20-sdk-and-packaging/README.md) | Package structure and dependency rules |
| 5 | [Domain reference](design/30-domain-reference/README.md) | Full domain specs by layer — read only the domain(s) your task touches |
| 6 | [Decisions](design/40-decisions/README.md) | Accepted design decisions and their rationale |

The [engineering](engineering/README.md) folder covers verification policy and tooling — relevant
for implementation and CI work, not required for design reading.

## What is included

This bundle covers:

- The high-level design: orientation, architecture, SDK/packaging, and accepted decisions.
- The full domain-level design corpus, organized by layer under `design/30-domain-reference/`.

Implementation wave charters, review history, and readiness tracking are maintained separately.
See [IMPLEMENTATION_STATUS_NOTE.md](design/IMPLEMENTATION_STATUS_NOTE.md) for context.

## What is authoritative

The domain specs under `design/30-domain-reference/` are the authoritative source for low-level
design. The orientation and architecture layers introduce and cross-reference those specs; they do
not duplicate them.
