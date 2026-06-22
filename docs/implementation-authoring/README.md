---
title: "Implementation planning — authoring standard"
status: draft
last-reviewed: "2026-06-22"
---

# Implementation planning — authoring standard

> **Audience** — the architect authoring the plan, and whoever builds or verifies the delivery engine.
> **Job** — the front door to the authoring corpus: the standard the planning artifacts must meet, and
> the spec the delivery engine is built and verified against.

## Design-time vs runtime

This corpus is consumed **while planning / designing** — when an architect authors charters, DAGs, and
story contracts, and when an engineer builds or verifies the delivery engine. At **runtime** the
delivery agents — the `orchestrated-delivery` skill plus the implementer / reviewer / characterization-
review sub-agents — consume the **authored artifacts** in [`../implementation/`](../implementation/README.md)
(charters, DAGs, story contracts), **not** this corpus. This corpus produces the *standard* for those
artifacts and the *spec* for the delivery engine that runs them.

## The two pillars

| If you are… | Go to |
|---|---|
| authoring the plan (domain charter → epic charter → story DAG → story contract) | [authoring-standard/](authoring-standard/README.md) |
| building or verifying the delivery engine + role agents | [operating-model/](operating-model/README.md) |

## North star

An artifact pins **WHAT** + **WHY** with zero gray areas, so the implementer derives the **HOW** and the
reviewer verifies against the *same* artifact and reaches the *same* verdict — the full statement lives in
[authoring-standard/](authoring-standard/README.md#north-star).

## Relationship to other docs

| Directory | Owns |
|---|---|
| [`../design/`](../design/README.md) | Normative product, architecture, package, domain, and decision contracts. **Wins on conflict.** |
| [`../engineering/`](../engineering/README.md) | Verification policy, the check gate, and test lanes. |
| [`../implementation/`](../implementation/README.md) | The authored plan artifacts — charters, DAGs, story contracts — the inputs the runtime agents consume. |
| `./` | This authoring method: the standard those artifacts meet and the spec for the engine that runs them. |

When this corpus conflicts with `../design/`, the design corpus wins; `../engineering/` owns verify
policy and the gate.

## Lessons ledger

Recurring defect classes, each mapped to the gate or role that covers it: [lessons-ledger.md](lessons-ledger.md).

## In this corpus

- [authoring-standard/](authoring-standard/README.md) — Pillar 1: the bar every planning artifact meets.
- [operating-model/](operating-model/README.md) — Pillar 2: the delivery-engine + role-agent spec.
- [lessons-ledger.md](lessons-ledger.md) — retro lessons → covering gate or role; the "lessons land
  before the next wave" gate.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../README.md) · **← Prev:** [implementation coverage rollup](../implementation/coverage.md) · **Next →:** [Authoring standard — Pillar 1](./authoring-standard/README.md)

**Children:** [Authoring standard — Pillar 1](./authoring-standard/README.md) · [Operating model — delivery system spec](./operating-model/README.md) · [implementation lessons ledger](./lessons-ledger.md)

<!-- /DOCS-NAV -->
