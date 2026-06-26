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
- **Re-derive, don't trust the self-claim:** for sweep and coverage boxes, independently reconstruct the
  true forbidden-token set (the real public surface) and the claimed helper scope from the design — a
  passing self-stated set or an aggregate coverage number is not evidence. Verify that no forbidden-token
  set bans a token that appears in the story's own ACs or in the normative design vocabulary — an
  over-broad sweep is a defect, not a safety measure.
- **Design→AC completeness pass (per story).** Read the design sections that govern each story's signal.
  For every fail-closed invariant and every emitted event the design states, assert it maps to at least one
  AC in the contract. Gates check AC→design (nothing invented); this pass is the mirror check:
  design→AC (nothing dropped). A dropped invariant or dropped emitted event is a story-defect finding.
  This pass is not optional: it is the only check that catches a silently dropped requirement before any
  code is written.
- **Producer-closure pass (per story).** Verify the contract's produced-obligations section of the
  predicate-input matrix exists and covers every required field of every produced record/event and every
  required public symbol. A row with no declared source is a closure defect.
- **Manifest coverage pass (per story).** Verify every spec-surface manifest item maps to a proving AC,
  and every proving AC maps to a standing `pnpm check` leaf or named CI lane. A manifest item with no AC,
  or with only manual/prose evidence and no standing gate lane, is an orphaned obligation and a
  story-defect finding.
- **Pure/value classifier boundary pass (per story).** If a story is characterized as pure, value-only,
  classifier-only, or projection-only, verify it owns no writer, append, persistence, or event-log
  obligation unless the contract explicitly names the writer seam it owns. A pure classifier with an
  unnamed writer obligation is a boundary contradiction, not dispatchable scope.
- **Safety-action provenance pass (per story).** Verify every unattended recovery, clear, apply,
  auto-retry, or similar safety action names the classification producer and the committed gate record
  required before execution. A safety action backed only by stale state, prose classification, or an
  uncommitted/manual check is a source gap.
- **Failure-token/catalog closure pass (story + DAG).** Verify every failure / degraded / validation token
  in the story resolves to exactly one authoritative producer catalog: the story-owned catalog, or an
  earlier frozen design / producer catalog recorded in the DAG reconciliation. Consumer stories cannot
  invent tokens; producer stories must enumerate exact literals in enforced fixtures / catalog tests. An
  unowned, ambiguous, or stronger-than-design token is a story-defect or DAG-defect finding, not a
  dispatchable ambiguity.
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

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Operating model — delivery system spec](./README.md) · **← Prev:** [Role — architect](./architect.md) · **Next →:** [Role — orchestrator](./orchestrator.md)

<!-- /DOCS-NAV -->
