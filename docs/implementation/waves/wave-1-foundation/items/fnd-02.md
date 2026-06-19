---
title: "fnd-02 — Storage & Artifacts — implementation charter"
id: "fnd-02"
wave: 1
layer: "foundation"
status: "item: ready"
spec: "docs/design/domains/foundation/fnd-02-storage-and-artifacts/"
---

# fnd-02 — Storage & Artifacts

**Purpose.** The durable primitives the system stands on: crash-safe append-only log persistence, the
lease/fence primitive, and a write-once artifact store.

**Spec (normative).** Implement the approved design at
`docs/design/domains/foundation/fnd-02-storage-and-artifacts/` **exactly**. Its contracts, typed
stored-frames, durability classes, events, and failure/degraded modes are **normative requirements**,
not guidance. If the spec is ambiguous or looks wrong, **STOP and surface** to the architect — do not
silently diverge.

## Responsibilities (in scope)

- JSONL append with **durability classes** (which records fsync) and **partial-write/corruption
  tolerance** (torn tail vs interior).
- Lease acquire/renew/**fence** by writer epoch.
- Content-addressed **write-once artifact store** with retention, redaction hooks, size limits, export.

## Out of scope

Event *semantics* and projections (core-01); recovery/coordination semantics (core-06); *what* to
store (producers decide).

## Requirements owned

NFR-OBS, NFR-SAFE, NFR-DET, NFR-OPS; supports FR-6/FR-9; **plus full fnd-02 design-spec compliance.**

## Dependencies & frozen contracts

Foundation-only. Provides the storage/lease/artifact ports consumed by core-01 (log), core-06 (leases),
core-07/others (artifacts). Must NOT depend on anything above foundation.

## Libraries

`zod` for stored-frame validation; Node `fs`. **JSONL-first — do not add a SQLite library**; keep the
backend behind a port so SQLite can replace it later without touching callers. No SDKs.

## Required reading

This domain's spec (`README.md` + sibling aspect files); `dependency-policy.md`; `testing-policy.md`; the writer/coordination notes
referenced by the core-01 & core-06 designs.

## Deliverable

The storage package: atomic JSONL append/replay with fsync durability classes; the lease primitive with
epoch fencing; the artifact store (digested, write-once, redactable, exportable) — all behind a
swappable backend port.

## Definition of done

- *Spec compliance (verified independently against the domain spec):* every storage/lease/artifact interface,
  stored-frame schema, durability class, and failure/degraded mode in the fnd-02 design is implemented
  as specified — names, shapes, semantics match; behavior matches the design's append/fence/
  corruption-handling algorithms and the network-FS degrade state; any unavoidable deviation surfaced
  and recorded.
- *Quality bar:* append crash-safe & corruption-tolerant — property + integration tests on a real temp
  FS (simulated torn tail / interior corruption); a stale writer provably fenced; artifacts
  immutable/digested/redactable; network-FS degrades to a named safe state; backend swappable behind
  the port; `pnpm check` green; coverage bar met.

## Boundaries

Stay in the storage package; clock/id injected (no ambient time/randomness). If the log-envelope
boundary with core-01 is ambiguous, **STOP and surface** — do not define event semantics here.
