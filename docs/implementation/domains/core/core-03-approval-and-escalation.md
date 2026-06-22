---
title: "core-03 - Approval & Escalation domain charter"
id: "core-03"
layer: "core"
status: "domain-charter: frozen"
source-design: "docs/design/30-domain-reference/core/approval-and-escalation/README.md"
last-reviewed: "2026-06-22"
---

# core-03 - Approval & Escalation

## What

Core-03 is the SDK approval relay decision model. It owns implementation planning for normalized
approval requests, deterministic risk classification, mode-ladder decisions, tight scoped grants,
durable pending approval state, park/resume facts, and approval outcome audit events.

It records judgment as evented input and keeps approval decisions replayable without embedding
provider-specific protocol behavior in core.

## Why

Human control is a required part of the v1 safety model. Worker escalation requests must survive
process death and human latency, and assisted grants must be bounded by policy and capability gates.

This domain comes after core-01 and core-02 because it needs durable run records and gate evaluation
before it can decide whether a request can be answered, denied, or parked.

## Does Not Own

- The provider transport that catches or answers an approval request.
- Concrete Codex approval enums or driver behavior.
- Approval policy schema authoring.
- Lifecycle ownership, provider probing, merge, recovery, or liveness decisions.
- LLM adjudication or auto approval in v1.

## Inputs And Dependencies

- `core-01` Run Lifecycle & Event State for writer, replay, lifecycle, and session linkage.
- `core-02` Capability & Safety for `escalation-auto-grant` and deferred
  `orchestrator-decide` gates.
- `fnd-01` Configuration & Policy for resolved approval and escalation policy.
- SDK Agent provider port plus testkit mock for neutral approval request, answer, and scoped grant
  shapes.
- Implementation DAG band: Band 4 with supervision and liveness.

## Downstream Epics

- `Epic 4` Human control and liveness loop consumes approval request, decision, and park/resume
  behavior.
- `Epic 5` Completion, verification, and recovery consumes protected-policy approval decisions.
- `Epic 7` Operator surfaces expose pending approval, decision, and resume controls.

## Story Group Signals

- Neutral `ApprovalRequest`, decision, outcome, and scoped-grant records.
- Deterministic low, medium, and high risk classification signals.
- V1 mode ladder: policy allowlist to human, with high risk always requiring a human.
- Pending approval persistence before decision.
- Parked approval, resumed approval, and expired approval facts.
- Mapping from policy-level grants to Agent-provider scoped grants.
- Fail-closed states for missing policy, missing relay, ambiguous session linkage, expired requests,
  or unwritable event records.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [core domain charters](./README.md) · **← Prev:** [core-02 - Capability & Safety domain charter](./core-02-capability-and-safety.md) · **Next →:** [core-04 - Supervision & Liveness domain charter](./core-04-supervision-and-liveness.md)

<!-- /DOCS-NAV -->
