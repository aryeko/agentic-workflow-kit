---
title: "Domain charter — Layer 1"
status: draft
last-reviewed: "2026-06-22"
---

# Domain charter (Layer 1)

> **Audience** — architect (authoring) · characterization reviewer (grading).
> **Job** — the entity-altitude artifact. Authored first, derived from exactly one design-domain README
> (`source-design`). It names the entity contracts / types / events and the seam shapes a domain **owns**,
> and what it explicitly does **not** own. It says **WHAT** — no acceptance criteria, no HOW.
> **To author one** — copy [`_templates/domain-charter.md`](_templates/domain-charter.md), fill the
> six-part card, then tick every box in [Gate 1](#gate-1--planning-ready).

A wrong boundary or an untraceable signal here propagates into every story under the domain, so this is
where that defect class is cheapest to stop.

## Shape — the six-part card

Frontmatter carries `id`, `layer`, `status`, `source-design`, `last-reviewed`. The body, in order:

| Part | Holds |
|---|---|
| **What** | the implementation-planning responsibility in plain language; names owned spec surface with the design's own type / event / token names where it helps a later story author |
| **Why** | why the domain matters to the rebuild sequence and what it unblocks |
| **Does Not Own** | nearby concerns that belong elsewhere, **each attributed** to the owning domain / epic / story group by id |
| **Inputs And Dependencies** | the `source-design` README, direct domain dependencies (or `none`), and the planning artifacts that order the work; layer-specific lines expected — provider charters split SDK vs testkit inputs, core charters name their implementation DAG band |
| **Downstream Epics** | milestone epics that consume this domain |
| **Story Group Signals** | likely story groups this domain will shape — **no** acceptance criteria, **no** implementation HOW |

The catalog of authored charters lives in [`domains/README.md`](../../implementation/domains/README.md).

## Gate 1 — planning-ready

A domain charter is planning-ready only when all four hold; an empty box means not ready, and its stories
must not be authored.

- [ ] **Boundary is crisp.** `Does Not Own` names each excluded concern and attributes it to a specific
      owner id, with no overlap against sibling charters in the same layer.
- [ ] **Signals trace to design.** Every `Story Group Signal` and every named type / event / token maps to
      the `source-design` README or a cited sibling design file. Nothing is invented beyond design.
- [ ] **Altitude holds.** The charter states WHAT the domain owns, not HOW. No acceptance criteria,
      algorithms, file layout, or session mechanics.
- [ ] **Edges defer to the DAGs.** `Inputs And Dependencies` and `Downstream Epics` are consistent with
      the domain and epic DAGs and do not restate edge rationale the DAGs own.
