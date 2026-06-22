---
title: "fnd-02-s4-artifact-evidence - artifact evidence implementation story"
id: "fnd-02-s4-artifact-evidence"
epic: 1
status: "story: ready"
design:
  - "docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md"
  - "docs/design/20-sdk-and-packaging/storage-port-types.md"
---

# fnd-02-s4-artifact-evidence - Artifact Evidence

## Purpose

Implement write-once artifact references, scratch refs, tombstones, and redacted-by-default evidence
exports with stable digests.

## Normative design

- `docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md`
- `docs/design/20-sdk-and-packaging/storage-port-types.md`
- `docs/engineering/testing-policy.md`
- `docs/engineering/test-lanes.md`
- `docs/engineering/dependency-policy.md`

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types: `ArtifactStore`, `ArtifactInput`, `ArtifactRef`, `ScratchArtifactRef`,
  `ArtifactStream`, `ExportSelection`, `ExportManifest`.
- Events / append intents: none.
- Provider operations / commands: none.
- Failure and degraded tokens: `artifact-quarantined`, `export-incomplete-forbidden`,
  `network-fs-degraded`.
- Evidence records / attestations: artifact metadata record, tombstone record, and export manifest.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Implement write-once artifact publish with content-addressed SHA-256 digest, size, media type,
  retention class, classification, producer, and optional expiry metadata.
- Preserve stable `ArtifactRef.id` as the canonical opaque reference string.
- Support non-authoritative `ScratchArtifactRef` only in degraded mode and bar it from evidence,
  export, gates, and retention policy.
- Redact by creating a new redacted artifact plus append-only tombstone from original digest to
  replacement digest.
- Export stable, redacted-by-default manifests and refuse incomplete or digest-mismatched exports.

## Out of scope

- Redaction policy and secret detection, owned by `fnd-04-s3-redaction`.
- Provider evidence semantics or operator-facing report meaning.
- Filesystem backend publication protocol, owned by `fnd-02-s5-filesystem-conformance`.
- Retention policy defaults outside explicit write metadata.

## Dependencies and frozen inputs

- Covers signals: Artifact refs, scratch refs, digest metadata, redaction hooks, tombstones, and
  export manifests; Evidence bundles that preserve stable refs, digests, and redacted-by-default
  exports.
- Depends on: `fnd-02-s1-storage-health`.
- Depended on by: `fnd-02-s5-filesystem-conformance`, `fnd-03-s3-local-git-evidence`,
  `fnd-03-s4-cleanup-settlement`.
- Shared shapes consumed: `fnd-02-s1-storage-health/StorageHealth`,
  `fnd-02-s1-storage-health/StorageError`.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. Avoid "exactly as
specified."

- **AC-1** `put` publishes immutable artifacts with stable `ArtifactRef.id`, digest, size, media type,
  retention class, classification, and redaction state - evidence: artifact publish test.
- **AC-2** Rewriting blob bytes for an existing artifact id is impossible; a failed digest, redaction,
  classification, or size check returns `artifact-quarantined` - evidence: immutability and
  quarantine test.
- **AC-3** Under `network-fs-degraded`, `put` fails and only `putScratch` returns a
  `ScratchArtifactRef`, and that scratch ref cannot satisfy evidence, export, gates, or retention
  policy - evidence: scratch ref test.
- **AC-4** `redact` creates a new redacted artifact and a tombstone from original digest to replacement
  digest; normal reads deny tombstoned originals - evidence: tombstone test.
- **AC-5** `export` creates a stable, redacted-by-default `ExportManifest` containing selected refs,
  digests, sizes, log ranges, and log health - evidence: export snapshot.
- **AC-6** Export refuses any selected blob or log range that cannot be verified with
  `export-incomplete-forbidden` - evidence: incomplete export fixture.

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No
responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| Write-once publish with digest, size, media type, retention class, classification, producer, expiry | AC-1 |
| Preserve stable `ArtifactRef.id` as canonical reference | AC-1 |
| Blob immutability and check-failure quarantine | AC-2 |
| `ScratchArtifactRef` degraded-only and barred from evidence/export/gates/retention | AC-3 |
| Redact via new redacted artifact plus tombstone | AC-4 |
| Export stable, redacted-by-default manifest | AC-5 |
| Refuse incomplete or digest-mismatched export | AC-6 |
| `ArtifactStore` / `ArtifactInput` interfaces | AC-1 |
| `ArtifactRef` type | AC-1 |
| `ScratchArtifactRef` type | AC-3 |
| `ArtifactStream` type | AC-4 |
| `ExportSelection` / `ExportManifest` types | AC-5 |
| Artifact metadata record evidence | AC-1 |
| Tombstone record evidence | AC-4 |
| Export manifest evidence | AC-5 |

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `artifact-quarantined` | Digest, redaction, classification, or size checks fail. | Quarantine output and prevent it from satisfying evidence or export. | AC-2 |
| `export-incomplete-forbidden` | Selected blob or log range cannot be verified. | Refuse export and return no misleading manifest. | AC-6 |
| `network-fs-degraded` | Authoritative artifact writes are unavailable. | `put` fails; only `putScratch` may create non-authoritative output. | AC-3 |

## Quality bar

- Coverage scope and threshold: artifact/evidence modules at 90% minimum, aiming for 95%.
- Coverage command and instrumented lane(s): `pnpm coverage:baseline` instruments unit helpers; integration-only helper scope must be measured with `pnpm exec vitest run --project integration --coverage --passWithNoTests -- packages/sdk/tests/foundation/storage/artifacts/*.int.test.ts`.
- Required tests, catalogued by AC and failure row: publish, immutability, scratch, tombstone, export,
  and incomplete export fixtures.
- Exact commands: `pnpm test:unit -- packages/sdk/tests/foundation/storage/artifacts/*.unit.test.ts`;
  `pnpm test:int -- packages/sdk/tests/foundation/storage/artifacts/*.int.test.ts`;
  `pnpm check`; coverage with `pnpm coverage:baseline` for unit helpers and `pnpm exec vitest run --project integration --coverage --passWithNoTests -- packages/sdk/tests/foundation/storage/artifacts/*.int.test.ts` for integration helpers.
- Determinism constraints: export ordering and digest computation are stable over explicit inputs.
- Dependency boundaries: artifact store imports no provider, operator report, concrete driver, or
  secret material resolver.
- File-size or module-size constraints: artifact metadata, redaction/tombstone, and export manifest
  logic stay separate if needed.
- Domain non-negotiables: exports are redacted by default and incomplete exports fail closed.

## Required reading

- `docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md`
- `docs/design/20-sdk-and-packaging/storage-port-types.md`
- `fnd-02-s1-storage-health` story contract
- `docs/engineering/testing-policy.md`

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The SDK artifact/evidence modules providing `ArtifactStore`, artifact refs, scratch refs, tombstones,
and `ExportManifest`, plus the evidence pack.

## Evidence pack

- Test name or artifact proving each AC.
- Test name or artifact proving each failure/degraded outcome row.
- Negative fixture or equivalent failing assertion proving every rejection, degraded, or fail-closed
  claim named by an AC or failure row.
- `pnpm check` result, unless the gate is blocked by an unrelated repository issue that is named.
- Coverage command, instrumented lane(s), and number for the stated scope.
- Sweep-grep results showing no provider evidence semantics, operator report semantics, or secret
  resolver imports.

## Boundaries and STOP conditions

- Package or module boundary: `packages/sdk/src/foundation/storage/artifacts` and
  `evidence-bundles`.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/foundation/storage/artifacts/**`,
  `packages/sdk/src/foundation/storage/evidence-bundles/**`,
  `packages/sdk/tests/foundation/storage/artifacts/**`.
- Forbidden dependencies: no fnd-04 redaction policy import in production code unless it is a typed
  hook contract already approved by design; no provider or operator report imports.
- STOP when: artifact content semantics, retention defaults, or provider-specific evidence fields are
  required.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 1 - stories](./README.md) · **← Prev:** [fnd-02-s3-lease-store - lease store implementation story](./fnd-02-s3-lease-store.md) · **Next →:** [fnd-02-s5-filesystem-conformance - filesystem conformance implementation story](./fnd-02-s5-filesystem-conformance.md)

<!-- /DOCS-NAV -->
