---
title: "Storage & Artifacts — charter"
id: "fnd-02"
layer: "foundation"
status: "charter: ready"
last-reviewed: 2026-06-18
---

# Storage & Artifacts — charter

**Purpose.** The durable primitives the rest of the system stands on: crash-safe event-log persistence,
the lease/lock primitive for coordination, and a write-once artifact store.

## Responsibilities (in scope)
- **Event-log persistence**: atomic append, durability classes (which events fsync), partial-write and
  corruption handling (tail vs interior).
- **Lease / lock primitive**: acquire / renew / fence (writer epoch), used by the single-writer model
  (core-01) and repo-level coordination (core-06).
- **Artifact store**: write-once blobs for outputs / evidence / analysis / reports — content-addressed
  digests, retention, redaction hooks, size limits, export.

## Out of scope
- Event *semantics* and projections (core-01); recovery/coordination *semantics* (core-06); *what* to
  store (the producing domains decide).

## Requirements owned
NFR-OBS, NFR-SAFE, NFR-DET, NFR-OPS; supports FR-6 / FR-9 (artifact refs).

## Dependencies (Dependency Rule)
- Depends on: nothing above Foundation.
- Depended on by: core-01 (log), core-06 (leases), core-07 and others (artifacts).

## Required reading
Standard set + the writer/coordination notes in
[core-01](../core-01-run-lifecycle-and-state/charter.md) and
[core-06](../core-06-recovery-and-reconciliation/charter.md).

## Deliverable
`design.md` defining: the persistence contract (append/durability classes/corruption handling); the
lease/lock primitive (epoch fencing); the artifact store (write-once, digests, retention, redaction,
export); network-filesystem degrade behavior.

## Definition of done (domain-specific)
- Append is crash-safe and corruption-tolerant (tested); leases fence stale writers.
- Artifacts are immutable + digested; sensitive content is redactable; network-FS degrades safely.

## Open questions
- Durability class per event; SQLite as a later backend; retention defaults.
