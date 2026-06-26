---
title: "Delivery pipeline — flow, gates, and invariants"
status: draft
last-reviewed: "2026-06-23"
---

# Flow, gates, and invariants

## The flow

```
domain + epic charters        Layers 1–2, frozen — architect-authored, no skill
        │  epic: ready over frozen domains
        ▼
plan-epic                     authors Layer 3 DAG + Layer 4 contracts; characterization-reviews each
        │  GATE 1 — story-dag: frozen · every story: ready          (the authoring standard's exit)
        ▼
plan-delivery                 projects the ready contracts into an execution package — how only
        │  GATE 2 — package: ready_for_implementation
        ▼
orchestrated-delivery         dispatches ready stories in waves; implementer/reviewer loop; commit; PR
        │
        ▼
reviewed, merged changes      stops at the requested boundary
```

Two review loops at two altitudes, inherited from the operating model: **characterization review** inside
`plan-epic` (pre-dispatch — "is the *what* right?", output = the `ready` flag) and **code review** inside
`orchestrated-delivery` (post-implementation — "does the build match the *what*?"). The first is Bucket 1
(a missing or imprecise *what*); the second is Bucket 2 (the *what* was clear and the builder erred).

## The two gates

A gate is a **token the upstream stage produces and the downstream stage refuses to start without**. The
downstream skill checks presence, not quality — quality was the upstream stage's job.

| Gate | Token | Produced by | Refused by (if absent) |
|---|---|---|---|
| 1 | `story-dag: frozen` + every selected story `story: ready` | `plan-epic` | `plan-delivery` → route back to `plan-epic` |
| 2 | execution package `ready_for_implementation` (deep-readiness verdict) | `plan-delivery` | `orchestrated-delivery` → route back to `plan-delivery` |

Gate 1 is exactly the authoring standard's dispatch gate
([10-principles.md](../authoring-standard/10-principles.md)) — `plan-delivery` adds nothing the architect
should have decided.

## The five invariants

**I1 — One job per stage.** Each skill embodies exactly one operating-model responsibility (author /
project / execute) and no other. A skill that starts doing the next stage's job has broken the gate that
makes the pipeline resumable and reviewable.

**I2 — Add only your altitude.** A stage may add its own layer of detail; it may never re-decide the
layer above. `plan-epic` decides the *what*; `plan-delivery` adds the *how to dispatch it*;
`orchestrated-delivery` binds the *runtime facts*. Altitude flows down, never up.

**I3 — Gates are boolean.** A downstream skill checks for its input token's presence and refuses if it is
absent — a check, not a judgment. It does not re-grade the upstream artifact; if the token is present the
upstream gate already vouched for quality.

**I4 — The package is a projection (pinned).** The execution package `plan-delivery` produces is a
faithful, traceable projection of the `ready` story contracts: it may add *how* — dispatch prompts, model
class, effort, a reasoning tier at or above the suggested-tier floor, tracker rows — and nothing else. It
must not introduce or alter scope, acceptance criteria, dependency order, or the suggested-tier floor;
every package element traces 1:1 to a `ready` contract. **Why it is pinned:** the operating model routes
the orchestrator straight to the authored artifacts, so inserting a package step is only safe if the
package cannot smuggle in new *what*. If it ever does, the Bucket-1 characterization gate has been
bypassed and the churn the operating model exists to prevent returns. **The trace makes it auditable:**
every package element records the story id and acceptance-criteria ids it projects from; an element that
cites no source contract is exactly the defect this invariant catches.

**I5 — Durability over narration.** Pipeline state must be reconstructable from committed artifacts
(contracts, package, tracker, git history), never from a session transcript. Every stage records evidence
— commit hashes, verdicts, gate output — so a fresh session can resume after compaction by reading the
artifacts. A claim with no artifact behind it does not count.

## Status and handoff vocabulary

Reuse the authoring standard's lifecycle and coverage vocabulary verbatim; the pipeline adds the package
and routing tokens.

| Token | Meaning | Set by |
|---|---|---|
| `domain-charter / epic / story-dag / story: draft → ready → frozen` | the layer lifecycle | architect (`plan-epic` owns story-dag + story) |
| `story: ready` | the dispatch gate — characterization review passed | `plan-epic` |
| coverage `covered` / `deferred` | which epic owns or defers a signal (epic-level) | epic charter — Layer 2, architect, before `plan-epic` |
| coverage `split` + owning-story backfill | a signal split across stories; the story that owns a signal | `plan-epic` (Layer 3 DAG) |
| suggested tier `light` / `standard` / `elevated` | the orchestrator's tier floor for a public-exposure story | `plan-epic` (Layer 3 DAG) |
| `ready_for_implementation` | the package passed deep-readiness review | `plan-delivery` |
| model class · effort · reasoning tier | routing; abstract until execution; reasoning tier ≥ the suggested-tier floor (adds `critical` above `elevated`) | `plan-delivery` (abstract), `orchestrated-delivery` (concrete) |

## The eval method

Each skill carries its own eval spec (`EVALS.md`) that **must satisfy the requirements in this pillar's
per-skill files**. This pillar owns the *requirements* (what must be true and why); the skill's `EVALS.md`
owns the *test cases and the version pin*. Requirements here use four verification modalities:

- **S — static**: inspect the skill or an artifact without running it.
- **P — planning run**: run the skill on a real input and inspect the planning output.
- **E — execution / dry run**: run, or toy-repo dry-run, the delivery loop; for communication
  requirements, audit the transcript or session output from that execution.
- **T — trap**: feed a malformed or out-of-gate input and confirm refusal.

A skill is *ready* only when every P1 requirement passes with shown evidence. Evidence over assertion: a
result block that lists only "PASS" re-runs the presence trap the operating model warns about.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Delivery pipeline — the skill spec](./README.md) · **← Prev:** [Delivery pipeline — the skill spec](./README.md) · **Next →:** [plan-epic — charter and evals](./20-plan-epic.md)

<!-- /DOCS-NAV -->
