---
title: kit-vnext — orientation
status: high-level design
last-reviewed: "2026-06-19"
---

# Orientation

This layer answers what the project is, what it must guarantee, and how to navigate the rest of the
design. It is the required starting point for any session in the design corpus.

## Read in order

1. [Mission and scope](mission-and-scope.md) — the product mission, the motivation for the redesign,
   and the v1 boundary.
2. [Requirements](requirements.md) — functional requirements and verifiable quality attributes;
   domain charters reference these IDs.
3. [Glossary](glossary.md) — shared vocabulary; use these terms exactly throughout the design.
4. [Reading guide](reading-guide.md) — the minimum reading path for each class of task.
5. [Design conventions](conventions.md) — how every domain design is written, structured, and
   reviewed.
6. [Original design home](design-home-original.md) — the authoritative top-level framing document,
   migrated from the original corpus.

## Mission in one sentence

Delegate well-scoped work to agent workers and land it as reviewed, merged changes under
deterministic control, recoverability, evidence, and human supervision.

## Non-negotiable invariants

- Agents are workers, not orchestrators. The control plane is deterministic code.
- The SDK owns all orchestration logic and provider interfaces; concrete behavior lives in driver
  packages behind those interfaces.
- Completion and merge rest on independently gathered evidence and explicit policy, not a worker's
  self-report.
- Human approval and safety gates are explicit and fail-closed. Autonomy is earned by proving
  guarantees, never assumed.

For the full expression of these invariants see [design-home-original.md](design-home-original.md)
and [requirements.md](requirements.md).

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [design corpus overview](../README.md) · **← Prev:** [<Domain name>](../_templates/domain-design-template.md) · **Next →:** [mission and scope](./mission-and-scope.md)

**Children:** [mission and scope](./mission-and-scope.md) · [requirements](./requirements.md) · [glossary](./glossary.md) · [reading guide](./reading-guide.md) · [design conventions](./conventions.md) · [next-generation workflow kit (design home)](./design-home-original.md)

<!-- /DOCS-NAV -->
