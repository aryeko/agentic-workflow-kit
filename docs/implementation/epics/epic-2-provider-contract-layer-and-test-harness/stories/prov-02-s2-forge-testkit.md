---
title: "prov-02-s2-forge-testkit - testkit Mock Forge and conformance implementation story"
id: "prov-02-s2-forge-testkit"
epic: 2
status: "story: ready"
design:
  - "docs/design/20-sdk-and-packaging/testkit-and-conformance.md"
---

# prov-02-s2-forge-testkit - Testkit Mock Forge and Conformance

## Purpose

Provide the testkit Mock Forge, the Forge conformance suite, and the Forge incident fixtures — in
memory only, against the SDK-owned `prov-02-s1-forge-port/ForgeProvider` seam — so that completion,
merge-readiness, and recovery stories can exercise exact-head reads and expected-head write actions
(and prove broken Forge behavior FAILS the suite) without a GitHub driver, network, or real
credentials.

## Normative design

- `docs/design/20-sdk-and-packaging/testkit-and-conformance.md` — `testkit` owns provider mocks,
  conformance suite helpers, and incident fixtures; depends ONLY on `sdk`; must not redefine
  `ForgeProvider` or `CapabilityAttestation`; "mock success alone is not conformance … broken
  providers must fail the suite."
- `docs/implementation/domains/providers/prov-02-forge-collaboration.md` — testkit owns Mock Forge,
  conformance helpers, and adversarial fixtures for head SHA, checks, reviews, rulesets, queue,
  thread, auth, and credential failures (lines ~21–23, 55–56, 70–73).
- `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-02-s1-forge-port.md`
  — the SDK Forge port: the normative source for every `ForgeProvider`, DTO, union, and
  `ForgeFailureToken` name consumed here. Cited as `prov-02-s1-forge-port/<Type>`; never redeclared.
- `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-00-s1-capability-attestation.md`
  — the generic `CapabilityAttestation<Capability>` envelope, consumed via the port's
  `CapabilityAttestation<ForgeCapability>[]`; never redeclared.
- `docs/design/20-sdk-and-packaging/dependency-rules.md` — `testkit` depends only on `sdk`; it must
  never appear in any production dependency graph; `@octokit/*`, network clients, and concrete driver
  clients are forbidden in `testkit`.
- `docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/stories/epic0-s4-export-templates.md`
  — `PackageExportConvention` for the public `testkit` entrypoint.
- `docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/stories/epic0-s1-package-graph.md`
  — `packages/testkit` package identity.
- `docs/engineering/testing-policy.md`, `docs/engineering/test-lanes.md`,
  `docs/engineering/dependency-policy.md`.

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and this story must expose or consume, by name:

- Consumed SDK port types (cited `prov-02-s1-forge-port/<Type>`, NEVER redeclared): `ForgeProvider`,
  `EvidenceRequest`, `ExpectedHeadActionRequest`, `ForgeEvidenceSnapshot`, `ForgeActionResult`
  (union `accepted | refused | ForgeDegraded`), `ForgeDegraded`, `ForgeFailureToken` (the twelve
  tokens), `ForgeCapability`, and the observed-facts DTOs `ForgePrStateFacts`, `ForgeStatusCheckFacts`,
  `ForgeReviewThreadFacts`, `ForgeProtectionFacts`, `ForgeRuleset`, `ForgeMergeQueueFacts`; plus the
  request/ref DTOs `PushBranchRequest`, `PullRequestUpsertRequest`, `PullRequestCommentRequest` it
  must satisfy. Consumed attestation envelope: `prov-00-s1-capability-attestation/CapabilityAttestation`
  (specialized by the port as `CapabilityAttestation<ForgeCapability>[]`).
- Coined testkit symbols (design is silent on names; this story coins them, exported from the
  `testkit` public entrypoint):
  - `MockForgeProvider` — an in-memory class implementing `prov-02-s1-forge-port/ForgeProvider`,
    constructed from a scenario describing observed head, observed facts, capability outcomes, and a
    failure-token plan; deterministic, no network/credentials.
  - `ForgeScenario` — the in-memory scenario record driving a `MockForgeProvider` (observed head SHA,
    seeded `ForgeObservedFacts`, per-capability attestation outcomes, and a token-per-operation map).
  - `forgeConformanceSuite` — a function registering the Forge conformance suite (Forge reads +
    expected-head write actions, positive/negative/degraded/adversarial) against any
    `ForgeProvider`-shaped subject.
  - `forgeIncidentFixtures` — the catalog of named adversarial `ForgeScenario` fixtures (head-SHA
    mismatch, checks, reviews, rulesets, merge queue, review-thread, auth, credential).
  - `brokenForgeFixtures` — deliberately-broken subjects (e.g. one that writes despite an
    `expectedHeadSha` mismatch; one that presents a degraded read as authoritative) used by the
    negative conformance fixture to prove the suite has teeth.
- Evidence records / attestations produced: in-memory `ForgeEvidenceSnapshot` (pinned to
  `expectedHeadSha`), `ForgeActionResult` arms, `ForgeDegraded` values carrying a `ForgeFailureToken`,
  and `CapabilityAttestation<ForgeCapability>[]` — all recorded/in-memory, never from a real forge.
- Failure and degraded tokens exercised: all twelve `prov-02-s1-forge-port/ForgeFailureToken` members,
  enumerated in the failure table below; `forge-head-mismatch` is the lead exact-head guard.

Done requires every coined symbol present and importable from `testkit`, every consumed port type
cited not redeclared, and every listed token exercised by a mock scenario and a conformance assertion.

## Responsibilities

- Provide `MockForgeProvider` implementing `prov-02-s1-forge-port/ForgeProvider` in memory: its eight
  operations return `ForgeActionResult` arms, `ForgeEvidenceSnapshot | ForgeDegraded`, and
  `CapabilityAttestation<ForgeCapability>[]` driven by a `ForgeScenario`, with no `@octokit`, network,
  or real credential.
- Produce the four named scenario classes: exact-head (snapshot pinned to `expectedHeadSha`), degraded
  (`ForgeDegraded` carrying a `ForgeFailureToken`), credential (`forge-credential-unavailable` /
  `forge-auth-denied`), and ambiguous-state (`forge-state-unknown` and uninspectable facts).
- Provide `forgeConformanceSuite` checking Forge reads: `collectEvidence` returns a well-formed
  `ForgeEvidenceSnapshot` pinned to the expected head, OR a `ForgeDegraded` that is NOT presentable as
  an authoritative snapshot.
- Provide `forgeConformanceSuite` checking expected-head write actions: `updateBranch`/`enqueue`/
  `merge` refuse with `forge-head-mismatch` when the observed head differs from `expectedHeadSha`, and
  never return `accepted` for a drifted head.
- Provide `forgeIncidentFixtures`: adversarial `ForgeScenario` fixtures for head-SHA mismatch, checks,
  reviews, rulesets, merge queue, review-thread, auth, and credential failures, each pinned to a
  `ForgeFailureToken`.
- Provide `brokenForgeFixtures` and a negative conformance fixture proving the conformance suite FAILS
  a deliberately-broken Forge subject (writes on head mismatch; presents a degraded read as
  authoritative).
- Export every coined symbol from the `testkit` public entrypoint per `PackageExportConvention`.
- Import only `sdk`: the testkit source imports no `@octokit/*`, no network client, no `provider-*`,
  no `cli`/`mcp` — proven by a runnable forbidden-symbol sweep plus `pnpm deps`.

## Out of scope

- Defining `ForgeProvider`, the DTOs, `ForgeActionResult`, `ForgeDegraded`, `ForgeFailureToken`,
  `ForgeCapability`, or the observed-facts catalog — owned by `prov-02-s1-forge-port`, consumed here.
- The generic `CapabilityAttestation<Capability>` envelope, `capabilityAttestationSchema`, and
  `isCapabilityAttestation` — owned by `prov-00-s1-capability-attestation`, consumed here.
- Concrete GitHub / GHES behavior, real `@octokit/*` calls, live credentials, real-head reads — owned
  by Epic 6 provider drivers; this story is in-memory only.
- The replay/projection engine that consumes incident fixtures — SDK-owned (core-01/core-06), not
  testkit; this story holds the fixture data only.
- Completion, merge-readiness, and recovery decisions that consume these fixtures — Epic 5.
- Mocks/conformance for `AgentProvider`, `ExecutionHostProvider`, `WorkSourceProvider` — other
  provider testkit stories.

## Dependencies and frozen inputs

- Covers signals: "Testkit Mock Forge with exact-head, degraded, credential, and ambiguous-state
  scenarios"; and "Conformance helpers for Forge reads and expected-head write actions, and incident
  fixtures."
- Depends on: `prov-02-s1-forge-port` (the `ForgeProvider` interface + exact-head evidence DTOs +
  `ForgeFailureToken`), `prov-00-s1-capability-attestation`.
- Depended on by: completion, merge-readiness, and recovery stories needing Forge evidence and
  expected-head action results without a GitHub driver.
- Shared shapes consumed: `prov-02-s1-forge-port/ForgeProvider`, `prov-02-s1-forge-port/EvidenceRequest`,
  `prov-02-s1-forge-port/ExpectedHeadActionRequest`, `prov-02-s1-forge-port/ForgeEvidenceSnapshot`,
  `prov-02-s1-forge-port/ForgeActionResult`, `prov-02-s1-forge-port/ForgeDegraded`,
  `prov-02-s1-forge-port/ForgeFailureToken`, `prov-02-s1-forge-port/ForgeCapability`,
  `prov-02-s1-forge-port/ForgePrStateFacts`, `prov-02-s1-forge-port/ForgeStatusCheckFacts`,
  `prov-02-s1-forge-port/ForgeReviewThreadFacts`, `prov-02-s1-forge-port/ForgeProtectionFacts`,
  `prov-02-s1-forge-port/ForgeRuleset`, `prov-02-s1-forge-port/ForgeMergeQueueFacts`, and
  `prov-00-s1-capability-attestation/CapabilityAttestation`.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. Avoid "exactly as
specified."

- **AC-1** `MockForgeProvider` implements `prov-02-s1-forge-port/ForgeProvider` — all eight operations
  (`probeCapabilities`, `pushBranch`, `upsertPullRequest`, `publishComment`, `collectEvidence`,
  `updateBranch`, `enqueue`, `merge`) typed to the port's request and return types — and a fixture
  constructs it from a `ForgeScenario` - evidence: `mock-forge-shape.unit.test.ts` type-checks a
  `MockForgeProvider` assigned to a `ForgeProvider` binding under `pnpm typecheck` and asserts all
  eight methods are callable; the suite fails if any method is missing or mistyped.
- **AC-2** The exact-head scenario makes `collectEvidence` return a `ForgeEvidenceSnapshot` whose
  `expectedHeadSha` equals the request's `expectedHeadSha` and whose required `prState`,
  `statusChecks`, `reviewThreads`, `protection`, and `mergeQueue` fields (each a `Forge*Facts` shape
  carried directly on the snapshot) equal the seeded facts - evidence:
  `mock-forge-exact-head.unit.test.ts` asserts `snapshot.expectedHeadSha === req.expectedHeadSha` and
  deep-equals each of the five seeded `Forge*Facts` values on the snapshot (`ForgePrStateFacts`,
  `ForgeStatusCheckFacts`, `ForgeReviewThreadFacts`, `ForgeProtectionFacts`, `ForgeMergeQueueFacts`) —
  the all-optional `ForgeObservedFacts` bag is reserved for the degraded-read scenario
  (`ForgeDegraded.observedFacts`), not the snapshot; fails on any pin or fact mismatch.
- **AC-3** The expected-head write conformance check FAILS any subject whose `updateBranch`,
  `enqueue`, or `merge` returns `kind: "accepted"` when the scenario's observed head differs from
  `req.expectedHeadSha`, and PASSES a subject that returns `kind: "refused"` with
  `token: "forge-head-mismatch"` carrying `observedHeadSha` - evidence:
  `forge-write-actions.conformance.test.ts` (project `conformance-mock`) runs the check against
  `MockForgeProvider` (passes) and against `brokenForgeFixtures.writesOnHeadMismatch` (the suite
  reports a failed assertion); a green run alone does not pass — the broken subject must produce a
  recorded failed assertion.
- **AC-4** The Forge-reads conformance check FAILS any subject that presents a `ForgeDegraded` value
  as an authoritative `ForgeEvidenceSnapshot`, and PASSES a subject whose `collectEvidence` returns
  either a snapshot pinned to `expectedHeadSha` or a `ForgeDegraded` carrying a
  `prov-02-s1-forge-port/ForgeFailureToken` - evidence: `forge-reads.conformance.test.ts` (project
  `conformance-mock`) passes `MockForgeProvider` and reports a failed assertion for
  `brokenForgeFixtures.degradedAsAuthoritative`.
- **AC-5** `forgeIncidentFixtures` enumerates the eight adversarial categories — head-SHA mismatch,
  checks, reviews, rulesets, merge queue, review-thread, auth, credential — each a `ForgeScenario`
  pinned to a `prov-02-s1-forge-port/ForgeFailureToken`, and each, when run through the conformance
  suite, surfaces its token on a `refused`/`ForgeDegraded` value (never on an `accepted` value) -
  evidence: `forge-incident-fixtures.conformance.test.ts` (project `conformance-mock`) iterates the
  catalog and asserts each fixture's expected token appears on a non-`accepted` arm; a fixture
  surfacing its token on `accepted` fails the test.
- **AC-6** Each of the twelve `prov-02-s1-forge-port/ForgeFailureToken` members — `forge-head-mismatch`,
  `forge-credential-unavailable`, `forge-auth-denied`, `forge-state-unknown`,
  `forge-protection-uninspectable`, `forge-rulesets-unattested`, `forge-merge-queue-unavailable`,
  `forge-review-threads-uninspectable`, `forge-admin-bypass-refused`, `forge-ghes-capability-unknown`,
  `forge-rate-limited`, `forge-redaction-unavailable` — is produced by at least one `ForgeScenario`
  and asserted by a conformance check on a `refused` or `ForgeDegraded` value - evidence:
  `forge-failure-tokens.conformance.test.ts` (project `conformance-mock`) maps each token to its
  scenario and asserts it on a non-`accepted` arm; an unmapped token fails the test.
- **AC-7** Every coined symbol — `MockForgeProvider`, `ForgeScenario`, `forgeConformanceSuite`,
  `forgeIncidentFixtures`, `brokenForgeFixtures` — is importable from the `testkit` public entrypoint
  (not a private module path), and `MockForgeProvider`, each `forgeIncidentFixtures` entry, and each
  `brokenForgeFixtures` entry is constructable from a fixture - evidence:
  `forge-testkit-public-import.unit.test.ts` imports each symbol from `testkit`, constructs each, and
  asserts a non-`undefined` value; a missing export or unconstructable shape fails the import.
- **AC-8** The `packages/testkit/src/forge/**` and `packages/testkit/src/fixtures/forge/**` source
  imports only `sdk` — no `@octokit/*`, no network client (`node:net`/`node:http(s)`), no
  `provider-*`, no `cli`/`mcp`, no `execa`/`child_process` - evidence: `pnpm deps` plus the runnable
  grep sweep
  `grep -REn "@octokit/|child_process|from ['\"]execa['\"]|node:net|node:https?|packages/(provider-|cli|mcp)" packages/testkit/src/forge packages/testkit/src/fixtures/forge`
  with zero matches captured in the Evidence pack.

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No
responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| `MockForgeProvider` implements `prov-02-s1-forge-port/ForgeProvider` (eight ops, in-memory) | AC-1 |
| `ForgeScenario` drives the mock (observed head, seeded facts, capability outcomes, token plan) | AC-1, AC-2 |
| Exact-head scenario → `ForgeEvidenceSnapshot` pinned to `expectedHeadSha` | AC-2 |
| Degraded scenario → `ForgeDegraded` carrying a `ForgeFailureToken` | AC-4, AC-6 |
| Credential scenario (`forge-credential-unavailable`/`forge-auth-denied`) | AC-5, AC-6 |
| Ambiguous-state scenario (`forge-state-unknown`, uninspectable facts) | AC-5, AC-6 |
| `forgeConformanceSuite` — Forge reads (snapshot pinned, or degraded not authoritative) | AC-4 |
| `forgeConformanceSuite` — expected-head writes refuse with `forge-head-mismatch` | AC-3 |
| `forgeIncidentFixtures` (8 adversarial categories, each pinned to a token) | AC-5 |
| All twelve `ForgeFailureToken` members exercised | AC-6 |
| `brokenForgeFixtures` + negative conformance fixture proving the suite FAILS broken subjects | AC-3, AC-4 |
| Coined symbols exported from `testkit` entrypoint; constructable | AC-7 |
| Consume port + attestation shapes without redeclaring | AC-1, AC-2, AC-7 |
| `testkit` imports only `sdk`; no `@octokit`/network/`provider-*` | AC-8 |

## Failure and degraded outcomes

Each row's cited AC asserts this row's trigger and required behavior (not the happy path). All values
are recorded/in-memory from `MockForgeProvider`; no real forge.

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `forge-head-mismatch` | Scenario observed head differs from `expectedHeadSha` on `updateBranch`/`enqueue`/`merge`. | `refused` with `token: "forge-head-mismatch"` + `observedHeadSha`; never `accepted`; suite FAILS a subject that writes anyway. | AC-3, AC-5, AC-6 |
| `forge-credential-unavailable` | Credential scenario: credential for the phase is unavailable. | Surface token on `refused`/`ForgeDegraded`; do not proceed; not on `accepted`. | AC-5, AC-6 |
| `forge-auth-denied` | Credential scenario: credential present but authorization denied. | Surface token on `refused`/`ForgeDegraded`; do not proceed. | AC-5, AC-6 |
| `forge-state-unknown` | Ambiguous-state scenario: state unreadable for the pinned head. | `ForgeDegraded` carrying the token; not presentable as authoritative snapshot. | AC-4, AC-5, AC-6 |
| `forge-protection-uninspectable` | Protection facts uninspectable in scenario. | `ForgeDegraded` with token; not authoritative. | AC-5, AC-6 |
| `forge-rulesets-unattested` | Rulesets capability not attested in scenario. | Surface token; ruleset facts not asserted. | AC-5, AC-6 |
| `forge-merge-queue-unavailable` | Merge-queue facts unavailable in scenario. | `ForgeDegraded`/`refused` token. | AC-5, AC-6 |
| `forge-review-threads-uninspectable` | Review-thread resolution uninspectable in scenario. | `ForgeDegraded` token; not authoritative. | AC-5, AC-6 |
| `forge-admin-bypass-refused` | Scenario requests admin bypass of protection. | `refused` with token; no bypass. | AC-6 |
| `forge-ghes-capability-unknown` | GHES capability indeterminate in scenario. | Surface token; capability treated as unattested. | AC-6 |
| `forge-rate-limited` | Scenario hits a rate limit. | `ForgeDegraded`/`refused` token. | AC-6 |
| `forge-redaction-unavailable` | Redaction fingerprints unavailable in scenario. | Surface token; no unredacted result emitted. | AC-6 |

## Quality bar

- Coverage scope and threshold: the Mock Forge, conformance helpers, and incident-fixture modules
  under `packages/testkit/src/forge/**` and `packages/testkit/src/fixtures/forge/**` at 90% minimum,
  aiming for 95%.
- Coverage command and instrumented lane(s):
  `pnpm exec vitest run --project conformance-mock --coverage --passWithNoTests -- packages/testkit/tests/forge`
  instruments the conformance-mock lane for the stated Forge testkit scope; `pnpm coverage:baseline`
  aggregates across the unit, integration, and conformance-mock lanes.
- Required tests, catalogued by AC and failure row: `mock-forge-shape.unit.test.ts` (AC-1);
  `mock-forge-exact-head.unit.test.ts` (AC-2); `forge-write-actions.conformance.test.ts` (AC-3,
  `forge-head-mismatch` row, negative `brokenForgeFixtures.writesOnHeadMismatch`);
  `forge-reads.conformance.test.ts` (AC-4, degraded rows, negative
  `brokenForgeFixtures.degradedAsAuthoritative`); `forge-incident-fixtures.conformance.test.ts`
  (AC-5, the eight adversarial categories); `forge-failure-tokens.conformance.test.ts` (AC-6, all
  twelve token rows); `forge-testkit-public-import.unit.test.ts` (AC-7);
  the `pnpm deps` + grep sweep (AC-8).
- Public exposure (import path + public-import test): `MockForgeProvider`, `ForgeScenario`,
  `forgeConformanceSuite`, `forgeIncidentFixtures`, `brokenForgeFixtures` are exported from the
  `testkit` public entrypoint per `epic0-s4-export-templates/PackageExportConvention` (export +
  barrel + `exports`), proven by `forge-testkit-public-import.unit.test.ts` (AC-7). No consumer
  imports a private module path.
- Determinism constraints: `MockForgeProvider` is in-memory and value-stable; scenarios seed observed
  head/facts/tokens with static data; no clock, network, filesystem, or credential source; any
  generated id is fixture-supplied, not random.
- Dependency boundaries: `packages/testkit` imports only `sdk` (`dependency-rules.md`); forbidden in
  this source: `@octokit/*`, network clients, `execa`, `child_process`, `provider-*`, `cli`, `mcp`;
  `testkit` must never appear in any production dependency graph.
- File-size budget (lines per file): soft cap ~200 lines per file; split across focused files —
  `mock-forge` (the provider), `scenario` (the `ForgeScenario` builder), conformance helpers (reads
  vs write-actions), and fixtures (incident vs broken) — if a file approaches the cap.
- Domain non-negotiables: mock success is NOT conformance — the suite must FAIL a deliberately-broken
  Forge subject (writes on head mismatch; presents a degraded read as authoritative); a degraded read
  is never presentable as an authoritative `ForgeEvidenceSnapshot`; no real process, network, or
  credential.

## Required reading

- `docs/design/20-sdk-and-packaging/testkit-and-conformance.md`.
- `docs/implementation/domains/providers/prov-02-forge-collaboration.md`.
- `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-02-s1-forge-port.md`
  — the consumed Forge port types.
- `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-00-s1-capability-attestation.md`.
- `docs/design/20-sdk-and-packaging/dependency-rules.md`.
- `docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/stories/epic0-s4-export-templates.md`.
- `docs/engineering/testing-policy.md`, `docs/engineering/test-lanes.md`,
  `docs/engineering/dependency-policy.md`.

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The `packages/testkit` Forge module providing `MockForgeProvider`, `ForgeScenario`,
`forgeConformanceSuite`, `forgeIncidentFixtures`, and `brokenForgeFixtures` over the
`prov-02-s1-forge-port/ForgeProvider` seam — in-memory only — plus the evidence pack.

## Evidence pack

- Test name or artifact proving each AC (catalogued in Quality bar).
- Test name or artifact proving each failure/degraded outcome row
  (`forge-write-actions.conformance.test.ts`, `forge-reads.conformance.test.ts`,
  `forge-incident-fixtures.conformance.test.ts`, `forge-failure-tokens.conformance.test.ts`).
- Negative fixture for every "the suite has teeth" claim: `brokenForgeFixtures.writesOnHeadMismatch`
  (AC-3) and `brokenForgeFixtures.degradedAsAuthoritative` (AC-4) each produce a recorded FAILED
  conformance assertion; a green run alone does not satisfy AC-3/AC-4.
- `pnpm check` result, unless the gate is blocked by an unrelated repository issue that is named.
- Coverage command, instrumented lane (conformance-mock), and number for the stated Forge testkit
  scope.
- Public-import test result (`forge-testkit-public-import.unit.test.ts`) for every coined symbol,
  imported through the `testkit` entrypoint.
- Boundary/forbidden-symbol sweep: exact command
  `grep -REn "@octokit/|child_process|from ['\"]execa['\"]|node:net|node:https?|packages/(provider-|cli|mcp)" packages/testkit/src/forge packages/testkit/src/fixtures/forge`,
  path roots `packages/testkit/src/forge` and `packages/testkit/src/fixtures/forge`, forbidden-token
  set {`@octokit/*`, `child_process`, `execa`, network clients, `provider-*`, `cli`, `mcp`}, expected
  zero matches, output captured; plus `pnpm deps` output.
- Conformance evidence: this story delivers in-memory mocks, conformance helpers, and recorded
  incident fixtures only; no real process, network, or credential. Real-driver / live forge
  attestation is Epic 6.

## Boundaries and STOP conditions

- Package or module boundary: `packages/testkit/src/forge` and `packages/testkit/src/fixtures/forge`.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/testkit/src/forge/**`, `packages/testkit/src/fixtures/forge/**`,
  `packages/testkit/tests/forge/**`.
- Forbidden dependencies: `@octokit/*`, any network client, `execa`, `child_process`, `provider-*`,
  `cli`, `mcp`, and any concrete driver client; `testkit` must never enter a production dependency
  graph.
- STOP when: a Forge type/field/token needed by a scenario or assertion is not in
  `prov-02-s1-forge-port` (the port must be amended first, not redeclared here); a conformance check
  would require real forge/network/credential behavior (that is Epic 6); or a fixture would need to
  redeclare the generic `CapabilityAttestation` envelope or a port DTO rather than importing it.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 2 - stories](./README.md) · **← Prev:** [prov-02-s1-forge-port - SDK Forge provider port implementation story](./prov-02-s1-forge-port.md) · **Next →:** [prov-03-s1-work-source-port - SDK Work Source provider port implementation story](./prov-03-s1-work-source-port.md)

<!-- /DOCS-NAV -->
