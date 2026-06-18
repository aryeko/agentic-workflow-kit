---
title: "Configuration & Policy — charter"
id: "fnd-01"
layer: "foundation"
status: "charter: ready"
last-reviewed: 2026-06-18
---

# Configuration & Policy — charter

**Purpose.** The config schema, the deterministic precedence + provenance resolution, and the policy
blocks the control plane consumes. Depended on by everything; depends on nothing above.

## Responsibilities (in scope)
- The config schema: `provisioning`, `approval`, `escalationPolicy`, `capabilities` (and run/profile
  fields).
- **Deterministic precedence**: operator per-run override > profile > defaults — with **per-field
  provenance** recorded (which layer set each field). Operator overrides always win.
- Safe defaults (capabilities off; approval `assisted`; narrow dependency-install grant).
- The policy shapes consumed by core-02 (capabilities), core-03 (approval/escalation), core-05 (merge).
- **Adoption diagnostics**: detect legacy/incompatible config + artifacts and **refuse to run** (fail
  closed) with adoption guidance — never silently mishandle them (FR-13, AD-1).

## Out of scope
- Applying policy (the consuming core domains); credentials/secrets (fnd-04).

## Requirements owned
Policy side of FR-4 and FR-7; **FR-13 (adoption diagnostics)**; NFR-SAFE, NFR-DET, NFR-SOLID.

## Dependencies (Dependency Rule)
- Depends on: nothing above Foundation.
- Depended on by: core domains and providers.

## Required reading
Standard set + [decisions.md](../../decisions.md) (AD-4, AD-5, AD-8).

## Deliverable
`design.md` defining: the schema; the precedence algorithm + provenance event; default values;
the capability default-off model; the escalation/approval/merge policy shapes.

## Definition of done (domain-specific)
- Precedence is deterministic and tested (operator override provably wins); provenance is recorded.
- Defaults are safe; no schema field silently enables autonomy.

## Open questions
- Exact field names (coordinate with core-03 / prov-01). Whether the narrow dependency-install
  auto-grant is default-on or explicit opt-in.
