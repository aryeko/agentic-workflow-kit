---
title: "Delivery pipeline — the skill spec"
status: draft
last-reviewed: "2026-06-23"
---

# Delivery pipeline — the skill spec

> **Audience** — whoever authors, recreates, extends, or verifies the delivery skills.
> **Job** — pin the *what* and *why* of the three skills that carry a `ready` epic to merged changes,
> with zero gray areas, so the skills can be rebuilt from this doc and a new one slotted in without
> re-deciding the pipeline. The *how* lives inside each skill and is deliberately absent here.

## Where this sits

Three pillars, one method:

| Pillar | Owns | Altitude |
|---|---|---|
| [authoring-standard/](../authoring-standard/README.md) | the bar every planning artifact meets (Layers 1–4) | the *what* of a plan |
| [operating-model/](../operating-model/README.md) | the roles and the delivery-engine spec | the *who* and the loop |
| **delivery-pipeline/ (this)** | the three skills that run the operating model from `story: ready` to merged | the *stages* and their gates |

The operating model names the roles (architect, characterization-reviewer, orchestrator, implementer,
reviewer). This pillar names the **skills** that embody them, the **bridge** the operating model does not
name (`plan-delivery`), and the **evals** each skill must pass. It begins where the authoring standard
ends — at the `ready` dispatch gate — and ends at reviewed, merged changes.

## The pipeline at a glance

| Stage | Skill | One job | Starts on | Hands off |
|---|---|---|---|---|
| 1 | `plan-epic` | author + characterization-review one epic's stories | an `epic: ready` charter over frozen domains | `story-dag: frozen` + every story `story: ready` |
| 2 | `plan-delivery` | project the `ready` contracts into a runtime-executable package | gate 1 met | package `ready_for_implementation` |
| 3 | `orchestrated-delivery` | execute the package: dispatch, review, commit, PR | gate 2 met | reviewed, merged changes |

Implementer and reviewer are **not skills** — they are sub-agents `orchestrated-delivery` dispatches per
story from the packaged prompts.

The full flow, the two gates, and the invariants that bind them:
[10-pipeline-and-invariants.md](./10-pipeline-and-invariants.md).

## The non-negotiables (summary)

- **One job per stage.** Each skill embodies one operating-model responsibility and no other.
- **Add only your altitude.** A stage may add its own layer of detail; it may never re-decide the layer
  above. Authoring decides the *what*; delivery adds the *how*; execution binds runtime facts.
- **Gates are boolean.** A downstream skill refuses to start unless its input-gate token is present — a
  check, not a judgment.
- **The package is a projection.** `plan-delivery`'s execution package adds *how* only; it never
  introduces scope, acceptance criteria, dependency order, or tier the `ready` contracts did not already
  fix. The pinned invariant — see [10-pipeline-and-invariants.md](./10-pipeline-and-invariants.md).
- **Evidence over assertion.** Every gate is backed by shown evidence, not a claimed "PASS."

## In this corpus

- [10-pipeline-and-invariants.md](./10-pipeline-and-invariants.md) — the flow, the two gates, the five
  invariants, the status vocabulary, the front edge, and the eval method.
- [20-plan-epic.md](./20-plan-epic.md) — skill charter + evals.
- [30-plan-delivery.md](./30-plan-delivery.md) — skill charter + evals (the projection bridge).
- [40-orchestrated-delivery.md](./40-orchestrated-delivery.md) — skill charter + evals.

## Front edge and extension points

Layers 1–2 (domain and epic charters) are **architect-authored by hand** today; no skill owns them, and
the pipeline's front edge is an `epic: ready` charter. That is a deliberate boundary, not an oversight —
the charter altitude changes rarely and is the architect's direct responsibility. If a future session
wants a charter-authoring skill, it slots **before** `plan-epic` as stage 0 and must hand off the exact
token `plan-epic` already requires (`epic: ready` over frozen domains); do not widen `plan-epic`'s job to
absorb it. New surfaces (providers) and new skills extend the pipeline only by honoring the same gates —
the gates, not the skill internals, are the stable contract.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Implementation planning — authoring standard](../README.md) · **← Prev:** [Role — reviewer](../operating-model/reviewer.md) · **Next →:** [Delivery pipeline — flow, gates, and invariants](./10-pipeline-and-invariants.md)

**Children:** [Delivery pipeline — flow, gates, and invariants](./10-pipeline-and-invariants.md) · [plan-epic — charter and evals](./20-plan-epic.md) · [plan-delivery — charter and evals](./30-plan-delivery.md) · [orchestrated-delivery — charter and evals](./40-orchestrated-delivery.md)

<!-- /DOCS-NAV -->
