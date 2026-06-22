---
title: "fnd-02-s3-lease-store - lease store implementation story"
id: "fnd-02-s3-lease-store"
epic: 1
status: "story: ready"
design:
  - "docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md"
  - "docs/design/20-sdk-and-packaging/storage-port-types.md"
---

# fnd-02-s3-lease-store - Lease Store

## Purpose

Implement the lease primitive used for single-writer and coordination fencing without interpreting
lease names or higher-level recovery semantics.

## Normative design

- `docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md`
- `docs/design/20-sdk-and-packaging/storage-port-types.md`
- `docs/engineering/testing-policy.md`
- `docs/engineering/test-lanes.md`
- `docs/engineering/dependency-policy.md`

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types: `LeaseStore`, `LeaseCapability`, `LeaseSnapshot`.
- Events / append intents: none.
- Provider operations / commands: none.
- Failure and degraded tokens: `stale-writer-fenced`, `lease-unavailable`, `network-fs-degraded`.
- Evidence records / attestations: lease acquisition/renewal/release/fence transcript with epoch and
  token digest evidence.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Implement `acquire`, `renew`, `release`, `read`, and `fence`.
- Increment epoch monotonically on successful acquisition after absent or expired leases.
- Return token secrets only in `LeaseCapability`; persisted/read snapshots expose only `tokenDigest`.
- Require current epoch and token for renew, release, and protected writes.
- Treat lease names as opaque; fnd-02 does not interpret `run-writer` or `story-launch`.

## Out of scope

- Repository worktree lease semantics, owned by `fnd-03`.
- Recovery or launch coordination decisions above the primitive.
- Filesystem guarded-update protocol implementation, owned by `fnd-02-s5-filesystem-conformance`.
- Event-log append semantics, owned by `fnd-02-s2-event-log`.

## Dependencies and frozen inputs

- Covers signals: Lease acquisition, renewal, release, and epoch fencing.
- Depends on: `fnd-02-s1-storage-health`.
- Depended on by: `fnd-02-s5-filesystem-conformance`, `fnd-03-s2-worktree-setup`,
  `fnd-03-s4-cleanup-settlement`.
- Shared shapes consumed: `fnd-02-s1-storage-health/StorageError`.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. Avoid "exactly as
specified."

- **AC-1** `acquire` succeeds only when no live lease exists or the prior lease is expired and
  advances epoch monotonically - evidence: acquisition table test.
- **AC-2** `renew` with current name, epoch, and token returns a new `LeaseCapability` with updated
  expiry - evidence: renewal test.
- **AC-3** `renew` with a stale epoch or token returns `stale-writer-fenced` and issues no
  `LeaseCapability` - evidence: stale-renew fencing test.
- **AC-4** `release` requires current name, epoch, and token; stale release returns
  `stale-writer-fenced` - evidence: release fencing test.
- **AC-5** `read` returns `LeaseSnapshot` with token digest and never returns token secret - evidence:
  snapshot redaction test.
- **AC-6** `fence(name, epoch, token)` returns true only for the current unexpired lease and matching
  token digest - evidence: fence predicate test.
- **AC-7** When lock guarantees are unavailable, acquire/renew/release fail with `lease-unavailable`
  or `network-fs-degraded` and no partial lease capability is returned - evidence: degraded lease test.

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No
responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| Implement `acquire` | AC-1 |
| Implement `renew` | AC-2, AC-3 |
| Implement `release` | AC-4 |
| Implement `read` | AC-5 |
| Implement `fence` | AC-6 |
| Increment epoch monotonically on acquisition | AC-1 |
| Return token secret only in `LeaseCapability`; snapshots expose only `tokenDigest` | AC-5 |
| Require current epoch and token for renew, release, and protected writes | AC-3, AC-4, AC-6 |
| Treat lease names as opaque | AC-1 |
| `LeaseStore` interface | AC-1, AC-2, AC-4, AC-5, AC-6 |
| `LeaseCapability` type | AC-2 |
| `LeaseSnapshot` type | AC-5 |
| Lease transcript with epoch and token-digest evidence | AC-5 |
| Degraded/unavailable lock handling | AC-7 |

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `stale-writer-fenced` | Epoch or token is stale for renew, release, or fence. | Reject the operation before protected state changes. | AC-3, AC-4, AC-6 |
| `lease-unavailable` | Lock guarantees cannot be proven. | Do not issue a `LeaseCapability`; coordination is unavailable. | AC-7 |
| `network-fs-degraded` | Backend cannot prove guarded lease update safety. | Refuse lease mutation and report degraded health. | AC-7 |

## Quality bar

- Coverage scope and threshold: lease store modules at 90% minimum, aiming for 95%.
- Coverage command and instrumented lane(s): `pnpm coverage:baseline` instruments the unit, integration, and conformance-mock lanes for the aggregate gate; use `pnpm exec vitest run --project integration --coverage --passWithNoTests -- packages/sdk/tests/foundation/storage/leases/*.int.test.ts` when a focused per-lane report is needed for this story's stated helper scope.
- Required tests, catalogued by AC and failure row: acquisition, renewal, stale-renew fencing,
  release, snapshot, fence, and degraded-lock fixtures.
- Exact commands: `pnpm test:unit -- packages/sdk/tests/foundation/storage/leases/*.unit.test.ts`;
  `pnpm test:int -- packages/sdk/tests/foundation/storage/leases/*.int.test.ts`;
  `pnpm check`; coverage with `pnpm coverage:baseline`; focused integration coverage with `pnpm exec vitest run --project integration --coverage --passWithNoTests -- packages/sdk/tests/foundation/storage/leases/*.int.test.ts` when needed.
- Determinism constraints: tests inject clock/expiry and token generator.
- Dependency boundaries: lease code imports no repository, core coordination, provider, process, or
  concrete backend behavior.
- File-size or module-size constraints: token digesting, epoch comparison, and store adapter remain
  focused modules.
- Domain non-negotiables: persisted state never contains token secret.

## Required reading

- `docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md`
- `docs/design/20-sdk-and-packaging/storage-port-types.md`
- `fnd-02-s1-storage-health` story contract
- `docs/engineering/testing-policy.md`

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The SDK lease-store contract modules providing `LeaseStore`, `LeaseCapability`, and `LeaseSnapshot`,
plus the evidence pack.

## Evidence pack

- Test name or artifact proving each AC.
- Test name or artifact proving each failure/degraded outcome row.
- Negative fixture or equivalent failing assertion proving every rejection, degraded, or fail-closed
  claim named by an AC or failure row.
- `pnpm check` result, unless the gate is blocked by an unrelated repository issue that is named.
- Coverage command, instrumented lane(s), and number for the stated scope.
- Sweep-grep results showing no persisted token secret and no higher-level coordination names
  interpreted by fnd-02.

## Boundaries and STOP conditions

- Package or module boundary: `packages/sdk/src/foundation/storage/leases`.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/foundation/storage/leases/**`,
  `packages/sdk/tests/foundation/storage/leases/**`.
- Forbidden dependencies: no workspace/repository, recovery, core coordination, provider, or concrete
  filesystem backend dependency.
- STOP when: a consumer needs lease semantics above opaque name/epoch/token fencing.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 1 - stories](./README.md) · **← Prev:** [fnd-02-s2-event-log - event log implementation story](./fnd-02-s2-event-log.md) · **Next →:** [fnd-02-s4-artifact-evidence - artifact evidence implementation story](./fnd-02-s4-artifact-evidence.md)

<!-- /DOCS-NAV -->
