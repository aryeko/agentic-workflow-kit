---
title: kit-vnext - implementation readiness matrix
status: draft
last-reviewed: "2026-06-20"
---

# Implementation readiness matrix

This matrix tracks implementation evidence. Design approval is necessary, but it is not executable
readiness.

## Terms

| Term | Meaning |
|---|---|
| `yes` | Axis-specific executable evidence exists and is cited. |
| `partial` | Design evidence, fixtures, probes, or migrated code exist, but the axis is not fully proven. |
| `no` | No qualifying executable evidence is claimed. |
| `n/a` | The axis does not apply. |
| `production gate` | Evidence required before a real provider driver or live capability can be used in production. It is not required for SDK/core package build or mock-driven core tests. |

## Domain readiness

Runtime / production attestation is a production-readiness gate for real provider drivers and
capability-dependent live powers. It is not a core build/test prerequisite. Core SDK tests run on SDK
provider ports plus testkit mocks/fixtures with zero real processes and zero network.

| Frontier | Domain | design-approved | story contract | package implemented | conformance / integration | runtime / production attestation | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 0 | `fnd-01` Configuration & Policy | yes | no | no | no | n/a | Story contract pending. |
| 0 | `fnd-02` Storage & Artifacts | yes | no | no | no | n/a | Story contract pending. |
| 1 | `fnd-03` Workspace & Repository | yes | no | no | no | n/a | Story contract pending. |
| 1 | `fnd-04` Credentials & Secrets | yes | no | no | no | n/a | Story contract pending. |
| 1 | `core-01` Run Lifecycle & Event State | yes | no | no | no | n/a | Story contract pending. |
| 2 | `prov-03` Work Source | yes | no | no | no | no | Story contract pending. |
| 2 | `prov-02` Forge Collaboration | yes | no | no | no | no | Story contract pending. |
| 2 | `prov-04` Execution Host | yes | no | no | no | no | Story contract pending; prior work must be re-evidenced before migration. |
| 3 | `prov-01` Agent Execution | yes | no | no | no | no | Story contract pending. |
| 3 | `core-02` Capability & Safety | yes | no | no | no | n/a | Story contract pending. |
| 3 | `core-07` Observability & Analysis | yes | no | no | no | n/a | Story contract pending. |
| 4 | `core-03` Approval & Escalation | yes | no | no | no | n/a | Story contract pending. |
| 4 | `core-04` Supervision & Liveness | yes | no | no | no | n/a | Story contract pending. |
| 5 | `core-05` Completion, Verification & Merge | yes | no | no | no | n/a | Story contract pending. |
| 5 | `core-06` Recovery & Reconciliation | yes | no | no | no | n/a | Story contract pending. |
| 6 | `edge-01` Operator & Entry Surface | yes | no | no | no | n/a | Story contract pending. |

## Package readiness

| Package | first frontier | implemented | evidence |
|---|---:|---:|---|
| `packages/sdk` | 0 | no | Not claimed. |
| `packages/testkit` | 2 | no | Not claimed. |
| `packages/provider-markdown` | 2 | no | Not claimed. |
| `packages/provider-github` | 2 | no | Not claimed. |
| `packages/provider-local` | 2 | no | Not claimed. |
| `packages/provider-codex` | 3 | no | Not claimed. |
| `packages/cli` | 6 | no | Not claimed. |
| `packages/mcp` | 6 | no | Not claimed. |

## Update rule

Move an axis to `yes` only with cited evidence:

- story contract: committed story file with manifest, ACs, failure table, and evidence requirements;
- package implemented: package/module exists and passes the story's required test lanes;
- conformance / integration: command evidence proves the relevant test lane and failure cases;
- runtime / production attestation: capability attestation evidence exists for the named real driver,
  live provider surface, or production capability. Recorded/mock attestations can prove core gate
  predicates and conformance behavior, but they do not by themselves make a real driver
  production-ready.

Matrix satisfaction for an SDK/core story does not require live runtime attestation unless the story
itself claims a live provider capability. SDK/core readiness is proven by package implementation,
conformance fixtures, replay tests, and mock-driven core tests.

Migrated code, historical fixtures, schema snapshots, or prose may justify `partial`; they do not make
an implementation axis ready by themselves.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [implementation contract](./README.md) · **← Prev:** [work item authoring guide](./work-item-authoring-guide.md) · **Next →:** [Frontier 0 charter - independent substrate](./frontiers/frontier-0-independent-substrate/charter.md)

<!-- /DOCS-NAV -->
