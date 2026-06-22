---
title: "core-01 - Run Lifecycle & Event State domain charter"
id: "core-01"
layer: "core"
status: "domain-charter: frozen"
source-design: "docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md"
last-reviewed: "2026-06-22"
---

# core-01 - Run Lifecycle & Event State

## What

Core-01 is the SDK runtime spine for authored run activity. It owns implementation planning for the
append-only run event log, leased writer discipline, event envelopes, lifecycle transitions,
session-link facts, replay, and pure projections.

It gives sibling core domains a deterministic place to record facts and read run state without
writing projections or depending on concrete drivers.

## Why

Most later core behavior needs a durable, replayable source of truth before it can be tested safely.
Capability gates, approval, supervision, completion, recovery, analysis, and edge inspection all
consume core-01 events or projections.

This domain is the first core build slice because it depends only on root foundation substrate:
resolved policy from Configuration & Policy and storage, lease, durability, and artifact primitives
from Storage & Artifacts.

## Does Not Own

- Domain-specific event payload semantics for sibling core or provider domains.
- Analysis and telemetry correlation.
- Recovery action selection or repo-level coordination.
- Approval adjudication, supervision timers, completion predicates, merge predicates, or provider
  operations.
- Concrete Agent, Forge, Work Source, or Execution Host drivers.

## Inputs And Dependencies

- `fnd-01` Configuration & Policy for resolved policy inputs.
- `fnd-02` Storage & Artifacts for event-log persistence, append durability, leases, replay health,
  and artifact references.
- Domain catalog dependency: `core-01` has no dependency on other core domains or concrete drivers.
- Implementation DAG band: starts in Band 2 after foundation storage and policy substrate exist.

## Downstream Epics

- `Epic 3` Core runtime spine consumes this domain directly.
- `Epic 4` Human control and liveness loop consumes run events, lifecycle state, session linkage,
  and cursors.
- `Epic 5` Completion, verification, and recovery consumes run replay, evidence refs, and lifecycle
  transitions.
- `Epic 7` Operator surfaces and end-to-end composition reads run state through the core runtime.

## Story Group Signals

- Run event envelope and append receipt vocabulary.
- Single leased writer, writer epoch fencing, monotonic sequence, and stale-writer rejection.
- Lifecycle transition records and terminal-state guardrails.
- Session link and supersession records.
- Replay health, tail/interior corruption classes, and partial-write handling.
- Pure `state`, `summary`, `metrics`, and `launch` projections.
- Low-level cursor wait primitive as the substrate later wrapped by supervision.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [core domain charters](./README.md) · **← Prev:** [core domain charters](./README.md) · **Next →:** [core-02 - Capability & Safety domain charter](./core-02-capability-and-safety.md)

<!-- /DOCS-NAV -->
