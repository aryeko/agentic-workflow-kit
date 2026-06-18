---
title: "Capability & Safety — charter"
id: "core-02"
layer: "core"
status: "charter: ready"
last-reviewed: 2026-06-18
---

# Capability & Safety — charter

**Purpose.** The "earn autonomy" model: the registry of autonomous capabilities and the gates that
unlock each only when its guarantees hold against recorded evidence and **capability attestations**.

## Responsibilities (in scope)
- The capability registry (`auto-merge`, `auto-recover`, `unattended-run`, `escalation-auto-grant`,
  `orchestrator-decide` [deferred, AD-14], …) and each one's **guarantee predicate**.
- Gate evaluation as pure predicates over recorded evidence + **capability attestations** (probed,
  fresh, expiring — never self-report); a `CapabilityGateRecord` event per evaluation (allow/deny +
  which guarantees held).
- The approval **modes** (`manual` / `assisted`; `auto` deferred per AD-14) as the high-level posture.
- Conservative defaults (capabilities off until guarantees can be attested).

## Out of scope
- The approval adjudication itself (core-03), merge mechanics (core-05), recovery actions (core-06).
  This domain provides the gates those domains consult.

## Requirements owned
FR-7 (gating of irreversible actions), NFR-SAFE, NFR-DET.

## Dependencies (Dependency Rule)
- Depends on: core-01 (evidence/events); the **capability attestations** emitted by the provider
  contracts (abstract, not drivers).
- Must NOT: depend on a concrete driver.

## Required reading
Standard set + [core-01](../core-01-run-lifecycle-and-state/charter.md) and the capability
**attestation** model in [architecture.md](../../architecture.md) §3.

## Deliverable
`design.md` defining: the capability list + each guarantee predicate; how attestations are consumed
(freshness/expiry; stale, absent, or negative → capability off); the gate evaluation + record; the
modes; the default-off posture.

## Definition of done (domain-specific)
- Gates are pure predicates; every gated decision emits a `CapabilityGateRecord`.
- A capability with no fresh positive attestation is treated as absent (never a silent allow).

## Open questions
- Capability granularity (e.g. split `auto-pr` from `auto-merge`).
