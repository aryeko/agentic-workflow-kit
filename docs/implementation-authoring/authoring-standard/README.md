---
title: "Authoring standard — Pillar 1"
status: draft
last-reviewed: "2026-06-22"
---

# Authoring standard

> **Audience** — architect (authoring) · characterization reviewer (grading).
> **Job** — the standard every planning artifact must meet as implementation planning descends
> **domain charter → epic charter → story DAG → story contract**. Each layer gets a bar matched to
> what it owns, not a copy of the story bar.

## North star

An artifact pins down **WHAT** and **WHY** with zero architectural, design, or requirements gray
areas — so the implementer derives the **HOW** and the reviewer verifies against the *same* artifact
and reaches the *same* verdict, with no private re-derivation. That is the success criterion of the
whole standard.

## The four layers

Two kinds alternate: **content** artifacts (charters/contracts — what an item owns and proves) and
**structure** artifacts (DAGs — what exists and in what order).

| Layer | Altitude | Artifact | Gate | Doc |
|---|---|---|---|---|
| Domain charter | entity | `domains/<layer>/<id>.md` | Gate 1 | [20-domain-charter.md](20-domain-charter.md) |
| Epic charter | work-item milestone | `epics/epic-<n>/README.md` | Gate 2 | [30-epic-charter.md](30-epic-charter.md) |
| Story DAG | intra-epic structure | `epics/epic-<n>/story-dag.md` | Gate 3 | [40-story-dag.md](40-story-dag.md) |
| Story contract | per-story | `epics/epic-<n>/stories/<id>.md` | Gates 4–6 | [50-story-contract.md](50-story-contract.md) |

Author layer N only against a **frozen** layer N−1. Two rules hold across all four: each layer is a
checkable **subset of the source** above it (ultimately [`../../design/`](../../design/README.md)), and
**altitude flows down, never up** — see [10-principles.md](10-principles.md).

## Gates at a glance

| Gate | Catches | Defined in |
|---|---|---|
| Gate 1 | domain charter planning-ready | [20-domain-charter.md](20-domain-charter.md) |
| Gate 2 | epic charter planning-ready | [30-epic-charter.md](30-epic-charter.md) |
| Gate 3 | story DAG ready | [40-story-dag.md](40-story-dag.md) |
| Gate 4 | story contract authoring-ready | [50-story-contract.md](50-story-contract.md) |
| Gate 5 | evidence pack complete | [50-story-contract.md](50-story-contract.md) |
| Gate 6 | readiness matrix | [50-story-contract.md](50-story-contract.md) |
| Coverage rule | every signal owned exactly once | [60-coverage.md](60-coverage.md) |

## Verifying a layer

The readiness gates are author-time self-checks. After authoring **any** layer — the domain charters,
the epic charters, an epic's story DAG, or a batch of story contracts — run this shared close-out
before the next layer consumes it and before marking it `frozen`. Three steps:

1. **Run the merge gate.** `pnpm check` must be green (docs nav, links, lints clean). Re-run
   `pnpm docs:nav` first if any file was added or moved — the gate's first step fails on stale nav.
2. **Rebuild coverage from the source artifacts, not the rollup.** Extract every signal from the
   charters and confirm each maps to exactly one owner (epic table row / story node, or a `deferred`
   row). Trusting the rollup's own assertion is circular.
3. **Run the layer's readiness gate as an independent pass**, by a *different* reader than the author.
   Divergent independent verdicts mean the artifact or the rule is under-specified, not noise to
   average away.

Two reviewer rules keep the independent pass honest:

- **Quote the source.** Every finding quotes the design line (or AC) it contradicts; a quote that
  actually supports the artifact auto-refutes the finding.
- **Classify story-defect vs design-defect.** Vagueness that comes from the design is a design gap to
  escalate, not a story bug to log against the author.

**Self-checks must show evidence, not assert it.** A block listing only "PASS" re-runs the presence
trap; quote the proving AC under every failure row and include the responsibility/manifest → AC matrix
so an empty proof is visible on the page.

**Encoding new lessons.** A new recurring defect class is encoded as a **gate box, template field, or
evidence-pack item — never new prose** — and recorded in [`../lessons-ledger.md`](../lessons-ledger.md).
A lesson that cannot be reduced to a checkable box is not ready to add; an uncovered lesson is an open
gap to close before the next epic is authored.

## Lifecycle

`draft → ready → frozen` — full definition in [10-principles.md](10-principles.md#lifecycle).

## In this pillar

- [10-principles.md](10-principles.md) — the universal bar every layer meets.
- [20-domain-charter.md](20-domain-charter.md) — Layer 1, Gate 1.
- [30-epic-charter.md](30-epic-charter.md) — Layer 2, Gate 2.
- [40-story-dag.md](40-story-dag.md) — Layer 3, Gate 3.
- [50-story-contract.md](50-story-contract.md) — Layer 4, Gates 4–6.
- [60-coverage.md](60-coverage.md) — the exactly-once coverage rule.
- [_templates/](_templates/) — copy-to-author starting points.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Implementation planning — authoring standard](../README.md) · **← Prev:** [Implementation planning — authoring standard](../README.md) · **Next →:** [Domain charter — Layer 1](./20-domain-charter.md)

**Children:** [Domain charter — Layer 1](./20-domain-charter.md) · [Epic charter — Layer 2](./30-epic-charter.md) · [Story DAG — Layer 3](./40-story-dag.md) · [Story contract — Layer 4](./50-story-contract.md) · [Principles — the universal bar](./10-principles.md) · [Coverage — exactly-once ownership](./60-coverage.md) · [Domain charter template](./_templates/domain-charter.md) · [Epic charter template](./_templates/epic-charter.md) · [Story contract template](./_templates/story-contract.md) · [Story DAG template](./_templates/story-dag.md)

<!-- /DOCS-NAV -->
