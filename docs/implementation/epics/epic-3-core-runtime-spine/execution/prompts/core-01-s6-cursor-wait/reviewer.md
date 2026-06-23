# Reviewer Prompt: core-01-s6-cursor-wait

## Assigned Routing

- Source story id: `core-01-s6-cursor-wait`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.
- Model class: `frontier-reviewer`.
- Effort: `medium`.
- Suggested-tier floor: `standard`.
- Reasoning tier: `standard`.
- Routing rationale: core-01-s6-cursor-wait covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8 and carries bounded cursor wait behavior with injected clock and no mutation authority. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Original Scope

- Story id: `core-01-s6-cursor-wait`.
- Epic slug: `epic-3-core-runtime-spine`.
- Source story contract path: `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s6-cursor-wait.md`.
- Allowed pathset: `packages/sdk/src/core/run-lifecycle/cursor-wait/**`, `packages/sdk/tests/core/run-lifecycle/cursor-wait/**`.
- Direct dependencies: `core-01-s1-event-contracts`, `core-01-s2-replay-and-corruption`.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus committed producer shapes and public import paths named in the source contract and DAG.

### Acceptance Criteria

Each AC is a single assertion that is true or false against a test or artifact. Every rejection AC
names its own failing fixture. The `evidence` names the exact test id or command and the result it
produces.

- **AC-1** Given a replay containing events at sequences 1–3 and a cursor with `afterSequence: 0`,
  `waitRunEvents` returns a `Result.ok` with `events` equal to the three envelopes, `timedOut: false`,
  `cursor.afterSequence` advanced to 3, and `lastSequence: 3` — evidence:
  `cursor-wait-returns-events.unit.test.ts` constructs a fake `replay()` returning three envelopes and
  asserts the returned result matches those fields exactly (test id:
  `cursor-wait > returns events after cursor`).

- **AC-2** When `maxEvents: 2` is set and replay returns 5 events after the cursor, `waitRunEvents`
  returns exactly 2 events and sets `cursor.afterSequence` to the sequence of the second delivered
  event — evidence: `cursor-wait-max-events.unit.test.ts` asserts on `events.length === 2` and
  `cursor.afterSequence` equals the second event's sequence (test id: `cursor-wait > respects
  maxEvents`).

- **AC-3** When replay returns no events after the cursor and the injected clock advances past
  `timeoutMs`, `waitRunEvents` returns a `Result.ok` with `events: []`, `timedOut: true`, and
  `cursor.afterSequence` unchanged from the request — evidence:
  `cursor-wait-timeout.unit.test.ts` injects a controlled clock that immediately reads past
  `timeoutMs` and a fake `replay()` that always returns an empty event list; asserts `timedOut: true`
  and `events.length === 0` (test id: `cursor-wait > timedOut on no new events`).

- **AC-4** When `waitRunEvents` delivers events, the returned `cursor.afterSequence` equals the
  sequence of the last delivered event — evidence: `cursor-wait-cursor-advances.unit.test.ts`
  supplies events at sequences 5, 7, 9 with `afterSequence: 4`; asserts the returned cursor
  `afterSequence === 9` (test id: `cursor-wait > cursor advances to last delivered sequence`).

- **AC-5** The `health` and `healthRecords` fields in `WaitRunEventsResult` carry the values from the
  underlying replay pass verbatim: when replay returns `health: "tail-repaired"` and a non-empty
  `healthRecords`, the result carries those values unchanged — evidence:
  `cursor-wait-health-passthrough.unit.test.ts` asserts `result.value.health === "tail-repaired"` and
  `result.value.healthRecords` deep-equals the replay's health records (test id: `cursor-wait > health
  passthrough`).

- **AC-6** When the underlying replay returns a `RunReplayFailure` (e.g. `"event-log-unavailable"`),
  `waitRunEvents` returns `Result.error` with `error.code === "event-log-unavailable"` and does not
  wrap or re-interpret the failure — evidence: `cursor-wait-replay-failure.unit.test.ts` injects a
  fake `replay()` that returns `{ ok: false, error: { code: "event-log-unavailable", ... } }` and
  asserts the `waitRunEvents` result is `{ ok: false, error: { code: "event-log-unavailable" } }` (test
  id: `cursor-wait > surfaces replay failure verbatim`).

- **AC-7** The implementation never calls any lease store method, never calls any projection write
  function, never appends any event or health record, and never calls any liveness mutation — proven
  via spy/fake: a fake context exposes spies on `LeaseStore.acquire`, `LeaseStore.renew`,
  `RunWriter.append`, and any projection-write function; after `waitRunEvents` completes (both
  events-found and timed-out paths), all spies report zero calls — evidence:
  `cursor-wait-read-only-invariants.unit.test.ts` asserts all spy call counts are 0 on both paths (test
  id: `cursor-wait > read-only: no lease/projection/append side effects`).

- **AC-8** `waitRunEvents` (the stand-alone behavior function) is importable from the `sdk` public
  entrypoint, not a private module path, and a fixture successfully calls it — evidence:
  `cursor-wait-public-import.unit.test.ts` imports `waitRunEvents` from the `sdk` entrypoint and
  invokes it with a minimal fixture, asserting the import and call succeed (test id: `cursor-wait >
  public import`).

### Dependencies And Frozen Inputs

- Covers signals: "Low-level cursor wait primitive as the substrate later wrapped by supervision."
- Depends on: `core-01-s1-event-contracts`, `core-01-s2-replay-and-corruption` (band 3).
- Depended on by: `core-01-s4-run-event-log-and-writer` (delegates `waitRunEvents` to this module).
- Shared shapes consumed:
  - `core-01-s1-event-contracts/WaitRunEventsRequest`
  - `core-01-s1-event-contracts/WaitRunEventsResult`
  - `core-01-s1-event-contracts/RunEventCursor`
  - `core-01-s1-event-contracts/RunReplayFailure`
  - `core-01-s1-event-contracts/RunEventEnvelope`
  - `core-01-s1-event-contracts/Result`
  - `core-01-s2-replay-and-corruption/replay()`

### Non-Goals

- Liveness timers, supervision, operator blocking, and the liveness wrapping that core-04 (Epic 4) builds over this primitive — this story is strictly the bounded-poll substrate.
- Lease acquisition or renewal, owned by `core-01-s4-run-event-log-and-writer`.
- Health-record appends, owned by `core-01-s2-replay-and-corruption` (tail repair) and
  `core-01-s4-run-event-log-and-writer` (writer path).
- Projection writes (`state`/`summary`/`metrics`/`launch`), owned by `core-01-s5-projections`.
- The `RunEventLog` interface declaration and the full assembled `RunEventLog` object, owned by
  `core-01-s1-event-contracts` (declaration) and `core-01-s4-run-event-log-and-writer` (assembly);
  this story implements the wait behavior that `s4` delegates to.
- The `RunEventCursor`, `WaitRunEventsRequest`, and `WaitRunEventsResult` type declarations, owned by
  `core-01-s1-event-contracts`; consumed, not redeclared.

### STOP Conditions And Boundaries

- Package or module boundary: `packages/sdk/src/core/run-lifecycle/cursor-wait` only.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/core/run-lifecycle/cursor-wait/**`,
  `packages/sdk/tests/core/run-lifecycle/cursor-wait/**`.
- Forbidden dependencies: no `testkit` in production source; no `cli`, `mcp`, or `provider-*`; no
  `LeaseStore`, `RunWriter`, or projection-write imports in the cursor-wait module; no ambient
  `Date.now()` or `new Date()` (inject the clock); no new failure tokens beyond
  `core-01-s1-event-contracts/RunReplayFailure`.
- STOP when: any requirement adds lease acquisition, event appending, projection writing, liveness
  state mutation, supervision timers, or operator blocking to this module — those belong to
  `core-01-s4-run-event-log-and-writer` (lease/append) or Epic 4 `core-04` (liveness wrap).

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check implementation against source story `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s6-cursor-wait.md` and AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.

- AC coverage by source `AC-n` id, including every failure, degraded, validation, and negative-fixture row named by the source contract.
- Evidence pack completeness against the source `Quality bar` and `Evidence pack` sections.
- Public API names, exports, and import paths against the source contract and DAG producer/consumer table.
- Dependency boundaries, committed dependency inputs, and `{{DEPENDENCY_COMMITS}}` consistency.
- Stale names and sibling occurrences of any issue found.
- Tests, targeted checks, coverage commands, forbidden-symbol sweeps, and `pnpm check` output.
- Scope control against allowed writes: `packages/sdk/src/core/run-lifecycle/cursor-wait/**`, `packages/sdk/tests/core/run-lifecycle/cursor-wait/**`.
- Repo conventions and mutation limits from `AGENTS.md` and the source contract.

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - Core runtime spine](../../../README.md) · **← Prev:** [Implementer Prompt: core-01-s6-cursor-wait](./implementer.md) · **Next →:** [Implementer Prompt: core-02-s1-capability-registry](../core-02-s1-capability-registry/implementer.md)

<!-- /DOCS-NAV -->
