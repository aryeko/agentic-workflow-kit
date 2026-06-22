---
title: "fnd-04 - Credentials & Secrets domain charter"
id: "fnd-04"
layer: "foundation"
status: "domain-charter: frozen"
source-design: "docs/design/30-domain-reference/foundation/credentials-and-secrets/README.md"
last-reviewed: "2026-06-22"
---

# fnd-04 - Credentials & Secrets

## What

Credentials & Secrets is the implementation-planning home for scoped credential resolution,
injection planning, redaction policy, credential-use audit data, and the egress-policy document
handed to attesting enforcement points and consuming drivers.

Its core invariant is that the worker never receives Forge credentials.

## Why

The rebuild needs credential isolation before provider contracts, concrete drivers, approval grant
fulfillment, or operator composition can safely touch secret-backed actions.

This domain lets later epics reason about credential use through references, scopes, redaction sets,
audit records, and egress-policy attestations instead of ambient environment access.

## Does Not Own

- Secret-manager backend implementation beyond referenced environment-based v1 material.
- Egress enforcement or process containment.
- Provider-specific driver behavior, Forge actions, Agent execution, or Work Source behavior.
- Event-log storage mechanics.
- Expansion of configured parties, phases, hosts, TTLs, command prefixes, or credential kinds.

## Inputs And Dependencies

- Direct domain dependencies: fnd-01 for resolved credential references and egress-policy source
  fields.
- Planning prerequisites: Epic 0 package and dependency guardrails before implementation work closes.
- Source design: `docs/design/30-domain-reference/foundation/credentials-and-secrets/README.md`.
- Catalog and order inputs: `docs/design/30-domain-reference/domain-catalog.md`,
  `docs/implementation/domain-dag.md`, and `docs/implementation/epic-dag.md`.

## Downstream Epics

- Epic 1 - Foundation substrate: owns this domain's implementation story groups.
- Epic 2 - Provider contract layer and test harness: consumes credential, redaction, egress, and
  attestation vocabulary for provider ports, mocks, and conformance.
- Epic 3 - Core runtime spine: consumes credential and egress evidence through capability and audit
  projections.
- Epic 4 - Human control and liveness loop: consumes scoped grant fulfillment and denial records.
- Epic 6 - Concrete provider drivers: consumes scoped injection, redaction, and egress policy for
  real Forge, Agent, Execution Host, and other credentialed operations.
- Epic 7 - Operator surfaces and composition: consumes credential diagnostics and composition-time
  secret references without exposing secret material.

## Story Group Signals

- Credential references, scopes, allowed parties, phases, hosts, TTL, and policy digests.
- Injection plans that distinguish runner-only Forge credentials from worker-safe grants.
- Redaction sets for telemetry, process output, provider responses, and artifacts.
- Credential audit events, tamper-evidence fields, finish and destroy records, and denial records.
- Egress policy issuance and matching attestation evidence before confined credential release.
- Failure modes for unresolved refs, denied scopes, worker Forge exposure, missing audit, failed
  redaction, missing egress attestation, and unconfirmed destruction.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [foundation domain charters](./README.md) · **← Prev:** [fnd-03 - Workspace & Repository domain charter](./fnd-03-workspace-and-repository.md) · **Next →:** [provider domain charters](../providers/README.md)

<!-- /DOCS-NAV -->
