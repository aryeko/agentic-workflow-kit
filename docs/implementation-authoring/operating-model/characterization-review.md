---
title: "Role — characterization review"
status: draft
last-reviewed: "2026-06-22"
---

# Characterization review

> **Audience** — whoever builds or verifies this role's engine: the spec-reviewer sub-agent that
> grades the plan and the architect who owns its verdict.

## Goal

The **Bucket-1 gate** between planning and dispatch — the checkpoint that moves characterization
defects left, before any code is written. Output the binding `ready` flag.

## Requirements

- Verify each story characterization is **complete, internally consistent, and constructable**
  against the layer gates in the [authoring standard](../authoring-standard/README.md) — graded
  with [`50-story-contract.md`](../authoring-standard/50-story-contract.md) Gates 4–6.
- Verify **every AC carries an evidence clause** — `X holds, proven by <command → expected output>`
  — never bare "X holds".
- Performed by a **spec-reviewer sub-agent** the architect dispatches (reviews the plan like a PR);
  the **architect owns the final verdict**. The sub-agent assists; it does not decide.
- Emit the **`ready`** flag, which is **binding**: a story that is not `ready` is **not
  dispatchable** by the [orchestrator](orchestrator.md).
- Grade against the source: every finding quotes the design line or AC it contradicts, and
  classifies story-defect vs design-defect.
- **Does NOT** review or anticipate implementation code — that is Bucket 2, owned by the
  [reviewer](reviewer.md) post-implementation.

## Inputs

- The authored artifacts: domain plan, epic plan (DAG), story characterizations (from the
  [architect](architect.md)).
- The gates in the [authoring standard](../authoring-standard/README.md) — the checklist this gate
  runs.

## Outputs

- The binding **`ready`** flag per story (non-ready ⇒ not dispatchable).
- A finding list for each non-ready story, each finding quoting its contradicted source line and
  labelled story-defect or design-defect.

## Flow

1. Architect dispatches the spec-reviewer sub-agent against an authored story characterization.
2. Sub-agent runs the authoring-standard gates: completeness, internal consistency,
   constructability, and an evidence clause on every AC.
3. Sub-agent returns findings (each quoting source, classified); the architect owns the verdict.
4. Architect sets `ready` only on stories that pass clean; non-ready stories return to authoring.

## Validation

An engine implements this role correctly when:

- a story with an uncharacterized producer→consumer seam is **blocked here**, not at code review;
- an AC without an evidence clause **fails** the gate;
- the spec-reviewer **assists** and the architect **decides** — the flag is never set by the
  sub-agent alone;
- the gate never inspects or anticipates implementation code.

## Acceptance

Correctly implemented when no story reaches the orchestrator without a `ready` flag set by a
passing run of this gate, and Bucket-1 escapes to code review trend to zero across waves.

## References

- [Operating model](README.md) — the parent spec; the two defect buckets; enforcement rule 1
  (binding `ready`).
- [Authoring standard](../authoring-standard/README.md) — the gates this review runs;
  [`50-story-contract.md`](../authoring-standard/50-story-contract.md) Gates 4–6.
- [Architect](architect.md) — owns the verdict and sets `ready`.
- [Orchestrator](orchestrator.md) — hard-refuses any story not `ready`.