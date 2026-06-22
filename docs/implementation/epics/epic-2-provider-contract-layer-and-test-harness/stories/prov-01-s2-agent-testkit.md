---
title: "prov-01-s2-agent-testkit - testkit mock Agent provider and conformance implementation story"
id: "prov-01-s2-agent-testkit"
epic: 2
status: "story: ready"
design:
  - "docs/design/20-sdk-and-packaging/testkit-and-conformance.md"
  - "docs/design/20-sdk-and-packaging/provider-ports.md"
---

# prov-01-s2-agent-testkit - Testkit Mock Agent Provider and Conformance

## Purpose

Build the testkit-owned in-memory mock `AgentProvider` with positive, degraded, and adversarial
`AgentEvent` streams, the Agent conformance helpers that fail broken providers, and the adversarial
incident-replay fixtures that core approval, liveness, capability, and recovery stories consume without
a Codex driver.

## Normative design

- `docs/design/20-sdk-and-packaging/testkit-and-conformance.md` — what testkit owns (provider mocks,
  conformance suite helpers, incident fixtures), the `sdk`-only import rule, "mock success alone is not
  conformance … broken providers must fail the suite", and the SDK-vs-testkit ownership split (testkit
  must not redefine `AgentProvider` or `CapabilityAttestation`).
- `docs/design/20-sdk-and-packaging/provider-ports.md` — "Agent provider" (the SDK port types this
  story consumes and exercises by name, never redeclares).
- `docs/implementation/domains/providers/prov-01-agent-execution.md` — testkit owns the programmable
  mock Agent provider, conformance helpers, and incident fixtures (lines ~21–23); the Story Group
  Signals this story covers (lines ~72–73); AD-12 worker/runner isolation (the worker does not receive
  Forge credentials).
- `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-01-s1-agent-port.md`
  — the producer of every Agent port type this story cites.
- `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-00-s1-capability-attestation.md`
  — the producer of `CapabilityAttestation` and its result enum.
- `docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/stories/epic0-s4-export-templates.md`
  — `PackageExportConvention` for the `testkit` public entrypoint.
- `docs/engineering/testing-policy.md`, `docs/engineering/test-lanes.md`,
  `docs/engineering/dependency-policy.md`.

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types (consumed from the SDK port, cited verbatim, never redeclared):
  `prov-01-s1-agent-port/AgentProvider`, `prov-01-s1-agent-port/AgentSession`,
  `prov-01-s1-agent-port/AgentEvent` (arms `linked | progress | approval-requested | tool-observed |
  guardian-review | degraded | terminal`), `prov-01-s1-agent-port/AgentApprovalRequest`,
  `prov-01-s1-agent-port/ApprovalAnswer`, `prov-01-s1-agent-port/ApprovalAnswerResult`,
  `prov-01-s1-agent-port/ToolObserved`, `prov-01-s1-agent-port/GuardianReviewObserved`,
  `prov-01-s1-agent-port/AgentFailure`, `prov-01-s1-agent-port/AgentReleaseResult`,
  `prov-01-s1-agent-port/AgentStartRequest`, `prov-01-s1-agent-port/AgentCapability`,
  `prov-01-s1-agent-port/AgentTerminalReason`, `prov-01-s1-agent-port/AgentFailureReason`;
  `prov-00-s1-capability-attestation/CapabilityAttestation`; and (fixture-only, type citation, not a
  dependency edge) `prov-04-s1-execution-host-port/WorkerHandle`.
- Interfaces / types (coined here — design is silent on testkit symbol names, so this story names them
  and their import path on the `testkit` public entrypoint): `MockAgentProvider` implementing
  `prov-01-s1-agent-port/AgentProvider`; `agentConformance` (the Agent conformance suite/helper that
  runs assertions against any `AgentProvider`); `agentIncidentFixtures` (the catalog of adversarial
  incident-replay inputs — event sequences plus attestation sets).
- Events / append intents: none owned. The mock emits the SDK-owned `AgentEvent` arms as test data; it
  does not assign event ids (the run-log envelope does, Epic 3).
- Provider operations / commands: the mock implements the `AgentProvider` operations
  `probeCapabilities`, `startWorker`, `observe`, `answerApproval`, `resumeOwned`, `stopObserving` in
  memory; it owns no new operation.
- Failure and degraded tokens (exercised, not owned): the `AgentFailureReason` tokens carried by the
  mock's `degraded`/`terminal` arms and by `AgentFailure` —
  `agent-capability-unattested`, `agent-linkage-lost`, `approval-relay-unattested`,
  `approval-answer-channel-lost`, `agent-resume-unattested`, `structured-tool-exit-missing`,
  `tool-output-ref-missing`, `guardian-review-untrusted`, `host-parentage-unproven`,
  `agent-terminal-ambiguous` — plus the `AgentTerminalReason` `provider-lost`/`host-lost` terminals.
- Evidence records / attestations: recorded/in-memory conformance transcripts and the
  `agentIncidentFixtures` catalog (event sequences + `CapabilityAttestation<AgentCapability>[]` sets).
  No real Codex client, MCP-server runtime, process, network, or credential.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Provide a programmable in-memory `MockAgentProvider` implementing `AgentProvider` that emits, on
  demand, positive, degraded, and adversarial `AgentEvent` streams: the seven event arms (`linked`,
  `progress`, `approval-requested`, `tool-observed`, `guardian-review`, `degraded`, `terminal`),
  `ApprovalAnswerResult` from `answerApproval`, `AgentReleaseResult` from `stopObserving`, and
  `degraded`/`terminal` arms carrying `AgentFailure`/`AgentFailureReason` and `AgentTerminalReason`.
- Provide `agentConformance` helpers that assert Agent provider behavior: structured tool exit present
  (`emitsStructuredToolExit`); Guardian review trustworthy (`emitsGuardianReview`); approval relay and
  answer-channel persistence (`canRelayApproval` / `canPersistApprovalAnswerChannel`); owned resume
  (`canResumeOwned`); host process parentage preserved (`preservesHostProcessParentage`); and capability
  freshness over `CapabilityAttestation<AgentCapability>`.
- Make the conformance suite have teeth: a deliberately broken Agent provider (e.g. a `tool-observed`
  with no structured tool exit / empty `outputRef`, or a `terminal` with an ambiguous reason) FAILS
  `agentConformance`. Mock success alone is not conformance.
- Provide `agentIncidentFixtures` — adversarial incident-replay inputs (event sequences + attestation
  sets) that core approval/liveness/capability/recovery stories replay against the SDK replay engine.
- Build a minimal `prov-04-s1-execution-host-port/WorkerHandle` fixture value so the mock's
  `AgentStartRequest` is constructible (type citation only — no runtime dependency on execution-host).
- Keep testkit in-memory only: import `sdk` and nothing else; no Codex client, MCP-server runtime,
  process, network, credential, or `provider-*` package.

## Out of scope

- Defining `AgentProvider`, the agent DTOs, the `AgentEvent` union, `AgentCapability`, or
  `AgentFailureReason` — owned by `prov-01-s1-agent-port`.
- Defining `CapabilityAttestation` or its result enum — owned by `prov-00-s1-capability-attestation`.
- Defining `WorkerHandle` — owned by `prov-04-s1-execution-host-port` (consumed here as a fixture-only
  type citation, not a dependency edge).
- The SDK-owned replay/projection engine that consumes these fixtures — owned by core-01/core-06
  (Epic 3); testkit holds only the fixture inputs, not a replay runtime.
- The real Codex concrete provider driver and any live/real attestation — owned by Epic 6.
- Approval adjudication, liveness/supervision, capability-gate evaluation, and recovery decisions —
  owned by the core stories that consume these fixtures (`core-03`, `core-04`, `core-02`, recovery).

## Dependencies and frozen inputs

- Covers signals: "Testkit mock Agent provider with positive, degraded, and adversarial event streams"
  and "Conformance helpers for Agent provider behavior and incident replay inputs."
- Depends on: `prov-01-s1-agent-port` (the `AgentProvider` interface, agent DTOs, and `AgentEvent`
  union) and `prov-00-s1-capability-attestation` (the attestation envelope).
- Depended on by: core approval, liveness, capability, and recovery stories that need Agent evidence
  without a Codex driver (`core-02`, `core-03`, `core-04`, and recovery stories).
- Shared shapes consumed: `prov-01-s1-agent-port/AgentProvider`, `prov-01-s1-agent-port/AgentSession`,
  `prov-01-s1-agent-port/AgentEvent`, `prov-01-s1-agent-port/AgentApprovalRequest`,
  `prov-01-s1-agent-port/ApprovalAnswer`, `prov-01-s1-agent-port/ApprovalAnswerResult`,
  `prov-01-s1-agent-port/ToolObserved`, `prov-01-s1-agent-port/GuardianReviewObserved`,
  `prov-01-s1-agent-port/AgentFailure`, `prov-01-s1-agent-port/AgentReleaseResult`,
  `prov-01-s1-agent-port/AgentStartRequest`, `prov-01-s1-agent-port/AgentCapability`,
  `prov-01-s1-agent-port/AgentTerminalReason`, `prov-01-s1-agent-port/AgentFailureReason`,
  `prov-00-s1-capability-attestation/CapabilityAttestation`, and (fixture-only)
  `prov-04-s1-execution-host-port/WorkerHandle`.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. The `evidence` names
the exact test id or command and the result it produces.

- **AC-1** `MockAgentProvider` implements `prov-01-s1-agent-port/AgentProvider` and a full-arm
  demonstration script emits, in order, all seven `AgentEvent` arms `linked`, `progress`,
  `approval-requested`, `tool-observed`, `guardian-review`, `degraded`, and `terminal` (the `degraded`
  arm carries an `AgentFailure`; the script demonstrates the complete arm set, not a happy path), plus
  `answerApproval` returns an `ApprovalAnswerResult` and `stopObserving` returns an
  `AgentReleaseResult` - evidence: `mock-agent-arms.unit.test.ts` drives the scripted session, collects
  the `observe` stream, and asserts the seven `AgentEvent.type` discriminants appear and the two
  operation results are returned.
- **AC-2** A degraded script emits a `degraded` `AgentEvent` whose `failure.reason` is each exercised
  `AgentFailureReason` token (`agent-capability-unattested`, `agent-linkage-lost`,
  `approval-relay-unattested`, `approval-answer-channel-lost`, `agent-resume-unattested`,
  `guardian-review-untrusted`, `host-parentage-unproven`) and a `terminal` arm carries a
  `provider-lost`/`host-lost` `AgentTerminalReason` - evidence: `mock-agent-degraded.unit.test.ts`
  parameterizes over the token set and asserts each `AgentFailure.reason` and each terminal reason is
  emitted by the named scenario.
- **AC-3** `agentConformance` passes a conformant `MockAgentProvider` whose attested capabilities
  (`emitsStructuredToolExit`, `emitsGuardianReview`, `canRelayApproval`,
  `canPersistApprovalAnswerChannel`, `canResumeOwned`, `preservesHostProcessParentage`) are each backed
  by a positively-and-freshly-attested `CapabilityAttestation<AgentCapability>` and by matching emitted
  behavior - evidence: `agent-conformance.conformance.test.ts` runs `agentConformance` against the
  conformant mock and asserts a pass result enumerating all six capability checks.
- **AC-4** `agentConformance` FAILS a deliberately broken provider that emits a `tool-observed` with no
  structured tool exit (empty `outputRef`), flagging `structured-tool-exit-missing` /
  `tool-output-ref-missing` - evidence: `agent-conformance-broken.conformance.test.ts` constructs the
  broken provider from its own failing fixture and asserts `agentConformance` returns a failure naming
  those tokens (a passing suite here is itself a failure).
- **AC-5** `agentConformance` FAILS a provider that emits an untrusted Guardian review
  (`GuardianReviewObserved.stable === false`), flagging `guardian-review-untrusted`, and FAILS a
  provider whose `terminal` reason is ambiguous, flagging `agent-terminal-ambiguous` - evidence:
  `agent-conformance-broken.conformance.test.ts` asserts both broken fixtures produce a conformance
  failure naming the respective token.
- **AC-6** `agentConformance` treats a stale or negative `CapabilityAttestation<AgentCapability>` as
  absent and FAILS the provider with `agent-capability-unattested`; the approval-relay and resume checks
  likewise fail their providers with `approval-relay-unattested` / `approval-answer-channel-lost` and
  `agent-resume-unattested`, and the host-parentage check fails with `host-parentage-unproven` - evidence:
  `agent-conformance-capability.conformance.test.ts` parameterizes over the
  `{stale, negative}` × `{attestation, relay, answer-channel, resume, host-parentage}` matrix and
  asserts each yields the named failure token.
- **AC-7** `agentIncidentFixtures` provides named adversarial incident-replay inputs, each a frozen
  `{ events: AgentEvent[]; attestations: CapabilityAttestation<AgentCapability>[] }` record, and every
  fixture's events typecheck against `prov-01-s1-agent-port/AgentEvent` and its attestations against
  `prov-00-s1-capability-attestation/CapabilityAttestation` - evidence:
  `agent-incident-fixtures.unit.test.ts` iterates the catalog and asserts each record's shape and that
  the `MockAgentProvider` can replay each fixture's event sequence through `observe`.
- **AC-8** `MockAgentProvider`, `agentConformance`, and `agentIncidentFixtures` are importable from the
  `testkit` package public entrypoint (not a private module path), and a `WorkerHandle` fixture plus an
  `AgentStartRequest` fixture construct without an impossible field combination - evidence:
  `agent-testkit-public-import.unit.test.ts` imports the three symbols from the `testkit` entrypoint and
  constructs a `MockAgentProvider` from an `AgentStartRequest` built on the minimal `WorkerHandle`
  fixture.
- **AC-9** `packages/testkit/src/agent` and `packages/testkit/src/fixtures/agent` import only `sdk` —
  no Codex client, no MCP-server runtime, no network/process module, and no `provider-*` package -
  evidence: `pnpm deps` over the testkit boundary plus the sweep
  `grep -REn "from \"(execa|child_process|@octokit|node:net|node:http|node:child_process|provider-)" packages/testkit/src/agent packages/testkit/src/fixtures/agent`
  returns zero matches (captured output).

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No
responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| `MockAgentProvider` implements `AgentProvider`; positive seven-arm stream + operation results | AC-1 |
| Degraded/adversarial streams carrying `AgentFailureReason` and `AgentTerminalReason` | AC-2 |
| `agentConformance` passes a conformant mock over all six capability checks | AC-3 |
| Conformance has teeth: broken structured-tool-exit provider fails | AC-4 |
| Conformance has teeth: untrusted Guardian and ambiguous terminal fail | AC-5 |
| Conformance capability-freshness, relay, answer-channel, resume, host-parentage checks fail bad providers | AC-6 |
| `agentIncidentFixtures` adversarial incident-replay inputs (events + attestation sets) | AC-7 |
| `WorkerHandle` fixture + `AgentStartRequest` constructability | AC-8 |
| Public exposure of `MockAgentProvider`, `agentConformance`, `agentIncidentFixtures` | AC-8 |
| `testkit` imports only `sdk` (no Codex/MCP/network/process/`provider-*`) | AC-9 |
| Consumed SDK port types (`AgentProvider`, `AgentEvent`, agent DTOs, `AgentCapability`, `AgentFailureReason`, `AgentTerminalReason`) exercised by name | AC-1, AC-2, AC-7 |
| Consumed `CapabilityAttestation<AgentCapability>` for freshness | AC-3, AC-6, AC-7 |

## Failure and degraded outcomes

The mock exercises the SDK-owned `AgentFailureReason` tokens; each row names the mock scenario that
triggers it and the conformance assertion that proves it. (These tokens are owned by
`prov-01-s1-agent-port`; this story proves the testkit surface emits and catches them.)

| token | trigger (mock scenario) | required behavior (conformance assertion) | proven by |
|---|---|---|---|
| `structured-tool-exit-missing` | `tool-observed` emitted with no structured tool exit | `agentConformance` fails the provider naming the token | AC-4 |
| `tool-output-ref-missing` | `tool-observed` with an empty `outputRef` | `agentConformance` fails the provider naming the token | AC-4 |
| `guardian-review-untrusted` | `guardian-review` with `GuardianReviewObserved.stable === false` | `agentConformance` fails the provider naming the token | AC-5 |
| `agent-terminal-ambiguous` | `terminal` arm with an ambiguous reason | `agentConformance` fails the provider naming the token | AC-5 |
| `agent-capability-unattested` | stale/negative `CapabilityAttestation<AgentCapability>` (treated as absent) | `agentConformance` fails the provider naming the token | AC-6 |
| `approval-relay-unattested` | `canRelayApproval` unattested while approval relay is attempted | `agentConformance` relay check fails naming the token | AC-6 |
| `approval-answer-channel-lost` | answer channel not persistable / lost on `answerApproval` | `agentConformance` answer-channel check fails naming the token | AC-6 |
| `agent-resume-unattested` | `canResumeOwned` unattested while `resumeOwned` is attempted | `agentConformance` resume check fails naming the token | AC-6 |
| `host-parentage-unproven` | `preservesHostProcessParentage` not proven | `agentConformance` host-parentage check fails naming the token | AC-6 |
| `agent-linkage-lost` | `degraded` arm emitted after `linked` is lost | mock degraded-script asserts the `AgentFailure.reason` | AC-2 |

## Quality bar

- Coverage scope and threshold: the mock-agent provider, conformance helpers, and incident-fixture
  catalog modules (`packages/testkit/src/agent/**`, `packages/testkit/src/fixtures/agent/**`) at 90%
  minimum, aiming for 95%. Frozen fixture data is proven by the shape/typecheck assertions in AC-7, not
  by line coverage.
- Coverage command and instrumented lane(s): `pnpm coverage:baseline` instruments the unit and
  conformance-mock lanes for the aggregate gate; for a focused per-story report use
  `pnpm exec vitest run --project unit --coverage --passWithNoTests -- packages/testkit/tests/agent/*.unit.test.ts`
  and `pnpm exec vitest run --project conformance-mock --coverage --passWithNoTests -- packages/testkit/tests/agent/*.conformance.test.ts`.
- Required tests, catalogued by AC and failure row: `mock-agent-arms.unit.test.ts` (AC-1);
  `mock-agent-degraded.unit.test.ts` (AC-2, `agent-linkage-lost` row); `agent-conformance.conformance.test.ts`
  (AC-3); `agent-conformance-broken.conformance.test.ts` (AC-4, AC-5,
  `structured-tool-exit-missing`/`tool-output-ref-missing`/`guardian-review-untrusted`/`agent-terminal-ambiguous`
  rows); `agent-conformance-capability.conformance.test.ts` (AC-6,
  `agent-capability-unattested`/`approval-relay-unattested`/`approval-answer-channel-lost`/`agent-resume-unattested`/`host-parentage-unproven`
  rows); `agent-incident-fixtures.unit.test.ts` (AC-7); `agent-testkit-public-import.unit.test.ts`
  (AC-8); `pnpm deps` + boundary sweep (AC-9).
- Public exposure (import path + public-import test): `MockAgentProvider`, `agentConformance`,
  `agentIncidentFixtures` exported from the `testkit` package public entrypoint per
  `epic0-s4-export-templates/PackageExportConvention`; proven by `agent-testkit-public-import.unit.test.ts`.
- Determinism constraints: mock scripts and incident fixtures are seeded/static and reproducible; the
  mock uses no clock, randomness, I/O, process, or network (`at`/`expiry` strings are fixture-supplied);
  `observe` yields a deterministic, fully-scripted `AgentEvent` sequence.
- Dependency boundaries: `packages/testkit` depends ONLY on `sdk`; it must never appear in any
  production dependency graph and must not import `cli`, `mcp`, any `provider-*`, a Codex client, an
  MCP-server runtime, or network/process modules (`testkit-and-conformance.md`, `dependency-rules.md`).
- File-size budget (lines per file; default soft cap ~200): the mock provider, the conformance helpers,
  and the incident-fixture catalog stay in separate focused files, each ≤ 200 lines.
- Domain non-negotiables: mock success alone is not conformance — a broken Agent provider must fail the
  suite; a capability is trusted only when freshly and positively attested; the worker never receives
  Forge credentials (AD-12); testkit redefines none of the SDK port or attestation types.

## Required reading

- `docs/design/20-sdk-and-packaging/testkit-and-conformance.md`
- `docs/design/20-sdk-and-packaging/provider-ports.md` ("Agent provider")
- `prov-01-s1-agent-port` story contract (the cited port types)
- `prov-00-s1-capability-attestation` story contract (the cited attestation envelope)
- `prov-04-s1-execution-host-port` story contract (the cited `WorkerHandle`, fixture-only)
- `epic0-s4-export-templates` story contract (the `testkit` public entrypoint convention)
- `docs/engineering/test-lanes.md`, `docs/engineering/dependency-policy.md`

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The `packages/testkit` Agent surface: the in-memory `MockAgentProvider` (positive/degraded/adversarial
`AgentEvent` streams), the `agentConformance` helpers (with teeth), and the `agentIncidentFixtures`
catalog (event sequences + attestation sets), exposed on the `testkit` public entrypoint, plus the
evidence pack.

## Evidence pack

- Test name or artifact proving each AC (catalogued above).
- Test name or artifact proving each failure/degraded outcome row.
- Negative fixture for every rejection: the broken-provider fixtures (no structured tool exit / empty
  `outputRef`, untrusted Guardian, ambiguous terminal) that `agentConformance` must FAIL (AC-4, AC-5),
  and the stale/negative attestation and unattested relay/answer-channel/resume/host-parentage providers
  (AC-6) — a green conformance run against these is itself a failure.
- Conformance evidence: recorded/in-memory `agentConformance` transcripts and the `agentIncidentFixtures`
  catalog that core stories replay against the SDK replay engine; no real process, network, or
  credential.
- `pnpm check` result, unless blocked by a named unrelated repository issue.
- Coverage command, instrumented lane(s), and number for the mock/conformance/fixture scope.
- Public-import test result for every exposed shape, imported through the `testkit` entrypoint.
- Boundary/forbidden-symbol sweep: `pnpm deps` plus
  `grep -REn "from \"(execa|child_process|@octokit|node:net|node:http|node:child_process|provider-)" packages/testkit/src/agent packages/testkit/src/fixtures/agent`
  with zero-match output captured.

## Boundaries and STOP conditions

- Package or module boundary: `packages/testkit/src/agent` and `packages/testkit/src/fixtures/agent`
  only; tests under `packages/testkit/tests/agent`.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/testkit/src/agent/**`, `packages/testkit/src/fixtures/agent/**`,
  `packages/testkit/tests/agent/**`.
- Forbidden dependencies: no Codex client, no MCP-server runtime, no network/process module, no
  `provider-*` package, no `cli`/`mcp`; no redefinition of `AgentProvider`, the agent DTOs,
  `AgentEvent`, `CapabilityAttestation`, or `WorkerHandle`.
- STOP when: a requirement needs the SDK replay/projection engine, a real Codex driver, live/real
  attestation, or a port type that `prov-01-s1-agent-port` has not yet frozen — those belong to
  core-01/core-06, Epic 6, or the port story respectively.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 2 - stories](./README.md) · **← Prev:** [prov-01-s1-agent-port - SDK Agent provider port implementation story](./prov-01-s1-agent-port.md) · **Next →:** [prov-02-s1-forge-port - SDK Forge provider port implementation story](./prov-02-s1-forge-port.md)

<!-- /DOCS-NAV -->
