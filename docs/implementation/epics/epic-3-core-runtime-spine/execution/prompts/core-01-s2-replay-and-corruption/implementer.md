# Implementer Prompt: core-01-s2-replay-and-corruption

## Assigned Routing

- Source story id: `core-01-s2-replay-and-corruption`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`.
- Model class: `general-coder`.
- Effort: `medium`.
- Suggested-tier floor: `standard`.
- Reasoning tier: `standard`.
- Routing rationale: core-01-s2-replay-and-corruption covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10 and carries bounded replay implementation with corruption classification and deterministic fixture evidence. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Exact Task

Implement source story `core-01-s2-replay-and-corruption` for epic `epic-3-core-runtime-spine`. Deliver exactly the outcome in the ready source contract and nothing outside it:

The `packages/sdk/src/core/run-lifecycle/replay/` module providing the `replay()` function, plus
the evidence pack.

## Why It Matters

- Covers signals: Replay health, tail/interior corruption classes, and partial-write handling (replay
  side) — as listed in the Epic 3 charter `core-01` per-domain expectations table.
- Depends on: `core-01-s1-event-contracts` (type shapes); `fnd-02 EventLogStore` (Epic 1 frozen input).
- Depended on by: `core-01-s4-run-event-log-and-writer`, `core-01-s5-projections`,
  `core-01-s6-cursor-wait`.
- Shared shapes consumed (verbatim, not redeclared):
  `core-01-s1-event-contracts/RunReplay`,
  `core-01-s1-event-contracts/RunEventEnvelope`,
  `core-01-s1-event-contracts/RunReplayFailure`,
  `core-01-s1-event-contracts/RunLogHealthRecord`,
  `core-01-s1-event-contracts/RunLogCorruptionRecord`,
  `core-01-s1-event-contracts/RunDegradedHealth`,
  `core-01-s1-event-contracts/RunLogTailRepairedPayload`,
  `core-01-s1-event-contracts/RunEventCursor`.

The DAG dependents for this story are: `core-01-s4-run-event-log-and-writer`, `core-01-s5-projections`, `core-01-s6-cursor-wait`. Preserve the producer/consumer shape boundaries named above so later stories can consume committed dependency inputs without re-declaring or widening this story's scope.

## Required Reading

- `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s2-replay-and-corruption.md` — source story contract for `core-01-s2-replay-and-corruption`.
- `docs/implementation/epics/epic-3-core-runtime-spine/story-dag.md` — frozen DAG row, dependencies, owned pathset, wave, and suggested-tier floor for `core-01-s2-replay-and-corruption`.
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md` — type definitions for
  all consumed and produced shapes.
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/event-log-writer-and-corruption.md`
  — §Event envelope, §Corruption handling, §Writer-epoch fencing and partial-write recovery (replay
  side only; writer-recovery orchestration is core-01-s4).
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/projections-lifecycle-and-tests.md`
  — §Failure and degraded modes, §Testing strategy.
- `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s1-event-contracts.md` (when
  ready) — the single producer of all consumed shape declarations.
- `docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/stories/epic0-s4-export-templates.md`
  — `PackageExportConvention` for the `sdk` public entrypoint.
- `docs/engineering/test-lanes.md` — unit lane rules; no real FS/network/process.
- `docs/design/20-sdk-and-packaging/dependency-rules.md` — sdk → pure libs only; testkit excluded
  from production source.
- `{{DEPENDENCY_COMMITS}}` — runtime slot for committed dependency story inputs when this story has dependencies.

## Acceptance Criteria

Source story: `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s2-replay-and-corruption.md`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`.

- **AC-1** Given a fault-free in-memory fnd-02 store holding a log with N valid envelopes (sequences 1
  through N, correct `schema`, all required fields present, matching `runId`), `replay(runId)` returns
  `{ ok: true, value: RunReplay }` with `events.length === N`, `lastSequence === N`,
  `health === "ok"`, and `healthRecords === []` - evidence:
  `replay-happy-path.unit.test.ts` asserts `ok === true`, `value.events.length`, `value.lastSequence`,
  `value.health`, and `value.healthRecords.length` for a fixture of N = 3 events.

- **AC-2** Given a log containing a frame whose decoded object is missing the required `schema` field
  (value absent — not `"kit-vnext.run-event.v1"`), `replay(runId)` returns
  `{ ok: false, error: RunReplayFailure { code: "malformed-envelope" } }` - evidence:
  `replay-malformed-envelope.unit.test.ts` uses a fault-injected in-memory store whose frame omits
  `schema`; asserts `ok === false`, `error.code === "malformed-envelope"`.

- **AC-3** Given a log whose frames have non-contiguous sequences (e.g., sequences 1, 2, 4 with gap at
  3), `replay(runId)` returns `{ ok: false, error: RunReplayFailure { code: "malformed-envelope" } }` -
  evidence: `replay-non-contiguous-sequence.unit.test.ts` uses a fault-injected store with gap fixture;
  asserts `ok === false`, `error.code === "malformed-envelope"`.

- **AC-4** Given a log containing a frame whose `type` is `RunLifecycleTransitioned` (a core-01
  declared-relevant type) but whose `payload` is an empty object `{}` (missing all required fields of
  `RunLifecycleTransitionPayload`), `replay(runId)` returns
  `{ ok: false, error: RunReplayFailure { code: "malformed-declared-payload" } }` - evidence:
  `replay-malformed-declared-payload.unit.test.ts` uses a fault-injected store; asserts
  `ok === false`, `error.code === "malformed-declared-payload"`.

- **AC-5** Given a log whose declared-relevant frame has a well-formed `RunLifecycleTransitionPayload`
  and the fnd-02 store reports `storageHealth === "log-tail-repaired"`, `replay(runId)` returns
  `{ ok: true, value: RunReplay }` with `health === "tail-repaired"`,
  `healthRecords` containing exactly one `RunLogCorruptionRecord { kind: "tail-repaired" }` - evidence:
  `replay-tail-repaired.unit.test.ts` uses an in-memory store fault-injected with
  `storageHealth = "log-tail-repaired"`; asserts `ok === true`, `value.health === "tail-repaired"`,
  `value.healthRecords[0].kind === "tail-repaired"`, `value.healthRecords[0].storageHealth ===
  "log-tail-repaired"`.

- **AC-6** Given a fnd-02 store reporting `storageHealth === "log-interior-corrupt"`, `replay(runId)`
  fails closed, returning `{ ok: false, error: RunReplayFailure { code: "interior-corrupt" } }` whose
  `error.healthRecords` contains exactly one `RunLogCorruptionRecord { kind: "interior-corrupt" }`, so
  downstream `project()`/`waitRunEvents()` propagate the failure rather than serving incoherent history
  - evidence: `replay-interior-corrupt.unit.test.ts` uses a fault-injected store; asserts
  `ok === false`, `error.code === "interior-corrupt"`, `error.healthRecords[0].kind ===
  "interior-corrupt"`, `error.healthRecords[0].storageHealth === "log-interior-corrupt"`.

- **AC-7** Given a fnd-02 store reporting `storageHealth === "network-fs-degraded"` (and independently
  `"read-only"` and `"unusable"`), `replay(runId)` returns
  `{ ok: false, error: RunReplayFailure { code: "event-log-unavailable" } }` for each - evidence:
  `replay-event-log-unavailable.unit.test.ts` uses three separate fault-injected stores (one per
  health value); asserts `ok === false`, `error.code === "event-log-unavailable"`,
  `error.healthRecords[0].storageHealth` equals the injected value in each case.

- **AC-8** Given a fault-free log, calling `replay(runId)` twice returns two `RunReplay` values that
  are deep-equal in `events`, `lastSequence`, `writerEpoch`, `health`, and `healthRecords` — proving
  output is deterministic for a given log byte sequence - evidence:
  `replay-determinism.unit.test.ts` asserts `deepEqual(first.value, second.value)` for two calls
  against the same fixed in-memory store (no mutable ambient state).

- **AC-9** Given a log where a valid `RunLogTailRepaired` event is committed (containing a
  `RunLogTailRepairedPayload { repairedAt, lastCommittedSequence, quarantinedBytes, storageHealth:
  "log-tail-repaired" }`) and fnd-02 reports `log-tail-repaired`, the `RunLogCorruptionRecord` in
  `healthRecords` has `detectedAt` equal to the `repairedAt` from the payload and
  `lastValidSequence` equal to `lastCommittedSequence` from the payload - evidence:
  `replay-tail-repaired.unit.test.ts` (same file as AC-5) additionally asserts `healthRecords[0].detectedAt`
  and `healthRecords[0].lastValidSequence` match the fixture values from `RunLogTailRepairedPayload`.

- **AC-10** The `replay()` function is importable from the `sdk` package public entrypoint, not a
  private module path - evidence: `replay-public-import.unit.test.ts` imports `replay` from the `sdk`
  entrypoint and asserts it is a function.

## Allowed Writes

Source story: `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s2-replay-and-corruption.md`. Owned pathset from the frozen DAG and source contract:

- `packages/sdk/src/core/run-lifecycle/replay/**`
- `packages/sdk/tests/core/run-lifecycle/replay/**`

Every other write is forbidden, including this execution package, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, commits, pushes, PRs, and merges.

## Dependency Inputs

Direct dependency story ids: `core-01-s1-event-contracts`.

- Covers signals: Replay health, tail/interior corruption classes, and partial-write handling (replay
  side) — as listed in the Epic 3 charter `core-01` per-domain expectations table.
- Depends on: `core-01-s1-event-contracts` (type shapes); `fnd-02 EventLogStore` (Epic 1 frozen input).
- Depended on by: `core-01-s4-run-event-log-and-writer`, `core-01-s5-projections`,
  `core-01-s6-cursor-wait`.
- Shared shapes consumed (verbatim, not redeclared):
  `core-01-s1-event-contracts/RunReplay`,
  `core-01-s1-event-contracts/RunEventEnvelope`,
  `core-01-s1-event-contracts/RunReplayFailure`,
  `core-01-s1-event-contracts/RunLogHealthRecord`,
  `core-01-s1-event-contracts/RunLogCorruptionRecord`,
  `core-01-s1-event-contracts/RunDegradedHealth`,
  `core-01-s1-event-contracts/RunLogTailRepairedPayload`,
  `core-01-s1-event-contracts/RunEventCursor`.

Use `{{DEPENDENCY_COMMITS}}` for dependency commits that can only exist during execution. Import only producer-owned public shapes and paths named by the DAG or source contract.

## Non-Goals And STOP Conditions

### Source Out Of Scope

- Appending `RunLogTailRepaired` events to the writer after observing `log-tail-repaired` — that is the
  writer path owned by `core-01-s4`.
- Lost-ack recovery orchestration (reacquiring the writer, deciding committed vs absent vs conflict) —
  owned by `core-01-s4`.
- Lifecycle-transition folding and projection building — owned by `core-01-s5`.
- Cursor-based incremental waiting — owned by `core-01-s6`.
- The `RunEventLog` object assembly — owned by `core-01-s4`.
- Type declarations of `RunReplay`, `RunReplayFailure`, `RunLogHealthRecord`, `RunLogCorruptionRecord`,
  `RunDegradedHealth` — declared once by `core-01-s1-event-contracts`, never redeclared here.

### Source Boundaries And STOP Conditions

- Package or module boundary: `packages/sdk/src/core/run-lifecycle/replay/` only; test files under
  `packages/sdk/tests/core/run-lifecycle/replay/`.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/core/run-lifecycle/replay/**`,
  `packages/sdk/tests/core/run-lifecycle/replay/**`.
- Forbidden dependencies (production source): `testkit`, any `provider-*` package, `cli`, `mcp`.
- STOP when: lifecycle/projection folding is needed (core-01-s5), writer construction or lost-ack
  orchestration is needed (core-01-s4), cursor-wait polling is needed (core-01-s6), or type
  declarations for `RunReplay` / `RunReplayFailure` / `RunLogHealthRecord` need to be authored (those
  belong to core-01-s1-event-contracts).

Also stop and report if dependency inputs are missing, required writes fall outside the allowed pathset, a source gap blocks implementation, or any AC would need reinterpretation.

## Implementation Constraints

### Source Responsibilities

- Accept a `runId` and a `fnd-02 EventLogStore` injected as a port; call `EventLogStore.replay(runId)`.
- Deserialize each fnd-02 frame into a `RunEventEnvelope`; return `RunReplayFailure { code:
  "malformed-envelope" }` with any accumulated health records if any frame fails envelope validation.
- Validate the `RunEventEnvelope` contract fields: `schema === "kit-vnext.run-event.v1"`, all required
  fields present and typed correctly, `sequence` contiguous starting from 1, `runId` matches the
  requested id.
- For each frame whose `type` is a core-01 declared-relevant event type, parse and validate the
  payload against the declared schema; return `RunReplayFailure { code: "malformed-declared-payload" }`
  on failure, with accumulated health records.
- Map fnd-02 `StorageHealth` to `RunDegradedHealth` per the design mapping: `log-tail-repaired →
  tail-repaired`; `log-interior-corrupt → interior-corrupt`; `network-fs-degraded | read-only |
  unusable → event-log-unavailable`.
- For `log-tail-repaired`: assemble a `RunLogCorruptionRecord { kind: "tail-repaired", ... }` from the
  fnd-02 health signal, add it to `healthRecords`, set `health = "tail-repaired"`, and return a
  successful `RunReplay` (tail-repaired is usable, not a failure).
- For `log-interior-corrupt`: assemble a `RunLogCorruptionRecord { kind: "interior-corrupt", ... }`,
  add it to `healthRecords`, and return `RunReplayFailure { code: "interior-corrupt", healthRecords }`
  — fail closed (incoherent committed history yields no trustworthy ordered stream), so downstream
  `project()` and `waitRunEvents()` propagate the failure rather than acting on corrupt data. (The
  design's §Corruption-handling "mark projections degraded / recover from read-only evidence" is the
  core-06 recovery path in Epic 5, which consumes the `interior-corrupt` `healthRecords`; it is not
  this canonical `replay()`.)
- For `network-fs-degraded | read-only | unusable`: assemble a `RunLogHealthRecord { kind:
  "event-log-unavailable", ... }` and return `RunReplayFailure { code: "event-log-unavailable",
  healthRecords }`.
- Produce a deterministic `RunReplay` (same log byte sequence → same output every time); reducers and
  validators are pure; clock, ids, and storage injected — no ambient `Date.now` / `new Date` /
  `Math.random` / `crypto.randomUUID`.
- Expose the `replay()` function as the public production surface for consumption by `core-01-s4`,
  `core-01-s5`, and `core-01-s6`.

### Source Spec Surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types consumed (declared by `core-01-s1-event-contracts`; not redeclared here):
  `RunReplay`, `RunEventEnvelope`, `RunReplayFailure`, `RunLogHealthRecord`, `RunLogCorruptionRecord`,
  `RunDegradedHealth`, `RunLogTailRepairedPayload`, `RunEventCursor`.
- Provider operations consumed: `fnd-02 EventLogStore.replay(runId)` returning
  `Result<{ events: frame[], storageHealth: StorageHealth }, StorageError>` (Epic 1 frozen input).
- Failure and degraded tokens (catalog owned by `core-01-s1-event-contracts`; behavior proven here):
  - `malformed-envelope` — a committed frame decodes but the resulting object fails the
    `RunEventEnvelope` contract (missing required field, wrong schema string, non-contiguous sequence,
    or other shape violation).
  - `interior-corrupt` — fnd-02 reports `log-interior-corrupt`; replay fails closed, returning
    `RunReplayFailure { code: "interior-corrupt", healthRecords: [RunLogCorruptionRecord { kind:
    "interior-corrupt" }] }` (committed history is incoherent, so no trustworthy ordered stream can be
    served). The §Corruption-handling degraded recovery-read over read-only evidence is a separate
    core-06 path (Epic 5), not this canonical `replay()`.
  - `event-log-unavailable` — fnd-02 reports `network-fs-degraded`, `read-only`, or `unusable`;
    returns `RunReplayFailure { code: "event-log-unavailable", ... }`.
  - `malformed-declared-payload` — a frame for a core-01 declared-relevant event type (`RunLifecycleTransitioned`,
    `SessionLinked`, `SessionLinkSuperseded`, `RunLogTailRepaired`, `RunAppendRejected`) has a payload
    that fails its declared schema.
- Health classification (non-failure, degraded-but-usable):
  - `tail-repaired` — fnd-02 reports `log-tail-repaired`; appends a `RunLogCorruptionRecord` to
    `healthRecords`, sets `health = "tail-repaired"`, assembles the `RunLogTailRepairedPayload` from the
    `RunLogTailRepaired` event already committed in the log.
- Evidence records / attestations produced: `core-01-s1-event-contracts/RunLogHealthRecord` entries
  (specifically `RunLogCorruptionRecord` for `tail-repaired` and `interior-corrupt`, and the
  `event-log-unavailable` variant for unavailable storage) assembled into `RunReplay.healthRecords`.

Done requires every item here present with the design's names, shapes, and semantics.

Do not introduce implementation choices outside the names, events, failure tokens, determinism rules, boundary rules, import rules, conformance obligations, and safety invariants fixed above.

## Verification

### Source Quality Bar

- Coverage scope and threshold: the `replay()` function and its envelope/payload validators in
  `packages/sdk/src/core/run-lifecycle/replay/**` at ≥90%, aiming for 95%. Type-only imports from
  `core-01-s1-event-contracts` contribute no instrumented lines and are excluded from the scope
  measurement.
- Coverage command and instrumented lane(s): `pnpm exec vitest run --project unit --coverage
  --passWithNoTests -- packages/sdk/tests/core/run-lifecycle/replay/**` — instruments the unit lane
  over the replay module scope; the full aggregate gate is `pnpm coverage:baseline`.
- Required tests, catalogued by AC and failure row:
  - `replay-happy-path.unit.test.ts` (AC-1)
  - `replay-malformed-envelope.unit.test.ts` (AC-2, AC-3; separate fixtures for missing-field and
    non-contiguous-sequence)
  - `replay-malformed-declared-payload.unit.test.ts` (AC-4)
  - `replay-tail-repaired.unit.test.ts` (AC-5, AC-9)
  - `replay-interior-corrupt.unit.test.ts` (AC-6)
  - `replay-event-log-unavailable.unit.test.ts` (AC-7; three fault fixtures: `network-fs-degraded`,
    `read-only`, `unusable`)
  - `replay-determinism.unit.test.ts` (AC-8)
  - `replay-public-import.unit.test.ts` (AC-10)
- Public exposure (import path + public-import test): `replay` exported from the `sdk` public
  entrypoint per `epic0-s4-export-templates/PackageExportConvention` (export + barrel + `exports`
  field); proven by `replay-public-import.unit.test.ts` which imports `replay` from `sdk` (not a
  private path) and asserts it is a function. The `RunReplay` TYPE is `core-01-s1-event-contracts`'s
  public export; this story exports only the `replay` function.
- Determinism constraints: `replay()` is pure given its fnd-02 store argument; no ambient `Date.now`,
  `new Date`, `Math.random`, or `crypto.randomUUID`; clock, ids, and storage injected as ports.
  `detectedAt` in `RunLogCorruptionRecord` is derived from committed event payloads or the fnd-02 health
  signal, not from a live clock call inside `replay()`.
- Dependency boundaries: `sdk` imports only pure runtime libraries and `core-01-s1-event-contracts`
  types; it must not import `testkit`, any `provider-*`, `cli`, or `mcp`. Test files are exempt from
  the production-testkit rule and may import the fake in-memory fnd-02 store.
- File-size budget (lines per file; default soft cap ~200): `replay.ts` (main function) ≤ 200 lines;
  `envelope-validator.ts` ≤ 200 lines; `payload-validator.ts` ≤ 200 lines;
  `health-classifier.ts` ≤ 150 lines. Test files ≤ 200 lines each.
- Domain non-negotiables:
  - Tail-repaired is a usable result, not a failure; callers that need mutation-safety must inspect
    `health` themselves.
  - Interior-corrupt fails closed: `replay()` returns `RunReplayFailure { code: "interior-corrupt" }`
    (with the `RunLogCorruptionRecord` in `healthRecords`); it never serves incoherent committed history
    as a successful `RunReplay`. The degraded recovery-read over read-only evidence is core-06/Epic 5.
  - Replay output is deterministic: same fnd-02 byte sequence → same `RunReplay` every time.
  - Declared-payload validation covers only core-01 declared-relevant types; well-formed unknown future
    payloads are preserved in `events` and do not fail replay.

### Source Evidence Pack

- Test proving each AC: `replay-happy-path.unit.test.ts` (AC-1); `replay-malformed-envelope.unit.test.ts`
  (AC-2, AC-3); `replay-malformed-declared-payload.unit.test.ts` (AC-4);
  `replay-tail-repaired.unit.test.ts` (AC-5, AC-9); `replay-interior-corrupt.unit.test.ts` (AC-6);
  `replay-event-log-unavailable.unit.test.ts` (AC-7); `replay-determinism.unit.test.ts` (AC-8);
  `replay-public-import.unit.test.ts` (AC-10).
- Negative fixtures:
  - Missing-`schema` frame fixture in `replay-malformed-envelope.unit.test.ts` (AC-2).
  - Gap-sequence frame fixture in `replay-malformed-envelope.unit.test.ts` (AC-3).
  - Empty-payload `RunLifecycleTransitioned` frame fixture in `replay-malformed-declared-payload.unit.test.ts` (AC-4).
  - `storageHealth = "network-fs-degraded"`, `"read-only"`, `"unusable"` fixtures in
    `replay-event-log-unavailable.unit.test.ts` (AC-7).
- `pnpm check` result, unless blocked by a named unrelated repository issue.
- Coverage command, instrumented lane, and number for the `packages/sdk/src/core/run-lifecycle/replay/**`
  scope.
- Public-import test result for `replay` imported from the `sdk` entrypoint.
- Boundary/forbidden-symbol sweep (runnable recipe):
  `grep -REn "testkit|provider-(codex|local|github|markdown)|/cli/|/mcp/" packages/sdk/src/core/run-lifecycle/replay/`
  over path root `packages/sdk/src/core/run-lifecycle/replay/`; forbidden-token set = `testkit`,
  `provider-codex|local|github|markdown`, `/cli/`, `/mcp/`; expected result zero matches (exit code
  1), captured into the evidence pack.

Run the targeted commands and `pnpm check`, then report exact command output or an explicit blocked reason. Do not treat prose-only claims as evidence.

## Delivery Report

Return a report with changed files, AC coverage by `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, tests and checks run, evidence pack, open questions, and blockers. The report is review evidence only; it is not permission to update tracker state or perform delivery actions.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - Core runtime spine](../../../README.md) · **← Prev:** [Reviewer Prompt: core-01-s1-event-contracts](../core-01-s1-event-contracts/reviewer.md) · **Next →:** [Reviewer Prompt: core-01-s2-replay-and-corruption](./reviewer.md)

<!-- /DOCS-NAV -->
