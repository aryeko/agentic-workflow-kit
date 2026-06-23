# Reviewer Prompt: core-01-s2-replay-and-corruption

## Assigned Routing

- Source story id: `core-01-s2-replay-and-corruption`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`.
- Model class: `frontier-reviewer`.
- Effort: `medium`.
- Suggested-tier floor: `standard`.
- Reasoning tier: `standard`.
- Routing rationale: core-01-s2-replay-and-corruption covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10 and carries bounded replay implementation with corruption classification and deterministic fixture evidence. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Original Scope

- Story id: `core-01-s2-replay-and-corruption`.
- Epic slug: `epic-3-core-runtime-spine`.
- Source story contract path: `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s2-replay-and-corruption.md`.
- Allowed pathset: `packages/sdk/src/core/run-lifecycle/replay/**`, `packages/sdk/tests/core/run-lifecycle/replay/**`.
- Direct dependencies: `core-01-s1-event-contracts`.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus committed producer shapes and public import paths named in the source contract and DAG.

### Acceptance Criteria

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

### Dependencies And Frozen Inputs

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

### Non-Goals

- Appending `RunLogTailRepaired` events to the writer after observing `log-tail-repaired` — that is the
  writer path owned by `core-01-s4`.
- Lost-ack recovery orchestration (reacquiring the writer, deciding committed vs absent vs conflict) —
  owned by `core-01-s4`.
- Lifecycle-transition folding and projection building — owned by `core-01-s5`.
- Cursor-based incremental waiting — owned by `core-01-s6`.
- The `RunEventLog` object assembly — owned by `core-01-s4`.
- Type declarations of `RunReplay`, `RunReplayFailure`, `RunLogHealthRecord`, `RunLogCorruptionRecord`,
  `RunDegradedHealth` — declared once by `core-01-s1-event-contracts`, never redeclared here.

### STOP Conditions And Boundaries

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

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check implementation against source story `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s2-replay-and-corruption.md` and AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`.

- AC coverage by source `AC-n` id, including every failure, degraded, validation, and negative-fixture row named by the source contract.
- Evidence pack completeness against the source `Quality bar` and `Evidence pack` sections.
- Public API names, exports, and import paths against the source contract and DAG producer/consumer table.
- Dependency boundaries, committed dependency inputs, and `{{DEPENDENCY_COMMITS}}` consistency.
- Stale names and sibling occurrences of any issue found.
- Tests, targeted checks, coverage commands, forbidden-symbol sweeps, and `pnpm check` output.
- Scope control against allowed writes: `packages/sdk/src/core/run-lifecycle/replay/**`, `packages/sdk/tests/core/run-lifecycle/replay/**`.
- Repo conventions and mutation limits from `AGENTS.md` and the source contract.

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - Core runtime spine](../../../README.md) · **← Prev:** [Implementer Prompt: core-01-s2-replay-and-corruption](./implementer.md) · **Next →:** [Implementer Prompt: core-01-s3-lifecycle-and-linkage](../core-01-s3-lifecycle-and-linkage/implementer.md)

<!-- /DOCS-NAV -->
