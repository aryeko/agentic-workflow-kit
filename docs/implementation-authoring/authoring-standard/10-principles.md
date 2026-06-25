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
dozen fuzzy stories. So each layer gets a bar matched to what it owns — these four principles are what
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
- **The standing gate, not a spot-run, makes a proof durable.** A fixture that runs only as a manual
  one-off is a manual-only proof and does not count. The proof must be re-run by `pnpm check` (or a
  named CI lane); a negative type-fixture outside the `tsc -b` build graph silently rots until a
  regression slips through.

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

## Readiness is reconstructed, not asserted

A `ready` / `ready_for_implementation` verdict is valid **only** when closure has been *rebuilt from the
source artifacts* — the spec-surface manifest, the ACs, the declared inputs, the owned pathset — never
when it is asserted in prose. A verdict that says "coverage ≥ 95%" or "every branch is backed by declared
inputs" without reconstructing that claim from the artifacts is **rejectable on sight**: the assertion is
the defect, independent of whether it happens to be true.

This generalizes the [shared close-out](README.md#verifying-a-layer)'s *rebuild coverage from the source
artifacts, not the rollup* step (also the independent pass in
[50-story-contract.md](50-story-contract.md#verification--freeze)) — which is the **coverage** instance of
this rule — to **every** closure dimension:

- **Substrate** — the coverage lane is reconstructed from the owned pathset's runtime substrate, not
  asserted from a `0/0`→100% rollup.
- **Predicate-input** — every branch operand is traced to a declared field, not asserted "backed by
  declared inputs."
- **Producer-closure** — every produced field is traced to a source, not asserted constructable.
- **Public-exposure** — every public symbol is traced to its export line + import test, not asserted
  exposed.

Two Gate-4 boxes in [50-story-contract.md](50-story-contract.md#gate-4--authoring-ready) are the **named
enforced instances** of this principle: **Proof-substrate match** (substrate dimension) and
**Predicate-input closure — relational & compound** (predicate-input dimension). The plan-delivery
preflights and skill checks that mirror them are its mechanical instances. The intent: the *next* closure
class is caught by this principle plus the "reconstruct, don't assert" discipline — without waiting for a
third blocker.

**Falsification (both verdicts were asserted, both were false):**

- `core-04-s1` shipped a `ready` verdict on a `95% statements/branches` bar over a *type-only producer*.
  `type` / `interface` declarations erase at compile time → V8 sees `0/0` → reports 100% ≥ 95%. The bar
  was *vacuously satisfied*; the verdict asserted coverage no source statement could prove. Reconstructing
  the lane from the owned pathset (zero runtime substrate) rejects it.
- `core-03-s2` shipped a `ready` verdict claiming "every branch is backed by declared input values," while
  the relational predicate "cwd **inside the workspace**" named only one operand (`cwd`) as a frozen input
  and left the workspace-root operand unsourced. Reconstructing the predicate-input matrix
  operand-by-operand rejects it.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Authoring standard — Pillar 1](./README.md) · **← Prev:** [Story contract — Layer 4](./50-story-contract.md) · **Next →:** [Coverage — exactly-once ownership](./60-coverage.md)

<!-- /DOCS-NAV -->
