---
title: "Recovery, Reconciliation & Coordination — charter"
id: "core-06"
layer: "core"
status: "charter: ready"
last-reviewed: 2026-06-18
---

# Recovery, Reconciliation & Coordination — charter

**Purpose.** Classify non-clean terminals from evidence and recover **in-band**; coordinate launches so
the same work is never run twice. No manual artifact edits, ever.

## Responsibilities (in scope)
- The **recovery classifier**: a pure function mapping run evidence to a named recovery state and an
  **action-safety class** (auto-safe / operator-required / forbidden).
- **Repo-level coordination**: the `run-writer` lease and a repo-wide **`story-launch` lease** (catches
  duplicates across separate processes), backed by the fnd-02 lease primitive; kept lean for local (no
  scheduler/admission system in v1).
- Reconciliation and stale-launch clearing as **appended events via supported controls** — not edits.
- Resume-vs-restart semantics (resume an owned session vs restart from a safe empty state).

## Out of scope
- The actual resume/kill mechanics (Execution Host); merge (core-05); event-log primitives (core-01).

## Requirements owned
FR-8 (recovery, reconciliation & coordination), NFR-SAFE, NFR-DET, NFR-SCALE.

## Dependencies (Dependency Rule)
- Depends on: core-01 (events), core-02 (the `auto-recover` gate), fnd-02 (the lease/lock primitive);
  all four seams (for recovery evidence).
- Must NOT: depend on a concrete driver.

## Required reading
Standard set + [core-01](../core-01-run-lifecycle-and-state/charter.md),
[core-02](../core-02-capability-and-safety/charter.md), and the lease primitive in
[fnd-02](../fnd-02-storage-and-artifacts/charter.md).

## Deliverable
`design.md` defining: the recovery state taxonomy; the action-safety matrix; the repo-level lease model
(lean for local; remote-ready); reconciliation events; resume-vs-restart rules.

## Definition of done (domain-specific)
- Classifier is pure; never blind-relaunches; never clears a claim after unverified termination.
- Duplicate launches are caught across processes; recovery is appended events, no manual edits.

## Open questions
- Which recovery states are `auto-recover` by default. (Scheduler/admission deferred, not in v1.)
