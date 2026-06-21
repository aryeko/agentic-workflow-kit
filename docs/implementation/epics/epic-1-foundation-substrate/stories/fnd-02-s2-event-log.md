---
title: "fnd-02-s2-event-log - event log implementation story"
id: "fnd-02-s2-event-log"
epic: 1
status: "story: draft"
design:
  - "docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md"
  - "docs/design/20-sdk-and-packaging/storage-port-types.md"
---

# fnd-02-s2-event-log - Event Log

## Purpose

Implement the SDK event-log persistence contract for opaque framed payloads, durability classes,
append receipts, and replay health.

## Normative design

- `docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md`
- `docs/design/20-sdk-and-packaging/storage-port-types.md`
- `docs/engineering/testing-policy.md`
- `docs/engineering/test-lanes.md`
- `docs/engineering/dependency-policy.md`

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types: `EventLogStore`, `DurabilityClass`, `LogHandle`, `AppendBatch`,
  `AppendReceipt`, `NonDurableAck`, `StoredRecord`.
- Events / append intents: none; fnd-02 stores opaque bytes only.
- Provider operations / commands: none.
- Failure and degraded tokens: `stale-writer-fenced`, `log-tail-repaired`,
  `log-interior-corrupt`, `network-fs-degraded`.
- Evidence records / attestations: append/replay transcript with sequence ranges, byte ranges,
  payload digests, frame digests, lease name, and writer epoch.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Define `EventLogStore.openForAppend`, `append`, and `replay` against opaque payload bytes.
- Bind every `LogHandle` to lease name, epoch, and token supplied by `LeaseCapability`.
- Implement `buffered`, `durable`, and `barrier` durability semantics at the contract level.
- Return `AppendReceipt` only for durable/barrier appends and `NonDurableAck` only for buffered
  appends.
- Detect and classify tail repair versus interior corruption.

## Out of scope

- Event semantics, envelopes, projections, or run lifecycle decisions.
- Lease acquisition/renewal implementation, owned by `fnd-02-s3-lease-store`.
- Filesystem backend implementation, owned by `fnd-02-s5-filesystem-conformance`.
- Deciding which event types require which durability class; core-01 owns that mapping.

## Dependencies and frozen inputs

- Covers signals: Event-log persistence, durability classes, append receipts, and replay health.
- Depends on: `fnd-02-s1-storage-health`.
- Depended on by: `fnd-02-s5-filesystem-conformance`.
- Shared shapes consumed: `fnd-02-s1-storage-health/StorageHealth`,
  `fnd-02-s1-storage-health/StorageError`.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. Avoid "exactly as
specified."

- **AC-1** `openForAppend` mints a `LogHandle` bound to the supplied lease name, epoch, and token -
  evidence: handle binding test.
- **AC-2** `append` rejects stale or missing lease credentials before bytes are appended with
  `stale-writer-fenced` - evidence: fenced append test.
- **AC-3** A `buffered` append returns only `NonDurableAck` and is forbidden for authoritative gating
  state - evidence: durability contract test.
- **AC-4** A `durable` append returns `AppendReceipt` with first/last sequence, writer epoch, lease
  name, byte range, payload digest, frame digest, and durability - evidence: receipt test.
- **AC-5** A `barrier` append flushes or discards prior buffered bytes before returning a durable
  receipt - evidence: barrier ordering test.
- **AC-6** Replay returns committed `StoredRecord` entries in sequence order and reports
  `log-tail-repaired` for quarantined tail bytes - evidence: replay repair test.
- **AC-7** Interior corruption marks history incoherent, reports `log-interior-corrupt`, and rejects
  append - evidence: corruption fixture.

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `stale-writer-fenced` | Lease name, epoch, or token is not current. | Reject mutation before writing bytes. | AC-2 |
| `log-tail-repaired` | Partial bytes appear after the last valid commit trailer. | Quarantine/truncate tail and allow replay to continue. | AC-6 |
| `log-interior-corrupt` | Checksum failure, sequence gap, or invalid frame appears before later committed frames. | Mark log read-only and reject append. | AC-7 |
| `network-fs-degraded` | Storage root is degraded before or during append. | Refuse authoritative append and invalidate open handles. | AC-3, AC-4 |

## Quality bar

- Coverage scope and threshold: event-log contract modules at 90% minimum, aiming for 95%.
- Required tests, catalogued by AC and failure row: handle binding, stale writer, durability,
  receipt, barrier, replay repair, and corruption fixtures.
- Exact commands: `pnpm test:unit -- packages/sdk/tests/foundation/storage/event-log/*.unit.test.ts`;
  `pnpm test:int -- packages/sdk/tests/foundation/storage/event-log/*.int.test.ts`;
  `pnpm check`; coverage with `pnpm coverage:baseline`.
- Determinism constraints: tests inject byte payloads, digests, clocks, and lease capabilities; no
  ambient time or randomness.
- Dependency boundaries: event-log SDK code does not import core event semantics or concrete
  filesystem backend.
- File-size or module-size constraints: frame codec, receipt builder, and replay repair logic remain
  separate if needed.
- Domain non-negotiables: fnd-02 treats event payloads as opaque bytes.

## Required reading

- `docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md`
- `docs/design/20-sdk-and-packaging/storage-port-types.md`
- `fnd-02-s1-storage-health` story contract
- `docs/engineering/testing-policy.md`
- `docs/engineering/test-lanes.md`

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The SDK event-log contract modules providing `EventLogStore` and related types, plus the evidence pack.

## Evidence pack

- Test name or artifact proving each AC.
- Test name or artifact proving each failure/degraded outcome row.
- `pnpm check` result, unless the gate is blocked by an unrelated repository issue that is named.
- Coverage command and number for the stated scope.
- Sweep-grep results showing no core event-envelope or projection dependency.

## Boundaries and STOP conditions

- Package or module boundary: `packages/sdk/src/foundation/storage/event-log`.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/foundation/storage/event-log/**`,
  `packages/sdk/tests/foundation/storage/event-log/**`.
- Forbidden dependencies: no core run lifecycle imports, no provider packages, no concrete backend
  imports outside test fixtures.
- STOP when: event semantics, durability mapping by event type, or core writer behavior must be
  defined to complete the story.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 1 - stories](./README.md) · **← Prev:** [fnd-02-s1-storage-health - storage health implementation story](./fnd-02-s1-storage-health.md) · **Next →:** [fnd-02-s3-lease-store - lease store implementation story](./fnd-02-s3-lease-store.md)

<!-- /DOCS-NAV -->
