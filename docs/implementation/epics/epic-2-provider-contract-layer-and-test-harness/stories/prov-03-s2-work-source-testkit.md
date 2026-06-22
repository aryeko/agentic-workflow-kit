---
title: "prov-03-s2-work-source-testkit - Work Source testkit and conformance implementation story"
id: "prov-03-s2-work-source-testkit"
epic: 2
status: "story: ready"
design:
  - "docs/design/20-sdk-and-packaging/testkit-and-conformance.md"
---

# prov-03-s2-work-source-testkit - Work Source Testkit and Conformance

## Purpose

Build the `testkit` Work Source surface — an in-memory mock backlog, the status-authority-separation
and race-safe-mutation conformance helpers, and the incident fixtures — over the SDK
`prov-03-s1-work-source-port` seam, so run-lifecycle and completion stories can exercise Work Source
evidence without Markdown files, filesystem, or network, and so broken Work Source drivers fail the
suite.

## Normative design

- `docs/design/20-sdk-and-packaging/testkit-and-conformance.md` — testkit owns provider mocks,
  conformance-suite helpers, and incident fixtures; depends only on `sdk`; must not redefine
  `WorkSourceProvider` or `CapabilityAttestation`; "mock success alone is not conformance … broken
  providers must fail the suite."
- `docs/implementation/domains/providers/prov-03-work-source.md` — testkit owns the scripted mock
  backlog, conformance helpers, and incident fixtures (lines ~22–23); testkit inputs are mock backlog
  fixtures, claim/status race scenarios, malformed-task fixtures, and conformance helpers (lines
  ~54–55); story-group signals for the testkit mock backlog and the status-authority/race-safe
  conformance helpers (lines ~71–73).
- `docs/design/20-sdk-and-packaging/dependency-rules.md` — `testkit` depends ONLY on `sdk` and must
  never appear in a production dependency graph.
- `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-03-s1-work-source-port.md`
  — the SDK-owned `WorkSourceProvider` interface, DTOs, unions, `WorkSourceError`, and
  `isWorkSourceError` guard that this testkit consumes and validates against (never redeclares).
- `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-00-s1-capability-attestation.md`
  — the shared `CapabilityAttestation<Capability>` envelope the mock attests against.
- `docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/stories/epic0-s4-export-templates.md`
  — `PackageExportConvention` for the public `testkit` entrypoint.
- `docs/engineering/testing-policy.md`, `docs/engineering/test-lanes.md`,
  `docs/engineering/dependency-policy.md`.

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types — consumed from the SDK port, cited verbatim and never redeclared:
  `prov-03-s1-work-source-port/WorkSourceProvider`,
  `prov-03-s1-work-source-port/TrackView`, `prov-03-s1-work-source-port/TaskView`,
  `prov-03-s1-work-source-port/TaskSnapshot`, `prov-03-s1-work-source-port/Claim`,
  `prov-03-s1-work-source-port/ClaimResult`, `prov-03-s1-work-source-port/StatusWriteResult`,
  `prov-03-s1-work-source-port/StatusBucket`, `prov-03-s1-work-source-port/WorkSourceCapability`,
  `prov-03-s1-work-source-port/WorkSourceError` (kinds incl. `claim-conflict`,
  `status-authority-conflict`, `dependency-unresolved`, `status-bucket-unknown`,
  `work-source-unavailable`), `prov-03-s1-work-source-port/isWorkSourceError`;
  `prov-00-s1-capability-attestation/CapabilityAttestation`.
- Coined testkit symbols (design silent — this story names them and their `testkit` import path):
  `MockWorkSourceProvider` (the in-memory mock backlog) implementing
  `prov-03-s1-work-source-port/WorkSourceProvider`; a `MockWorkSourceOptions` scenario-config shape
  for seeding the backlog; `workSourceConformance` (the conformance suite runner) and its
  `WorkSourceConformanceResult` outcome; `workSourceIncidentFixtures` (the recorded fixture catalog).
- Provider operations / commands — the mock implements the seven SDK port operations
  (`probeCapabilities`, `listTracks`, `listTasks`, `nextEligible`, `claim`, `release`, `writeStatus`)
  in memory; the conformance suite drives those operations against any `WorkSourceProvider`.
- Failure and degraded tokens — the `prov-03-s1-work-source-port/WorkSourceError` kinds this testkit
  produces from mock scenarios and asserts in conformance: `claim-conflict`,
  `status-authority-conflict`, `dependency-unresolved`, `status-bucket-unknown`, `track-malformed`
  (malformed-task fixture), and `work-source-unavailable` (degraded-storage scenario). These tokens are
  owned by the SDK port; this story produces instances and proves the suite catches them.
- Evidence records / attestations — in-memory `CapabilityAttestation<WorkSourceCapability>[]` emitted
  by the mock's `probeCapabilities`; recorded incident fixtures (mock-backlog scenarios, claim/status
  race scenarios, malformed-task fixtures). All recorded/in-memory only — no real process, filesystem,
  markdown source, or network.

Done requires every item here present with the design's names, shapes, and semantics. Consumed SDK
types are cited by producer story; coined testkit symbols are defined here.

## Responsibilities

- Provide `MockWorkSourceProvider` — an in-memory mock backlog implementing
  `prov-03-s1-work-source-port/WorkSourceProvider` that, seeded via `MockWorkSourceOptions`, produces
  the five scenario families: dependency, status, claim, stale-digest, and degraded-storage, returning
  `TrackView`/`TaskView`/`TaskSnapshot`, `ClaimResult`, `StatusWriteResult`, and the relevant
  `WorkSourceError` kinds. In-memory only: no markdown files, filesystem, or network.
- Provide `workSourceConformance` conformance helpers asserting status authority separation: a write
  that conflicts with the status authority yields `status-authority-conflict` (the provider is not the
  status-authority owner), never a successful `StatusWriteResult`.
- Provide `workSourceConformance` conformance helpers asserting race-safe task mutation: a stale claim
  (wrong epoch or record digest) yields `claim-conflict`, and only one claimant wins a concurrent
  claim — the loser receives `claim-conflict`, never a second successful `ClaimResult`.
- Provide `workSourceIncidentFixtures` — recorded mock-backlog fixtures, claim/status race scenarios,
  and malformed-task fixtures (`track-malformed`/`dependency-unresolved`) — as static inputs.
- Make the conformance suite have teeth: a deliberately broken `WorkSourceProvider` (one that lets two
  claimants win the same task, or writes status despite an authority conflict) FAILS the suite.
- Expose `MockWorkSourceProvider`, `MockWorkSourceOptions`, `workSourceConformance`,
  `WorkSourceConformanceResult`, and `workSourceIncidentFixtures` from the `testkit` public entrypoint.
- Keep `testkit` importing only `sdk`: no markdown parser, filesystem, network, or `provider-*` import.

## Out of scope

- The `WorkSourceProvider` interface, the Track/Task/TaskSnapshot/claim/status DTOs, the
  `StatusBucket`/`WorkSourceCapability` unions, the `WorkSourceError` union, and the `isWorkSourceError`
  guard — all owned and defined by `prov-03-s1-work-source-port`; consumed here, never redeclared.
- The shared `CapabilityAttestation<Capability>` envelope — owned by `prov-00-s1-capability-attestation`.
- The concrete Markdown work-source driver (filesystem reads, markdown parsing, real digests, real
  attestation) and its driver-level conformance run — owned by the providers domain in Epic 6.
- The capability-freshness gate evaluation and the run-log envelope (`eventId` assignment) — owned by
  core-02 / Epic 3.
- Any production wiring: `testkit` must never enter a production dependency graph.

## Dependencies and frozen inputs

- Covers signals: Testkit mock backlog with dependency, status, claim, stale-digest, and
  degraded-storage scenarios; Conformance helpers for status authority separation and race-safe task
  mutation, and incident fixtures.
- Depends on: `prov-03-s1-work-source-port` (the `WorkSourceProvider` interface + task DTOs +
  `WorkSourceError` + `isWorkSourceError`); `prov-00-s1-capability-attestation` (the
  `CapabilityAttestation` envelope the mock attests against).
- Depended on by: run-lifecycle / completion stories (Epic 3 / Epic 5) needing Work Source evidence —
  task snapshots, claim results, status outcomes — without Markdown files.
- Shared shapes consumed: `prov-03-s1-work-source-port/WorkSourceProvider`,
  `prov-03-s1-work-source-port/TrackView`, `prov-03-s1-work-source-port/TaskView`,
  `prov-03-s1-work-source-port/TaskSnapshot`, `prov-03-s1-work-source-port/Claim`,
  `prov-03-s1-work-source-port/ClaimResult`, `prov-03-s1-work-source-port/StatusWriteResult`,
  `prov-03-s1-work-source-port/StatusBucket`, `prov-03-s1-work-source-port/WorkSourceCapability`,
  `prov-03-s1-work-source-port/WorkSourceError`, `prov-03-s1-work-source-port/isWorkSourceError`,
  `prov-00-s1-capability-attestation/CapabilityAttestation`.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. The `evidence` names
the exact test id or command and the result it produces.

- **AC-1** `MockWorkSourceProvider` implements `prov-03-s1-work-source-port/WorkSourceProvider`
  structurally — a fixture constructs a `MockWorkSourceProvider`, assigns it to a
  `WorkSourceProvider`-typed binding (typechecks), and calling each of the seven operations
  (`probeCapabilities`, `listTracks`, `listTasks`, `nextEligible`, `claim`, `release`, `writeStatus`)
  on a seeded happy-path backlog returns a value of the design return type (a `TrackView[]`, a
  `TaskView`, a `ClaimResult`, a `StatusWriteResult`, and a
  `CapabilityAttestation<WorkSourceCapability>[]`), with no filesystem or network access - evidence:
  `mock-work-source-shape.unit.test.ts` asserts the binding typechecks and each operation returns the
  expected runtime shape.
- **AC-2** Seeding `MockWorkSourceProvider` with the five scenario families via `MockWorkSourceOptions`
  produces, respectively: a dependency scenario whose `nextEligible`/`listTasks` reflects
  `TaskView.dependencies` and can yield `dependency-unresolved`; a status scenario exercising
  `StatusBucket` mapping and `status-bucket-unknown`; a claim scenario producing a `ClaimResult` and a
  `claim-conflict`; a stale-digest scenario producing `claim-conflict` from a wrong record digest/epoch;
  and a degraded-storage scenario producing `work-source-unavailable` — each scenario family is
  constructible and reachable - evidence: `mock-work-source-scenarios.unit.test.ts` constructs all five
  families and asserts each reaches its named outcome.
- **AC-3** `workSourceConformance` run against a correct `MockWorkSourceProvider` asserts status
  authority separation: a `writeStatus` whose input diverges from the seeded status authority returns a
  `WorkSourceError` of kind `status-authority-conflict` (guarded by
  `prov-03-s1-work-source-port/isWorkSourceError`) and NOT a `StatusWriteResult`, and the suite passes -
  evidence: `work-source-status-authority.conformance.test.ts` (project `conformance-mock`) asserts the
  returned `kind === "status-authority-conflict"` and that no `StatusWriteResult` is produced.
- **AC-4** `workSourceConformance` run against a correct `MockWorkSourceProvider` asserts race-safe task
  mutation: a `claim` with a stale epoch or record digest returns `claim-conflict` and not a
  `ClaimResult`, and under two concurrent claims of one task exactly one returns a `ClaimResult` while
  the other returns `claim-conflict`, and the suite passes - evidence:
  `work-source-race-safety.conformance.test.ts` (project `conformance-mock`) asserts one-winner and the
  `claim-conflict` discriminant on the loser and on the stale claim.
- **AC-5** `workSourceConformance` run against a DELIBERATELY BROKEN `WorkSourceProvider` FAILS — a
  broken provider that lets two concurrent claimants both receive a `ClaimResult` for one task, and a
  broken provider that returns a successful `StatusWriteResult` despite an authority conflict, each
  cause `WorkSourceConformanceResult` to report failure (`passed === false`) with the violated check
  named - evidence: `work-source-conformance-teeth.conformance.test.ts` (project `conformance-mock`)
  drives both broken-provider fixtures and asserts `result.passed === false` for each.
- **AC-6** `workSourceIncidentFixtures` is a recorded catalog containing at minimum a mock-backlog
  fixture, a claim/status race fixture, and a malformed-task fixture, where the malformed-task fixture
  drives `track-malformed` and `dependency-unresolved` outcomes; replaying the catalog through
  `MockWorkSourceProvider` is deterministic (no clock, randomness, or I/O) and reaches each named
  outcome - evidence: `work-source-incident-fixtures.unit.test.ts` enumerates the catalog, asserts the
  named entries are present, and replays each twice yielding identical results.
- **AC-7** `MockWorkSourceProvider`, `MockWorkSourceOptions`, `workSourceConformance`,
  `WorkSourceConformanceResult`, and `workSourceIncidentFixtures` are importable from the `testkit`
  package public entrypoint (per `epic0-s4-export-templates/PackageExportConvention`), not a private
  module path; a fixture imports every symbol from the entrypoint and constructs a
  `MockWorkSourceProvider` and reads one `workSourceIncidentFixtures` entry - evidence:
  `work-source-testkit-public-import.unit.test.ts` imports every name from the `testkit` entrypoint and
  constructs/uses each.
- **AC-8** The `testkit` Work Source source imports only `sdk` — a grep sweep over
  `packages/testkit/src/work-source/**` and `packages/testkit/src/fixtures/work-source/**` for the
  forbidden-token set (`node:fs`, `node:path`, `fs/promises`, `child_process`, `execa`, `@octokit`,
  `node-fetch`, `undici`, `marked`, `remark`, `markdown-it`, `gray-matter`, `provider-`) yields zero
  matches - evidence:
  `pnpm exec grep -rnE 'node:fs|node:path|fs/promises|child_process|execa|@octokit|node-fetch|undici|marked|remark|markdown-it|gray-matter|provider-' packages/testkit/src/work-source/ packages/testkit/src/fixtures/work-source/`
  exits non-zero (no match), captured in the evidence pack; and `pnpm deps` passes.

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No
responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| `MockWorkSourceProvider` implements the seven `WorkSourceProvider` operations in memory | AC-1 |
| Mock backlog produces the five scenario families (dependency, status, claim, stale-digest, degraded-storage) | AC-2 |
| `MockWorkSourceOptions` scenario-config shape seeds the backlog | AC-2 |
| Conformance: status authority separation → `status-authority-conflict` | AC-3 |
| Conformance: race-safe mutation → `claim-conflict` and single-winner | AC-4 |
| `workSourceConformance` / `WorkSourceConformanceResult` has teeth: broken provider FAILS | AC-5 |
| `workSourceIncidentFixtures` recorded catalog (mock-backlog, race, malformed-task) | AC-6 |
| Determinism of fixture replay (no clock/randomness/I/O) | AC-6 |
| Public exposure of coined testkit symbols from the `testkit` entrypoint | AC-7 |
| Boundary: `testkit` imports only `sdk` (no markdown/filesystem/network/`provider-*`) | AC-8 |
| Consumed `prov-03-s1-work-source-port/WorkSourceError` kinds produced + asserted | AC-2, AC-3, AC-4 |
| In-memory `CapabilityAttestation<WorkSourceCapability>[]` from the mock | AC-1 |

## Failure and degraded outcomes

Each row's cited AC asserts that row's trigger and required behavior — not the happy path. The
`WorkSourceError` kinds are owned by `prov-03-s1-work-source-port`; this story produces instances from
mock scenarios and proves the conformance suite catches them.

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `claim-conflict` | A `claim` carries a stale epoch/record digest, or a concurrent claim loses the race. | `claim` returns `claim-conflict`; no `ClaimResult` for the stale/losing claimant; exactly one winner. | AC-4 |
| `status-authority-conflict` | A `writeStatus` input diverges from the seeded status authority (the provider is not the authority owner). | `writeStatus` returns `status-authority-conflict`; no `StatusWriteResult`. | AC-3 |
| `dependency-unresolved` | The malformed-task / dependency fixture references a missing/malformed/blocked dependency. | The operation returns `dependency-unresolved`; no fabricated eligible task. | AC-2, AC-6 |
| `status-bucket-unknown` | The status scenario seeds a native status that maps to no known `StatusBucket`. | The operation returns `status-bucket-unknown`; the status is not silently bucketed. | AC-2 |
| `work-source-unavailable` | The degraded-storage scenario makes the in-memory backlog unreadable. | The operation returns `work-source-unavailable`; no track/task list is fabricated. | AC-2 |
| `track-malformed` | The malformed-task fixture seeds a structurally invalid track record. | The operation returns `track-malformed`; no partial `TrackView` is returned. | AC-6 |
| conformance suite false-pass | A broken provider double-claims a task or writes status despite an authority conflict. | `WorkSourceConformanceResult.passed === false`; the broken provider is rejected. | AC-5 |

## Quality bar

- Coverage scope and threshold: the testkit Work Source helpers (`MockWorkSourceProvider`,
  `workSourceConformance`, and the `workSourceIncidentFixtures` catalog) at 90% minimum, aiming for 95%.
- Coverage command and instrumented lane(s): `pnpm coverage:baseline` instruments the unit,
  integration, and conformance-mock lanes for the aggregate gate; focused per-story report via
  `pnpm exec vitest run --project unit --coverage --passWithNoTests -- packages/testkit/tests/work-source/*.unit.test.ts`
  and
  `pnpm exec vitest run --project conformance-mock --coverage --passWithNoTests -- packages/testkit/tests/work-source/*.conformance.test.ts`
  over the mock/conformance/fixture helpers.
- Required tests, catalogued by AC and failure row: `mock-work-source-shape.unit.test.ts` (AC-1);
  `mock-work-source-scenarios.unit.test.ts` (AC-2, the `dependency-unresolved` / `status-bucket-unknown`
  / `work-source-unavailable` rows); `work-source-status-authority.conformance.test.ts` (AC-3, the
  `status-authority-conflict` row); `work-source-race-safety.conformance.test.ts` (AC-4, the
  `claim-conflict` row); `work-source-conformance-teeth.conformance.test.ts` (AC-5, the broken-provider
  false-pass row); `work-source-incident-fixtures.unit.test.ts` (AC-6, the `track-malformed` /
  `dependency-unresolved` rows); `work-source-testkit-public-import.unit.test.ts` (AC-7); the AC-8 grep
  sweep plus `pnpm deps`.
- Public exposure (import path + public-import test): `MockWorkSourceProvider`, `MockWorkSourceOptions`,
  `workSourceConformance`, `WorkSourceConformanceResult`, and `workSourceIncidentFixtures` exported from
  the `testkit` public entrypoint per `epic0-s4-export-templates/PackageExportConvention`; proven by
  `work-source-testkit-public-import.unit.test.ts`. Consumed SDK shapes are imported from the `sdk`
  entrypoint and not re-exported by `testkit`.
- Determinism constraints: the mock backlog and incident fixtures are seeded and side-effect free — no
  clock, randomness, filesystem, or network; concurrent-claim races are simulated deterministically
  (caller-supplied epochs/digests, not wall-clock or real concurrency); replaying a fixture twice yields
  identical results (AC-6).
- Dependency boundaries: `testkit` depends ONLY on `sdk`; it must never enter a production dependency
  graph; the Work Source source must not import a markdown parser, filesystem, network client,
  `child_process`/`execa`, `@octokit/*`, or any `provider-*` package (`dependency-rules.md`,
  `testkit-and-conformance.md`).
- File-size budget (lines per file; default soft cap ~200): the mock backlog, the conformance helpers,
  and the incident-fixture catalog stay in separate focused files, each ≤ 200 lines.
- Domain non-negotiables: the provider is NOT the status-authority owner — a divergent authority is only
  ever `status-authority-conflict`, never a successful write; a stale claim is only ever
  `claim-conflict`, never a second `ClaimResult`; mock success alone is not conformance — a broken
  provider MUST fail the suite (AC-5); the testkit holds fixtures and helpers, not a replay engine (that
  is SDK-owned, core-01/core-06).

## Required reading

- `docs/design/20-sdk-and-packaging/testkit-and-conformance.md`
- `docs/implementation/domains/providers/prov-03-work-source.md` (lines ~22–23, 54–55, 71–73)
- `prov-03-s1-work-source-port` story contract (the consumed SDK seam)
- `prov-00-s1-capability-attestation` story contract (the `CapabilityAttestation` envelope)
- `epic0-s4-export-templates` story contract (the `testkit` public entrypoint convention)
- `docs/design/20-sdk-and-packaging/dependency-rules.md`
- `docs/engineering/test-lanes.md`

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The `packages/testkit` Work Source surface: `MockWorkSourceProvider` (in-memory mock backlog seeded by
`MockWorkSourceOptions`), the `workSourceConformance` suite and its `WorkSourceConformanceResult`, and
the `workSourceIncidentFixtures` recorded catalog, exposed on the `testkit` public entrypoint over the
`prov-03-s1-work-source-port` seam, plus the evidence pack.

## Evidence pack

- Test name or artifact proving each AC (catalogued above).
- Test name or artifact proving each failure/degraded row, including the conformance false-pass row.
- Negative fixture for every rejection: the broken double-claim provider and the broken
  authority-overwrite provider (AC-5); the stale-claim and concurrent-claim loser fixtures producing
  `claim-conflict` (AC-4); the divergent-authority `writeStatus` fixture producing
  `status-authority-conflict` (AC-3); the malformed-task fixture producing `track-malformed` /
  `dependency-unresolved` (AC-6); the degraded-storage scenario producing `work-source-unavailable`
  and the status scenario producing `status-bucket-unknown` (AC-2). A green conformance run alone proves
  only acceptance; the broken-provider fixtures prove the suite's teeth.
- `pnpm check` result, unless blocked by a named unrelated repository issue.
- Coverage command, instrumented lane(s), and number for the mock/conformance/fixture helper scope.
- Public-import test result for every exposed testkit symbol, imported through the `testkit` entrypoint.
- Boundary/forbidden-symbol sweep (AC-8): exact command
  `pnpm exec grep -rnE 'node:fs|node:path|fs/promises|child_process|execa|@octokit|node-fetch|undici|marked|remark|markdown-it|gray-matter|provider-' packages/testkit/src/work-source/ packages/testkit/src/fixtures/work-source/`,
  path roots `packages/testkit/src/work-source/` and `packages/testkit/src/fixtures/work-source/`, the
  forbidden-token set above, expected zero-match (non-zero exit) output captured; plus `pnpm deps` pass.
- Conformance evidence: recorded/in-memory only — no real filesystem, markdown source, process, or
  network. (The SDK seam is `prov-03-s1-work-source-port`; the real Markdown driver and its live
  attestation are Epic 6.)

## Boundaries and STOP conditions

- Package or module boundary: `packages/testkit` Work Source surface only.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/testkit/src/work-source/**`, `packages/testkit/src/fixtures/work-source/**`,
  `packages/testkit/tests/work-source/**`.
- Forbidden dependencies: no redeclaration of any `prov-03-s1-work-source-port` type, the
  `WorkSourceError` union, or the `CapabilityAttestation` envelope; no markdown parser, filesystem,
  network client, `child_process`/`execa`, `@octokit/*`, or any `provider-*` package; no SDK
  redefinition; no replay/projection engine (SDK-owned); `testkit` never in a production graph.
- STOP when: a needed `WorkSourceProvider` type, DTO field, or `WorkSourceError` kind is absent from the
  approved `prov-03-s1-work-source-port` contract; a behavior requires the concrete Markdown driver, real
  digests, or filesystem reads (Epic 6); a behavior requires the capability-freshness gate or run-log
  envelope (Epic 3); or a fixture needs a real replay engine rather than static recorded inputs.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 2 - stories](./README.md) · **← Prev:** [prov-03-s1-work-source-port - SDK Work Source provider port implementation story](./prov-03-s1-work-source-port.md) · **Next →:** [prov-04-s1-execution-host-port - SDK Execution Host provider port implementation story](./prov-04-s1-execution-host-port.md)

<!-- /DOCS-NAV -->
