---
title: "Role — architect"
status: draft
last-reviewed: "2026-06-22"
---

# Architect

> **Audience** — whoever builds or verifies this role's engine. The architect's "engine" is a
> human plus the [authoring standard](../authoring-standard/README.md); this spec stays thin and
> points at that standard for what each artifact must contain.

## Goal

Author **and** review the "what" — say what, not how. Produce the planning artifacts the rest of
the system builds and grades against, and own the verdict that releases them for dispatch.

## Requirements

- Author the three planning altitudes, each to its layer's gate in the authoring standard:
  - **domain plan** (entity altitude) — entity contracts, types/events, exposed/consumed seam
    shapes, the public-SDK surface — per [`20-domain-charter.md`](../authoring-standard/20-domain-charter.md).
  - **epic plan / DAG** (work-item altitude) — waves, per-story owned pathsets, shared-file
    ownership, producer→consumer seams by import path, phase-boundary readiness gate, suggested
    model tier — per [`30-epic-charter.md`](../authoring-standard/30-epic-charter.md) and
    [`40-story-dag.md`](../authoring-standard/40-story-dag.md).
  - **story characterizations** (per-story altitude) — ACs each carrying an evidence clause,
    public-SDK exposure, seam contract with import path, constructability, file-size budget as a
    number, negative-case matrix, per-story coverage command, non-goals — per
    [`50-story-contract.md`](../authoring-standard/50-story-contract.md).
- Review the authored "what" through [characterization review](characterization-review.md),
  dispatching a spec-reviewer sub-agent to assist; **the architect owns the final verdict.**
- Set the binding **`ready`** flag per story — and only after characterization review passes.
- Author down a **frozen** layer above; the planning artifacts are a checkable subset of
  [`docs/design/`](../../design/README.md), which wins on conflict.
- Encode each new lesson as a named characterization dimension or AC evidence clause, never as
  accumulated narrative.

## Inputs

- The frozen design corpus [`docs/design/`](../../design/README.md) — the source the plan subsets.
- The [authoring standard](../authoring-standard/README.md) — the bar each artifact must meet.
- The characterization-review verdict (from the gate it owns).

## Outputs

- The domain plan, the epic plan (DAG), and the story characterizations.
- The characterization-review verdict.
- The binding `ready` flag per story.

## Flow

1. Author the domain plan against frozen design; freeze it.
2. Author the epic plan (DAG) against the frozen domain plan; freeze it.
3. Author each story characterization against the frozen DAG.
4. Run [characterization review](characterization-review.md) (spec-reviewer assists; architect
   decides); set `ready` only on stories that pass.
5. Hand the epic plan and its `ready` stories to the [orchestrator](orchestrator.md).

## Validation

An engine implements this role correctly when:

- every artifact is authored against a **frozen** layer above and traces to design;
- no story is `ready` without a passing characterization-review verdict the architect owns;
- the architect never writes production code, runs the delivery loop, or dictates implementation
  mechanics;
- a new lesson lands as a gate box / evidence clause, not as new prose.

## Acceptance

Correctly implemented when the three altitudes exist, each gated to its layer in the authoring
standard, and the only path from authored to dispatchable is a passing characterization-review
verdict that sets `ready`.

## References

- [Operating model](README.md) — the parent spec; the two defect buckets and enforcement rules.
- [Authoring standard](../authoring-standard/README.md) — what each planning artifact must contain.
- [Characterization review](characterization-review.md) — the gate the architect owns.
- [Orchestrator](orchestrator.md) — consumes the epic plan and `ready` stories.