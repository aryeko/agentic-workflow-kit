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
| 7 | [Implementation contract](implementation/README.md) | Dependency frontiers, story contracts, readiness evidence, and migration tracking |
| 8 | [Implementation-planning authoring standard](implementation-authoring/README.md) | How to author the plan artifacts (the standard + gates) and the delivery operating-model spec |

The [engineering](engineering/README.md) folder covers verification policy and tooling — relevant
for implementation and CI work, not required for design reading.

## What is included

This bundle covers:

- The high-level design: orientation, architecture, SDK/packaging, and accepted decisions.
- The full domain-level design corpus, organized by layer under `design/30-domain-reference/`.
- The implementation contract layer under `implementation/`, which translates approved design into
  dependency frontiers, story contracts, and evidence tracking.
- The implementation-planning authoring standard under `implementation-authoring/`, which defines how
  the plan artifacts are authored and the delivery operating model.

Review history and execution-process material are maintained separately. See
[IMPLEMENTATION_STATUS_NOTE.md](design/IMPLEMENTATION_STATUS_NOTE.md) for context.

## What is authoritative

The domain specs under `design/30-domain-reference/` are the authoritative source for low-level
design. The orientation and architecture layers introduce and cross-reference those specs; they do
not duplicate them.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**Next →:** [design corpus overview](./design/README.md)

**Children:** [design corpus overview](./design/README.md) · [implementation contract](./implementation/README.md) · [Implementation planning — authoring standard](./implementation-authoring/README.md) · [Engineering Policy Index](./engineering/README.md) · [Delivery-model reform + barrel simplification — self-contained remediation plan](./reviews/2026-06-25-barrel-coownership-and-closure-wiring-plan.md) · [Closure-Defect Remediation — Durable Execution Plan](./reviews/2026-06-25-closure-remediation-plan.md) · [Producer↔Consumer Closure Audit — kit-vnext design corpus](./reviews/2026-06-25-producer-consumer-closure-audit.md) · [Codex Custom-Agent Bindings and Orchestration Message Plan](./reviews/2026-06-26-codex-custom-agent-skill-bindings-plan.md) · [roadmap](./roadmap.md)

<!-- /DOCS-NAV -->
