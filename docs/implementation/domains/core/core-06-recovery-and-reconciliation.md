---
title: "core-06 - Recovery, Reconciliation & Coordination domain charter"
id: "core-06"
layer: "core"
status: "domain-charter: frozen"
source-design: "docs/design/30-domain-reference/core/recovery-and-reconciliation/README.md"
last-reviewed: "2026-06-22"
---

# core-06 - Recovery, Reconciliation & Coordination

## What

Core-06 is the SDK recovery classifier and repo-level coordination layer. It owns implementation
planning for classifying non-clean runs, assigning action-safety classes, planning in-band recovery
or reconciliation records, preventing duplicate story launches, and distinguishing resume from safe
restart.

It coordinates through recorded evidence and fnd-02 leases; it never repairs state by editing logs,
projections, Work Source records, or provider artifacts directly.

## Why

The control plane must recover without blind relaunches or manual artifact edits. Recovery needs a
single, deterministic classifier over run state, liveness, completion, provider evidence, and lease
state so repeated processes reach the same safe answer.

This domain is late because it consumes nearly every earlier core contract plus all SDK provider
ports and testkit mocks.

## Does Not Own

- Physical event-log append mechanics or lease implementation.
- Lifecycle transition validation or projection authorship.
- Capability authorization.
- Liveness derivation, completion predicates, merge mechanics, resume mechanics, kill mechanics, or
  provider controls.
- Scheduler or admission-system design for v1.
- Concrete provider drivers.

## Inputs And Dependencies

- `core-01` Run Lifecycle & Event State for replay, projections, writer, lifecycle edges, session
  linkage, and cursors.
- `core-02` Capability & Safety for `auto-recover` gate records.
- `core-04` Supervision & Liveness for liveness, stale, supervision-lost, and termination facts.
- `core-05` Completion, Verification & Merge for completion, merge, and post-merge outcome facts.
- `fnd-02` Storage & Artifacts for `run-writer` and `story-launch` lease primitives.
- SDK Agent, Forge, Work Source, and Execution Host provider ports plus testkit mocks for recovery
  evidence and provider-control boundaries.
- Implementation DAG band: Band 6, after completion and liveness are available.

## Downstream Epics

- `Epic 5` Completion, verification, and recovery consumes this domain directly.
- `Epic 7` Operator surfaces and composition consume recovery classifications, parked recovery state,
  duplicate-launch status, and supported reconciliation controls.

## Story Group Signals

- Recovery evidence snapshot and classifier result records.
- Recovery state taxonomy and stable failure ordering.
- Action-safety classes: auto-safe, operator-required, and forbidden.
- `story-launch:<workSourceId>:<trackId>:<taskId>` lease acquisition, duplicate blocking, and stale
  launch clearing records.
- Resume eligibility from owned, non-superseded session evidence.
- Restart eligibility only from safe empty state with verified termination, owner, launch, approval,
  and claim evidence.
- Recovery plan, applied action, blocked reconciliation, and lifecycle recovery-edge signals.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [core domain charters](./README.md) · **← Prev:** [core-05 - Completion, Verification & Merge domain charter](./core-05-completion-and-merge.md) · **Next →:** [core-07 - Observability & Analysis domain charter](./core-07-observability-and-analysis.md)

<!-- /DOCS-NAV -->
