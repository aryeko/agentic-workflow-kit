---
title: "core-05 - Completion, Verification & Merge domain charter"
id: "core-05"
layer: "core"
status: "domain-charter: frozen"
source-design: "docs/design/30-domain-reference/core/completion-and-merge/README.md"
last-reviewed: "2026-06-22"
---

# core-05 - Completion, Verification & Merge

## What

Core-05 is the SDK evidence evaluator for done, verification, Forge readiness, and merge intent. It
owns implementation planning for completion decisions, fail-closed merge predicates, protected-policy
snapshots, changed-file anti-gaming checks, exact-head evidence binding, Forge operation intents, and
post-merge outcome classification.

It evaluates committed evidence and policy; it does not gather raw local, host, CI, PR, review, or
merge data itself.

## Why

The rebuild must never treat worker prose as proof of completion. Completion and merge need an
independent evidence model that is bound to the candidate head and gated before irreversible Forge
actions.

This domain is intentionally later than the core spine, approval, and provider contract layer because
it consumes run replay, capability gates, approval decisions, local git evidence, runner verify
capture, and Forge evidence.

## Does Not Own

- Local git evidence gathering or workspace mutation.
- Runner-owned verify command execution and capture.
- Forge reads, writes, queueing, or merge mechanics.
- Capability predicate definitions.
- Recovery action selection, Work Source status writes, or concrete provider drivers.

## Inputs And Dependencies

- `core-01` Run Lifecycle & Event State for replay, projections, cursors, writer, and lifecycle
  targets.
- `core-02` Capability & Safety for `auto-merge` gate records.
- `core-03` Approval & Escalation for protected-policy-change approval records.
- `fnd-01` Configuration & Policy for merge policy and change allowlists.
- `fnd-03` Workspace & Repository for local git evidence records.
- SDK Forge and Execution Host provider ports plus testkit mocks for exact-head Forge evidence and
  runner-owned verify capture.
- Implementation DAG band: Band 5 after core control and liveness foundations.

## Downstream Epics

- `Epic 5` Completion, verification, and recovery consumes this domain directly.
- `Epic 7` Operator surfaces and composition consume completion, blocker, and merge readiness state.

## Story Group Signals

- Candidate-head selection and exact-head evidence refs.
- Protected policy snapshot records and changed-file policy signals.
- Completion decision states and `claim-evidence-mismatch` handling.
- Verification freshness from runner-owned captures and matching local git evidence.
- Merge readiness predicate over policy, checks, review/thread evidence, branch freshness, protection,
  and capability gate records.
- Forge operation intent and merge intent records with `expectedHeadSha`.
- Blocker-evidence PR intent separation from task completion or merge readiness.
- Post-merge outcome classification into lifecycle targets.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [core domain charters](./README.md) · **← Prev:** [core-04 - Supervision & Liveness domain charter](./core-04-supervision-and-liveness.md) · **Next →:** [core-06 - Recovery, Reconciliation & Coordination domain charter](./core-06-recovery-and-reconciliation.md)

<!-- /DOCS-NAV -->
