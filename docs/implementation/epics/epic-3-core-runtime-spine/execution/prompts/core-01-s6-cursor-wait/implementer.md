# Implementer Prompt: core-01-s6-cursor-wait

## Assigned Routing

- Source story id: `core-01-s6-cursor-wait`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.
- Model class: `general-coder`.
- Effort: `medium`.
- Suggested-tier floor: `standard`.
- Reasoning tier: `standard`.
- Routing rationale: core-01-s6-cursor-wait covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8 and carries bounded cursor wait behavior with injected clock and no mutation authority. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Exact Task

Implement source story `core-01-s6-cursor-wait` for epic `epic-3-core-runtime-spine`. Deliver exactly the outcome in the ready source contract and nothing outside it:

The `packages/sdk/src/core/run-lifecycle/cursor-wait` module providing the `waitRunEvents` bounded-poll
behavior, exported via the `sdk` public entrypoint, plus the evidence pack.

## Why It Matters

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

The DAG dependents for this story are: `core-01-s4-run-event-log-and-writer`. Preserve the producer/consumer shape boundaries named above so later stories can consume committed dependency inputs without re-declaring or widening this story's scope.

## Required Reading

- `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s6-cursor-wait.md` — source story contract for `core-01-s6-cursor-wait`.
- `docs/implementation/epics/epic-3-core-runtime-spine/story-dag.md` — frozen DAG row, dependencies, owned pathset, wave, and suggested-tier floor for `core-01-s6-cursor-wait`.
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md` §5 (`waitRunEvents` paragraph).
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md` (`RunEventCursor`, `WaitRunEventsRequest`, `WaitRunEventsResult`, `RunReplayFailure`).
- `core-01-s1-event-contracts` story contract (the types this story consumes and does not redeclare).
- `core-01-s2-replay-and-corruption` story contract (the `replay()` behavior polled by this story).
- `core-01-s4-run-event-log-and-writer` story contract (how `s4` delegates `waitRunEvents` here).
- `epic0-s4-export-templates` story contract (`PackageExportConvention`).
- `docs/engineering/test-lanes.md`, `docs/design/20-sdk-and-packaging/dependency-rules.md`.

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.
- `{{DEPENDENCY_COMMITS}}` — runtime slot for committed dependency story inputs when this story has dependencies.

## Acceptance Criteria

Source story: `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s6-cursor-wait.md`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.

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

## Allowed Writes

Source story: `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s6-cursor-wait.md`. Owned pathset from the frozen DAG and source contract:

- `packages/sdk/src/core/run-lifecycle/cursor-wait/**`
- `packages/sdk/tests/core/run-lifecycle/cursor-wait/**`

Every other write is forbidden, including this execution package, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, commits, pushes, PRs, and merges.

## Dependency Inputs

Direct dependency story ids: `core-01-s1-event-contracts`, `core-01-s2-replay-and-corruption`.

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

Use `{{DEPENDENCY_COMMITS}}` for dependency commits that can only exist during execution. Import only producer-owned public shapes and paths named by the DAG or source contract.

## Non-Goals And STOP Conditions

### Source Out Of Scope

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

### Source Boundaries And STOP Conditions

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

Also stop and report if dependency inputs are missing, required writes fall outside the allowed pathset, a source gap blocks implementation, or any AC would need reinterpretation.

## Implementation Constraints

### Source Responsibilities

- Implement the `waitRunEvents(request: WaitRunEventsRequest): Promise<Result<WaitRunEventsResult, RunReplayFailure>>` behavior: poll `core-01-s2-replay-and-corruption/replay()` in a bounded async loop until events after `cursor.afterSequence` are found or `timeoutMs` elapses.
- Return events after `cursor.afterSequence` in the result's `events` array, respecting `maxEvents` when set; advance `cursor.afterSequence` to the last delivered event's sequence in the returned `WaitRunEventsResult.cursor`.
- When `timeoutMs` elapses with no new events, return `timedOut: true` and an empty `events` array with the cursor unchanged.
- Carry `health` and `healthRecords` from the final replay pass into `WaitRunEventsResult`.
- Set `lastSequence` in the result to the log's current last sequence from the most recent replay pass.
- Surface any `RunReplayFailure` from the underlying replay as the `waitRunEvents` error, without wrapping or re-interpreting the failure codes.
- Never acquire or renew a lease, append any event or health record, write a projection, or mutate liveness state — `waitRunEvents` is strictly read-only over replay.
- Accept clock and sleep/backoff injection for the timeout boundary so that tests are deterministic without real wall time and empty polls yield instead of hot-spinning.
- Export `waitRunEvents` (the stand-alone behavior function, not the `RunEventLog` interface) from the `sdk` public entrypoint per `epic0-s4-export-templates/PackageExportConvention`.

### Source Spec Surface

What the normative design defines and the implementation must expose or consume, by name (runtime types
variant):

- Interfaces / types: `WaitRunEventsRequest`, `WaitRunEventsResult`, `RunEventCursor` (consumed from
  `core-01-s1-event-contracts`; `waitRunEvents` is a method on `RunEventLog` declared there — this
  story implements the behavior, not a new declaration).
- Events / append intents: none — `waitRunEvents` is read-only; it appends no events.
- Provider operations / commands: `waitRunEvents(request: WaitRunEventsRequest): Promise<Result<WaitRunEventsResult, RunReplayFailure>>` — the bounded async poll over `core-01-s2-replay-and-corruption/replay()`.
- Failure and degraded tokens: surfaces `core-01-s1-event-contracts/RunReplayFailure` codes
  `"malformed-envelope"`, `"interior-corrupt"`, `"event-log-unavailable"`, `"malformed-declared-payload"`
  verbatim from the underlying replay; no new failure token is introduced by this story.
- Evidence records / attestations: none — no evidence append; `WaitRunEventsResult.health` and
  `WaitRunEventsResult.healthRecords` carry the health signal from the underlying replay pass.

Done requires every item here present with the design's names, shapes, and semantics.

Do not introduce implementation choices outside the names, events, failure tokens, determinism rules, boundary rules, import rules, conformance obligations, and safety invariants fixed above.

## Verification

### Source Quality Bar

- Coverage scope and threshold: all runtime helpers in `packages/sdk/src/core/run-lifecycle/cursor-wait/**` at ≥ 90%, aiming for 95%.
- Coverage command and instrumented lane(s): `pnpm coverage:baseline` instruments the unit lane for the aggregate gate; focused per-story report via `pnpm exec vitest run --project unit --coverage --passWithNoTests -- packages/sdk/tests/core/run-lifecycle/cursor-wait/*.unit.test.ts`.
- Required tests, catalogued by AC and failure row:
  - `cursor-wait-returns-events.unit.test.ts` (AC-1)
  - `cursor-wait-max-events.unit.test.ts` (AC-2)
  - `cursor-wait-timeout.unit.test.ts` (AC-3)
  - `cursor-wait-cursor-advances.unit.test.ts` (AC-4)
  - `cursor-wait-health-passthrough.unit.test.ts` (AC-5)
  - `cursor-wait-replay-failure.unit.test.ts` (AC-6; covers all four `RunReplayFailure` codes via four fixture variants)
  - `cursor-wait-read-only-invariants.unit.test.ts` (AC-7; both events-found and timed-out paths)
  - `cursor-wait-public-import.unit.test.ts` (AC-8)
- Public exposure (import path + public-import test): `waitRunEvents` exported from the `sdk` public
  entrypoint per `epic0-s4-export-templates/PackageExportConvention` (export from
  `packages/sdk/src/index.ts` barrel; `exports` map in `package.json`); proven by
  `cursor-wait-public-import.unit.test.ts` importing `{ waitRunEvents }` from `"sdk"`.
- Determinism constraints: clock is injected as a port (a `() => number` returning milliseconds
  since epoch); no ambient `Date.now()` or `new Date()` in production source; poll loop uses only the
  injected clock. Replay is a synchronous injected fake. All tests are hermetic with zero real
  process/network/filesystem.
- Dependency boundaries: `packages/sdk` production source imports only pure runtime libraries and
  `core-01-s1-event-contracts` / `core-01-s2-replay-and-corruption` SDK types; must not import
  `testkit`, `cli`, `mcp`, any `provider-*`, any lease store implementation, or any projection writer;
  test files are exempt from the production-testkit rule per `dependency-rules.md`.
- File-size budget (lines per file; default soft cap ~200): the poll implementation, the clock port
  type, and any exported helpers remain in separate focused files each ≤ 200 lines.
- Domain non-negotiables: `waitRunEvents` is strictly read-only — it never acquires a lease, appends
  an event, writes a projection, or mutates any liveness state; any future requirement that adds
  mutation is a STOP condition (see below). The `timedOut: true` path must return an empty `events`
  array and an unchanged cursor. All four `RunReplayFailure` codes are surfaced without re-wrapping.

### Forbidden-symbol sweep (runnable recipe)

```sh
grep -REn "LeaseStore|openWriter|createRun|project\(|writeProjection|liveness|acquire|renew\b|\.append\(|Date\.now\(\)|new Date\(" \
  packages/sdk/src/core/run-lifecycle/cursor-wait/
```

- Path root: `packages/sdk/src/core/run-lifecycle/cursor-wait/`.
- Forbidden-token set: `LeaseStore`, `openWriter`, `createRun`, `project(`, `writeProjection`,
  `liveness`, `acquire`, `renew` (word-boundary), `.append(`, `Date.now()`, `new Date(`.
- Expected result: zero matches (exit code 1, no lines), captured into the evidence pack. Any match
  means the cursor-wait module has leaked a mutation side-effect or an ambient clock and fails this
  story.

### Source Evidence Pack

- Test name or artifact proving each AC (catalogued above under Required tests).
- Test name or artifact proving each failure/degraded row: `cursor-wait-replay-failure.unit.test.ts`
  with four fixture variants — one per `RunReplayFailure` code (`malformed-envelope`,
  `interior-corrupt`, `event-log-unavailable`, `malformed-declared-payload`).
- Negative fixture for the replay-failure path: a fake `replay()` returning each `RunReplayFailure`
  code in turn, asserting the result is `{ ok: false, error: { code: <code> } }` with no `events`
  leakage.
- `pnpm check` result, unless blocked by a named unrelated repository issue.
- Coverage command, instrumented lane, and number for the stated scope.
- Public-import test result: `cursor-wait-public-import.unit.test.ts` importing `waitRunEvents` from
  `"sdk"` (not a private module path).
- Forbidden-symbol sweep: the exact command above, path root, forbidden-token set, and zero-match
  output, captured.
- Read-only invariant evidence: `cursor-wait-read-only-invariants.unit.test.ts` spy call-count output
  showing 0 calls to any lease, append, or projection-write surface on both the events-found and
  timed-out paths.
- Conformance evidence is recorded/in-memory only (fake `replay()`, injected clock, spy fakes); no
  real `EventLogStore`, `LeaseStore`, filesystem, process, or network.

Run the targeted commands and `pnpm check`, then report exact command output or an explicit blocked reason. Do not treat prose-only claims as evidence.

## Delivery Report

Return a report with changed files, AC coverage by `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, tests and checks run, evidence pack, open questions, and blockers. The report is review evidence only; it is not permission to update tracker state or perform delivery actions.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - Core runtime spine](../../../README.md) · **← Prev:** [Reviewer Prompt: core-01-s5-projections](../core-01-s5-projections/reviewer.md) · **Next →:** [Reviewer Prompt: core-01-s6-cursor-wait](./reviewer.md)

<!-- /DOCS-NAV -->
