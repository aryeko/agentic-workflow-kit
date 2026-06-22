---
title: "fnd-02-s1-storage-health - storage health implementation story"
id: "fnd-02-s1-storage-health"
epic: 1
status: "story: ready"
design:
  - "docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md"
  - "docs/design/20-sdk-and-packaging/storage-port-types.md"
---

# fnd-02-s1-storage-health - Storage Health

## Purpose

Define the shared storage health, error, and degraded-state catalog that all Storage & Artifacts
stories consume.

## Normative design

- `docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md`
- `docs/design/20-sdk-and-packaging/storage-port-types.md`
- `docs/engineering/testing-policy.md`
- `docs/engineering/dependency-policy.md`

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types: `StorageHealth`, `StorageError`, `StorageErrorCode`.
- Events / append intents: none.
- Provider operations / commands: none.
- `StorageHealth` states (exactly 6): `ok`, `log-tail-repaired`, `log-interior-corrupt`,
  `network-fs-degraded`, `read-only`, `unusable`.
- `StorageErrorCode` codes (exactly 7): `stale-writer-fenced`, `lease-unavailable`,
  `log-tail-repaired`, `log-interior-corrupt`, `artifact-quarantined`, `export-incomplete-forbidden`,
  `network-fs-degraded`. (`read-only` and `unusable` are health states, not error codes.)
- Evidence records / attestations: storage health transition table and fail-closed capability matrix.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Define the canonical health states and error codes for Storage & Artifacts.
- Map each token to the required fail-closed behavior from the design.
- Provide helpers that consumers use to reject authoritative writes under degraded health.
- Prove capability gates must treat durable logging, coordination, unattended-run, and auto-recover
  guarantees as absent when storage health cannot prove them.

## Out of scope

- Event-log append/replay behavior, owned by `fnd-02-s2-event-log`.
- Lease operations and token fencing, owned by `fnd-02-s3-lease-store`.
- Artifact writes and exports, owned by `fnd-02-s4-artifact-evidence`.
- Filesystem probing and backend conformance, owned by `fnd-02-s5-filesystem-conformance`.

## Dependencies and frozen inputs

- Covers signals: Storage health and fail-closed degraded modes.
- Depends on: none.
- Depended on by: `fnd-02-s2-event-log`, `fnd-02-s3-lease-store`,
  `fnd-02-s4-artifact-evidence`.
- Shared shapes consumed: none.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. Avoid "exactly as
specified."

- **AC-1** `StorageHealth` contains `ok`, `log-tail-repaired`, `log-interior-corrupt`,
  `network-fs-degraded`, `read-only`, and `unusable` - evidence: type-level exhaustiveness test.
- **AC-2** `StorageErrorCode` contains exactly `stale-writer-fenced`, `lease-unavailable`,
  `log-tail-repaired`, `log-interior-corrupt`, `artifact-quarantined`, `export-incomplete-forbidden`,
  and `network-fs-degraded` - evidence: token catalog test.
- **AC-3** Authoritative append, lease, evidence-ref, and export operations are classified unavailable
  under `network-fs-degraded`, `read-only`, or `unusable` - evidence: fail-closed table test.
- **AC-4** `log-tail-repaired` is readable health, while `log-interior-corrupt` rejects append and
  marks history incoherent - evidence: health semantics test.
- **AC-5** Capability-gate input helpers classify durable logging and coordination as absent when
  storage health is degraded - evidence: capability matrix test.

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No
responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| Define canonical health states | AC-1 |
| Define canonical error codes | AC-2 |
| Map each token to required fail-closed behavior | AC-3 |
| Helpers reject authoritative writes under degraded health | AC-3 |
| Distinguish readable vs append-rejecting log health | AC-4 |
| Capability gates treat durable/coordination guarantees as absent under degraded health | AC-5 |
| `StorageHealth` type and its 6 states | AC-1 |
| `StorageErrorCode` type and its 7 codes | AC-2 |
| `StorageError` shape | AC-2 |
| Health transition table evidence | AC-4 |
| Fail-closed capability matrix evidence | AC-5 |

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `network-fs-degraded` | Storage cannot prove atomic rename, exclusive create, fsync, directory fsync, or lease CAS. | Refuse authoritative writes and leases; allow only non-authoritative scratch where applicable. | AC-3 |
| `read-only` | Committed history is readable but not appendable. | Permit read/replay with health annotation; reject append/mutation. | AC-3, AC-4 |
| `unusable` | Storage cannot safely read or write authoritative state. | Reject authoritative operations and surface health. | AC-3 |
| `log-tail-repaired` | Incomplete tail bytes were quarantined and truncated. | Replay may continue with health annotation. | AC-4 |
| `log-interior-corrupt` | Committed history has checksum failure, sequence gap, or invalid interior frame. | Mark read-only and reject append. | AC-4 |

## Quality bar

- Coverage scope and threshold: storage health/error modules at 90% minimum, aiming for 95%.
- Required tests, catalogued by AC and failure row: exhaustiveness tests for AC-1/AC-2, fail-closed
  table tests for AC-3, log health semantics tests for AC-4, capability matrix tests for AC-5.
- Exact commands: `pnpm test:unit -- packages/sdk/tests/foundation/storage/health/*.unit.test.ts`;
  `pnpm check`; coverage with `pnpm coverage:baseline`.
- Determinism constraints: health classification is pure over explicit inputs.
- Dependency boundaries: SDK storage health code imports no provider, CLI, MCP, process, network, or
  concrete filesystem backend.
- File-size or module-size constraints: keep token catalog and behavior predicates focused.
- Domain non-negotiables: unknown or ambiguous storage state fails closed.

## Required reading

- `docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md`
- `docs/design/20-sdk-and-packaging/storage-port-types.md`
- `docs/engineering/testing-policy.md`

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The SDK storage health/error catalog providing `StorageHealth`, `StorageError`, and
`StorageErrorCode`, plus the evidence pack.

## Evidence pack

- Test name or artifact proving each AC.
- Test name or artifact proving each failure/degraded outcome row.
- `pnpm check` result, unless the gate is blocked by an unrelated repository issue that is named.
- Coverage command and number for the stated scope.
- Sweep-grep results proving storage health code has no concrete provider, process, network, or
  filesystem backend dependency.

## Boundaries and STOP conditions

- Package or module boundary: `packages/sdk/src/foundation/storage/health` and `errors`.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/foundation/storage/health/**`,
  `packages/sdk/src/foundation/storage/errors/**`,
  `packages/sdk/tests/foundation/storage/health/**`.
- Forbidden dependencies: no concrete storage backend, no core runtime imports, no provider packages.
- STOP when: a storage consumer needs a health token absent from the approved fnd-02 design.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 1 - stories](./README.md) · **← Prev:** [fnd-01-s3-adoption-diagnostics - adoption diagnostics implementation story](./fnd-01-s3-adoption-diagnostics.md) · **Next →:** [fnd-02-s2-event-log - event log implementation story](./fnd-02-s2-event-log.md)

<!-- /DOCS-NAV -->
