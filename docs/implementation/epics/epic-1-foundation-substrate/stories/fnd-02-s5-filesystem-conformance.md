---
title: "fnd-02-s5-filesystem-conformance - filesystem conformance implementation story"
id: "fnd-02-s5-filesystem-conformance"
epic: 1
status: "story: draft"
design:
  - "docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md"
  - "docs/design/20-sdk-and-packaging/storage-port-types.md"
---

# fnd-02-s5-filesystem-conformance - Filesystem Conformance

## Purpose

Prove filesystem-backed storage behavior and conformance fixtures for the event-log, lease, and
artifact contracts.

## Normative design

- `docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md`
- `docs/design/20-sdk-and-packaging/storage-port-types.md`
- `docs/engineering/testing-policy.md`
- `docs/engineering/test-lanes.md`
- `docs/engineering/dependency-policy.md`

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types: filesystem implementations of `EventLogStore`, `LeaseStore`, and
  `ArtifactStore`; storage conformance fixture catalog.
- Events / append intents: none.
- Provider operations / commands: none.
- Failure and degraded tokens: `network-fs-degraded`, `log-tail-repaired`, `log-interior-corrupt`,
  `lease-unavailable`, `artifact-quarantined`, `export-incomplete-forbidden`.
- Evidence records / attestations: fake filesystem, local temp filesystem, and fault-injection
  conformance transcripts.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Implement open-time probes for atomic same-directory create/rename, file fsync, directory fsync,
  exclusive create, and lease compare-and-swap.
- Implement mid-operation degradation when fsync, rename, exclusive-create, or guarded update fails.
- Provide filesystem-backed behavior for log, lease, artifact, and export contracts.
- Provide conformance fixtures using deterministic fake filesystem, local temp filesystem, and fault
  injection at write/fsync/rename/lease-CAS boundaries.

## Out of scope

- Defining the storage port interfaces, owned by `fnd-02-s2-event-log`, `fnd-02-s3-lease-store`, and
  `fnd-02-s4-artifact-evidence`.
- SQLite or native-backed store adapters.
- Provider-specific evidence content or operator export rendering.
- Real network filesystem smoke tests unless separately approved in a smoke lane.

## Dependencies and frozen inputs

- Covers signals: Filesystem-backed storage behavior and conformance fixtures.
- Depends on: `fnd-02-s2-event-log`, `fnd-02-s3-lease-store`, `fnd-02-s4-artifact-evidence`.
- Depended on by: later core, recovery, provider, and operator stories that need storage
  conformance evidence.
- Shared shapes consumed: `fnd-02-s2-event-log/EventLogStore`,
  `fnd-02-s3-lease-store/LeaseStore`, `fnd-02-s4-artifact-evidence/ArtifactStore`.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. Avoid "exactly as
specified."

- **AC-1** Opening a storage root probes atomic rename, exclusive create, file fsync, directory fsync,
  and lease CAS before a run starts - evidence: probe matrix test.
- **AC-2** Failed open-time probes put storage into `network-fs-degraded` before authoritative writes
  can occur - evidence: degraded-open fixture.
- **AC-3** Mid-operation fsync, rename, exclusive-create, or guarded-update failure invalidates open
  append handles, quarantines partial output, and flips health to degraded/unusable - evidence:
  fault-injection tests.
- **AC-4** The same conformance suite runs against deterministic fake filesystem and local temp
  filesystem implementations - evidence: conformance transcript.
- **AC-5** Fault fixtures cover append/replay equivalence, lease fencing, lease-unavailable issuance
  refusal under unprovable guarded update, artifact immutability, export verification including
  refusal of unverifiable selections, tombstones, scratch refs, and storage degradation - evidence:
  fixture catalog.
- **AC-6** No smoke-real, network, credential, or external process behavior is required by local
  conformance - evidence: lane guard test.

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No
responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| Implement open-time safety probes | AC-1 |
| Failed open-time probe enters degraded before authoritative writes | AC-2 |
| Implement mid-operation degradation | AC-3 |
| Provide filesystem-backed log/lease/artifact/export behavior | AC-4 |
| Conformance fixtures over fake and local temp filesystems | AC-4 |
| Fault-injection fixture coverage across storage behaviors | AC-5 |
| No real network/process/credential dependency in local lanes | AC-6 |
| Filesystem implementations of `EventLogStore`, `LeaseStore`, `ArtifactStore` | AC-4 |
| Storage conformance fixture catalog | AC-5 |
| Fake fs / local temp fs / fault-injection transcript evidence | AC-4, AC-5 |

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `network-fs-degraded` | Required filesystem safety probe fails. | Disable authoritative appends, leases, evidence refs, and exports before launch. | AC-1, AC-2 |
| `lease-unavailable` | Guarded lease update cannot be proven. | Refuse lease capability issuance. | AC-3, AC-5 |
| `artifact-quarantined` | Partial or invalid artifact output appears during a fault. | Quarantine partial output; it cannot satisfy evidence. | AC-3, AC-5 |
| `export-incomplete-forbidden` | Export selection cannot be verified under fault. | Refuse export. | AC-5 |

## Quality bar

- Coverage scope and threshold: filesystem storage and conformance fixture modules at 90% minimum,
  aiming for 95%.
- Required tests, catalogued by AC and failure row: probe matrix, degraded-open, mid-operation fault,
  fake/local conformance, fixture catalog, and lane guard tests.
- Exact commands: `pnpm test:int -- packages/sdk/tests/foundation/storage/conformance/*.int.test.ts`;
  `pnpm test:conf -- packages/sdk/tests/foundation/storage/conformance/*.conformance.test.ts`;
  `pnpm check`; coverage with `pnpm coverage:baseline`.
- Determinism constraints: fake filesystem faults are seeded and reproducible; temp filesystem tests
  use isolated temp directories.
- Dependency boundaries: filesystem storage remains SDK-compatible and does not import providers,
  CLI, MCP, native store adapters, network, or process helpers.
- File-size or module-size constraints: probe, backend, and conformance harness logic stay separate.
- Domain non-negotiables: degraded storage cannot make authoritative claims.

## Required reading

- `docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md`
- `docs/design/20-sdk-and-packaging/storage-port-types.md`
- `fnd-02-s2-event-log`, `fnd-02-s3-lease-store`, and `fnd-02-s4-artifact-evidence` story contracts
- `docs/engineering/test-lanes.md`

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The filesystem storage implementation and conformance fixtures over `EventLogStore`, `LeaseStore`, and
`ArtifactStore`, plus the evidence pack.

## Evidence pack

- Test name or artifact proving each AC.
- Test name or artifact proving each failure/degraded outcome row.
- `pnpm check` result, unless the gate is blocked by an unrelated repository issue that is named.
- Coverage command and number for the stated scope.
- Sweep-grep results proving no real network/process/credential dependency in local conformance.

## Boundaries and STOP conditions

- Package or module boundary: `packages/sdk/src/foundation/storage/filesystem` and storage
  conformance fixtures.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/foundation/storage/filesystem/**`,
  `packages/sdk/tests/foundation/storage/conformance/**`,
  `packages/sdk/tests/fixtures/storage/**`.
- Forbidden dependencies: no native store adapter, no provider package, no external process/network
  call in unit/integration/conformance lanes.
- STOP when: filesystem safety requires a native or SQLite backend adapter, or real network filesystem
  proof is required in the local gate.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 1 - stories](./README.md) · **← Prev:** [fnd-02-s4-artifact-evidence - artifact evidence implementation story](./fnd-02-s4-artifact-evidence.md) · **Next →:** [fnd-03-s1-repository-branch - repository branch implementation story](./fnd-03-s1-repository-branch.md)

<!-- /DOCS-NAV -->
