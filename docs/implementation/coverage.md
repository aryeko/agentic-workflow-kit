---
title: kit-vnext - implementation coverage rollup
status: draft
last-reviewed: "2026-06-22"
---

# Implementation coverage rollup

This is the global coverage view. It confirms that every domain's `Story Group Signals` are accounted
for across the whole epic set, with no signal left unclaimed and none owned by two epics. The model and
the per-layer gates are in [`work-item-authoring-guide.md`](work-item-authoring-guide.md#coverage-validation).

The domain charters are the coverage oracle. The unit of coverage is the **Story Group Signal**, not the
domain, because domains span epics. Each signal must resolve to exactly one disposition:

- `covered` - claimed by exactly one epic (and, once its story DAG is frozen, one story).
- `deferred(<why>, <until>)` - intentionally out of v1 scope; accounted-for, not a gap.
- `split(<parts>)` - one signal divided across stories, each part named so it stays exactly-once.

The detailed signal-to-story tables live in each epic charter's `Per-domain expectations`. This page is
the rollup that proves the set is complete; it does not restate every signal.

## How to use this page

- When an epic is characterized, set its domains' status here from `pending` to the epic that claims
  them, and confirm no other epic already owns the same signals.
- A domain is `closed` only when every one of its charter signals is `covered` or `deferred` in some
  epic's table.
- Any signal with no disposition is a coverage gap and blocks freezing the epic set.

## Domain coverage status

Status is `pending` until the owning epic(s) are characterized and their per-domain coverage tables are
filled. `Owning epics` is the expected home from [`epic-dag.md`](epic-dag.md) and each domain charter's
`Downstream Epics`; it is confirmed, not assumed, when status moves to `closed`.

### Foundation

| Domain | Charter | Owning epics (expected) | Status |
|---|---|---|---|
| `fnd-01` Configuration & Policy | [charter](domains/foundation/fnd-01-configuration-and-policy.md) | Epic 1 | closed |
| `fnd-02` Storage & Artifacts | [charter](domains/foundation/fnd-02-storage-and-artifacts.md) | Epic 1 | closed |
| `fnd-03` Workspace & Repository | [charter](domains/foundation/fnd-03-workspace-and-repository.md) | Epic 1 | closed |
| `fnd-04` Credentials & Secrets | [charter](domains/foundation/fnd-04-credentials-and-secrets.md) | Epic 1 | closed |

### Providers

| Domain | Charter | Owning epics (expected) | Status |
|---|---|---|---|
| `prov-01` Agent Execution | [charter](domains/providers/prov-01-agent-execution.md) | Epic 2 (port/mock), Epic 6 (driver) | closed |
| `prov-02` Forge / Collaboration | [charter](domains/providers/prov-02-forge-collaboration.md) | Epic 2 (port/mock), Epic 6 (driver) | closed |
| `prov-03` Work Source | [charter](domains/providers/prov-03-work-source.md) | Epic 2 (port/mock), Epic 6 (driver) | closed |
| `prov-04` Execution Host | [charter](domains/providers/prov-04-execution-host.md) | Epic 2 (port/mock), Epic 6 (driver) | closed |

### Core

| Domain | Charter | Owning epics (expected) | Status |
|---|---|---|---|
| `core-01` Run Lifecycle & Event State | [charter](domains/core/core-01-run-lifecycle-and-state.md) | Epic 3 | closed |
| `core-02` Capability & Safety | [charter](domains/core/core-02-capability-and-safety.md) | Epic 3 | closed |
| `core-03` Approval & Escalation | [charter](domains/core/core-03-approval-and-escalation.md) | Epic 4 | closed |
| `core-04` Supervision & Liveness | [charter](domains/core/core-04-supervision-and-liveness.md) | Epic 4 | closed |
| `core-05` Completion, Verification & Merge | [charter](domains/core/core-05-completion-and-merge.md) | Epic 5 | closed |
| `core-06` Recovery, Reconciliation & Coordination | [charter](domains/core/core-06-recovery-and-reconciliation.md) | Epic 5 | closed |
| `core-07` Observability & Analysis | [charter](domains/core/core-07-observability-and-analysis.md) | Epic 3 | closed |

### Edge

| Domain | Charter | Owning epics (expected) | Status |
|---|---|---|---|
| `edge-01` Operator & Entry Surface | [charter](domains/edge/edge-01-operator-surface.md) | Epic 3 (mock smoke), Epic 7 (production composition) | closed |

## Epic-set completeness

The epic set is coverage-complete: every row above is `closed`. Epic 3 owns only the mock-backed
Edge command-envelope smoke signal; Epic 7 owns production Edge composition and defers external
triggers until trigger auth and transport contracts exist. No domain has a pending or gapped signal.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [implementation contract](./README.md) · **← Prev:** [Epic 7 - story DAG](./epics/epic-7-operator-surfaces-and-composition/story-dag.md) · **Next →:** [Engineering Policy Index](../engineering/README.md)

<!-- /DOCS-NAV -->
