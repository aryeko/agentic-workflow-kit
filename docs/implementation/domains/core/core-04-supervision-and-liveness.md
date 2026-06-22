---
title: "core-04 - Supervision & Liveness domain charter"
id: "core-04"
layer: "core"
status: "domain-charter: frozen"
source-design: "docs/design/30-domain-reference/core/supervision-and-liveness/README.md"
last-reviewed: "2026-06-22"
---

# core-04 - Supervision & Liveness

## What

Core-04 is the SDK liveness and supervision layer. It owns implementation planning for deriving
worker liveness from real current-session worker events, recording liveness state changes, evaluating
supervision timers, wrapping the event cursor wait primitive, and handing stale owned workers to the
Execution Host provider port for termination.

It ensures parent polling, reconnects, projection reads, and unrelated lifecycle movement cannot make
a stale worker appear active.

## Why

The control plane needs externally verifiable progress evidence before deciding whether a Run is
healthy, stale, or requires termination. This domain gives later recovery and operator surfaces a
deterministic liveness signal rather than relying on process presence or worker prose.

It follows core-01 because it folds committed events and uses the core cursor, and it uses SDK Agent
and Execution Host provider ports plus testkit mocks rather than concrete drivers.

## Does Not Own

- Agent protocol emission of worker events.
- Process signalling, kill mechanics, containment, or proof of empty process trees.
- Approval adjudication, completion predicates, merge decisions, or recovery action selection.
- Forge, Work Source, or concrete Agent and Execution Host driver behavior.

## Inputs And Dependencies

- `core-01` Run Lifecycle & Event State for event cursors, replay, session linkage, lifecycle facts,
  and writer access.
- SDK Agent provider port plus testkit mock for current-session worker progress, tool, approval, and
  terminal observations.
- SDK Execution Host provider port plus testkit mock for termination request and proof evidence.
- Domain catalog dependency: no dependency on the Codex or Local driver.
- Implementation DAG band: Band 4 with approval and escalation.

## Downstream Epics

- `Epic 4` Human control and liveness loop consumes this domain directly.
- `Epic 5` Completion, verification, and recovery consumes liveness, termination, and
  supervision-lost facts.
- `Epic 7` Operator surfaces expose wait and liveness status through core runtime calls.

## Story Group Signals

- Liveness state fold over committed events and explicit clock input.
- Current-session event classes that advance liveness.
- Event classes that explicitly never refresh liveness.
- Startup, idle, no-progress, per-tool, approval-SLA, and max-runtime timer signals.
- `waitRunEvents` wrapper behavior and cursor validation.
- Supervisor start, liveness advanced, timer expired, supervision lost, termination requested,
  worker terminated, and supervisor stopped facts.
- Fail-closed signals for unavailable cursor, ambiguous session linkage, missing progress guarantee,
  stale workers, overdue approvals, or unproven termination.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [core domain charters](./README.md) · **← Prev:** [core-03 - Approval & Escalation domain charter](./core-03-approval-and-escalation.md) · **Next →:** [core-05 - Completion, Verification & Merge domain charter](./core-05-completion-and-merge.md)

<!-- /DOCS-NAV -->
