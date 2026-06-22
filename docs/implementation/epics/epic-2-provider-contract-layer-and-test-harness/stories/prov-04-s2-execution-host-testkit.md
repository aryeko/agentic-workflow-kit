---
title: "prov-04-s2-execution-host-testkit - testkit Execution Host mock, conformance, and incident fixtures implementation story"
id: "prov-04-s2-execution-host-testkit"
epic: 2
status: "story: ready"
design:
  - "docs/design/20-sdk-and-packaging/testkit-and-conformance.md"
---

# prov-04-s2-execution-host-testkit - Testkit Execution Host Mock, Conformance, and Incident Fixtures

## Purpose

Build the `packages/testkit` programmable mock Execution Host (positive, degraded, incomplete-capture,
and termination scenarios), the conformance helpers (host observation, command capture, injection
separation, capability freshness), and the incident-fixture registry — all in-memory, implementing the
SDK `prov-04-s1-execution-host-port/ExecutionHostProvider` port and validating it against the
SDK types without redefining them.

## Normative design

- `docs/design/20-sdk-and-packaging/testkit-and-conformance.md` — testkit owns provider mocks,
  conformance suite helpers, and incident fixtures; depends only on `sdk`; must not appear in any
  production dependency graph; "mock success alone is not conformance … broken providers must fail the
  suite"; conformance must cover positive, negative, stale, and adversarial cases.
- `docs/implementation/domains/providers/prov-04-execution-host.md` — testkit inputs: mock host
  scenarios, conformance helpers, command capture fixtures, termination fixtures, and degraded host
  observation fixtures (lines ~22–24, 54–55, 75–77).
- `docs/design/20-sdk-and-packaging/provider-interface-model.md` — a capability is trusted only when
  freshly and positively attested; a capability that cannot be freshly and positively attested is
  treated as absent (the freshness invariant the conformance helper enforces).
- `docs/design/20-sdk-and-packaging/dependency-rules.md`, `sdk-boundary.md` — `testkit` depends ONLY on
  `sdk`; no `provider-*`, `cli`, `mcp`, no real `execa`/`child_process`/network client/credential.
- `docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/stories/epic0-s4-export-templates.md`
  — `PackageExportConvention` for the public `testkit` entrypoint.
- `docs/engineering/testing-policy.md`, `docs/engineering/test-lanes.md`,
  `docs/engineering/dependency-policy.md`.

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name (runtime
types variant). Consumed SDK shapes are cited verbatim from the sibling port; coined testkit symbols are
this story's job to name and expose.

- Interfaces / types — **consumed (cited, never redeclared):**
  `prov-04-s1-execution-host-port/ExecutionHostProvider`, `prov-04-s1-execution-host-port/WorkerHandle`,
  `prov-04-s1-execution-host-port/HostWorkspaceHandle`, `prov-04-s1-execution-host-port/WorkspaceAttachment`,
  `prov-04-s1-execution-host-port/SpawnWorkerRequest`, `prov-04-s1-execution-host-port/HostCommandRequest`,
  `prov-04-s1-execution-host-port/HostInjectionContext`, `prov-04-s1-execution-host-port/TerminationPolicy`,
  `prov-04-s1-execution-host-port/HostProbeScope`, `prov-04-s1-execution-host-port/HostAttestationDetails`;
  the `prov-04-s1-execution-host-port/HostObservation` discriminated union (arms `"output"`,
  `"structured-tool-exit"`, `"process-exit"`, `"host-failure"`); plus
  `prov-00-s1-capability-attestation/CapabilityAttestation` specialized as
  `CapabilityAttestation<HostCapability>` with `prov-04-s1-execution-host-port/HostCapability`.
- Interfaces / types — **coined (this story owns the symbol + public import path):**
  `MockExecutionHostProvider` (a constructable `ExecutionHostProvider` implementation);
  `MockExecutionHostScenario` (a scripted scenario descriptor enumerating `"positive" | "degraded" |
  "incomplete-capture" | "termination"`); `executionHostConformance` (the conformance suite runner over
  any `ExecutionHostProvider`); `executionHostIncidentFixtures` (the incident-fixture registry). All
  exported from the `testkit` package public entrypoint per
  `epic0-s4-export-templates/PackageExportConvention`.
- Provider operations / commands — the mock implements the seven port operations
  (`probeCapabilities`, `attachWorkspace`, `spawnWorker`, `observeWorker`, `terminateWorker`,
  `runCommand`, `releaseWorkspace`) in-memory with no real process/network; the conformance runner
  drives them and asserts evidence.
- Failure and degraded tokens — the mock emits these `prov-04-s1-execution-host-port/HostFailureReason`
  members through `HostFailure.reason` or the `HostObservation` `"host-failure"` arm, scenario-selected:
  `host-observation-incomplete` (degraded stream), `termination-unproven` (incomplete
  `TerminationProof`), `runner-command-capture-incomplete` (missing capture digest),
  `credential-injection-rejected` (runner-credential leak rejection), `egress-confinement-unattested`
  and `host-capability-unattested` (stale/negative attestation treated as absent). These are consumed
  tokens, not redeclared.
- Evidence records / attestations — recorded/in-memory only: scripted `HostObservation` streams,
  `CommandResult` capture evidence (`commandDigest`, `outputDigest`, optional `stdoutRef`/`stderrRef`),
  `TerminationResult` carrying `TerminationProof`, and `CapabilityAttestation<HostCapability>[]` sets
  (positive, negative, stale-by-`expiry`) used by the freshness helper. NO real process, network, or
  credential.

Done requires every coined symbol present with its stated import path and semantics, and every consumed
SDK shape cited (not redeclared) with the design's names.

## Responsibilities

- Provide `MockExecutionHostProvider` — a constructable, in-memory `ExecutionHostProvider` driven by a
  `MockExecutionHostScenario` selecting one of `"positive" | "degraded" | "incomplete-capture" |
  "termination"`, producing the matching `HostObservation` stream, `CommandResult` capture evidence,
  `TerminationResult` with `TerminationProof`, and `host-failure` arms carrying `HostFailureReason`
  tokens — with no real process, network, or credential.
- Provide `executionHostConformance` — a conformance suite runner over any `ExecutionHostProvider` that
  asserts: (a) host observation streams are well-formed over the four arms; (b) every `runCommand`
  yields a `CommandResult` carrying `commandDigest` and `outputDigest`; (c) injection separation —
  runner-only credentials in `HostInjectionContext` never surface in any worker-visible observation;
  (d) capability freshness — a stale or negative `CapabilityAttestation<HostCapability>` is treated as
  absent and the gated operation fails closed.
- Make the conformance suite have teeth: it FAILS a deliberately broken `ExecutionHostProvider` (one
  returning a `TerminationResult` without a complete `TerminationProof`, or a `CommandResult` missing
  its `outputDigest`), proving mock success alone is not conformance.
- Provide `executionHostIncidentFixtures` — an in-memory registry of command-capture fixtures,
  termination fixtures, and degraded host-observation fixtures usable as inputs to conformance and to
  later core/supervision/verification stories needing host evidence without a Local driver.
- Export `MockExecutionHostProvider`, `MockExecutionHostScenario`, `executionHostConformance`, and
  `executionHostIncidentFixtures` from the `testkit` public entrypoint with no private-module import.
- Keep `testkit` importing only `sdk`: no `provider-*`, no `cli`/`mcp`, no real process/network/credential.

## Out of scope

- The SDK `ExecutionHostProvider` interface, the host DTO catalog, the four host unions,
  `HostObservation`, `HostAttestationDetails`, and `WorkerHandle` — produced by
  `prov-04-s1-execution-host-port`; consumed and cited, never redeclared.
- The shared `CapabilityAttestation<Capability>` envelope, `CapabilityProvider`, and
  `CapabilityAttestationResult` — owned by `prov-00-s1-capability-attestation`.
- The SDK-owned replay/projection engine — testkit holds incident-fixture **inputs** only, not a replay
  runtime (`testkit-and-conformance.md` "Replay and projection engine: SDK-owned, not testkit"; core-01/core-06).
- Real process control, real kill/containment, real egress confinement, and live probes — owned by the
  Epic 6 Local driver; this story is in-memory only.
- The run-time capability-gate evaluation enforcing freshness in production — owned by core-02 (Epic 3);
  this story only asserts the freshness predicate in conformance.

## Dependencies and frozen inputs

- Covers signals: "Testkit mock host with positive, degraded, incomplete capture, and termination
  scenarios" and "Conformance helpers for host observation, command capture, injection separation, and
  capability freshness, and incident fixtures."
- Depends on: `prov-04-s1-execution-host-port`, `prov-00-s1-capability-attestation`.
- Depended on by: later core, supervision, completion, and recovery stories that need host evidence
  (observations, command capture, termination proof) without a Local driver.
- Shared shapes consumed: `prov-04-s1-execution-host-port/ExecutionHostProvider`,
  `prov-04-s1-execution-host-port/WorkerHandle`, `prov-04-s1-execution-host-port/HostObservation`,
  `prov-04-s1-execution-host-port/CommandResult`, `prov-04-s1-execution-host-port/TerminationResult`,
  `prov-04-s1-execution-host-port/TerminationProof`, `prov-04-s1-execution-host-port/HostReleaseResult`,
  `prov-04-s1-execution-host-port/HostFailure`, `prov-04-s1-execution-host-port/HostFailureReason`,
  `prov-04-s1-execution-host-port/HostCapability`, `prov-04-s1-execution-host-port/HostAttestationDetails`,
  `prov-04-s1-execution-host-port/HostInjectionContext`;
  `prov-00-s1-capability-attestation/CapabilityAttestation` (specialized as
  `CapabilityAttestation<HostCapability>`).

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. A happy-path command
proves only successful acceptance; every rejection or negative-outcome AC names the failing fixture or
provider that proves it. The `evidence` names the exact test id or command and the result it produces.

- **AC-1** `MockExecutionHostProvider`, constructed with a `MockExecutionHostScenario` of `"positive"`,
  satisfies the `prov-04-s1-execution-host-port/ExecutionHostProvider` port: `observeWorker` yields a
  well-formed `HostObservation` stream covering `"output"` (with `redactionApplied: true`),
  `"structured-tool-exit"`, and `"process-exit"`; `runCommand` returns a `CommandResult` with
  `commandDigest` and `outputDigest`; `terminateWorker` returns a `TerminationResult` whose
  `TerminationProof` has every flag set and an `evidenceRef` - evidence:
  `mock-host-positive.unit.test.ts` constructs the mock and asserts each shape, all in-memory.
- **AC-2** `MockExecutionHostProvider` with scenario `"degraded"` emits the `HostObservation`
  `"host-failure"` arm carrying `failure.reason === "host-observation-incomplete"` mid-stream, and with
  scenario `"incomplete-capture"` returns a `HostFailure` with reason
  `"runner-command-capture-incomplete"` from `runCommand` rather than an uncaptured `CommandResult` -
  evidence: `mock-host-degraded.unit.test.ts` drives both scenarios and asserts the exact tokens.
- **AC-3** `MockExecutionHostProvider` with scenario `"termination"` returns, via `terminateWorker`, a
  `TerminationResult` whose scripted `TerminationProof` is incomplete (e.g. `reaped: false,
  containmentEmpty: false`), and surfaces `"termination-unproven"` as a `HostFailure` on the
  `observeWorker` `HostObservation` `"host-failure"` arm — never as a `terminateWorker` return value
  (the port types it `TerminationResult` only) — with a complete proof and no failure arm in the proven
  path - evidence: `mock-host-termination.unit.test.ts` asserts the incomplete `TerminationProof` from
  `terminateWorker` and the `"termination-unproven"` token on the observation `"host-failure"` arm for
  the incomplete-proof script.
- **AC-4** `executionHostConformance` run against `MockExecutionHostProvider` (`"positive"`) PASSES all
  four helper checks: host-observation well-formedness over the four arms, command capture
  (`commandDigest` + `outputDigest` present on every `runCommand`), injection separation
  (`HostInjectionContext` runner-only credential bytes never appear in any `HostObservation`
  `outputRef`/payload), and capability freshness (a fresh positive
  `CapabilityAttestation<HostCapability>` admits the gated operation) - evidence:
  `host-conformance-positive.conformance.test.ts` reports all four checks green (project
  `conformance-mock`).
- **AC-5** `executionHostConformance` FAILS a deliberately broken `ExecutionHostProvider` from
  `broken-termination-proof.fixture.ts` (returns a `TerminationResult` whose `TerminationProof` has
  `reaped: false, containmentEmpty: false`) and from `broken-command-capture.fixture.ts` (returns a
  `CommandResult` with `outputDigest` empty) - evidence:
  `host-conformance-broken.conformance.test.ts` asserts the suite reports a FAIL for each broken
  provider (a green run on a broken provider would itself fail this test — the suite has teeth).
- **AC-6** `executionHostConformance` capability-freshness check treats a STALE attestation (a
  `CapabilityAttestation<HostCapability>` whose `expiry` is past its `freshnessKey` window) and a
  NEGATIVE attestation (`result: "negative"`) as ABSENT: the gated operation fails closed with
  `HostFailure.reason` `"host-capability-unattested"` (or `"egress-confinement-unattested"` for the
  egress-confined operation) - evidence: `host-freshness.conformance.test.ts` drives
  `stale-attestation.fixture.ts` and `negative-attestation.fixture.ts` and asserts the fail-closed token
  for each.
- **AC-7** `executionHostConformance` injection-separation check FAILS a leaky provider from
  `leaky-injection.fixture.ts` whose `observeWorker` emits an `"output"` arm containing the runner-only
  credential marker from `HostInjectionContext`, while passing the non-leaking mock - evidence:
  `host-injection-separation.conformance.test.ts` asserts the leaky provider is reported FAILED and the
  mock PASSED.
- **AC-8** Every coined symbol — `MockExecutionHostProvider`, `MockExecutionHostScenario`,
  `executionHostConformance`, `executionHostIncidentFixtures` — is importable from the `testkit` package
  public entrypoint (not a private module path); `executionHostIncidentFixtures` exposes
  command-capture, termination, and degraded host-observation fixtures, each constructing its consumed
  SDK shape; and the testkit-boundary sweep below reports zero matches - evidence:
  `host-testkit-public-import.unit.test.ts` imports every symbol from the `testkit` entrypoint and
  constructs one fixture of each registry kind; plus the forbidden-symbol sweep reports zero matches.

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No
responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| `MockExecutionHostProvider` positive scenario (observation stream, command capture, proven termination) | AC-1 |
| `MockExecutionHostScenario` degraded + incomplete-capture scenarios | AC-2 |
| `MockExecutionHostScenario` termination scenario (unproven vs proven) | AC-3 |
| `executionHostConformance` four positive helper checks (observation, capture, injection, freshness) | AC-4 |
| Conformance suite has teeth — FAILS deliberately broken providers | AC-5 |
| Capability-freshness helper treats stale/negative attestation as absent (fail-closed) | AC-6 |
| Injection-separation helper FAILS a credential-leaking provider | AC-7 |
| Coined-symbol public exposure from `testkit` entrypoint; incident-fixture registry; testkit boundary | AC-8 |
| Consumed `ExecutionHostProvider`/`HostObservation`/`CommandResult`/`TerminationResult`/`TerminationProof` (cited) | AC-1, AC-4 |
| Consumed `CapabilityAttestation<HostCapability>` (cited) | AC-4, AC-6 |
| Incident fixtures: command-capture, termination, degraded host-observation | AC-2, AC-3, AC-8 |

## Failure and degraded outcomes

Runtime token table. Each cited AC asserts this row's trigger AND behavior (not the happy path). All
tokens are consumed `prov-04-s1-execution-host-port/HostFailureReason` members emitted by the mock or
asserted by a conformance helper; the mock/helpers use recorded/in-memory evidence only.

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `host-observation-incomplete` | The `"degraded"` mock scenario cannot deliver a complete observation stream. | Emit the `HostObservation` `"host-failure"` arm carrying this reason mid-stream. | AC-2 |
| `runner-command-capture-incomplete` | The `"incomplete-capture"` mock scenario cannot capture `commandDigest`/`outputDigest`/refs. | Return `HostFailure` with this reason rather than an uncaptured `CommandResult`. | AC-2 |
| `termination-unproven` | The `"termination"` mock scenario scripts an incomplete `TerminationProof`. | `terminateWorker` returns a `TerminationResult` with the incomplete proof; surface this reason as a `HostFailure` on the `HostObservation` `"host-failure"` arm — not as a `terminateWorker` return value. | AC-3 |
| `host-capability-unattested` | The freshness helper sees a stale or negative `CapabilityAttestation<HostCapability>` for a gated operation. | Treat the capability as absent; the gated operation fails closed with this reason. | AC-6 |
| `egress-confinement-unattested` | The freshness helper sees no fresh positive `egress-confinement` attestation for an egress-confined operation. | Fail closed with this reason; do not run unconfined. | AC-6 |
| `credential-injection-rejected` | The injection-separation helper detects runner-only `HostInjectionContext` credentials surfacing to the worker. | Report the provider FAILED (leak rejected); the non-leaking mock passes. | AC-7 |

## Quality bar

- Coverage scope and threshold: the testkit runtime helpers in this story — `MockExecutionHostProvider`,
  the scenario engine, the four `executionHostConformance` checks, and the incident-fixture builders —
  at 90% minimum, aiming for 95%.
- Coverage command and instrumented lane(s): `pnpm coverage:baseline` instruments the unit and
  conformance-mock lanes for the aggregate gate; focused per-story report via
  `pnpm exec vitest run --project unit --coverage --passWithNoTests -- packages/testkit/tests/execution-host/*.unit.test.ts`
  and `pnpm exec vitest run --project conformance-mock --coverage --passWithNoTests -- packages/testkit/tests/execution-host/*.conformance.test.ts`.
- Required tests, catalogued by AC and failure row: `mock-host-positive.unit.test.ts` (AC-1);
  `mock-host-degraded.unit.test.ts` (AC-2, `host-observation-incomplete` +
  `runner-command-capture-incomplete`); `mock-host-termination.unit.test.ts` (AC-3,
  `termination-unproven`); `host-conformance-positive.conformance.test.ts` (AC-4);
  `host-conformance-broken.conformance.test.ts` (AC-5, broken-provider fixtures);
  `host-freshness.conformance.test.ts` (AC-6, `host-capability-unattested` +
  `egress-confinement-unattested`); `host-injection-separation.conformance.test.ts` (AC-7,
  `credential-injection-rejected`); `host-testkit-public-import.unit.test.ts` (AC-8 + boundary sweep).
- Public exposure (import path + public-import test): `MockExecutionHostProvider`,
  `MockExecutionHostScenario`, `executionHostConformance`, and `executionHostIncidentFixtures` exported
  from the `testkit` package public entrypoint per `epic0-s4-export-templates/PackageExportConvention`;
  proven by `host-testkit-public-import.unit.test.ts`. No SDK shape is re-exported from `testkit`;
  consumers import host types from the `sdk` entrypoint.
- Constructability: a fixture constructs `MockExecutionHostProvider` (each scenario), each
  `executionHostIncidentFixtures` kind (command-capture, termination, degraded host-observation), the
  broken-provider fixtures (`broken-termination-proof.fixture.ts`, `broken-command-capture.fixture.ts`),
  the attestation fixtures (`stale-attestation.fixture.ts`, `negative-attestation.fixture.ts`), and the
  `leaky-injection.fixture.ts`; no shape requires an impossible field combination.
- Determinism constraints: scenarios and observation streams are seeded and reproducible; all timestamps
  (`at`, `startedAt`, `checkedAt`, attestation `expiry`/`at`) are fixture-supplied strings; no clock,
  randomness, process, or I/O.
- Dependency boundaries: `testkit` depends ONLY on `sdk`; it must not import `provider-*`, `cli`, or
  `mcp`, must never appear in a production dependency graph, and must contain no real
  `execa`/`child_process`/network client/credential (`dependency-rules.md`,
  `testkit-and-conformance.md`).
- File-size budget (lines per file; default soft cap ~200): split the mock provider, the scenario
  engine, the four conformance checks, and the incident-fixture registry into separate focused files,
  each ≤ 200 lines.
- Domain non-negotiables: mock success alone is not conformance — the suite must fail a broken provider;
  a host capability is trusted only when freshly and positively attested (stale/negative is absent);
  termination is never reported without a complete `TerminationProof`; runner-only credentials never
  surface to the worker; all evidence is recorded/in-memory (no real process/network/credential — that
  is the Epic 6 Local driver).

### Testkit boundary sweep (runnable recipe)

```sh
grep -REn "execa|child_process|node:net|node:http|node:https|@octokit|net\\.connect|spawn\\(|provider-|/cli|/mcp" \
  packages/testkit/src/execution-host/ packages/testkit/src/fixtures/execution-host/
```

- Path roots: `packages/testkit/src/execution-host/`, `packages/testkit/src/fixtures/execution-host/`.
- Forbidden-token set: `execa`, `child_process`, `node:net`, `node:http`, `node:https`, `@octokit`,
  `net.connect`, `spawn(`, `provider-`, `/cli`, `/mcp`.
- Expected result: zero matches (exit code 1, no lines), captured into the evidence pack. A non-empty
  match means the testkit leaked a real process/network/credential dependency or imported a forbidden
  package and fails this story. Pair with `pnpm deps` to prove `testkit` imports only `sdk`.

## Required reading

- `docs/design/20-sdk-and-packaging/testkit-and-conformance.md` (testkit ownership; "mock success alone
  is not conformance"; positive/negative/stale/adversarial obligation).
- `docs/implementation/domains/providers/prov-04-execution-host.md` (testkit inputs).
- `docs/design/20-sdk-and-packaging/provider-interface-model.md` (the freshness invariant the
  conformance helper enforces).
- `prov-04-s1-execution-host-port` story contract (the `ExecutionHostProvider` port, host DTOs,
  `HostObservation`, `HostFailureReason`, and `HostCapability` it produces).
- `prov-00-s1-capability-attestation` story contract (the `CapabilityAttestation` envelope it produces).
- `epic0-s4-export-templates` story contract; `docs/engineering/test-lanes.md`,
  `docs/design/20-sdk-and-packaging/dependency-rules.md`.

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The `packages/testkit` Execution Host mock and conformance surface — `MockExecutionHostProvider`,
`MockExecutionHostScenario`, `executionHostConformance`, and `executionHostIncidentFixtures` — exposed
on the `testkit` public entrypoint, implementing and validating the
`prov-04-s1-execution-host-port/ExecutionHostProvider` port in-memory, plus the evidence pack.

## Evidence pack

- Test name or artifact proving each AC (catalogued in the quality bar).
- Test name or artifact proving each failure/degraded row (the `host-observation-incomplete`,
  `runner-command-capture-incomplete`, `termination-unproven`, `host-capability-unattested`,
  `egress-confinement-unattested`, and `credential-injection-rejected` rows).
- Negative fixture for every rejection/fail-closed claim: `broken-termination-proof.fixture.ts` and
  `broken-command-capture.fixture.ts` (the suite-has-teeth fixtures), `stale-attestation.fixture.ts`,
  `negative-attestation.fixture.ts`, and `leaky-injection.fixture.ts` — each making the conformance
  suite report a FAIL (a green tool exit alone proves only acceptance, so each broken/stale/leaky
  provider must drive an asserted suite FAILURE).
- `pnpm check` result, unless blocked by a named unrelated repository issue.
- Coverage command, instrumented lanes, and number for the stated helper scope.
- Public-import test result for every coined symbol, imported through the `testkit` entrypoint.
- Testkit boundary sweep: the exact command above, path roots, forbidden-token set, and zero-match
  output, captured; plus `pnpm deps` proving `testkit` imports only `sdk`.
- Conformance evidence is recorded/in-memory only (scripted observation streams, constructed
  `CommandResult`/`TerminationProof`, and constructed `CapabilityAttestation<HostCapability>` sets); no
  real process, network, or credential — real driver attestation is Epic 6.

## Boundaries and STOP conditions

- Package or module boundary: `packages/testkit` Execution Host surface only.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/testkit/src/execution-host/**`, `packages/testkit/src/fixtures/execution-host/**`,
  `packages/testkit/tests/execution-host/**`.
- Forbidden dependencies: no `provider-*`, no `cli`/`mcp`, no real `execa`/`child_process`/network
  client/credential; do not redeclare `ExecutionHostProvider`, any host DTO, `HostObservation`,
  `HostFailureReason`, `HostCapability`, `HostAttestationDetails`, `WorkerHandle`, or
  `CapabilityAttestation` — consume them from `sdk`.
- STOP when: a requirement needs real process control, real kill/containment, live egress confinement,
  or a real probe (Epic 6 Local driver); needs a host shape `prov-04-s1-execution-host-port` does not
  produce; needs the SDK-owned replay/projection engine (core-01/core-06); or needs the run-time
  freshness-gate evaluation (core-02, Epic 3).

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 2 - stories](./README.md) · **← Prev:** [prov-04-s1-execution-host-port - SDK Execution Host provider port implementation story](./prov-04-s1-execution-host-port.md) · **Next →:** [Epic 2 - story DAG](../story-dag.md)

<!-- /DOCS-NAV -->
