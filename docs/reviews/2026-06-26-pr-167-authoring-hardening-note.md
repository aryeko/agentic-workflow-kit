---
title: "PR #167 authoring hardening note"
status: "review-note"
created: "2026-06-26"
scope: "Source-of-truth authoring hardening after Epic 4 blocker analysis"
owner: architect
---

# PR #167 authoring hardening note

## Purpose

PR #167 records the source-of-truth authoring hardening that follows the Epic 4 blocker-pattern report.
It does not re-state the design corpus. It names the defect classes, why they matter, and which authoring
gates now carry the prevention rule.

Authoritative source files:

- [`docs/implementation-authoring/authoring-standard/40-story-dag.md`](../implementation-authoring/authoring-standard/40-story-dag.md)
- [`docs/implementation-authoring/authoring-standard/50-story-contract.md`](../implementation-authoring/authoring-standard/50-story-contract.md)
- [`docs/implementation-authoring/delivery-pipeline/20-plan-epic.md`](../implementation-authoring/delivery-pipeline/20-plan-epic.md)
- [`docs/implementation-authoring/delivery-pipeline/30-plan-delivery.md`](../implementation-authoring/delivery-pipeline/30-plan-delivery.md)
- [`docs/implementation-authoring/operating-model/characterization-review.md`](../implementation-authoring/operating-model/characterization-review.md)
- [`docs/implementation-authoring/lessons-ledger.md`](../implementation-authoring/lessons-ledger.md)

## Classes Hardened

### Phantom Consumer Edges

A DAG can claim a producer has consumers even when no dependency edge and no consumed-shape/predicate use
exists. That makes ordering look real while no story actually consumes the producer. Gate 3 now rejects
phantom consumers as part of whole-graph producer/consumer reconciliation.

Ledger mapping: LSN-24 strengthening, not a new lesson.

### Orphaned Manifest Obligations

Manifest obligations are not durable when they map only to prose, a responsibility label, or a manual
one-off proof. Every manifest item must map to a proving AC, and that AC must map to a standing gate lane.
Gate 5 evidence also has to be reconstructable by concrete file range, fixture id, or generated artifact
id when it is not a command result.

Ledger mapping: new LSN-34 for repeated orphaned manifest obligations; evidence-pack range omissions are
treated as LSN-15 / Gate 5 coverage hardening.

### Pure Classifier And Writer Boundary Contradictions

A pure/value/classifier/projection story can classify or return values, but it cannot own writer, append,
persistence, or event-log obligations unless it explicitly owns the writer seam. Otherwise the story asks
a value classifier to perform side effects it does not own.

Ledger mapping: LSN-33 producer/source-closure plus boundary contradiction.

### Unattended Safety-Action Provenance

Unattended recovery, clear, apply, auto-retry, or similar actions must name the classification producer
and the committed gate record required before execution. A stale classification or prose safety label
does not authorize action.

Ledger mapping: LSN-21/30 predicate-input closure plus safety-action specialization.

## Gates Hardened

- Gate 3: rejects phantom consumer edges in the story DAG.
- Gate 4: requires durable manifest coverage, pure/value classifier writer-seam ownership, and
  safety-action provenance.
- Gate 5: requires reconstructable evidence ranges/artifact ids for non-command evidence.
- `plan-epic`: carries the Gate 3 and Gate 4 checks into the ready-story handoff.
- `plan-delivery`: adds a manifest/gate-lane coverage preflight before `ready_for_implementation`.
- Characterization review: verifies manifest coverage, pure/value classifier boundaries, and
  safety-action provenance before any story is dispatchable.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [agentic-workflow-kit — documentation home](../README.md) · **← Prev:** [Orchestrated-Delivery Operator UX Design](./2026-06-26-orchestrated-delivery-operator-ux-design.md) · **Next →:** [Jig product feature-gap analysis (design → product)](./2026-06-30-jig-product-feature-gap-analysis.md)

<!-- /DOCS-NAV -->
