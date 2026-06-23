# Implementer Prompt: edge-01-s2-cli-mcp-parity-smoke

## Assigned Routing

- Source story id: `edge-01-s2-cli-mcp-parity-smoke`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`.
- Model class: `strong-coder`.
- Effort: `high`.
- Suggested-tier floor: `standard`.
- Reasoning tier: `elevated`.
- Routing rationale: edge-01-s2-cli-mcp-parity-smoke covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13 and carries cross-package CLI/MCP/testkit smoke with dependency-boundary sweeps and public testkit exposure. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Exact Task

Implement source story `edge-01-s2-cli-mcp-parity-smoke` for epic `epic-3-core-runtime-spine`. Deliver exactly the outcome in the ready source contract and nothing outside it:

The `packages/cli/src/operator-smoke/` thin CLI envelope builders (internal), the
`packages/mcp/src/operator-smoke/` thin MCP envelope builders (internal), and the
`packages/testkit/src/operator/` + `packages/testkit/src/fixtures/operator/` structural fakes and
fixture builders (public via `testkit` entrypoint) — consuming `edge-01-s1` types by injection,
importing `sdk` only in production source, exercised by hermetic `*.unit.test.ts` tests that prove
byte-parity, one-call-one-audit, the envelope-error path, and dependency-boundary invariants — plus
the evidence pack.

## Why It Matters

- Covers signals: "CLI and MCP command parity over the shared operator command envelope (executable
  smoke part)" — the `edge-01` Epic-3 signal's smoke half (see story DAG `split` disposition).
- Depends on: `edge-01-s1-operator-command-contract` (produces all envelope/result/param/view
  types consumed here); `core-01-s1-event-contracts` (produces `RunProjections` and `RunEventCursor`
  used as fixture value types in the inspect-run smoke).
- Depended on by: Epic 7 operator-production stories (consume this story's testkit fakes + the
  envelope substrate).
- Shared shapes consumed:
  - `edge-01-s1-operator-command-contract/OperatorCommandEnvelope`,
    `OperatorCommandResult`, `OperatorActionRecordedPayload`, `OperatorActionKind`,
    `OperatorActorRef`, `OsUserOperatorActorRef`, `OperatorCommandTarget`,
    `OperatorEnvelopeError`, `OperatorEnvelopeErrorCode`, `OperatorEventRef`,
    `PreviewRunParams`, `PreviewRunView`, `StartRunParams`, `RunStartedView`,
    `InspectRunParams`, `RunInspectionView`.
  - `core-01-s1-event-contracts/RunProjections`, `RunEventCursor`.

The DAG dependents for this story are: none inside Epic 3. Preserve the producer/consumer shape boundaries named above so later stories can consume committed dependency inputs without re-declaring or widening this story's scope.

## Required Reading

- `docs/implementation/epics/epic-3-core-runtime-spine/stories/edge-01-s2-cli-mcp-parity-smoke.md` — source story contract for `edge-01-s2-cli-mcp-parity-smoke`.
- `docs/implementation/epics/epic-3-core-runtime-spine/story-dag.md` — frozen DAG row, dependencies, owned pathset, wave, and suggested-tier floor for `edge-01-s2-cli-mcp-parity-smoke`.
- `docs/design/30-domain-reference/edge/operator-surface/command-surface-and-envelopes.md` —
  full parity rule, the preview/start/inspect parity-table rows, the `OperatorCommandEnvelope`
  fields that differ by surface, the envelope-error carry-and-reject path, the one-call/one-audit
  invariant.
- `docs/design/30-domain-reference/edge/operator-surface/README.md` §4 (core decisions) and §9
  (testing strategy) — fake OperatorControlPort, fake OS identity, deterministic clocks, no real
  processes.
- `docs/design/20-sdk-and-packaging/cli-and-mcp-wrappers.md` — CLI/MCP thin-adapter mandate.
- `docs/design/20-sdk-and-packaging/dependency-rules.md` — the `cli`/`mcp → sdk only` production
  rule; `testkit` is test-only; determinism port injection.
- `edge-01-s1-operator-command-contract` story contract (the shapes this story consumes and cites).
- `core-01-s1-event-contracts` story contract (`RunProjections`, `RunEventCursor` fixture types).
- `epic0-s4-export-templates` story contract (`PackageExportConvention` for the `testkit`
  entrypoint).
- `docs/engineering/test-lanes.md` (the hermetic `*.unit.test.ts` lane; smoke tests for this story
  run as `*.unit.test.ts`, not `*.smoke.test.ts` — `*.smoke.test.ts` is excluded from `pnpm check`
  and is for real-process tests, which this story must not use).

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.
- `{{DEPENDENCY_COMMITS}}` — runtime slot for committed dependency story inputs when this story has dependencies.

## Acceptance Criteria

Source story: `docs/implementation/epics/epic-3-core-runtime-spine/stories/edge-01-s2-cli-mcp-parity-smoke.md`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`.

Each AC is a single falsifiable assertion, self-contained (the set enumerated here), tracing to
a design line. Each rejection AC names its own failing fixture. `evidence` names the exact test id
and the result it produces.

- **AC-1** For `preview-run`: given a fixed `PreviewRunParams` fixture, a deterministic `Clock`
  returning `"2026-01-01T00:00:00.000Z"`, a deterministic `IdGenerator` returning `"action-001"`,
  a shared `OsUserOperatorActorRef` fixture (with `username: "testuser"`, `hostname: "testhost"`,
  `processId: 1`), and a `OperatorCommandTarget` fixture, the CLI builder produces an
  `OperatorCommandEnvelope<PreviewRunParams>` with `surface: "cli"` and the MCP builder produces an
  `OperatorCommandEnvelope<PreviewRunParams>` with `surface: "mcp"` — and when both envelopes are
  serialized to JSON with `surface`, `surfaceClient`, `processId`, `terminalRef`, `uid`, `gid`,
  `groups`, `hostname`, and `requestedAt` fields removed, the resulting byte strings are identical.
  — evidence: `cli-mcp-parity-preview.unit.test.ts` constructs both envelopes with the shared
  fixture, strips the named fields, and asserts `JSON.stringify(stripped_cli) ===
  JSON.stringify(stripped_mcp)`.

- **AC-2** For `start-run`: the same parity assertion holds for `StartRunParams` — CLI builder with
  `surface: "cli"` vs MCP builder with `surface: "mcp"`, byte-identical after stripping `surface`,
  `surfaceClient`, `processId`, `terminalRef`, `uid`, `gid`, `groups`, `hostname`, and `requestedAt`.
  — evidence: `cli-mcp-parity-start.unit.test.ts` constructs both envelopes and asserts stripped
  JSON equality.

- **AC-3** For `inspect-run`: the same parity assertion holds for `InspectRunParams` (including an
  `InspectRunParams` fixture with a `core-01-s1-event-contracts/RunEventCursor` value). — evidence:
  `cli-mcp-parity-inspect.unit.test.ts` constructs both envelopes and asserts stripped JSON
  equality.

- **AC-4** For each of the three actions (`preview-run`, `start-run`, `inspect-run`): invoking the
  CLI builder with a valid params fixture calls the `FakeOperatorControlSurface` matching method
  exactly once (no more, no fewer), and the fake records exactly one call with the forwarded
  envelope. — evidence: `cli-one-call-per-action.unit.test.ts` exercises each action, checks
  `fake.callsFor("preview-run").length === 1`, `fake.callsFor("start-run").length === 1`,
  `fake.callsFor("inspect-run").length === 1` after a single builder invocation each.

- **AC-5** For each of the three actions: invoking the MCP builder with a valid params fixture calls
  the `FakeOperatorControlSurface` matching method exactly once; the fake records exactly one call.
  — evidence: `mcp-one-call-per-action.unit.test.ts` exercises each action, asserts call count = 1
  per action.

- **AC-6** For each of the three actions: the `FakeOperatorControlSurface` is configured to return
  an `OperatorCommandResult` with `operatorEventRef` set (writable path); after the CLI builder
  invocation, the returned `OperatorCommandResult.operatorEventRef` equals the configured
  `OperatorEventRef` fixture (including `eventId`, `sequence`, `payloadDigest`,
  `type: "OperatorActionRecorded"`). — evidence: `cli-audit-event-ref.unit.test.ts` configures the
  fake to return a specific `OperatorEventRef`, invokes each builder, and asserts the returned
  `operatorEventRef` equals the fixture exactly.

- **AC-7** Determinism: given identical inputs (same params, actor, target, clock, id-generator),
  the CLI builder for each action produces the same `OperatorCommandEnvelope` bytes on two
  successive calls (no ambient `Date.now`, `new Date`, `Math.random`, or `crypto.randomUUID` in
  the builder). — evidence: `cli-envelope-determinism.unit.test.ts` calls each CLI builder twice
  with the same injected fixtures and asserts `JSON.stringify(env1) === JSON.stringify(env2)`.

- **AC-8** Envelope-error path — `params-invalid`: when the `params` fixture carries a
  `params-invalid` `OperatorEnvelopeError` (simulating a params validation failure at transport
  parse time), the CLI builder for `preview-run` still calls the `FakeOperatorControlSurface`
  `previewRun` method exactly once, the forwarded envelope contains `envelopeErrors` with that
  error, and the fake is configured to return `OperatorCommandResult` with `status: "rejected"`;
  the returned result's `status` is `"rejected"` and `errors` is non-empty. — evidence:
  `cli-envelope-error-reject.unit.test.ts` constructs a params fixture with an injected
  `OperatorEnvelopeError({ code: "params-invalid", field: "workSource", message: "missing" })`,
  invokes the CLI preview builder, asserts `fake.callsFor("preview-run").length === 1` and
  `result.status === "rejected"`.

- **AC-9** Dependency sweep — CLI production source: `packages/cli/src/operator-smoke/` contains
  no import of `testkit` (directly or transitively under that path root). — evidence:
  `grep -REn "testkit" packages/cli/src/operator-smoke/` returns zero matches (exit code 1, no
  lines), captured in the evidence pack.

- **AC-10** Dependency sweep — MCP production source: `packages/mcp/src/operator-smoke/` contains
  no import of `testkit`. — evidence: `grep -REn "testkit" packages/mcp/src/operator-smoke/`
  returns zero matches (exit code 1, no lines), captured in the evidence pack.

- **AC-11** Testkit public exposure — `FakeOperatorControlSurface`, `FakeOsIdentityResolver`,
  `DeterministicClock`, `DeterministicIdGenerator`, and the fixture builders (`buildFixtureRunProjections`,
  `buildFixtureRunEventCursor`) are each importable from the `testkit` package public entrypoint
  (not a private module path), per `epic0-s4-export-templates/PackageExportConvention`. — evidence:
  `testkit-operator-public-import.unit.test.ts` imports each of the six names from the `testkit`
  entrypoint and constructs one instance of each to confirm the import is resolvable and the exported
  type is constructible.

- **AC-12** CLI and MCP production builders are internal (not re-exported on the `sdk` or `cli`/`mcp`
  public entrypoints); only the testkit fakes are public (via `testkit`). The builder functions
  are consumed only in tests and in production composition wiring (Epic 7). — evidence: the
  forbidden-symbol sweep below over `packages/sdk/src/` reports zero matches for the builder
  function names; and `packages/cli/src/operator-smoke/` and `packages/mcp/src/operator-smoke/`
  contain no `export * from` or re-export lines — proven by the runnable recipe in the
  Forbidden-symbol sweeps section (AC-12 re-export sweep).

- **AC-13** Identity-unavailable path: given a `FakeOsIdentityResolver` configured to return an
  `edge-01-s1-operator-command-contract/UnavailableOsUserOperatorActorRef` fixture (i.e. the fake
  OS-identity resolver returns unavailable), the CLI builder for `preview-run` still calls the
  `FakeOperatorControlSurface` `previewRun` method exactly once, and the forwarded envelope's
  `actor.kind === "os-user-unavailable"`. — evidence:
  `cli-identity-unavailable.unit.test.ts` constructs the CLI preview builder with a
  `FakeOsIdentityResolver` returning an `UnavailableOsUserOperatorActorRef` fixture, invokes the
  builder, asserts `fake.callsFor("preview-run").length === 1` and
  `result.envelope.actor.kind === "os-user-unavailable"`.

## Allowed Writes

Source story: `docs/implementation/epics/epic-3-core-runtime-spine/stories/edge-01-s2-cli-mcp-parity-smoke.md`. Owned pathset from the frozen DAG and source contract:

- `packages/testkit/src/operator/**`
- `packages/testkit/src/fixtures/operator/**`
- `packages/cli/src/operator-smoke/**`
- `packages/cli/tests/operator/**`
- `packages/mcp/src/operator-smoke/**`
- `packages/mcp/tests/operator/**`

Every other write is forbidden, including this execution package, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, commits, pushes, PRs, and merges.

## Dependency Inputs

Direct dependency story ids: `edge-01-s1-operator-command-contract`, `core-01-s1-event-contracts`.

- Covers signals: "CLI and MCP command parity over the shared operator command envelope (executable
  smoke part)" — the `edge-01` Epic-3 signal's smoke half (see story DAG `split` disposition).
- Depends on: `edge-01-s1-operator-command-contract` (produces all envelope/result/param/view
  types consumed here); `core-01-s1-event-contracts` (produces `RunProjections` and `RunEventCursor`
  used as fixture value types in the inspect-run smoke).
- Depended on by: Epic 7 operator-production stories (consume this story's testkit fakes + the
  envelope substrate).
- Shared shapes consumed:
  - `edge-01-s1-operator-command-contract/OperatorCommandEnvelope`,
    `OperatorCommandResult`, `OperatorActionRecordedPayload`, `OperatorActionKind`,
    `OperatorActorRef`, `OsUserOperatorActorRef`, `OperatorCommandTarget`,
    `OperatorEnvelopeError`, `OperatorEnvelopeErrorCode`, `OperatorEventRef`,
    `PreviewRunParams`, `PreviewRunView`, `StartRunParams`, `RunStartedView`,
    `InspectRunParams`, `RunInspectionView`.
  - `core-01-s1-event-contracts/RunProjections`, `RunEventCursor`.

Use `{{DEPENDENCY_COMMITS}}` for dependency commits that can only exist during execution. Import only producer-owned public shapes and paths named by the DAG or source contract.

## Non-Goals And STOP Conditions

### Source Out Of Scope

- The `OperatorControlPort` named interface (11 methods, full production type) — Epic 7
  (`edge-01-s1-operator-command-contract` defers this; scope decision 3 in the story DAG).
- Any action beyond `preview-run`, `start-run`, `inspect-run` — deferred to Epic 7.
- Real OS identity resolution — Epic 7 production wiring.
- Real process/filesystem/network/provider calls — the testing strategy for this story is a
  hermetic fake; no real transports used.
- Production composition wiring (wiring concrete providers, storage, the real `OperatorControlPort`
  implementation) — Epic 7.
- The `wait-run`, `approval-decision`, `stop-run`, `handoff-run`, `override-field`,
  `request-recovery`, `explain`, `attention-ack` actions — Epic 7.
- `OperatorActionRecorded` append to a real `RunWriter` — the Control plane appends; the edge never
  obtains a `RunWriter` (design §4 core decisions; this story uses a fake surface only).
- The full `AttentionNotice[]` and `ExplanationView` response fields (reference types owned by later
  epics) — deferred to Epic 7; the smoke's result shape uses the subset fields that resolve from
  `core-01`/`edge-01` only.

### Source Boundaries And STOP Conditions

- Package or module boundary: `packages/testkit/src/operator/`,
  `packages/testkit/src/fixtures/operator/`, `packages/cli/src/operator-smoke/`,
  `packages/cli/tests/operator/`, `packages/mcp/src/operator-smoke/`,
  `packages/mcp/tests/operator/` only.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly
  this):
  `packages/testkit/src/operator/**`,
  `packages/testkit/src/fixtures/operator/**`,
  `packages/cli/src/operator-smoke/**`,
  `packages/cli/tests/operator/**`,
  `packages/mcp/src/operator-smoke/**`,
  `packages/mcp/tests/operator/**`.
- Forbidden dependencies:
  - `packages/cli/src/operator-smoke/` and `packages/mcp/src/operator-smoke/`: no `testkit`, no
    `provider-*`, no driver, no `execa`, no `child_process`, no MCP/CLI runtime (production source
    imports `sdk` only).
  - `packages/testkit/src/operator/` and `packages/testkit/src/fixtures/operator/`: no `cli`, no
    `mcp`, no `provider-*` (testkit imports `sdk` only per `dependency-rules.md`).
  - No ambient `Date.now`, `new Date`, `Math.random`, or `crypto.randomUUID` in production builders.
  - No real `RunWriter` usage anywhere in this story's scope.
- STOP when:
  - The full named `OperatorControlPort` interface (11 methods) is reached — Epic 7.
  - Any action beyond `preview-run`, `start-run`, or `inspect-run` is needed.
  - Real OS identity resolution, real MCP server lifecycle, real CLI process/terminal interaction,
    real filesystem/network, or any concrete driver is needed — Epic 7 production wiring.
  - The `OperatorActionRecorded` write path to a real `RunWriter` is needed — the edge never owns
    that; the Control plane does (Epic 7 and beyond).
  - A type from a later epic (`PolicyGrantScope`, approval params, recovery params, attention/
    explanation view types beyond what `edge-01-s1` has already declared) is needed — escalate as
    a design-sequencing gap, do not invent.

Also stop and report if dependency inputs are missing, required writes fall outside the allowed pathset, a source gap blocks implementation, or any AC would need reinterpretation.

## Implementation Constraints

### Source Responsibilities

- Implement thin CLI envelope builders for `preview-run`, `start-run`, `inspect-run` in
  `packages/cli/src/operator-smoke/`: receive params, actor, target, clock, id-generator, and the
  structural fake control surface by injection; produce an
  `edge-01-s1-operator-command-contract/OperatorCommandEnvelope<TParams>` with `surface: "cli"`;
  call the matching fake control surface method exactly once; return the
  `edge-01-s1-operator-command-contract/OperatorCommandResult`.
- Implement thin MCP envelope builders for the same three actions in
  `packages/mcp/src/operator-smoke/`: structurally identical to the CLI builders but with
  `surface: "mcp"` and `surfaceClient: "mcp"` in the actor.
- Guarantee that for the same logical command (same params, same target, same actor identity
  modulo surface fields, same clock, same ids), the CLI and MCP builders produce envelope bytes that
  are byte-identical except for `surface`, `surfaceClient`, terminal/process fields (`processId`,
  `terminalRef`, `uid`, `gid`, `groups`, `hostname` where they differ), and `requestedAt`.
- Guarantee that each action (valid params or envelope-error path) results in exactly one call to the
  matching fake control surface method and exactly one `OperatorActionRecorded` audit event from the
  fake.
- Carry `envelopeErrors` on the envelope and still forward to the fake control surface on the
  envelope-error path; the fake records `resultIntent = "reject"` in that case.
- Return `operatorEventRef` from the `OperatorCommandResult` when the fake surface is configured to
  return it (writable path).
- Provide `FakeOperatorControlSurface`, `FakeOsIdentityResolver`, `DeterministicClock`,
  `DeterministicIdGenerator`, and the two fixture builders in `packages/testkit/src/operator/` and
  `packages/testkit/src/fixtures/operator/`, exported from the `testkit` public entrypoint.

### Source Spec Surface

What the normative design defines and the implementation must expose or consume, by name:

**Production CLI/MCP builders (packages/cli and packages/mcp; inject-only, sdk-import-only):**

- Functions / entry points:
  - `buildPreviewRunEnvelope(params, actor, target, clock, ids): OperatorCommandEnvelope<PreviewRunParams>`
  - `buildStartRunEnvelope(params, actor, target, clock, ids): OperatorCommandEnvelope<StartRunParams>`
  - `buildInspectRunEnvelope(params, actor, target, clock, ids): OperatorCommandEnvelope<InspectRunParams>`
  - (One set under `packages/cli/src/operator-smoke/`; a structurally identical set under
    `packages/mcp/src/operator-smoke/` — same shapes, different `surface` field value.)
- Injected port interfaces (structural, not named SDK interfaces in this story):
  - `FakeControlSurface` — `{ previewRun(env): OperatorCommandResult<PreviewRunView>, startRun(env): OperatorCommandResult<RunStartedView>, inspectRun(env): OperatorCommandResult<RunInspectionView> }` — structural three-method fake; no `OperatorControlPort` named interface declared here (Epic 7 owns that).
  - `OsIdentityResolver` — `(surface: OperatorSurface) => OperatorActorRef` — injected identity function.
  - `Clock` — `() => string` — injected ISO-string timestamp function.
  - `IdGenerator` — `() => string` — injected action-id and idempotency-key function.

**Testkit structural fakes (packages/testkit; public via `testkit` entrypoint):**

- `FakeOperatorControlSurface` — a structural fake implementing the three-method surface above;
  records calls (per-call capture: `action`, `envelope`); configures stub results per action kind;
  provides `callCount`, `lastCall`, `callsFor(kind)` inspection.
- `FakeOsIdentityResolver` — returns a deterministic `OsUserOperatorActorRef` fixture with
  configurable `surfaceClient`; never reads real OS identity.
- `DeterministicClock` — returns a fixed ISO string; configurable per-call sequence if needed.
- `DeterministicIdGenerator` — returns predictable ids (e.g. a counter-based string) per call.
- Fixture `RunProjections` builder — constructs a `core-01-s1/RunProjections` value for use as
  fixture data in inspect-run smoke tests (does not redeclare `RunProjections` fields).
- Fixture `RunEventCursor` builder — constructs a `core-01-s1/RunEventCursor` value for use as
  fixture data.

**Shared shapes consumed (cited by producer story, not redeclared):**
- `edge-01-s1-operator-command-contract/OperatorCommandEnvelope<TParams>`
- `edge-01-s1-operator-command-contract/OperatorCommandResult<TView>`
- `edge-01-s1-operator-command-contract/OperatorActionRecordedPayload` (payload type)
- `edge-01-s1-operator-command-contract/OperatorActionKind`
- `edge-01-s1-operator-command-contract/OperatorActorRef`
- `edge-01-s1-operator-command-contract/OsUserOperatorActorRef`
- `edge-01-s1-operator-command-contract/OperatorCommandTarget`
- `edge-01-s1-operator-command-contract/OperatorEnvelopeError`
- `edge-01-s1-operator-command-contract/OperatorEnvelopeErrorCode`
- `edge-01-s1-operator-command-contract/OperatorEventRef`
- `edge-01-s1-operator-command-contract/PreviewRunParams`
- `edge-01-s1-operator-command-contract/PreviewRunView`
- `edge-01-s1-operator-command-contract/StartRunParams`
- `edge-01-s1-operator-command-contract/RunStartedView`
- `edge-01-s1-operator-command-contract/InspectRunParams`
- `edge-01-s1-operator-command-contract/RunInspectionView`
- `core-01-s1-event-contracts/RunProjections` (fixture value type for inspect smoke)
- `core-01-s1-event-contracts/RunEventCursor` (fixture value type for inspect smoke)

**Events / audit payloads:**
- `OperatorActionRecorded` — recorded by the fake control surface; its `OperatorEventRef` is
  returned in `OperatorCommandResult.operatorEventRef` when the run log is writable.

**Failure and degraded tokens:**
- `envelope-error-reject` — an envelope carrying `envelopeErrors` (e.g. `params-invalid`) is still
  forwarded to the matching fake control surface call exactly once, which records reject
  (`resultIntent = "reject"`); the result carries the errors.

Done requires every item here present with the design's names, shapes, and semantics. Production
builders (`cli/src/operator-smoke`, `mcp/src/operator-smoke`) import `sdk` only. Only test files
import `testkit`.

Do not introduce implementation choices outside the names, events, failure tokens, determinism rules, boundary rules, import rules, conformance obligations, and safety invariants fixed above.

## Verification

### Source Quality Bar

- Coverage scope and threshold: ≥ 90% branch and line coverage (aim 95%) on the production builder
  modules at `packages/cli/src/operator-smoke/` and `packages/mcp/src/operator-smoke/`; the testkit
  fakes at `packages/testkit/src/operator/` and `packages/testkit/src/fixtures/operator/` are
  covered by AC-4/AC-5/AC-11 tests. Coverage excludes the test files themselves.
- Coverage command and instrumented lane(s):
  `pnpm exec vitest run --project unit --coverage --coverage.include "packages/cli/src/operator-smoke/**" --coverage.include "packages/mcp/src/operator-smoke/**" --coverage.include "packages/testkit/src/operator/**" --coverage.include "packages/testkit/src/fixtures/operator/**" -- packages/cli/tests/operator/*.unit.test.ts packages/mcp/tests/operator/*.unit.test.ts packages/testkit/tests/operator/*.unit.test.ts`
  Lane: `*.unit.test.ts` (hermetic; zero real process/network/filesystem).
- Required tests, catalogued by AC and failure row:
  - `cli-mcp-parity-preview.unit.test.ts` (AC-1) — under `packages/cli/tests/operator/` or
    `packages/mcp/tests/operator/` (co-located parity test).
  - `cli-mcp-parity-start.unit.test.ts` (AC-2).
  - `cli-mcp-parity-inspect.unit.test.ts` (AC-3).
  - `cli-one-call-per-action.unit.test.ts` (AC-4) — under `packages/cli/tests/operator/`.
  - `mcp-one-call-per-action.unit.test.ts` (AC-5) — under `packages/mcp/tests/operator/`.
  - `cli-audit-event-ref.unit.test.ts` (AC-6) — under `packages/cli/tests/operator/`.
  - `cli-envelope-determinism.unit.test.ts` (AC-7) — under `packages/cli/tests/operator/`.
  - `cli-envelope-error-reject.unit.test.ts` (AC-8, `envelope-error-reject` failure row) — under
    `packages/cli/tests/operator/`; uses a negative fixture constructing an envelope with an
    `OperatorEnvelopeError({ code: "params-invalid", ... })`.
  - `testkit-operator-public-import.unit.test.ts` (AC-11) — under `packages/testkit/tests/operator/`
    (or equivalent testkit test path); imports each of the six public testkit names from the
    `testkit` entrypoint and constructs one instance.
  - `cli-identity-unavailable.unit.test.ts` (AC-13) — under `packages/cli/tests/operator/`; uses
    a `FakeOsIdentityResolver` returning `UnavailableOsUserOperatorActorRef` and asserts one fake
    call plus `actor.kind === "os-user-unavailable"`.
  - Dependency sweeps are shell commands (AC-9, AC-10, AC-12), not test files; their output is
    captured into the evidence pack.
- Public exposure (import path + public-import test):
  - `FakeOperatorControlSurface`, `FakeOsIdentityResolver`, `DeterministicClock`,
    `DeterministicIdGenerator`, `buildFixtureRunProjections`, `buildFixtureRunEventCursor` — all
    exported from the `testkit` package public entrypoint (barrel + `exports` per
    `epic0-s4-export-templates/PackageExportConvention`); proven by
    `testkit-operator-public-import.unit.test.ts` (AC-11).
  - CLI builders (`buildPreviewRunEnvelope`, `buildStartRunEnvelope`, `buildInspectRunEnvelope` in
    `packages/cli/src/operator-smoke/`) — **internal only** (not re-exported on any public
    entrypoint); consumed only in tests and in future Epic 7 production wiring.
  - MCP builders (same three names in `packages/mcp/src/operator-smoke/`) — **internal only**;
    same constraint.
  - "none — no public `sdk` surface" for this story: the envelope/result types themselves are public
    SDK shapes owned by `edge-01-s1`; this story adds no new public `sdk` exports.
- Determinism constraints: all injected — clock via `Clock: () => string`, action/idempotency ids
  via `IdGenerator: () => string`, OS identity via `OsIdentityResolver`. No ambient `Date.now`,
  `new Date`, `Math.random`, or `crypto.randomUUID` in `packages/cli/src/operator-smoke/` or
  `packages/mcp/src/operator-smoke/`. The `paramsDigest` field is a deterministic canonical digest
  of the redacted parameters; the implementation uses a pure deterministic hash function (no
  randomness). Determinism proven by AC-7.
- Dependency boundaries:
  - `packages/cli/src/operator-smoke/` and `packages/mcp/src/operator-smoke/` import `sdk` only
    (the `edge-01-s1` envelope/result/param types and the injected port structural types); they
    NEVER import `testkit`, `provider-*`, or any concrete driver (per `dependency-rules.md`).
  - `packages/testkit/src/operator/` and `packages/testkit/src/fixtures/operator/` import `sdk`
    only (no `cli`, no `mcp`, no `provider-*`).
  - Test files (`packages/cli/tests/operator/`, `packages/mcp/tests/operator/`) may import `sdk`,
    `testkit`, and the production builders under their respective `src/`; they are exempt from the
    production-testkit rule.
- File-size budget (lines per file; default soft cap ~200):
  - `packages/cli/src/operator-smoke/`: split across `preview-run.ts`, `start-run.ts`,
    `inspect-run.ts`, and a shared `envelope-builder.ts` helper, each ≤ 200 lines.
  - `packages/mcp/src/operator-smoke/`: same structure, ≤ 200 lines per file.
  - `packages/testkit/src/operator/fake-control-surface.ts` ≤ 200 lines.
  - `packages/testkit/src/operator/fake-identity-resolver.ts` ≤ 100 lines.
  - `packages/testkit/src/operator/deterministic-clock.ts` ≤ 60 lines.
  - `packages/testkit/src/operator/deterministic-id-generator.ts` ≤ 60 lines.
  - `packages/testkit/src/fixtures/operator/fixture-projections.ts` ≤ 120 lines.
  - `packages/testkit/src/fixtures/operator/fixture-cursor.ts` ≤ 60 lines.
- Domain non-negotiables:
  - Each operator action results in exactly one fake control surface call — never zero, never two.
  - The edge never calls `RunWriter` directly; `OperatorActionRecorded` is recorded by the control
    surface (fake here, real Control plane in Epic 7).
  - Envelope-error path is not a short-circuit: the builder still invokes the fake once with the
    error-bearing envelope; no domain action runs on the fake-reject path.
  - CLI production source and MCP production source never import `testkit` — proven by the
    dependency sweeps (AC-9, AC-10).
  - Parity bytes are stable: same logical command → same bytes (modulo the named surface fields).

### Forbidden-symbol sweeps (runnable recipes)

**AC-9 sweep (CLI production source):**
```sh
grep -REn "testkit" packages/cli/src/operator-smoke/
```
- Path root: `packages/cli/src/operator-smoke/`.
- Forbidden token: `testkit`.
- Expected result: zero matches (exit code 1, no lines). A match means a production source has
  imported the testkit, violating the dependency rule.

**AC-10 sweep (MCP production source):**
```sh
grep -REn "testkit" packages/mcp/src/operator-smoke/
```
- Path root: `packages/mcp/src/operator-smoke/`.
- Forbidden token: `testkit`.
- Expected result: zero matches (exit code 1, no lines).

**AC-12 sweep (SDK entrypoint re-export check):**
```sh
grep -REn "buildPreviewRunEnvelope\|buildStartRunEnvelope\|buildInspectRunEnvelope" packages/sdk/src/
```
- Path root: `packages/sdk/src/`.
- Forbidden tokens: `buildPreviewRunEnvelope`, `buildStartRunEnvelope`, `buildInspectRunEnvelope`.
- Expected result: zero matches (exit code 1, no lines). The builder functions are internal only.

**AC-12 re-export sweep (CLI and MCP operator-smoke barrel check):**
```sh
grep -REn "export \*|export \{[^}]*\} from" packages/cli/src/operator-smoke/ packages/mcp/src/operator-smoke/
```
- Path roots: `packages/cli/src/operator-smoke/`, `packages/mcp/src/operator-smoke/`.
- Forbidden patterns: `export *` (wildcard re-export) and `export { ... } from` (named re-export).
- Expected result: zero matches (exit code 1, no lines). The builder modules are internal only and
  must not barrel-re-export their symbols onto any public entrypoint.

### Source Evidence Pack

- Test names proving each AC: `cli-mcp-parity-preview.unit.test.ts` (AC-1),
  `cli-mcp-parity-start.unit.test.ts` (AC-2), `cli-mcp-parity-inspect.unit.test.ts` (AC-3),
  `cli-one-call-per-action.unit.test.ts` (AC-4), `mcp-one-call-per-action.unit.test.ts` (AC-5),
  `cli-audit-event-ref.unit.test.ts` (AC-6), `cli-envelope-determinism.unit.test.ts` (AC-7),
  `cli-envelope-error-reject.unit.test.ts` (AC-8, and the `envelope-error-reject` failure row),
  `testkit-operator-public-import.unit.test.ts` (AC-11),
  `cli-identity-unavailable.unit.test.ts` (AC-13, and the `identity-unavailable` failure row).
- Negative fixture for the `envelope-error-reject` row: an `OperatorEnvelopeError` fixture with
  `code: "params-invalid"` injected into the builder's envelope construction in
  `cli-envelope-error-reject.unit.test.ts` — asserts `result.status === "rejected"` and
  `fake.callsFor("preview-run").length === 1`.
- `pnpm check` result, unless blocked by a named unrelated repository issue.
- Coverage command (stated above), instrumented lane `*.unit.test.ts`, number ≥ 90%.
- Public-import test result: `testkit-operator-public-import.unit.test.ts` — imports six names from
  `testkit` entrypoint and constructs each (AC-11).
- Dependency sweep outputs (AC-9, AC-10, AC-12): the four `grep` commands above (including the
  AC-12 re-export sweep), path roots, forbidden-token/pattern sets, and zero-match output (exit
  code 1, no lines), captured.
- No conformance or runtime evidence required — this story uses no real process, filesystem,
  network, driver, or credential. The fakes are structural in-process objects.

Run the targeted commands and `pnpm check`, then report exact command output or an explicit blocked reason. Do not treat prose-only claims as evidence.

## Delivery Report

Return a report with changed files, AC coverage by `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, tests and checks run, evidence pack, open questions, and blockers. The report is review evidence only; it is not permission to update tracker state or perform delivery actions.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - Core runtime spine](../../../README.md) · **← Prev:** [Reviewer Prompt: edge-01-s1-operator-command-contract](../edge-01-s1-operator-command-contract/reviewer.md) · **Next →:** [Reviewer Prompt: edge-01-s2-cli-mcp-parity-smoke](./reviewer.md)

<!-- /DOCS-NAV -->
