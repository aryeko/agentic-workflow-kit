---
title: "Credentials & Secrets — charter"
id: "fnd-04"
layer: "foundation"
status: "charter: ready"
last-reviewed: 2026-06-18
---

# Credentials & Secrets — charter

**Purpose.** Scoped credential injection, redaction, and audit, plus the egress-policy spec. The core
invariant: **the worker never holds Forge credentials** (FR-12).

## Responsibilities (in scope)
- Resolve credentials from the environment / secret manager (referenced, **never stored in the repo**).
- **Scoped injection**: give each party only what it needs — the runner gets Forge credentials; the
  worker gets only its narrow needs (e.g. a registry scope), **never Forge credentials**.
- **Redaction** of secrets in all telemetry and artifacts; **audit** of every credential use.
- The **egress policy** (host allowlists) handed to the Execution Host / Agent for enforcement and
  **attestation** (enforcement is delegated and proven, not performed here — AD-5).

## Out of scope
- Enforcing egress (delegated + attested by the Execution Host / Agent, prov-04/prov-01).
- The secret-storage backend (env / secret manager — referenced, not reimplemented).

## Requirements owned
FR-12 (credential isolation), NFR-SEC.

## Dependencies (Dependency Rule)
- Depends on: nothing above Foundation.
- Depended on by: prov-02 (Forge credentials), prov-04 (runner-command credentials), core-03 (scoped
  grant fulfillment).

## Required reading
Standard set + the worker/runner boundary (AD-12) and NFR-SEC in
[decisions.md](../../decisions.md) / [requirements.md](../../requirements.md).

## Deliverable
`design.md` defining: the credential model + scoped-injection rules (who gets what); the redaction
policy; the audit events; the egress-policy shape consumed by Execution Host attestation.

## Definition of done (domain-specific)
- The worker provably never receives Forge credentials; every credential use is audited.
- Secrets are redacted in all telemetry and artifacts.

## Open questions
- Secret-manager integrations; per-driver credential shapes.
