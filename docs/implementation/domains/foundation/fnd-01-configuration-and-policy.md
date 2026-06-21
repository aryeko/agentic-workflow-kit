---
title: "fnd-01 - Configuration & Policy domain charter"
id: "fnd-01"
layer: "foundation"
status: "domain-charter: draft"
source-design: "docs/design/30-domain-reference/foundation/configuration-and-policy/README.md"
last-reviewed: "2026-06-22"
---

# fnd-01 - Configuration & Policy

## What

Configuration & Policy is the implementation-planning home for the vNext configuration schema,
deterministic policy resolution, per-field provenance, safe defaults, and adoption diagnostics.

It frames the policy shapes consumed by capability gates, approval and escalation, merge policy,
credential references, and egress policy source data.

## Why

This is a root Foundation domain. The rebuild cannot safely create runs, provider contracts, core
gates, or operator entry points until the system has a deterministic way to resolve policy and fail
closed on incompatible config or artifacts.

The domain also establishes the default-off posture for autonomy, which downstream epics treat as an
input rather than re-deciding.

## Does Not Own

- Applying capability, approval, escalation, verification, or merge policy.
- Resolving, injecting, redacting, or auditing secret material.
- Provider behavior, driver behavior, operator UX, or event-log persistence mechanics.
- Migration of legacy artifacts or silent interpretation of non-vNext configuration.

## Inputs And Dependencies

- Direct domain dependencies: none.
- Planning prerequisites: Epic 0 package and dependency guardrails before implementation work closes.
- Source design: `docs/design/30-domain-reference/foundation/configuration-and-policy/README.md`.
- Catalog and order inputs: `docs/design/30-domain-reference/domain-catalog.md`,
  `docs/implementation/domain-dag.md`, and `docs/implementation/epic-dag.md`.

## Downstream Epics

- Epic 1 - Foundation substrate: owns this domain's implementation story groups.
- Epic 2 - Provider contract layer and test harness: consumes resolved policy shapes through SDK
  provider ports, credential references, and egress policy inputs.
- Epic 3 - Core runtime spine: consumes resolved policy and provenance for run lifecycle and
  capability gates.
- Epic 4 - Human control and liveness loop: consumes approval, escalation, and capability policy.
- Epic 5 - Completion, verification, and recovery: consumes merge policy and policy snapshots.
- Epic 7 - Operator surfaces and composition: supplies operator config inputs and exposes
  diagnostics without owning policy semantics.

## Story Group Signals

- Config schema and accepted vNext marker.
- Deterministic precedence across defaults, profile, and operator override.
- Per-field provenance and policy-resolution event payloads.
- Safe defaults, default-off capabilities, and deferred autonomy rejection.
- Adoption diagnostics for legacy, unknown, or incompatible config and artifacts.
- Consumer policy shapes for capability, approval, escalation, merge, credential refs, and egress.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [foundation domain charters](./README.md) · **← Prev:** [foundation domain charters](./README.md) · **Next →:** [fnd-02 - Storage & Artifacts domain charter](./fnd-02-storage-and-artifacts.md)

<!-- /DOCS-NAV -->
