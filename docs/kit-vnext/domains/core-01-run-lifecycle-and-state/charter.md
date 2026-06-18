---
title: "Run Lifecycle & Event State — charter"
id: "core-01"
layer: "core"
status: "charter: ready"
last-reviewed: 2026-06-18
---

# Run Lifecycle & Event State — charter

**Purpose.** The spine of the control plane: the append-only event log (single source of truth),
the projection model, the writer discipline, and the run lifecycle state machine.

## Responsibilities (in scope)
- The event envelope and append protocol: single leased writer, monotonic sequence, writer-epoch
  fencing, partial-write recovery.
- Projections (`state` / `summary` / `metrics` / `launch`) as pure functions of the log — never
  authored directly.
- The run lifecycle state machine and its transitions.
- Session linkage as an append-only fact (monotonic, never clobbered).
- Physical durability of the log (append atomicity, corruption handling: tail vs interior).

## Out of scope
- Domain-specific event semantics (each domain defines its own events).
- Analysis (core-07), recovery/coordination actions (core-06) — this provides the primitives they use.

## Requirements owned
FR-11 (run-activity authority), NFR-OBS, NFR-DET, NFR-SAFE (coherent state).

## Dependencies (Dependency Rule)
- Depends on: Foundation — fnd-01 (config) and fnd-02 (Storage & Artifacts: persistence + lease primitive).
- Must NOT: depend on drivers or other core domains for state authorship.

## Required reading
Standard set + [fnd-01](../fnd-01-configuration-and-policy/charter.md).

## Deliverable
`design.md` defining: event envelope; writer/lease/fencing model; projection set + deterministic
rebuild; lifecycle states/transitions; durability classes; corruption handling.

## Definition of done (domain-specific)
- Projections are pure functions; replaying a log yields identical projections (property-tested).
- No projection is ever written directly; linkage is monotonic.
- Stale-writer writes after a terminal/superseded epoch are rejected.

## Open questions
- Durability class per event (which events fsync). Storage backend (filesystem first; SQLite later?).
