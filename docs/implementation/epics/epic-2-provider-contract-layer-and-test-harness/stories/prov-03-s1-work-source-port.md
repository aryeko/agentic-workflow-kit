---
title: "prov-03-s1-work-source-port - SDK Work Source provider port implementation story"
id: "prov-03-s1-work-source-port"
epic: 2
status: "story: ready"
design:
  - "docs/design/20-sdk-and-packaging/provider-ports.md"
---

# prov-03-s1-work-source-port - SDK Work Source Provider Port

## Purpose

Define the SDK `WorkSourceProvider` seam interface, its Track/Task/TaskSnapshot/claim/release/status
DTO catalog, its `WorkSourceCapability` attestations, and the `WorkSourceError` failure union, as
pure types and a runtime catalog that every Work Source driver and the testkit specialize without
redefining.

## Normative design

- `docs/design/20-sdk-and-packaging/provider-ports.md` — "Work source provider" (the
  `WorkSourceProvider` interface, the Track/Task/TaskSnapshot/claim/release/status DTOs, the
  `StatusBucket`/`WorkSourceCapability` unions, `WorkSourceProbeScope`, and the `WorkSourceError`
  union) and "External supporting types" (`ArtifactRef` ownership).
- `docs/design/20-sdk-and-packaging/provider-interface-model.md` — the SDK owns the seam type; the
  provider is not the status-authority owner; capabilities are trusted only when freshly attested.
- `docs/design/20-sdk-and-packaging/sdk-boundary.md` — seam port types are SDK-owned; no concrete
  driver, filesystem, markdown parser, or network client lives in the port source.
- `docs/design/20-sdk-and-packaging/dependency-rules.md` — `sdk` may import only pure runtime
  libraries; forbidden symbols in `sdk` runtime.
- `docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/stories/epic0-s4-export-templates.md`
  — `PackageExportConvention` for the public `sdk` entrypoint.
- `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-00-s1-capability-attestation.md`
  — the shared `CapabilityAttestation<Capability>` envelope this seam specializes.
- `docs/engineering/testing-policy.md`, `docs/engineering/test-lanes.md`,
  `docs/engineering/dependency-policy.md`.

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types — the seam interface `WorkSourceProvider` with operations
  `probeCapabilities(scope: WorkSourceProbeScope): CapabilityAttestation<WorkSourceCapability>[]`,
  `listTracks(): TrackView[] | WorkSourceError`,
  `listTasks(trackId: string): TaskView[] | WorkSourceError`,
  `nextEligible(input): TaskView | null | WorkSourceError`,
  `claim(input): ClaimResult | WorkSourceError`,
  `release(input): void | WorkSourceError`,
  `writeStatus(input): StatusWriteResult | WorkSourceError`.
- DTOs — `TaskKey` (`workSourceId`, `trackId`, `taskId`); `SpecRef` (`kind: "path" | "url"`, `ref`,
  `label?`, `declaredDigest?`); `TaskStatus` (`native`, `bucket: StatusBucket`); `Claim` (`runId`,
  `holder`, `claimedAt`, `expiresAt`, `epoch`); `TaskView` (`key`, `title`, `status`, `target`,
  `spec`, `dependencies`, `claim?`, `sourceRecordDigest`); `TrackView` (`trackId`, `workSourceId`,
  `statusBuckets`, `taskKeys`, `sourceRecordDigest`); `TaskSnapshot` (`task`, `sourcePath`,
  `sourceRevision`, `sourceBytesDigest`, `inlineSpecDigest?`, `rawExcerptDigest`, `createdAt`);
  `ClaimResult` (`task`, `snapshotRef: ArtifactRef`, `snapshotDigest`); `AuditCitation` (`runId`,
  `taskSnapshotRef`, `statusEvidenceRef?`); `StatusWriteResult` (`written`, `updatedRecordDigest`,
  `evidenceRef?: ArtifactRef`, `auditCitation?`, `at`).
- Unions / enums — `StatusBucket` = `"eligible" | "inProgress" | "complete" | "blocked" | "unknown"`;
  `StatusBuckets` = `Record<Exclude<StatusBucket, "unknown">, string[]>`; `WorkSourceCapability` =
  `"supportsTracks" | "supportsClaim" | "supportsStatusWrite" | "supportsDependencies"`;
  `WorkSourceProbeScope` (`driverId`, `driverVersion`, `platform`, `sourceKind: "markdown" | "mock"`,
  `freshnessKey`, `capabilities`, `trackIds?`, `at`).
- Provider operations / commands — the seven `WorkSourceProvider` operations listed above.
- Failure and degraded tokens — the `WorkSourceError` union kinds: `work-source-unavailable`,
  `track-malformed`, `dependency-unresolved` (`reason: "missing" | "malformed" | "blocked" |
  "unknown" | "incomplete"`), `status-bucket-unknown`, `claim-conflict` (carries
  `expectedRecordDigest`/`observedRecordDigest` + `expectedEpoch?`/`observedEpoch?`),
  `claim-lock-unavailable`, `snapshot-artifact-unavailable`, `status-write-unavailable`,
  `status-authority-conflict`.
- Evidence records / attestations — `CapabilityAttestation<WorkSourceCapability>[]` from
  `probeCapabilities`; plus a canonical runtime catalog (`workSourceCapabilities` member list and a
  `isWorkSourceError` type guard) so the testkit and drivers validate against the SDK type.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Define the `WorkSourceProvider` interface with exactly the seven operations and their design return
  signatures, including the `TaskView | null | WorkSourceError` union on `nextEligible`.
- Define every Work Source DTO (`TaskKey`, `SpecRef`, `TaskStatus`, `Claim`, `TaskView`, `TrackView`,
  `TaskSnapshot`, `ClaimResult`, `AuditCitation`, `StatusWriteResult`) with exactly the design fields.
- Define `StatusBucket`, `StatusBuckets`, and `WorkSourceCapability` with exactly the design members.
- Specialize the shared attestation as `CapabilityAttestation<WorkSourceCapability>` for the four
  Work Source capabilities, without redeclaring the envelope.
- Define the `WorkSourceError` union with exactly its nine kinds and a `isWorkSourceError` guard, so
  every operation's failure channel is the single discriminated union.
- Carry race-safety structurally: `Claim` carries `epoch` and `claim`/`release` consume
  `expectedRecordDigest`/`expectedEpoch`, so a stale claim is expressible only as `claim-conflict`.
- Keep the port pure: no filesystem, markdown-parsing, or network import in the port source.

## Out of scope

- The shared `CapabilityAttestation<Capability>` envelope, `CapabilityProvider`, and
  `CapabilityAttestationResult` — owned by `prov-00-s1-capability-attestation`.
- The testkit mock backlog, dependency/status/claim/stale-digest/degraded-storage scenarios, and the
  status-authority-separation and race-safe-mutation conformance helpers — owned by
  `prov-03-s2-work-source-testkit`.
- The concrete Markdown work-source driver (filesystem reads, markdown parsing, real digests) and its
  driver-specific evidence — owned by the providers domain in Epic 6.
- The capability-gate evaluation that enforces attestation freshness — owned by core-02 (Epic 3).
- `ArtifactRef` — consumed from `fnd-02`, not defined here.

## Dependencies and frozen inputs

- Covers signals: SDK Work Source provider interface and Track, Task, TaskSnapshot, claim, release,
  and status DTOs; `split`: Work Source capability attestations for tracks, claim, status write, and
  dependencies.
- Depends on: `prov-00-s1-capability-attestation`.
- Depended on by: `prov-03-s2-work-source-testkit`.
- Shared shapes consumed: `prov-00-s1-capability-attestation/CapabilityAttestation` (specialized as
  `CapabilityAttestation<WorkSourceCapability>`); `fnd-02/ArtifactRef` (used in `ClaimResult.snapshotRef`
  and `StatusWriteResult.evidenceRef`).

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. The `evidence` names
the exact test id or command and the result it produces.

- **AC-1** `WorkSourceProvider` declares exactly the seven operations `probeCapabilities`,
  `listTracks`, `listTasks`, `nextEligible`, `claim`, `release`, `writeStatus` with the design return
  signatures, where `probeCapabilities` returns `CapabilityAttestation<WorkSourceCapability>[]` and
  `nextEligible` returns `TaskView | null | WorkSourceError` - evidence:
  `work-source-port-shape.unit.test.ts` constructs a conforming object literal implementing all seven
  operations (typechecks) and a type-level fixture omitting one operation fails compilation.
- **AC-2** Each Work Source DTO is present with exactly its design fields — `TaskKey`
  (`workSourceId`, `trackId`, `taskId`), `SpecRef` (`kind`, `ref`, `label?`, `declaredDigest?`),
  `TaskStatus` (`native`, `bucket`), `Claim` (`runId`, `holder`, `claimedAt`, `expiresAt`, `epoch`),
  `TaskView` (`key`, `title`, `status`, `target`, `spec`, `dependencies`, `claim?`,
  `sourceRecordDigest`), `TrackView` (`trackId`, `workSourceId`, `statusBuckets`, `taskKeys`,
  `sourceRecordDigest`), `TaskSnapshot` (`task`, `sourcePath`, `sourceRevision`, `sourceBytesDigest`,
  `inlineSpecDigest?`, `rawExcerptDigest`, `createdAt`), `ClaimResult` (`task`, `snapshotRef`,
  `snapshotDigest`), `AuditCitation` (`runId`, `taskSnapshotRef`, `statusEvidenceRef?`),
  `StatusWriteResult` (`written`, `updatedRecordDigest`, `evidenceRef?`, `auditCitation?`, `at`) -
  evidence: `work-source-dtos.unit.test.ts` constructs a fixture of each DTO (typechecks) and a
  type-level fixture adding an unknown field or dropping a required field fails compilation.
- **AC-3** `StatusBucket` is exactly `"eligible" | "inProgress" | "complete" | "blocked" | "unknown"`,
  `StatusBuckets` is `Record<Exclude<StatusBucket, "unknown">, string[]>`, and `WorkSourceCapability`
  is exactly `"supportsTracks" | "supportsClaim" | "supportsStatusWrite" | "supportsDependencies"`,
  each with no other members - evidence: `work-source-unions.unit.test.ts` exhaustiveness checks yield
  the five `StatusBucket` members, the four non-`unknown` keys of `StatusBuckets`, and the four
  `WorkSourceCapability` members.
- **AC-4** `probeCapabilities` produces `CapabilityAttestation<WorkSourceCapability>[]` specializing the
  `prov-00-s1-capability-attestation/CapabilityAttestation` envelope without redeclaring its fields, and
  `WorkSourceProbeScope.sourceKind` is exactly `"markdown" | "mock"` - evidence:
  `work-source-attestation.unit.test.ts` constructs an attestation with `capability: "supportsClaim"`
  that satisfies `CapabilityAttestation<WorkSourceCapability>`, and a type-level fixture with
  `capability: "supportsTracks2"` or `sourceKind: "github"` fails compilation.
- **AC-5** `WorkSourceError` is the discriminated union of exactly the nine kinds
  `work-source-unavailable`, `track-malformed`, `dependency-unresolved`, `status-bucket-unknown`,
  `claim-conflict`, `claim-lock-unavailable`, `snapshot-artifact-unavailable`,
  `status-write-unavailable`, `status-authority-conflict`, each carrying its design fields, and the
  `isWorkSourceError` guard returns `true` for each kind and `false` for a non-error value - evidence:
  `work-source-error.unit.test.ts` constructs one fixture per kind (typechecks, guard `true`) and a
  `{ kind: "claim-stale" }` negative fixture fails the guard and fails compilation against the union.
- **AC-6** A stale `claim` is representable only as `claim-conflict` carrying both
  `expectedRecordDigest` and `observedRecordDigest` (and optional `expectedEpoch`/`observedEpoch`), and
  a conflicting status authority is representable only as `status-authority-conflict` carrying
  `observedRecordDigest` — neither stale state can be returned as a successful `ClaimResult` or
  `StatusWriteResult` - evidence: `work-source-race-safety.unit.test.ts` constructs the
  stale-claim fixture (`claim-conflict`) and the authority-conflict fixture
  (`status-authority-conflict`) and a type-level fixture asserting a `ClaimResult` cannot carry a
  `claim-conflict` discriminant fails compilation.
- **AC-7** `WorkSourceProvider` and every Work Source type (`TaskKey`, `SpecRef`, `TaskStatus`,
  `Claim`, `TaskView`, `TrackView`, `TaskSnapshot`, `ClaimResult`, `AuditCitation`,
  `StatusWriteResult`, `StatusBucket`, `StatusBuckets`, `WorkSourceCapability`,
  `WorkSourceProbeScope`, `WorkSourceError`, `isWorkSourceError`, `workSourceCapabilities`) are
  importable from the `sdk` package public entrypoint, not a private module path - evidence:
  `work-source-public-import.unit.test.ts` imports every name from the `sdk` entrypoint and constructs
  a `TaskView` and a `WorkSourceError`.
- **AC-8** The port source imports no filesystem, markdown-parsing, or network module — a grep sweep
  over `packages/sdk/src/providers/work-source/**` for the forbidden-token set
  (`node:fs`, `node:path`, `fs/promises`, `child_process`, `execa`, `@octokit`, `node-fetch`,
  `undici`, `marked`, `remark`, `markdown-it`, `gray-matter`) yields zero matches - evidence:
  `pnpm exec grep -rnE 'node:fs|node:path|fs/promises|child_process|execa|@octokit|node-fetch|undici|marked|remark|markdown-it|gray-matter' packages/sdk/src/providers/work-source/`
  exits non-zero (no match), captured in the evidence pack; and `pnpm deps` passes.

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No
responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| `WorkSourceProvider` interface with seven operations and design return signatures | AC-1 |
| `nextEligible` returns `TaskView \| null \| WorkSourceError` (null ≠ error) | AC-1 |
| DTO catalog (`TaskKey`, `SpecRef`, `TaskStatus`, `Claim`, `TaskView`, `TrackView`, `TaskSnapshot`, `ClaimResult`, `AuditCitation`, `StatusWriteResult`) | AC-2 |
| Unions `StatusBucket`, `StatusBuckets`, `WorkSourceCapability` members | AC-3 |
| `WorkSourceProbeScope` shape and `sourceKind` (`markdown \| mock`) | AC-4 |
| Capability attestation specialization `CapabilityAttestation<WorkSourceCapability>` | AC-4 |
| `WorkSourceError` union kinds + `isWorkSourceError` guard | AC-5 |
| Race-safety: stale claim → `claim-conflict`; authority conflict → `status-authority-conflict` | AC-6 |
| Public exposure of the seam interface, DTOs, unions, and guard | AC-7 |
| Port purity: no filesystem/markdown/network import | AC-8 |

## Failure and degraded outcomes

Each row's cited AC asserts that row's trigger and required behavior. `WorkSourceError` is the single
failure channel; this port defines the tokens (the driver and testkit produce instances).

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `work-source-unavailable` | The work source cannot be reached or read. | Operation returns this kind; no track/task list is fabricated. | AC-5 |
| `track-malformed` | A track record fails structural validation. | Operation returns this kind carrying `trackId` + `diagnostic`. | AC-5 |
| `dependency-unresolved` | A task dependency is `missing`/`malformed`/`blocked`/`unknown`/`incomplete`. | Operation returns this kind carrying `task`, `dependency`, and the `reason`. | AC-5 |
| `status-bucket-unknown` | A native status maps to no known bucket. | Operation returns this kind carrying `task` + `nativeStatus`; it is not silently bucketed. | AC-5 |
| `claim-conflict` | The observed record digest/epoch differs from the expected on `claim`. | Claim fails with this kind carrying expected/observed record digest (+ epoch); no `ClaimResult` is returned. | AC-5, AC-6 |
| `claim-lock-unavailable` | The claim lease cannot be acquired. | `claim` returns this kind carrying `task`, `leaseKey`, and `priorClaim?`. | AC-5 |
| `snapshot-artifact-unavailable` | The task snapshot artifact cannot be produced or stored. | `claim` returns this kind carrying `task` + `diagnostic`; no partial `ClaimResult`. | AC-5 |
| `status-write-unavailable` | The status write cannot be persisted. | `writeStatus` returns this kind carrying `task` + `diagnostic`; `written` is never reported true. | AC-5 |
| `status-authority-conflict` | The provider is not the status authority owner and the observed record diverges. | `writeStatus` returns this kind carrying `observedRecordDigest`; no `StatusWriteResult` is returned. | AC-5, AC-6 |

## Quality bar

- Coverage scope and threshold: the runtime helpers (`isWorkSourceError` guard and the
  `workSourceCapabilities` catalog) at 90% minimum, aiming for 95%. The pure type declarations are
  proven by the type-level fixtures in AC-1..AC-7, not by line coverage.
- Coverage command and instrumented lane(s): `pnpm coverage:baseline` instruments the unit,
  integration, and conformance-mock lanes for the aggregate gate; focused per-story report via
  `pnpm exec vitest run --project unit --coverage --passWithNoTests -- packages/sdk/tests/providers/work-source/*.unit.test.ts`
  over the guard/catalog helpers.
- Required tests, catalogued by AC and failure row: `work-source-port-shape.unit.test.ts` (AC-1);
  `work-source-dtos.unit.test.ts` (AC-2); `work-source-unions.unit.test.ts` (AC-3);
  `work-source-attestation.unit.test.ts` (AC-4); `work-source-error.unit.test.ts` (AC-5, all nine
  failure rows); `work-source-race-safety.unit.test.ts` (AC-6, the `claim-conflict` and
  `status-authority-conflict` rows); `work-source-public-import.unit.test.ts` (AC-7); the AC-8 grep
  sweep plus `pnpm deps`.
- Public exposure (import path + public-import test): `WorkSourceProvider`, `TaskKey`, `SpecRef`,
  `TaskStatus`, `Claim`, `TaskView`, `TrackView`, `TaskSnapshot`, `ClaimResult`, `AuditCitation`,
  `StatusWriteResult`, `StatusBucket`, `StatusBuckets`, `WorkSourceCapability`, `WorkSourceProbeScope`,
  `WorkSourceError`, `isWorkSourceError`, `workSourceCapabilities` exported from the `sdk` public
  entrypoint per `epic0-s4-export-templates/PackageExportConvention`; proven by
  `work-source-public-import.unit.test.ts`.
- Determinism constraints: the guard and catalog are pure and side-effect free; no clock, randomness,
  or I/O (`claimedAt`/`expiresAt`/`createdAt`/`at` are caller-supplied strings).
- Dependency boundaries: `sdk` may import only pure runtime libraries (zod); it must not import
  `testkit`, any `provider-*`, `cli`, or `mcp`, and the port source must not import `execa`,
  `child_process`, `@octokit/*`, network clients, markdown parsers, or filesystem modules
  (`dependency-rules.md`).
- File-size budget (lines per file; default soft cap ~200): the seam interface, the DTO catalog, the
  unions, the error union, and the guard/catalog stay in separate focused files, each ≤ 200 lines.
- Domain non-negotiables: the provider is NOT the status-authority owner (status authority separation),
  so a divergent authority is only ever `status-authority-conflict`; a stale claim is only ever
  `claim-conflict`; `nextEligible` returns `null` when nothing is eligible — emptiness is never an
  error.

## Required reading

- `docs/design/20-sdk-and-packaging/provider-ports.md` ("Work source provider", "External supporting
  types")
- `docs/design/20-sdk-and-packaging/provider-interface-model.md`
- `docs/design/20-sdk-and-packaging/sdk-boundary.md`
- `docs/design/20-sdk-and-packaging/dependency-rules.md`
- `prov-00-s1-capability-attestation` story contract
- `epic0-s4-export-templates` story contract
- `docs/engineering/test-lanes.md`

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The `packages/sdk` Work Source provider port: the `WorkSourceProvider` interface, the
Track/Task/TaskSnapshot/claim/release/status DTO catalog, the `StatusBucket`/`StatusBuckets`/
`WorkSourceCapability` unions and `WorkSourceProbeScope`, the `WorkSourceError` union and
`isWorkSourceError` guard, and the `CapabilityAttestation<WorkSourceCapability>` specialization,
exposed on the `sdk` public entrypoint, plus the evidence pack.

## Evidence pack

- Test name or artifact proving each AC (catalogued above).
- Test name or artifact proving each of the nine failure rows.
- Negative fixture for every rejection: `{ kind: "claim-stale" }` against the union and guard (AC-5);
  the stale-claim `claim-conflict` and `status-authority-conflict` fixtures plus the
  `ClaimResult`-cannot-carry-`claim-conflict` type-level fixture (AC-6); the
  `capability: "supportsTracks2"` / `sourceKind: "github"` type-level fixtures (AC-4); the
  unknown-field / dropped-field DTO fixtures (AC-2); the dropped-operation interface fixture (AC-1).
- `pnpm check` result, unless blocked by a named unrelated repository issue.
- Coverage command, instrumented lane, and number for the guard/catalog helper scope.
- Public-import test result for every exposed shape, imported through the `sdk` entrypoint.
- Boundary/forbidden-symbol sweep (AC-8): exact command
  `pnpm exec grep -rnE 'node:fs|node:path|fs/promises|child_process|execa|@octokit|node-fetch|undici|marked|remark|markdown-it|gray-matter' packages/sdk/src/providers/work-source/`,
  path root `packages/sdk/src/providers/work-source/`, the forbidden-token set above, expected
  zero-match (non-zero exit) output captured; plus `pnpm deps` pass.
- Conformance evidence: in-memory/recorded only — no real filesystem, markdown source, process, or
  network. (The mock backlog and conformance helpers are `prov-03-s2-work-source-testkit`; the real
  Markdown driver is Epic 6.)

## Boundaries and STOP conditions

- Package or module boundary: `packages/sdk/src/providers/work-source` only.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/providers/work-source/**`, `packages/sdk/tests/providers/work-source/**`.
- Forbidden dependencies: no `testkit`, no `provider-*`, no `cli`/`mcp`, no concrete Work Source
  driver, no filesystem/markdown-parser/network import, no redeclaration of the shared
  `CapabilityAttestation` envelope, no status-authority-gate evaluation logic.
- STOP when: a required DTO field is not in the approved `provider-ports.md` "Work source provider"
  section; a behavior needs the concrete Markdown driver, real digests, or filesystem reads (Epic 6);
  or a requirement needs the capability-freshness gate or run-log envelope (Epic 3).

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 2 - stories](./README.md) · **← Prev:** [prov-02-s2-forge-testkit - testkit Mock Forge and conformance implementation story](./prov-02-s2-forge-testkit.md) · **Next →:** [prov-03-s2-work-source-testkit - Work Source testkit and conformance implementation story](./prov-03-s2-work-source-testkit.md)

<!-- /DOCS-NAV -->
