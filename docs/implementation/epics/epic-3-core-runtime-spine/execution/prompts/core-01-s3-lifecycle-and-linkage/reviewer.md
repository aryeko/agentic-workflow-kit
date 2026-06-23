# Reviewer Prompt: core-01-s3-lifecycle-and-linkage

## Assigned Routing

- Source story id: `core-01-s3-lifecycle-and-linkage`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, `AC-14`.
- Model class: `frontier-reviewer`.
- Effort: `medium`.
- Suggested-tier floor: `standard`.
- Reasoning tier: `standard`.
- Routing rationale: core-01-s3-lifecycle-and-linkage covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14 and carries bounded pure lifecycle and linkage implementation with generated transition-table evidence. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Original Scope

- Story id: `core-01-s3-lifecycle-and-linkage`.
- Epic slug: `epic-3-core-runtime-spine`.
- Source story contract path: `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s3-lifecycle-and-linkage.md`.
- Allowed pathset: `packages/sdk/src/core/run-lifecycle/lifecycle/**`, `packages/sdk/tests/core/run-lifecycle/lifecycle/**`.
- Direct dependencies: `core-01-s1-event-contracts`.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus committed producer shapes and public import paths named in the source contract and DAG.

### Acceptance Criteria

Each AC is a single falsifiable assertion against a hermetic `*.unit.test.ts`. A happy-path assertion
proves only acceptance; every rejection AC names its own failing fixture. Each `evidence` names the
exact test id and the result it produces.

- **AC-1** A generated test enumerates every legal `(from, to)` edge in the table above — the 13 forward
  edges, the 4 recovery edges, and the 3 terminal targets (`blocked`/`failed`/`canceled`) expanded over
  each of the 11 non-terminal source states (33 terminal edges), for 50 legal edges total — and asserts
  the transition validator returns `{ ok: true }` for a fixture payload meeting that edge's constraint -
  evidence: `transition-table-legal-edges.unit.test.ts` is driven by a fixture array deriving all legal
  edges from the exported catalog and asserts `result.ok === true` for each.

- **AC-2** A generated test enumerates every ordered state-pair drawn from `{null} ∪ RunLifecycleState`
  that is NOT a legal edge of the table (the full cross-product minus the legal set) and asserts the
  transition validator returns `{ ok: false, error: "illegal-lifecycle-transition" }` for each - evidence:
  `transition-table-illegal-pairs.unit.test.ts` builds the rejected set as `(allStates × allStates) −
  legalEdges` from `transition-illegal-pairs.fixture.ts` and asserts `result.ok === false` and
  `result.error === "illegal-lifecycle-transition"` for every pair.

- **AC-3** A first transition whose `(from, to)` is not `null -> created` (fixture: `from = null,
  to = "configured"`) is rejected with `illegal-lifecycle-transition`, and a `null -> created`
  transition whose `sourceEventIds` does not reference a `RunCreated` event id is also rejected -
  evidence: `transition-first-edge.unit.test.ts` uses `first-transition-wrong-target.fixture.ts` and
  `created-missing-runcreated-ref.fixture.ts`; asserts `result.ok === false`,
  `result.error === "illegal-lifecycle-transition"` for each.

- **AC-4** A `created -> configured` transition whose `sourceEventIds` omits the `RunPolicyBound`
  reference, and a `configured -> task-snapshotted` transition that omits the `TaskSnapshotRecorded`
  reference, are each rejected with `illegal-lifecycle-transition` - evidence:
  `transition-factual-refs.unit.test.ts` uses `configured-missing-policybound-ref.fixture.ts` and
  `task-snapshotted-missing-snapshot-ref.fixture.ts`; asserts `result.ok === false`,
  `result.error === "illegal-lifecycle-transition"` for each.

- **AC-5** Each of the four recovery edges (`runner-verifying -> running`, `forge-waiting ->
  runner-verifying`, `merge-waiting -> forge-waiting`, `settling -> merge-waiting`) is accepted ONLY when
  `authority === "recovery"` and `sourceEventIds` carries retry evidence, and the same `(from, to)` with
  `authority !== "recovery"` (or with empty retry evidence) is rejected with
  `illegal-lifecycle-transition` - evidence: `transition-recovery-edges.unit.test.ts` asserts
  `result.ok === true` for each recovery edge with `authority = "recovery"` + evidence, and
  `result.ok === false`, `result.error === "illegal-lifecycle-transition"` using
  `recovery-edge-wrong-authority.fixture.ts` (one per edge).

- **AC-6** Any transition whose `from` is a terminal state (`completed`, `blocked`, `failed`,
  `canceled`) to any target is rejected with `illegal-lifecycle-transition`, proving a terminal source
  closes lifecycle mutation - evidence: `transition-terminal-closed.unit.test.ts` uses
  `post-terminal-transition.fixture.ts` (e.g. `from = "completed", to = "running"`) for each terminal
  source and asserts `result.ok === false`, `result.error === "illegal-lifecycle-transition"`.

- **AC-7** `RunLifecycleState` carries no `"abandoned"` member and the legal-transition table contains
  no edge targeting `"abandoned"`; the table's terminal set is exactly `{completed, blocked, failed,
  canceled}` - evidence: `terminal-vocabulary.unit.test.ts` asserts the exported terminal-state set deep
  -equals `["completed","blocked","failed","canceled"]` and that no table edge has `to === "abandoned"`.

- **AC-8** The lifecycle reducer, folding an ordered stream, moves `RunStateProjection.lifecycle` only on
  `RunLifecycleTransitioned` events: given a stream `[RunCreated, RunLifecycleTransitioned(null→created),
  RunPolicyBound, RunLifecycleTransitioned(created→configured)]` the reducer yields `lifecycle ===
  "configured"`, and a stream containing only `RunCreated`/`RunPolicyBound`/`TaskSnapshotRecorded`/
  `SessionLinked` (no `RunLifecycleTransitioned`) yields `lifecycle === null` - evidence:
  `lifecycle-reducer.unit.test.ts` asserts both folds, including that the factual-only stream leaves
  `lifecycle === null` and `currentSequence` unset by lifecycle.

- **AC-9** The lifecycle reducer is total: given a stream containing a well-formed `RunEventEnvelope`
  whose `type` is an unknown future type, the reducer does not throw and leaves `lifecycle` unchanged
  from the prior lifecycle event - evidence: `lifecycle-reducer-totality.unit.test.ts` folds a stream
  with an injected unknown-type envelope and asserts no throw and `lifecycle` equals the last
  `RunLifecycleTransitioned` target.

- **AC-10** Folding to a terminal transition sets `RunStateProjection.terminalReason` from the terminal
  `RunLifecycleTransitionPayload.reason` - evidence: `lifecycle-reducer-terminal.unit.test.ts` folds a
  stream ending in `... -> failed` with `reason = "driver-crash"` and asserts `lifecycle === "failed"`
  and `terminalReason === "driver-crash"`.

- **AC-11** The session-ordinal monotonicity predicate accepts a `SessionLinked` ordinal sequence that
  starts at 1 and is strictly contiguous (`[1,2,3]`) and rejects a sequence with a gap (`[1,3]`), a
  duplicate (`[1,1]`), a non-1 start (`[2]`), and a decrease (`[1,2,1]`) - evidence:
  `linkage-ordinal-monotonicity.unit.test.ts` asserts the predicate is `true` for `[1,2,3]` and `false`
  for each of the fixtures in `linkage-ordinal-violations.fixture.ts` (gap, duplicate, non-1-start,
  decrease).

- **AC-12** The linkage resolver returns the latest non-superseded link as `currentSession` and the full
  ordered history as `linkHistory`, where a `SessionLinkSuperseded` correcting an earlier ordinal removes
  that ordinal from resolution but keeps it in `linkHistory` (never clobbered) - evidence:
  `linkage-resolution.unit.test.ts` folds `[SessionLinked(1, primary), SessionLinked(2, primary),
  SessionLinkSuperseded(supersededOrdinal:1, replacementOrdinal:2)]` and asserts
  `currentSession.linkOrdinal === 2`, `linkHistory.length === 2`, and ordinal 1 is still present in
  `linkHistory`.

- **AC-13** The linkage resolver classifies `RunLaunchProjection.linkage` as `"known"` for exactly one
  non-superseded owning link, `"unknown"` for no link, and folds an ambiguous result (more than one
  conflicting non-superseded owning link) to `"unknown"` for the launch projection - evidence:
  `linkage-classification.unit.test.ts` provides three fixtures (one owning link → `"known"`; no links →
  `"unknown"`; two conflicting non-superseded owning links → `"unknown"`) and asserts the resolved
  `linkage` value for each.

- **AC-14** The table/validator, lifecycle reducer, ordinal-monotonicity predicate, and linkage resolver
  are each importable from the `sdk` package public entrypoint, not a private module path - evidence:
  `lifecycle-linkage-public-import.unit.test.ts` imports each from the `sdk` entrypoint and asserts each
  is a function (and the legal-edge catalog is a non-empty array).

### Dependencies And Frozen Inputs

- Covers signals: "Lifecycle transition records and terminal-state guardrails" and "Session link and
  supersession records" — as listed in the Epic 3 charter `core-01` per-domain expectations table (both
  owned by this story).
- Depends on: `core-01-s1-event-contracts` (type shapes only).
- Depended on by: `core-01-s4-run-event-log-and-writer` (transition enforcement + ordinal rule),
  `core-01-s5-projections` (lifecycle reducer + linkage resolution).
- Shared shapes consumed (verbatim, not redeclared):
  `core-01-s1-event-contracts/RunLifecycleState`,
  `core-01-s1-event-contracts/RunLifecycleTransitionPayload`,
  `core-01-s1-event-contracts/SessionLinkedPayload`,
  `core-01-s1-event-contracts/SessionLinkSupersededPayload`,
  `core-01-s1-event-contracts/RunStateProjection`,
  `core-01-s1-event-contracts/RunLaunchProjection`.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

### Non-Goals

- Enforcing transition legality **at append**, authoring `RunAppendRejected`, and mapping the
  monotonicity-violation predicate to a `RunAppendFailure` — owned by `core-01-s4-run-event-log-and-writer`
  (it calls this story's validator/predicate; never re-declares the table).
- Assembling the full `state`/`summary`/`metrics`/`launch` projections (`currentSequence`, `eventCount`,
  `parkedMs`, summary status, etc.) — owned by `core-01-s5-projections` (it uses this story's lifecycle
  reducer and linkage resolver; never re-declares them).
- Replay assembly, envelope validation, and corruption classification — owned by
  `core-01-s2-replay-and-corruption`.
- Type declarations of `RunLifecycleState`, `RunLifecycleTransitionPayload`, `SessionLinkedPayload`,
  `SessionLinkSupersededPayload`, `RunStateProjection`, `RunLaunchProjection` — declared once by
  `core-01-s1-event-contracts`, never redeclared here.
- Durability-class enforcement (`barrier` for terminal events) at append, and the durability-class
  rejection tests — owned by `core-01-s4` (this story records the design's `barrier` constraint on the
  table as a legality annotation, but does not append or fsync).

### STOP Conditions And Boundaries

- Package or module boundary: `packages/sdk/src/core/run-lifecycle/lifecycle/` only; test files under
  `packages/sdk/tests/core/run-lifecycle/lifecycle/`.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/core/run-lifecycle/lifecycle/**`,
  `packages/sdk/tests/core/run-lifecycle/lifecycle/**`.
- Forbidden dependencies (production source): `testkit`, any `provider-*` package, `cli`, `mcp`, any
  fnd-02 runtime module (`EventLogStore`/`LeaseStore`), driver, process, or network client; no
  append/replay/I/O; no ambient clock/randomness.
- STOP when: transition legality must be enforced **at append** or the monotonicity predicate mapped to
  a `RunAppendFailure` / `RunAppendRejected` (`core-01-s4-run-event-log-and-writer`); full
  `state`/`summary`/`metrics`/`launch` projection assembly is needed (`core-01-s5-projections`); replay
  assembly or corruption classification is needed (`core-01-s2-replay-and-corruption`); or a
  lifecycle/linkage type declaration needs to be authored (`core-01-s1-event-contracts`).

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check implementation against source story `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s3-lifecycle-and-linkage.md` and AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, `AC-14`.

- AC coverage by source `AC-n` id, including every failure, degraded, validation, and negative-fixture row named by the source contract.
- Evidence pack completeness against the source `Quality bar` and `Evidence pack` sections.
- Public API names, exports, and import paths against the source contract and DAG producer/consumer table.
- Dependency boundaries, committed dependency inputs, and `{{DEPENDENCY_COMMITS}}` consistency.
- Stale names and sibling occurrences of any issue found.
- Tests, targeted checks, coverage commands, forbidden-symbol sweeps, and `pnpm check` output.
- Scope control against allowed writes: `packages/sdk/src/core/run-lifecycle/lifecycle/**`, `packages/sdk/tests/core/run-lifecycle/lifecycle/**`.
- Repo conventions and mutation limits from `AGENTS.md` and the source contract.

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - Core runtime spine](../../../README.md) · **← Prev:** [Implementer Prompt: core-01-s3-lifecycle-and-linkage](./implementer.md) · **Next →:** [Implementer Prompt: core-01-s4-run-event-log-and-writer](../core-01-s4-run-event-log-and-writer/implementer.md)

<!-- /DOCS-NAV -->
