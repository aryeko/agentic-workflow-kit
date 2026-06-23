---
title: "edge-01-s2-cli-mcp-parity-smoke - CLI and MCP parity smoke implementation story"
id: "edge-01-s2-cli-mcp-parity-smoke"
epic: 3
status: "story: ready"
design:
  - "docs/design/30-domain-reference/edge/operator-surface/command-surface-and-envelopes.md"
  - "docs/design/30-domain-reference/edge/operator-surface/README.md"
  - "docs/design/20-sdk-and-packaging/cli-and-mcp-wrappers.md"
  - "docs/design/20-sdk-and-packaging/dependency-rules.md"
---

# edge-01-s2-cli-mcp-parity-smoke - CLI and MCP Command-Parity Smoke

## Purpose

Prove the mock-backed executable smoke for the `preview-run`, `start-run`, and `inspect-run` actions:
a thin CLI command→envelope builder and a thin MCP tool→envelope builder each produce
byte-identical `edge-01-s1/OperatorCommandEnvelope<TParams>` (modulo the named surface-specific
fields), invoke exactly one injected structural fake control surface call, and produce exactly one
`edge-01-s1/OperatorActionRecorded` audit event — covering the executable-smoke part of the single
edge-01 Epic-3 signal (FR-10; command-parity rule in `command-surface-and-envelopes.md`).

## Normative design

- `docs/design/30-domain-reference/edge/operator-surface/command-surface-and-envelopes.md` — THE
  parity rule ("MCP and CLI must produce the same envelope bytes for the same logical command, except
  for `surface`, `surfaceClient`, terminal/process fields, and `requestedAt`"); the
  preview/start/inspect rows of the parity table; the one-call/one-audit invariant; the
  `envelopeErrors` carry-and-reject path.
- `docs/design/30-domain-reference/edge/operator-surface/README.md` §4 core decisions, §9 testing
  strategy — fake `OperatorControlPort`, fake OS identity resolver, deterministic clocks, fixture run
  projections/events; NO real processes, filesystem, network, provider contracts, concrete drivers, or
  `RunWriter`s.
- `docs/design/20-sdk-and-packaging/cli-and-mcp-wrappers.md` — CLI/MCP are thin adapters over SDK;
  neither owns orchestration; the shared-composition helper pattern.
- `docs/design/20-sdk-and-packaging/dependency-rules.md` — `cli`/`mcp` production → `sdk` only (not
  `testkit`); `tests` → `sdk + testkit`; no ambient `Date.now`/`new Date`/`Math.random`/
  `crypto.randomUUID` in deterministic logic.

If these sources do not answer a contract question, this story is not ready.

## Spec surface

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

## Responsibilities

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

## Out of scope

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

## Dependencies and frozen inputs

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

## Acceptance criteria

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

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No
responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| CLI envelope builders for preview/start/inspect produce `OperatorCommandEnvelope<TParams>` with `surface: "cli"` | AC-1, AC-2, AC-3 |
| MCP envelope builders produce `OperatorCommandEnvelope<TParams>` with `surface: "mcp"` | AC-1, AC-2, AC-3 |
| Byte-parity guarantee: CLI vs MCP for preview (modulo named surface fields) | AC-1 |
| Byte-parity guarantee: CLI vs MCP for start | AC-2 |
| Byte-parity guarantee: CLI vs MCP for inspect (incl. `RunEventCursor` fixture) | AC-3 |
| One call to fake control surface per action (CLI) | AC-4 |
| One call to fake control surface per action (MCP) | AC-5 |
| `OperatorActionRecorded` `OperatorEventRef` returned in result on writable path (CLI) | AC-6 |
| Determinism — stable envelope bytes under fixed clock/identity/ids | AC-7 |
| `envelopeErrors` carry-and-reject path: envelope forwarded once; result `status: "rejected"` | AC-8 |
| Dependency boundary: `cli/src/operator-smoke` imports no `testkit` | AC-9 |
| Dependency boundary: `mcp/src/operator-smoke` imports no `testkit` | AC-10 |
| `FakeOperatorControlSurface`, `FakeOsIdentityResolver`, `DeterministicClock`, `DeterministicIdGenerator`, fixture builders importable from `testkit` entrypoint | AC-11 |
| CLI/MCP builders are internal (not re-exported on public entrypoints) | AC-12 |
| `OperatorCommandEnvelope<PreviewRunParams>` (spec-surface type) | AC-1 |
| `OperatorCommandEnvelope<StartRunParams>` (spec-surface type) | AC-2 |
| `OperatorCommandEnvelope<InspectRunParams>` (spec-surface type) | AC-3 |
| `OperatorCommandResult` (spec-surface type, incl. `operatorEventRef`) | AC-4, AC-5, AC-6 |
| `OperatorActionRecorded` (audit event, recorded by fake) | AC-6 |
| `FakeOperatorControlSurface` (testkit) | AC-4, AC-5, AC-11 |
| `FakeOsIdentityResolver` (testkit) | AC-11 |
| `DeterministicClock` (testkit) | AC-7, AC-11 |
| `DeterministicIdGenerator` (testkit) | AC-7, AC-11 |
| Fixture `RunProjections` builder (testkit) | AC-11 |
| Fixture `RunEventCursor` builder (testkit) | AC-3, AC-11 |
| `envelope-error-reject` failure token | AC-8 |
| `identity-unavailable` failure token: `UnavailableOsUserOperatorActorRef` actor, one fake call, `actor.kind === "os-user-unavailable"` | AC-13 |

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `envelope-error-reject` | `envelopeErrors` present on the envelope (e.g. `params-invalid` from transport parse failure); the builder still invokes the matching fake control surface method | Exactly one fake control surface call is made with the error-bearing envelope; the fake returns `status: "rejected"`; the result carries the errors; no domain action runs (the fake records `resultIntent = "reject"`) | AC-8 |
| `identity-unavailable` (structural) | `OsUserOperatorActorRef` cannot be resolved; the builder receives an `UnavailableOsUserOperatorActorRef` fixture from the injected `FakeOsIdentityResolver` | The builder still calls the fake control surface method exactly once; the envelope's `actor.kind === "os-user-unavailable"`; the fake can record the rejection — the builder does not short-circuit on identity failure | AC-13 |

> **Design gap (informational, not blocking):** The `OperatorCommandResult` response shape includes
> `attention?: AttentionNotice[]` and `explanation?: ExplanationView` fields whose types reference
> later-epic constructs. The smoke result assertions do not assert those fields (they are optional
> and the fake leaves them absent). If `edge-01-s1` cannot declare those fields without a
> later-epic type resolving, that is a design-sequencing gap to escalate per story-DAG scope
> decision 3 — this story does not invent around it.

## Quality bar

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

## Required reading

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

## Deliverable

The `packages/cli/src/operator-smoke/` thin CLI envelope builders (internal), the
`packages/mcp/src/operator-smoke/` thin MCP envelope builders (internal), and the
`packages/testkit/src/operator/` + `packages/testkit/src/fixtures/operator/` structural fakes and
fixture builders (public via `testkit` entrypoint) — consuming `edge-01-s1` types by injection,
importing `sdk` only in production source, exercised by hermetic `*.unit.test.ts` tests that prove
byte-parity, one-call-one-audit, the envelope-error path, and dependency-boundary invariants — plus
the evidence pack.

## Evidence pack

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

## Boundaries and STOP conditions

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

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - stories](./README.md) · **← Prev:** [edge-01-s1-operator-command-contract - shared operator command-envelope substrate implementation story](./edge-01-s1-operator-command-contract.md) · **Next →:** [Epic 4 - Human control and liveness loop](../../epic-4-human-control-and-liveness-loop/README.md)

<!-- /DOCS-NAV -->
