# Reviewer Prompt: edge-01-s2-cli-mcp-parity-smoke

## Assigned Routing

- Source story id: `edge-01-s2-cli-mcp-parity-smoke`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `standard`.
- Reasoning tier: `elevated`.
- Routing rationale: edge-01-s2-cli-mcp-parity-smoke covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13 and carries cross-package CLI/MCP/testkit smoke with dependency-boundary sweeps and public testkit exposure. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Original Scope

- Story id: `edge-01-s2-cli-mcp-parity-smoke`.
- Epic slug: `epic-3-core-runtime-spine`.
- Source story contract path: `docs/implementation/epics/epic-3-core-runtime-spine/stories/edge-01-s2-cli-mcp-parity-smoke.md`.
- Allowed pathset: `packages/testkit/src/operator/**`, `packages/testkit/src/fixtures/operator/**`, `packages/cli/src/operator-smoke/**`, `packages/cli/tests/operator/**`, `packages/mcp/src/operator-smoke/**`, `packages/mcp/tests/operator/**`.
- Direct dependencies: `edge-01-s1-operator-command-contract`, `core-01-s1-event-contracts`.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus committed producer shapes and public import paths named in the source contract and DAG.

### Acceptance Criteria

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

### Dependencies And Frozen Inputs

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

### Non-Goals

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

### STOP Conditions And Boundaries

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

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check implementation against source story `docs/implementation/epics/epic-3-core-runtime-spine/stories/edge-01-s2-cli-mcp-parity-smoke.md` and AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`.

- AC coverage by source `AC-n` id, including every failure, degraded, validation, and negative-fixture row named by the source contract.
- Evidence pack completeness against the source `Quality bar` and `Evidence pack` sections.
- Public API names, exports, and import paths against the source contract and DAG producer/consumer table.
- Dependency boundaries, committed dependency inputs, and `{{DEPENDENCY_COMMITS}}` consistency.
- Stale names and sibling occurrences of any issue found.
- Tests, targeted checks, coverage commands, forbidden-symbol sweeps, and `pnpm check` output.
- Scope control against allowed writes: `packages/testkit/src/operator/**`, `packages/testkit/src/fixtures/operator/**`, `packages/cli/src/operator-smoke/**`, `packages/cli/tests/operator/**`, `packages/mcp/src/operator-smoke/**`, `packages/mcp/tests/operator/**`.
- Repo conventions and mutation limits from `AGENTS.md` and the source contract.

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - Core runtime spine](../../../README.md) · **← Prev:** [Implementer Prompt: edge-01-s2-cli-mcp-parity-smoke](./implementer.md) · **Next →:** [Epic 3 Execution Tracker](../../tracker.md)

<!-- /DOCS-NAV -->
