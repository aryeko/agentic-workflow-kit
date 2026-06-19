---
title: "prov-04 — Execution Host contract + mock — implementation charter"
id: "prov-04-contract"
wave: 2
layer: "contracts (providers)"
status: "item: ready"
spec: "docs/design/domains/providers/prov-04-execution-host/"
---

# prov-04 — Execution Host contract + mock

**Purpose.** The host-neutral contract for **where and how processes run** — spawn + contain a worker,
terminate the whole tree, and run runner-owned commands (the verifier) — plus a mock host.
**Contract + mock only; the real Local driver and its native containment helper are the driver track.**

**Spec (normative).** Implement the contract + capability set from
`docs/design/domains/providers/prov-04-execution-host/`. The contract must **not bake in locality**
(remote is a later driver, AD-13). The capability set (`canKill`, `containmentStrength`, egress
confinement) and the verify-capture shape are normative.

## Responsibilities (in scope)

- The Execution Host contract: spawn-against-workspace; contain (own the process tree);
  signal/terminate/reap the whole tree; run runner-owned commands capturing
  command/argv/cwd/exit/signal/output + digests.
- The `CapabilityAttestation` set incl. egress confinement with **negative-probe** semantics.
- An **in-memory mock host** (deterministic spawn/terminate/verify simulation) with adversarial cases
  (won't-die, lies about containment, egress-leak) + conformance cases.

## Out of scope

The **native containment helper + real Local driver** (driver track); the agent protocol (prov-01);
local git (fnd-03); credentialed forge ops (prov-02).

## Requirements owned

The contract sides of FR-3/FR-5/FR-6; NFR-EXT, NFR-TEST, NFR-SEC (egress attestation shape); **plus
prov-04 contract spec compliance.**

## Dependencies & frozen contracts

Depends on fnd-03 (workspace), fnd-04 (scoped creds for runner commands), w2-1 (attestation + kit).
Referenced by the prov-01 Agent contract; consumed by core-04/05/06.

## Libraries

`zod`, conformance-kit, `fast-check`. **No `execa`, no native helper, no real process** — those are the
driver track; the mock simulates.

## Required reading

This domain's design.md; `decisions.md` AD-2/AD-13; `dependency-policy.md`; `testing-policy.md`; w2-1.

## Deliverable

The Execution Host contract package + mock host, passing the conformance kit; the egress/termination
capability types with negative-probe shape.

## Definition of done

- *Spec compliance:* contract + capability set + verify-capture shape match the design; no locality
  baked in; attestation includes egress negative-probe semantics.
- *Quality bar:* the mock passes the kit; adversarial mocks (won't-die / false containment / egress
  leak) **fail closed** as specified; runs in `conformance-mock` (no real proc); `pnpm check` green.

## Boundaries

Contract + mock only. The termination *ladder* and real containment are the driver's job — here,
specify the contract they must satisfy and simulate it. If the contract can't express a containment
guarantee the design requires, **STOP and surface**.
