# Implementer Prompt: core-01-s5-projections

## Assigned Routing

- Source story id: `core-01-s5-projections`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, `AC-14`.
- Model class: `general-coder`.
- Effort: `medium`.
- Suggested-tier floor: `standard`.
- Reasoning tier: `standard`.
- Routing rationale: core-01-s5-projections covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14 and carries bounded pure projection reducers over replay and lifecycle inputs. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Exact Task

Implement source story `core-01-s5-projections` for epic `epic-3-core-runtime-spine`. Deliver exactly the outcome in the ready source contract and nothing outside it:

The `packages/sdk/src/core/run-lifecycle/projections` module providing the `project()` function
(composing four pure reducers) and re-exporting the `RunProjections` shape (and its four sub-types)
from `core-01-s1-event-contracts` through the `sdk` public entrypoint, plus the evidence pack.

## Why It Matters

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

The DAG dependents for this story are: `core-01-s4-run-event-log-and-writer`. Preserve the producer/consumer shape boundaries named above so later stories can consume committed dependency inputs without re-declaring or widening this story's scope.

## Required Reading

- `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s5-projections.md` — source story contract for `core-01-s5-projections`.
- `docs/implementation/epics/epic-3-core-runtime-spine/story-dag.md` — frozen DAG row, dependencies, owned pathset, wave, and suggested-tier floor for `core-01-s5-projections`.
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/projections-lifecycle-and-tests.md`
  §Projection model, §Session linkage, §Testing strategy
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md` — projection types
  and `RunEventLog.project` signature
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md` §6
- `core-01-s1-event-contracts` story contract (type producer)
- `core-01-s2-replay-and-corruption` story contract (`RunReplay` input shape)
- `core-01-s3-lifecycle-and-linkage` story contract (lifecycle reducer + linkage resolution rules)
- `docs/engineering/test-lanes.md`
- `docs/design/20-sdk-and-packaging/dependency-rules.md`

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.
- `{{DEPENDENCY_COMMITS}}` — runtime slot for committed dependency story inputs when this story has dependencies.

## Acceptance Criteria

Source story: `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s5-projections.md`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, `AC-14`.

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

## Allowed Writes

Source story: `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s5-projections.md`. Owned pathset from the frozen DAG and source contract:

- `packages/sdk/src/core/run-lifecycle/projections/**`
- `packages/sdk/tests/core/run-lifecycle/projections/**`

Every other write is forbidden, including this execution package, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, commits, pushes, PRs, and merges.

## Dependency Inputs

Direct dependency story ids: `core-01-s1-event-contracts`, `core-01-s2-replay-and-corruption`, `core-01-s3-lifecycle-and-linkage`.

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

Use `{{DEPENDENCY_COMMITS}}` for dependency commits that can only exist during execution. Import only producer-owned public shapes and paths named by the DAG or source contract.

## Non-Goals And STOP Conditions

### Source Out Of Scope

- Append, create, or write operations — owned by `core-01-s4-run-event-log-and-writer`.
- The `replay()` behavior itself and corruption classification — owned by
  `core-01-s2-replay-and-corruption`.
- The legal lifecycle transition table and fold logic ownership — owned by
  `core-01-s3-lifecycle-and-linkage` (this story _uses_ the s3 lifecycle reducer, not re-declares it).
- Cursor wait primitive (`waitRunEvents`) — owned by `core-01-s6-cursor-wait`.
- The `RunEventLog` assembly object (which delegates `project` here) — owned by
  `core-01-s4-run-event-log-and-writer`.

### Source Boundaries And STOP Conditions

- Package or module boundary: `packages/sdk/src/core/run-lifecycle/projections`.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/core/run-lifecycle/projections/**`,
  `packages/sdk/tests/core/run-lifecycle/projections/**`.
- Forbidden dependencies: no fnd-02 `EventLogStore` or `LeaseCapability`, no `RunWriter` or
  `createRun`/`openWriter`, no `testkit`, no `cli`, no `mcp`, no concrete provider package, no
  ambient clock or randomness source.
- STOP when: append or write path (s4) is needed, replay internals or corruption handling (s2) must
  be changed, lifecycle table itself must be re-declared (s3), or cursor/wait behavior (s6) is reached.

Also stop and report if dependency inputs are missing, required writes fall outside the allowed pathset, a source gap blocks implementation, or any AC would need reinterpretation.

## Implementation Constraints

### Source Responsibilities

- Accept a `core-01-s2-replay-and-corruption/replay()` result (`RunReplay`) and fold events through
  four pure reducers, producing `RunProjections = { state, summary, metrics, launch }`.
- `state` reducer: fold only `RunLifecycleTransitioned` events using the
  `core-01-s3-lifecycle-and-linkage` lifecycle reducer; populate `lifecycle`, `currentSequence`,
  `writerEpoch?`, `terminalReason?`, and `degradedHealth` (forwarded from `RunReplay.health`).
- `summary` reducer: populate `runId`, `taskId?` (from `TaskSnapshotRecordedPayload`), `status`
  (= `state.lifecycle` at fold end), `ownerSessionId?` (latest non-superseded link's `sessionId`),
  `artifactRefs[]` (accumulated across all envelopes), and `unknownEvents[]` (every
  `RunEventEnvelope` whose `type` is not in the declared core-01 event catalog and whose payload is
  well-formed; reducer never throws for unknown well-formed payloads).
- `metrics` reducer: compute `eventCount` (total envelopes in replay stream), `retryCount` (count of
  `RunLifecycleTransitioned` events that are recovery-authority lifecycle re-entries — specifically,
  transitions with `authority = "recovery"` re-entering an operational state per the legal recovery
  rows in the lifecycle table; sibling-domain retry payload parsing is not performed), `parkedMs`
  (sum of durations between `running → parked` and `parked → running` transitions using
  `occurredAt` timestamps from envelopes), `firstRecordedAt?` (earliest `recordedAt` in stream),
  `lastRecordedAt?` (latest `recordedAt` in stream).
- `launch` reducer: extract `policyDigest?` (from `RunPolicyBoundPayload`),
  `taskSnapshotDigest?` (from `TaskSnapshotRecordedPayload`), `linkage` (`"known"` when exactly one
  latest non-superseded link is resolvable, `"unknown"` when no non-superseded link exists, and
  `"ambiguous"` when multiple conflicting non-superseded links make the owner ambiguous),
  `currentSession?` (the latest
  non-superseded `SessionLinkedPayload`), and `linkHistory[]` (all `SessionLinkedPayload`s in
  ordinal order, unfiltered).
- Enforce projection purity: reducers do not call append APIs, do not write projection files, do not
  mutate `RunReplay` inputs, do not inspect live external state, and do not call any provider
  contract.
- Expose `project` on the `sdk` public entrypoint; the four projection types are re-exported from
  `core-01-s1-event-contracts`.

### Source Spec Surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types: `RunProjections`, `RunStateProjection`, `RunSummaryProjection`,
  `RunMetricsProjection`, `RunLaunchProjection` (all produced by `core-01-s1-event-contracts`; this
  story populates their values), `RunEventEnvelope`, `RunReplay`, `RunDegradedHealth`,
  `RunLifecycleState`, `SessionLinkedPayload`, `RunLifecycleTransitionPayload`,
  `RunPolicyBoundPayload`, `TaskSnapshotRecordedPayload`, `RunReplayFailure`.
- Provider operations / commands: `project(runId: string): Result<RunProjections, RunReplayFailure>`
  (the function this story implements; declared on `RunEventLog` in `core-01-s1`).
- Failure and degraded tokens: `malformed-envelope`, `interior-corrupt`, `event-log-unavailable`,
  `malformed-declared-payload` (all from `core-01-s1-event-contracts/RunReplayFailure`; forwarded
  from replay health — this story adds no new failure tokens).
- Evidence records / attestations: none new; `RunProjections` is the output record.

Done requires every item here present with the design's names, shapes, and semantics.

Do not introduce implementation choices outside the names, events, failure tokens, determinism rules, boundary rules, import rules, conformance obligations, and safety invariants fixed above.

## Verification

### Source Quality Bar

- Coverage scope and threshold: `packages/sdk/src/core/run-lifecycle/projections/**` at 90% minimum,
  aiming for 95%. Type-only declarations (`RunProjections` and the four projection types) are owned
  by `core-01-s1-event-contracts` and proven by type-level fixtures; the coverage scope here is
  the reducer and `project()` implementation lines.
- Coverage command and instrumented lane(s): `pnpm coverage:baseline` instruments the unit lane for
  the aggregate gate; for a focused per-story report: `pnpm exec vitest run --project unit
  --coverage --passWithNoTests --
  packages/sdk/tests/core/run-lifecycle/projections/*.unit.test.ts`.
- Required tests, catalogued by AC and failure row:
  - `projection-determinism.unit.test.ts` (AC-1)
  - `state-projection-fold.unit.test.ts` (AC-2, AC-3)
  - `summary-projection.unit.test.ts` (AC-4)
  - `reducer-totality.unit.test.ts` (AC-5, unknown-event-preserved row)
  - `metrics-projection.unit.test.ts` (AC-6)
  - `metrics-retry-count.unit.test.ts` (AC-7)
  - `metrics-parked-ms.unit.test.ts` (AC-8)
  - `launch-projection.unit.test.ts` (AC-9)
  - `launch-linkage.unit.test.ts` (AC-10)
  - `launch-supersession.unit.test.ts` (AC-11)
  - `projection-purity.unit.test.ts` (AC-12)
  - `projection-replay-failure.unit.test.ts` (AC-13, all four failure-row negative fixtures)
  - `projections-public-import.unit.test.ts` (AC-14)
- Public exposure (import path + public-import test): `project` function and the six names
  (`RunProjections`, `RunStateProjection`, `RunSummaryProjection`, `RunMetricsProjection`,
  `RunLaunchProjection`) exported from the `sdk` public entrypoint per
  `epic0-s4-export-templates/PackageExportConvention`; proven by
  `projections-public-import.unit.test.ts` importing from `"sdk"` (not a private path) and
  constructing one `RunProjections` value.
- Determinism constraints: the `project()` module accepts a `RunReplay` value (injected from `s2`);
  it does not call `Date.now()`, `new Date()`, `Math.random()`, or `crypto.randomUUID()`. All
  timestamps used in `metrics.parkedMs` computation are read from `occurredAt` fields on
  `RunEventEnvelope` records in the injected replay. The `replay()` dependency is injected as a
  function parameter or module-level port so tests can substitute a deterministic in-memory fake
  without real filesystem or network.
- Dependency boundaries: `packages/sdk/src/core/run-lifecycle/projections/**` must import only
  `core-01-s1-event-contracts` types and `core-01-s3-lifecycle-and-linkage` reducer/linkage
  functions; no `testkit`, no `cli`, no `mcp`, no fnd-02 `EventLogStore` or `LeaseCapability`,
  no concrete provider package.
- File-size budget (lines per file; default soft cap ~200): each of the four reducers
  (`state`, `summary`, `metrics`, `launch`) in its own file ≤ 200 lines; the `project()` entry
  point that composes them ≤ 200 lines; shared projection types are in `core-01-s1-event-contracts`
  (not re-declared here).
- Domain non-negotiables: projections are pure functions; replay is authoritative; cached snapshots
  are discardable acceleration only and must never override a full replay result; reducer totality
  is absolute — a well-formed unknown event never throws and is captured in `summary.unknownEvents`.

### Source Evidence Pack

- Test name or artifact proving each AC (catalogued in Required tests above).
- Negative fixtures for all four failure-row codes in `projection-replay-failure.unit.test.ts`; the
  unknown-event-preserved row's negative fixture in `reducer-totality.unit.test.ts`; the purity
  grep in `projection-purity.unit.test.ts`.
- `pnpm check` result, unless blocked by a named unrelated repository issue.
- Coverage command, instrumented lane, and number for `packages/sdk/src/core/run-lifecycle/projections/**`.
- Public-import test result: `projections-public-import.unit.test.ts` pass, importing from `"sdk"`.
- Boundary/forbidden-symbol sweep (runnable recipe): `grep -REn
  "openForAppend|append|createRun|openWriter|LeaseCapability|RunWriter|testkit|/cli/|/mcp/"
  packages/sdk/src/core/run-lifecycle/projections/` — expected zero matches; captured output in
  evidence pack. A non-empty match means the projections module leaked a forbidden dependency.
- `pnpm deps` to prove `sdk → pure libs only` dependency-rule edge.

Run the targeted commands and `pnpm check`, then report exact command output or an explicit blocked reason. Do not treat prose-only claims as evidence.

## Delivery Report

Return a report with changed files, AC coverage by `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, `AC-14`, tests and checks run, evidence pack, open questions, and blockers. The report is review evidence only; it is not permission to update tracker state or perform delivery actions.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - Core runtime spine](../../../README.md) · **← Prev:** [Reviewer Prompt: core-01-s4-run-event-log-and-writer](../core-01-s4-run-event-log-and-writer/reviewer.md) · **Next →:** [Reviewer Prompt: core-01-s5-projections](./reviewer.md)

<!-- /DOCS-NAV -->
