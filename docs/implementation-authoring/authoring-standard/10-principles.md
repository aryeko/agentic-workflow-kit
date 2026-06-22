---
title: "Principles — the universal bar"
status: draft
last-reviewed: "2026-06-22"
---

# Principles

> **Audience** — architect (authoring) · characterization reviewer (grading).
> **Job** — the bar every layer meets, independent of which layer. The per-layer docs
> ([20](20-domain-charter.md)–[50](50-story-contract.md)) sharpen these as you descend.

Ambiguity is cheapest to remove at the layer where it is introduced. A fuzzy domain boundary seeds a
dozen fuzzy stories. So each layer gets a bar matched to what it owns — these three principles are what
that bar is made of.

## Evidence over prose

Write for the next reader's verdict, not for narrative coherence. Design prose can be coherent without
being checkable.

- **Every check is falsifiable with attached proof.** A check is true or false against a test or
  artifact. "Handles it correctly" is never ready at any layer.
- **"As specified" / "as in design" is not falsifiable.** It defers the assertion instead of making it;
  enumerate the set at the layer that first references it.
- **One shared written rubric.** Author and reviewer grade against the *same* written check for that
  layer, graded the same way — not a bar that lives in someone's head.

## Altitude

HOW belongs at the **lowest** layer that owns it. Each higher layer states **WHAT**, not the detail of
the layer below it. Lower-layer detail placed higher rots, because the lower layer is where it is
actually maintained.

| Layer | Must not carry |
|---|---|
| Domain charter | acceptance criteria or HOW |
| Epic charter | story-level DTO / event / test detail |
| Story DAG | acceptance criteria |
| Story contract | a re-decided domain boundary or epic slicing |

## Lifecycle

Every planning artifact carries a `status` that moves one direction only. The string keeps its artifact
prefix as it advances (e.g. `domain-charter: draft → ready → frozen`).

| Status | Meaning |
|---|---|
| `draft` | being authored; downstream layers must not depend on it. |
| `ready` | passed its readiness gate and the [shared close-out](README.md#verifying-a-layer); dispatchable / consumable. `ready` is the **dispatch gate** — the orchestrator refuses anything not `ready`. |
| `frozen` | locked; children may be authored against it. Changing a frozen artifact requires re-verifying every child that cited it. |

**Governing rule:** author layer N only against a **frozen** layer N−1.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Authoring standard — Pillar 1](./README.md) · **← Prev:** [Story contract — Layer 4](./50-story-contract.md) · **Next →:** [Coverage — exactly-once ownership](./60-coverage.md)

<!-- /DOCS-NAV -->
