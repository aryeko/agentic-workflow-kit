---
title: "fnd-02 - Storage & Artifacts domain charter"
id: "fnd-02"
layer: "foundation"
status: "domain-charter: draft"
source-design: "docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md"
last-reviewed: "2026-06-22"
---

# fnd-02 - Storage & Artifacts

## What

Storage & Artifacts is the implementation-planning home for the durable substrate: event-log
persistence, lease and lock primitives, write-once artifacts, artifact references, storage health,
and exportable evidence bundles.

It owns physical storage guarantees and opaque artifact identity, not the meaning of the stored
events or artifacts.

## Why

This is a root Foundation domain. Core run state, recovery coordination, observability, provider
evidence, and later operator exports all depend on a safe storage base before they can make
authoritative claims.

The lease and artifact primitives also let later epics coordinate writers, avoid duplicate launch
claims, and refer to evidence without embedding payloads in every domain.

## Does Not Own

- Event semantics, event envelopes, projections, or run lifecycle decisions.
- Recovery and coordination semantics beyond the lease primitive.
- Decisions about which domain should produce a given artifact.
- Provider-specific evidence content, driver behavior, or operator-facing report semantics.
- Retention policy defaults beyond the storage contract's need for explicit retention data.

## Inputs And Dependencies

- Direct domain dependencies: none.
- Planning prerequisites: Epic 0 package and dependency guardrails before implementation work closes.
- Source design: `docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md`.
- Consumer planning inputs: core run-writer and recovery coordination needs from the domain catalog
  and implementation DAGs.
- Catalog and order inputs: `docs/design/30-domain-reference/domain-catalog.md`,
  `docs/implementation/domain-dag.md`, and `docs/implementation/epic-dag.md`.

## Downstream Epics

- Epic 1 - Foundation substrate: owns this domain's implementation story groups.
- Epic 2 - Provider contract layer and test harness: consumes artifact reference and storage
  vocabulary for provider ports, mocks, and conformance fixtures.
- Epic 3 - Core runtime spine: consumes event-log persistence and artifacts for run state and
  analysis.
- Epic 5 - Completion, verification, and recovery: consumes leases, evidence refs, exports, and
  storage health for coordination and readiness decisions.
- Epic 6 - Concrete provider drivers: consumes artifact storage for provider evidence and outputs.
- Epic 7 - Operator surfaces and composition: consumes default storage wiring and exportable
  evidence.

## Story Group Signals

- Event-log persistence, durability classes, append receipts, and replay health.
- Lease acquisition, renewal, release, and epoch fencing.
- Artifact refs, scratch refs, digest metadata, redaction hooks, tombstones, and export manifests.
- Storage health and fail-closed degraded modes.
- Filesystem-backed storage behavior and conformance fixtures.
- Evidence bundles that preserve stable refs, digests, and redacted-by-default exports.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [foundation domain charters](./README.md) · **← Prev:** [fnd-01 - Configuration & Policy domain charter](./fnd-01-configuration-and-policy.md) · **Next →:** [fnd-03 - Workspace & Repository domain charter](./fnd-03-workspace-and-repository.md)

<!-- /DOCS-NAV -->
