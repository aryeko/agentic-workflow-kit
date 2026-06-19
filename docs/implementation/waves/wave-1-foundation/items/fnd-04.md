---
title: "fnd-04 — Credentials & Secrets — implementation charter"
id: "fnd-04"
wave: 1
layer: "foundation"
status: "item: ready"
spec: "docs/design/domains/foundation/fnd-04-credentials-and-secrets/"
---

# fnd-04 — Credentials & Secrets

**Purpose.** Resolve secrets and inject them at the **tightest possible scope**, redact them
everywhere, and attest egress confinement — so the worker provably never holds Forge credentials
(AD-12 / FR-12).

**Spec (normative).** Implement `docs/design/domains/foundation/fnd-04-credentials-and-secrets/`,
consuming the credential-ref + egress-policy fields fnd-01 supplies (per w0-1). The resolution /
injection / redaction / attestation contracts and the audit model are normative. Ambiguous → STOP and
surface.

## Responsibilities (in scope)

- Credential **resolution** from references (values never live in config).
- **Scoped, per-operation/per-party injection** (runner-owned Forge creds; worker isolated).
- Secret **redaction** for logs/telemetry/artifacts — the ruleset other layers apply.
- Egress-confinement **attestation inputs** (the policy side; the *probe* runs in the Execution Host
  driver).
- A tamper-evident **audit trail** of credentialed decisions.

## Out of scope

Where credential refs/egress policy are *configured* (fnd-01); the egress *probe* itself (prov-04);
actually calling Forge (prov-02 with injected creds).

## Requirements owned

FR-12 (credential isolation); NFR-SEC (scoped injection, redaction + retention, egress attestation,
audited decisions); **plus full fnd-04 design-spec compliance.**

## Dependencies & frozen contracts

Depends on fnd-01 (credential refs + egress policy). Depended on by prov-01/02/04 (scoped creds) and by
every logger/telemetry adapter (redaction rules).

## Libraries

Node crypto/`fs` as needed. **No secret values in source or tests** (use fixtures/refs). No SDKs.

## Required reading

This domain's spec (`README.md` + sibling aspect files) (+ w0-1 amendment); `decisions.md` (AD-12 worker/runner boundary);
`dependency-policy.md` (redaction owned here, consumed by Pino/OTel adapters); `testing-policy.md`.

## Deliverable

The credentials package: reference resolution; the scoped injection API; the redaction ruleset (the
source of truth other layers apply); egress-attestation policy inputs; the audit trail.

## Definition of done

- *Spec compliance:* resolution/injection/redaction/attestation/audit contracts match the design; the
  worker-never-holds-Forge-creds boundary is predicate-enforced by the normative fnd-04 credential
  ref and scope model.
- *Quality bar:* redaction proven (property tests: no secret survives a log/telemetry/artifact path);
  scoped injection tested (creds present only in the intended scope, absent elsewhere); secrets never
  appear in test output; `pnpm check` green; coverage bar met.

## Boundaries

Stay in the credentials package; never print/persist a secret; clock/id injected. The egress *probe*
belongs to prov-04 — define the attestation *shape* here, not the probe.
