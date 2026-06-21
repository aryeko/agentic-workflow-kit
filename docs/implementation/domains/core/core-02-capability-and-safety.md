---
title: "core-02 - Capability & Safety domain charter"
id: "core-02"
layer: "core"
status: "domain-charter: draft"
source-design: "docs/design/30-domain-reference/core/capability-and-safety/README.md"
last-reviewed: "2026-06-22"
---

# core-02 - Capability & Safety

## What

Core-02 is the SDK capability registry and fail-closed gate layer. It owns implementation planning
for capability names, guarantee predicates, mode-aware gate evaluation, attestation freshness rules,
and `CapabilityGateRecord` facts.

It turns recorded evidence and provider capability attestations into deterministic allow or deny
records before any autonomous or irreversible action can proceed.

## Why

The rebuild needs autonomy to be earned rather than assumed. Core-02 supplies the common safety
contract that approval, merge, recovery, and unattended execution consult without coupling those
domains to provider drivers.

This domain can be built after core-01 and SDK provider ports plus testkit mocks exist because the
gate decision is pure over recorded events, resolved policy, and recorded or mock attestations.

## Does Not Own

- Approval adjudication, grant selection, or park/resume.
- Completion, merge, or recovery action selection.
- Provider probing, attestation production, or concrete driver behavior.
- Policy schema ownership beyond consuming resolved policy values.
- Auto mode or LLM adjudication, which is deferred by design.

## Inputs And Dependencies

- `core-01` Run Lifecycle & Event State for replay, projections, append, and gate records.
- `fnd-01` Configuration & Policy for resolved mode and capability policy.
- SDK Agent, Forge, Work Source, and Execution Host provider ports plus testkit mocks for
  `CapabilityAttestation` payloads.
- Domain catalog dependency: concrete provider packages are not prerequisites.
- Implementation DAG band: Band 3, alongside core observability and after provider contract layer.

## Downstream Epics

- `Epic 3` Core runtime spine consumes capability gate evaluation.
- `Epic 4` Human control and liveness loop consumes escalation-related gates.
- `Epic 5` Completion, verification, and recovery consumes `auto-merge` and `auto-recover` gates.
- `Epic 7` Operator surfaces expose gate explanations through core read models.

## Story Group Signals

- Capability registry and v1 capability posture.
- Mode handling for `manual` and `assisted`, with deferred capabilities represented explicitly.
- Guarantee predicates over committed evidence and attestations.
- Freshness, expiry, scope, negative, contradictory, and absent attestation handling.
- `CapabilityGateRecord` payloads, denial reasons, and barrier durability.
- Fail-closed behavior for degraded run logs, missing projections, self-report-only evidence, or
  unwritable gate records.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [core domain charters](./README.md) · **← Prev:** [core-01 - Run Lifecycle & Event State domain charter](./core-01-run-lifecycle-and-state.md) · **Next →:** [core-03 - Approval & Escalation domain charter](./core-03-approval-and-escalation.md)

<!-- /DOCS-NAV -->
