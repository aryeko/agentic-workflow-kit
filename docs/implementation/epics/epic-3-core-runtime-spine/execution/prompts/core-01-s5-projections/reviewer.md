# Reviewer Prompt: core-01-s5-projections

## Assigned Routing

- Source story id: `core-01-s5-projections`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, `AC-14`.
- Model class: `frontier-reviewer`.
- Effort: `medium`.
- Suggested-tier floor: `standard`.
- Reasoning tier: `standard`.
- Routing rationale: core-01-s5-projections covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14 and carries bounded pure projection reducers over replay and lifecycle inputs. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Original Scope

- Story id: `core-01-s5-projections`.
- Epic slug: `epic-3-core-runtime-spine`.
- Source story contract path: `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s5-projections.md`.
- Allowed pathset: `packages/sdk/src/core/run-lifecycle/projections/**`, `packages/sdk/tests/core/run-lifecycle/projections/**`.
- Direct dependencies: `core-01-s1-event-contracts`, `core-01-s2-replay-and-corruption`, `core-01-s3-lifecycle-and-linkage`.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus committed producer shapes and public import paths named in the source contract and DAG.

### Acceptance Criteria

- **AC-1** Given a deterministic in-memory event log with a fixed sequence of `RunEventEnvelope`
  records (byte-for-byte identical on each run), `project()` returns identical `RunProjections`
  every time it is called — evidence: `projection-determinism.unit.test.ts` replays the same
  fixture log twice and asserts deep-equal `RunProjections` for both calls (pass).

- **AC-2** `state.lifecycle` is the terminal value of the lifecycle fold; it equals the `to` field
  of the last `RunLifecycleTransitioned` event in the stream; `state.currentSequence` equals the
  envelope `sequence` of that last transition event; `state.writerEpoch` equals its `writerEpoch`;
  `state.degradedHealth` equals `RunReplay.health` — evidence:
  `state-projection-fold.unit.test.ts` constructs a fixture log ending at `running` and asserts
  each field matches its source value (pass).

- **AC-3** The `state` reducer ignores every event type other than `RunLifecycleTransitioned` —
  including `RunCreated`, `RunPolicyBound`, `TaskSnapshotRecorded`, `SessionLinked`, and arbitrary
  sibling-domain events — and does not advance `state.lifecycle` for them — evidence:
  `state-projection-fold.unit.test.ts` inserts `RunCreated` and `RunPolicyBound` envelopes before
  the first `RunLifecycleTransitioned` and asserts `state.lifecycle` remains the value set by the
  lifecycle events only (pass).

- **AC-4** `summary.runId` equals the `runId` from the `RunReplay`; `summary.taskId` is the
  `taskId` from the first `TaskSnapshotRecordedPayload` envelope; `summary.status` equals
  `state.lifecycle`; `summary.ownerSessionId` is the `sessionId` of the latest non-superseded
  `SessionLinkedPayload`; `summary.artifactRefs` is the union of all `artifactRefs` arrays across
  all envelopes — evidence: `summary-projection.unit.test.ts` builds a fixture log with one
  `TaskSnapshotRecorded`, two `SessionLinked` events (second supersedes first), and three
  envelopes with `artifactRefs`, and asserts each `summary` field (pass).

- **AC-5** Unknown well-formed envelopes (event `type` not in the declared core-01 catalog) are
  accumulated into `summary.unknownEvents[]` and the reducer never throws — evidence:
  `reducer-totality.unit.test.ts` injects a fixture `RunEventEnvelope` with `type =
  "sibling-domain.SomeUnknownEvent"` and a structurally valid payload and asserts (a) `project()`
  returns `ok: true`, (b) `summary.unknownEvents` contains exactly that envelope (pass on both).

- **AC-6** `metrics.eventCount` equals the total number of envelopes in the replay stream;
  `metrics.firstRecordedAt` is the earliest `recordedAt`; `metrics.lastRecordedAt` is the latest
  — evidence: `metrics-projection.unit.test.ts` constructs a five-event fixture and asserts all
  three fields (pass).

- **AC-7** `metrics.retryCount` counts only `RunLifecycleTransitioned` events with
  `authority = "recovery"` that re-enter an operational state per the recovery rows of the legal
  lifecycle table (e.g., `runner-verifying → running`, `forge-waiting → runner-verifying`,
  `merge-waiting → forge-waiting`, `settling → merge-waiting`); a sibling-domain event with a
  retry-like payload that is not a lifecycle re-entry transition does not increment `retryCount`
  — evidence: `metrics-retry-count.unit.test.ts` builds a fixture log with two recovery
  re-entry lifecycle transitions and one sibling event with `type =
  "sibling.RetryAttempted"` and asserts `retryCount === 2` (pass).

- **AC-8** `metrics.parkedMs` equals the sum of durations between each `running → parked`
  transition event's `occurredAt` and the corresponding subsequent `parked → running` transition
  event's `occurredAt`; a parked interval with no matching resume contributes zero (open interval)
  — evidence: `metrics-parked-ms.unit.test.ts` constructs a fixture with one complete parked
  interval (deterministic ISO timestamps 1000 ms apart) and asserts `parkedMs === 1000` (pass);
  a second fixture with an open parked interval (no resume) asserts `parkedMs === 0` (pass).

- **AC-9** `launch.policyDigest` is from the first `RunPolicyBoundPayload`; `launch.taskSnapshotDigest`
  is from the first `TaskSnapshotRecordedPayload`; `launch.linkHistory` contains all
  `SessionLinkedPayload`s in ascending `linkOrdinal` order, unfiltered — evidence:
  `launch-projection.unit.test.ts` builds a fixture with `RunPolicyBound`, `TaskSnapshotRecorded`,
  and two `SessionLinked` envelopes and asserts all three fields (pass).

- **AC-10** `launch.linkage` is `"known"` when exactly one latest non-superseded session link is
  resolvable (an unambiguous owner), `"unknown"` when no non-superseded link exists, and `"ambiguous"`
  when multiple conflicting non-superseded links make the owner ambiguous — evidence:
  `launch-linkage.unit.test.ts` provides three fixtures (no links, one link, two conflicting
  non-superseded links) and asserts `linkage` is `"unknown"`, `"known"`, and `"ambiguous"` respectively
  (pass on all three).

- **AC-11** When a `SessionLinkSuperseded` event supersedes link ordinal N, that link's
  `SessionLinkedPayload` is excluded from `launch.currentSession` and contributes to
  `launch.linkHistory` only as a historical fact (not as the current non-superseded link);
  the replacement ordinal's link becomes the non-superseded link — evidence:
  `launch-supersession.unit.test.ts` builds a fixture with two `SessionLinked` events where the
  second supersedes the first, and asserts `launch.currentSession.linkOrdinal === 2` and
  `launch.linkHistory` contains both (pass).

- **AC-12** A reducer-purity violation — specifically, a `project()` implementation that attempts
  to call any append API, write any file, or inspect live external state — is forbidden;
  the purity contract is proven by a structural test that the projection module does not import
  any fnd-02 `EventLogStore` append-path symbol, `LeaseCapability`, or any `RunWriter` method
  — evidence: `projection-purity.unit.test.ts` performs `grep -REn
  "openForAppend|append|createRun|openWriter|LeaseCapability|RunWriter"
  packages/sdk/src/core/run-lifecycle/projections/` and asserts zero matches (pass).

- **AC-13** `project()` returns `Result<RunProjections, RunReplayFailure>`; when the underlying
  `replay()` call returns a failure with code `malformed-envelope`, `interior-corrupt`,
  `event-log-unavailable`, or `malformed-declared-payload`, `project()` propagates that failure
  unchanged without throwing — evidence: `projection-replay-failure.unit.test.ts` injects a fake
  `replay()` returning each of the four failure codes and asserts `project()` returns `ok: false`
  with the identical code (pass on all four).

- **AC-14** `project`, `RunProjections`, `RunStateProjection`, `RunSummaryProjection`,
  `RunMetricsProjection`, and `RunLaunchProjection` are importable from the `sdk` public entrypoint
  (not a private path); the four projection types are re-exported from `core-01-s1-event-contracts`
  and not redeclared here — evidence: `projections-public-import.unit.test.ts` imports all six
  names from the `sdk` entrypoint and constructs one `RunProjections` value (pass).

### Dependencies And Frozen Inputs

- Covers signals: Pure `state`, `summary`, `metrics`, and `launch` projections (Epic 3 `core-01`).
- Depends on: `core-01-s1-event-contracts`, `core-01-s2-replay-and-corruption`,
  `core-01-s3-lifecycle-and-linkage` (band 3).
- Depended on by: `core-01-s4-run-event-log-and-writer` (delegates `project()` to this story's
  module).
- Shared shapes consumed:
  - `core-01-s1-event-contracts/RunProjections`
  - `core-01-s1-event-contracts/RunStateProjection`
  - `core-01-s1-event-contracts/RunSummaryProjection`
  - `core-01-s1-event-contracts/RunMetricsProjection`
  - `core-01-s1-event-contracts/RunLaunchProjection`
  - `core-01-s1-event-contracts/RunEventEnvelope`
  - `core-01-s1-event-contracts/RunReplay`
  - `core-01-s1-event-contracts/RunReplayFailure`
  - `core-01-s1-event-contracts/RunDegradedHealth`
  - `core-01-s1-event-contracts/RunLifecycleState`
  - `core-01-s1-event-contracts/SessionLinkedPayload`
  - `core-01-s1-event-contracts/SessionLinkSupersededPayload`
  - `core-01-s1-event-contracts/RunLifecycleTransitionPayload`
  - `core-01-s1-event-contracts/RunPolicyBoundPayload`
  - `core-01-s1-event-contracts/TaskSnapshotRecordedPayload`
  - `core-01-s2-replay-and-corruption/replay()` (input: the `RunReplay` value it produces)
  - `core-01-s3-lifecycle-and-linkage/lifecycle reducer` (the fold function for `RunLifecycleTransitioned`)
  - `core-01-s3-lifecycle-and-linkage/linkage resolution` (the rules for `launch.linkage`)

### Non-Goals

- Append, create, or write operations — owned by `core-01-s4-run-event-log-and-writer`.
- The `replay()` behavior itself and corruption classification — owned by
  `core-01-s2-replay-and-corruption`.
- The legal lifecycle transition table and fold logic ownership — owned by
  `core-01-s3-lifecycle-and-linkage` (this story _uses_ the s3 lifecycle reducer, not re-declares it).
- Cursor wait primitive (`waitRunEvents`) — owned by `core-01-s6-cursor-wait`.
- The `RunEventLog` assembly object (which delegates `project` here) — owned by
  `core-01-s4-run-event-log-and-writer`.

### STOP Conditions And Boundaries

- Package or module boundary: `packages/sdk/src/core/run-lifecycle/projections`.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/core/run-lifecycle/projections/**`,
  `packages/sdk/tests/core/run-lifecycle/projections/**`.
- Forbidden dependencies: no fnd-02 `EventLogStore` or `LeaseCapability`, no `RunWriter` or
  `createRun`/`openWriter`, no `testkit`, no `cli`, no `mcp`, no concrete provider package, no
  ambient clock or randomness source.
- STOP when: append or write path (s4) is needed, replay internals or corruption handling (s2) must
  be changed, lifecycle table itself must be re-declared (s3), or cursor/wait behavior (s6) is reached.

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check implementation against source story `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s5-projections.md` and AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, `AC-14`.

- AC coverage by source `AC-n` id, including every failure, degraded, validation, and negative-fixture row named by the source contract.
- Evidence pack completeness against the source `Quality bar` and `Evidence pack` sections.
- Public API names, exports, and import paths against the source contract and DAG producer/consumer table.
- Dependency boundaries, committed dependency inputs, and `{{DEPENDENCY_COMMITS}}` consistency.
- Stale names and sibling occurrences of any issue found.
- Tests, targeted checks, coverage commands, forbidden-symbol sweeps, and `pnpm check` output.
- Scope control against allowed writes: `packages/sdk/src/core/run-lifecycle/projections/**`, `packages/sdk/tests/core/run-lifecycle/projections/**`.
- Repo conventions and mutation limits from `AGENTS.md` and the source contract.

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - Core runtime spine](../../../README.md) · **← Prev:** [Implementer Prompt: core-01-s5-projections](./implementer.md) · **Next →:** [Implementer Prompt: core-01-s6-cursor-wait](../core-01-s6-cursor-wait/implementer.md)

<!-- /DOCS-NAV -->
