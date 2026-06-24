---
title: "core-01-s3-lifecycle-and-linkage - lifecycle legal-transition table and session linkage rules implementation story"
id: "core-01-s3-lifecycle-and-linkage"
epic: 3
status: "story: ready"
design:
  - "docs/design/30-domain-reference/core/run-lifecycle-and-state/projections-lifecycle-and-tests.md"
  - "docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md"
  - "docs/design/30-domain-reference/core/run-lifecycle-and-state/event-log-writer-and-corruption.md"
---

# core-01-s3-lifecycle-and-linkage - Lifecycle Legal-Transition Table and Session Linkage Rules

## Purpose

Own the lifecycle legal-transition table (with terminal-state guardrails), the pure lifecycle reducer
that folds only `RunLifecycleTransitioned`, and the append-only session-linkage rules (monotonic
ordinals, supersession, and latest-non-superseded resolution) — as a pure validate/fold module that
`core-01-s4` cites to enforce transitions at append and `core-01-s5` cites to fold lifecycle state and
resolve `launch.linkage` (FR-11, NFR-DET, NFR-SAFE; story-DAG catalog/behavior-ownership rule).

## Normative design

- `docs/design/30-domain-reference/core/run-lifecycle-and-state/projections-lifecycle-and-tests.md`
  — §Lifecycle state machine (THE normative legal transition table including the four recovery-classified
  rows and the three Any-non-terminal terminal rows; the `null -> created` first-transition and
  `RunCreated`/`RunPolicyBound`/`TaskSnapshotRecorded` reference rules; terminal vocabulary
  `completed|blocked|failed|canceled`, no `abandoned`, terminal closes lifecycle mutation for the writer
  epoch, post-terminal non-lifecycle facts cannot change state); §Session linkage (`linkOrdinal` starts
  at 1 and is strictly contiguous, supersession appends and never clobbers, latest-non-superseded
  resolution, missing → `launch.linkage = "unknown"`, ambiguous → `launch.linkage = "ambiguous"`);
  §Failure and degraded modes
  (`illegal-lifecycle-transition`).
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md` §Core decisions —
  `RunLifecycleTransitioned` is the only event that authors lifecycle state; `RunCreated`,
  `RunPolicyBound`, `TaskSnapshotRecorded`, `SessionLinked` are factual events that never move state on
  their own; a terminal transition closes lifecycle mutation for that writer epoch; session linkage is
  append-only and monotonic and no link fact is clobbered.
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/event-log-writer-and-corruption.md`
  §Append protocol — the validations the writer performs that this story OWNS the rule for (`s4` calls
  them): every `RunLifecycleTransitioned` payload is legal from the current replayed state; `created`/
  `configured`/`task-snapshotted` transitions reference the factual `RunCreated`/`RunPolicyBound`/
  `TaskSnapshotRecorded` event ids; session-linkage ordinals are monotonic.
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md` — the consumed shape
  declarations (`RunLifecycleState`, `RunLifecycleTransitionPayload`, `SessionLinkedPayload`,
  `SessionLinkSupersededPayload`, `RunStateProjection`, `RunLaunchProjection`); declared by
  `core-01-s1-event-contracts`, never redeclared here.
- `docs/design/20-sdk-and-packaging/dependency-rules.md`, `sdk-boundary.md` — `sdk` imports only pure
  runtime libraries; no `testkit`, `provider-*`, `cli`, `mcp`, driver, process, or network in production
  source.
- `docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/stories/epic0-s4-export-templates.md`
  — `PackageExportConvention` for the public `sdk` entrypoint (export + barrel + `exports`).
- `docs/engineering/test-lanes.md` — the hermetic `*.unit.test.ts` lane (zero process/network/filesystem).

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name (runtime-types
variant). This story produces a pure validate/fold module — no append, no full projection, no replay.

- Interfaces / types consumed (declared by `core-01-s1-event-contracts`; not redeclared here):
  `RunLifecycleState`, `RunLifecycleTransitionPayload`, `SessionLinkedPayload`,
  `SessionLinkSupersededPayload`, `RunStateProjection` (the `lifecycle` and `terminalReason` fields this reducer sets),
  `RunLaunchProjection` (the `linkage`/`currentSession`/`linkHistory` linkage fields this story's
  resolver fills for `core-01-s5`), `RunDurabilityClass`.
- Produced surface (the invariant/catalog cited by `s4` and `s5`):
  - **Legal-transition table** — the closed set of legal `(from, to)` edges exactly as enumerated below,
    with per-edge constraints (factual-event reference requirement, recovery authority/evidence
    requirement, terminal `barrier`/evidence requirement). The single source of truth for transition
    legality; `s4` calls the validator, neither `s4` nor `s5` re-declares the table.
  - **Transition validator** — a pure function `(from: RunLifecycleState | null, payload:
    RunLifecycleTransitionPayload) -> Result<void, "illegal-lifecycle-transition">` that accepts a legal
    edge meeting its constraints and rejects every state-pair not in the table (and every legal pair
    whose constraints are unmet, e.g. a recovery edge without `authority = "recovery"`).
  - **Lifecycle reducer** — a pure total fold over the ordered event stream that moves
    `RunStateProjection.lifecycle` ONLY for `RunLifecycleTransitioned` events (all other event types are
    inert), starting from `null`, populating `terminalReason` on a terminal transition; never throws on
    well-formed unknown events.
  - **Session-ordinal monotonicity rule** — the validator predicate over the `SessionLinked` ordinal
    sequence: `linkOrdinal` starts at 1 and is strictly contiguous (no gap, no duplicate, no decrease);
    a gap/duplicate is a monotonicity violation.
  - **Linkage resolver** — a pure function over the `SessionLinked` / `SessionLinkSuperseded` history
    producing the latest-non-superseded link plus the `RunLaunchProjection.linkage` classification
    (`"known"` / `"unknown"` / `"ambiguous"`), where ambiguous or missing linkage resolves to
    `"unknown"` for the launch projection.
- Failure / degraded tokens (catalog owned by `core-01-s1-event-contracts`; behavior raised here as the
  validator outcome and consumed by `s4`):
  - `illegal-lifecycle-transition` — a transition not in the legal table, or a legal-edge constraint
    unmet (missing factual reference; recovery edge without `authority = "recovery"` / retry evidence;
    terminal target from a terminal source; first transition not `null -> created`).
  - Session-ordinal monotonicity violation — a `SessionLinked` ordinal that is not the contiguous
    successor (gap, duplicate, or decrease) is rejected by the monotonicity predicate (the writer in
    `s4` maps this rejection to its append failure; this story owns the predicate and its boolean
    outcome).

The legal-transition table this story owns (the closed set; no other edge is legal):

| from | to | constraint |
|---|---|---|
| `null` | `created` | first transition only; references `RunCreated`; `barrier`. |
| `created` | `configured` | references `RunPolicyBound`; `barrier`. |
| `configured` | `task-snapshotted` | references `TaskSnapshotRecorded`; `barrier`. |
| `task-snapshotted` | `workspace-ready` | workspace evidence fact referenced. |
| `workspace-ready` | `worker-starting` | launch evidence fact referenced. |
| `worker-starting` | `running` | references `SessionLinked` for the primary/recovery owner. |
| `running` | `parked` | parked requires attention/approval evidence. |
| `running` | `runner-verifying` | verifier entry requires worker-done evidence. |
| `parked` | `running` | resume fact referenced. |
| `runner-verifying` | `forge-waiting` | verification evidence fact referenced. |
| `forge-waiting` | `merge-waiting` | PR/check/review gate evidence fact referenced. |
| `merge-waiting` | `settling` | merge fact referenced. |
| `settling` | `completed` | terminal; `barrier`. |
| `runner-verifying` | `running` | recovery-classified retry; `authority = "recovery"` + retry evidence. |
| `forge-waiting` | `runner-verifying` | recovery-classified retry; `authority = "recovery"` + retry evidence. |
| `merge-waiting` | `forge-waiting` | recovery-classified retry; `authority = "recovery"` + retry evidence. |
| `settling` | `merge-waiting` | recovery-classified merge reconciliation retry; `authority = "recovery"` + retry evidence. |
| any non-terminal | `blocked` | terminal; `barrier`; source evidence explains the unavailable guarantee / required human action. |
| any non-terminal | `failed` | terminal; `barrier`; source evidence classifies the failure. |
| any non-terminal | `canceled` | terminal; `barrier`; `authority = "operator"` unless policy records a cancellation decision. |

Terminal states are exactly `completed`, `blocked`, `failed`, `canceled`; there is no `abandoned`
state; a terminal source has no legal outgoing edge (terminal closes lifecycle mutation).

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Encode the legal-transition table above as the single closed catalog of legal `(from, to)` edges with
  their per-edge constraints; expose it as the source of truth `s4` enforces against and `s5` need not
  re-derive.
- Provide a pure transition validator: accept a transition that is (a) an edge in the table and (b)
  meets that edge's constraint (factual reference for `created`/`configured`/`task-snapshotted`;
  `authority = "recovery"` + retry evidence in `sourceEventIds` for the four recovery rows; terminal
  edges carry the design's terminal evidence/`barrier` requirement); reject every state-pair not in the
  table with `illegal-lifecycle-transition`.
- Reject the first transition unless it is `null -> created` referencing `RunCreated`; reject any
  transition whose `from` is a terminal state (terminal closes lifecycle mutation).
- Provide a pure, total lifecycle reducer that folds the ordered event stream and moves
  `RunStateProjection.lifecycle` only for `RunLifecycleTransitioned` events; every other event type
  (`RunCreated`, `RunPolicyBound`, `TaskSnapshotRecorded`, `SessionLinked`, sibling/unknown events)
  leaves `lifecycle` unchanged; the reducer starts from `null`, sets `terminalReason` from a terminal
  transition's `reason`, and never throws on well-formed unknown events.
- Provide the session-ordinal monotonicity predicate: `linkOrdinal` starts at 1 and is strictly
  contiguous; report a gap, duplicate, or decrease as a violation.
- Provide the linkage resolver over the `SessionLinked` / `SessionLinkSuperseded` history: return the
  latest non-superseded link as `currentSession`, the full ordered `linkHistory`, and classify
  `RunLaunchProjection.linkage` as `"known"` (exactly one non-superseded owning link), `"ambiguous"`
  (more than one conflicting non-superseded owning link), or `"unknown"` (no link); supersession
  corrects projection resolution without clobbering the prior fact, and an ambiguous or missing result
  resolves to `"unknown"` for the launch projection.
- Keep the module pure and deterministic: no append, no I/O, no clock/ids/randomness; all inputs are
  caller-supplied values (per-event payloads, ordered streams).
- Export the table/validator, lifecycle reducer, monotonicity predicate, and linkage resolver from the
  `sdk` public entrypoint per `epic0-s4-export-templates/PackageExportConvention`.

## Out of scope

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

## Dependencies and frozen inputs

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

## Acceptance criteria

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
  non-superseded owning link, `"unknown"` for no link, and `"ambiguous"` for more than one conflicting
  non-superseded owning link - evidence: `linkage-classification.unit.test.ts` provides three fixtures
  (one owning link → `"known"`; no links → `"unknown"`; two conflicting non-superseded owning links →
  `"ambiguous"`) and asserts the resolved
  `linkage` value for each.

- **AC-14** The table/validator, lifecycle reducer, ordinal-monotonicity predicate, and linkage resolver
  are each importable from the `sdk` package public entrypoint, not a private module path - evidence:
  `lifecycle-linkage-public-import.unit.test.ts` imports each from the `sdk` entrypoint and asserts each
  is a function (and the legal-edge catalog is a non-empty array).

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No
responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| Legal-transition table — every legal edge accepted | AC-1 |
| Transition validator — every non-table state-pair rejected with `illegal-lifecycle-transition` | AC-2 |
| First-transition rule (`null -> created` + `RunCreated` reference) | AC-3 |
| Factual-event reference rule (`configured`→`RunPolicyBound`, `task-snapshotted`→`TaskSnapshotRecorded`) | AC-4 |
| Recovery rows require `authority = "recovery"` + retry evidence | AC-5 |
| Terminal-state guardrail — terminal source has no legal outgoing edge | AC-6 |
| No `abandoned` state; terminal vocabulary `completed|blocked|failed|canceled` | AC-7 |
| Lifecycle reducer folds only `RunLifecycleTransitioned`; other events inert | AC-8 |
| Reducer totality — well-formed unknown events never throw, leave state unchanged | AC-9 |
| Terminal fold populates `RunStateProjection.terminalReason` | AC-10 |
| Session-ordinal monotonicity predicate (start-at-1, contiguous; gap/duplicate/decrease rejected) | AC-11 |
| Linkage resolver — latest non-superseded `currentSession` + full `linkHistory`, never clobbered | AC-12 |
| Linkage classification `known`/`unknown`/`ambiguous`; ambiguous/missing → `unknown` for launch | AC-13 |
| Public SDK export of table/validator, reducer, ordinal predicate, linkage resolver | AC-14 |
| `core-01-s1-event-contracts/RunLifecycleState` consumed | AC-1, AC-2, AC-7 |
| `core-01-s1-event-contracts/RunLifecycleTransitionPayload` consumed | AC-3, AC-4, AC-5, AC-10 |
| `core-01-s1-event-contracts/SessionLinkedPayload` consumed | AC-11, AC-12, AC-13 |
| `core-01-s1-event-contracts/SessionLinkSupersededPayload` consumed | AC-12 |
| `core-01-s1-event-contracts/RunStateProjection` filled by the reducer | AC-8, AC-10 |
| `core-01-s1-event-contracts/RunLaunchProjection` linkage fields filled by the resolver | AC-12, AC-13 |

## Failure and degraded outcomes

Each row's cited AC asserts this row's trigger AND required behavior, with its own failing fixture.

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `illegal-lifecycle-transition` | A transition `(from, to)` is not an edge of the legal table | Validator returns `{ ok: false, error: "illegal-lifecycle-transition" }` for every non-table state-pair | AC-2 |
| `illegal-lifecycle-transition` | First lifecycle transition is not `null -> created`, or a `null -> created` omits the `RunCreated` reference in `sourceEventIds` | Validator returns `{ ok: false, error: "illegal-lifecycle-transition" }` | AC-3 |
| `illegal-lifecycle-transition` | A `created`/`task-snapshotted` transition omits its required factual reference (`RunPolicyBound` / `TaskSnapshotRecorded`) | Validator returns `{ ok: false, error: "illegal-lifecycle-transition" }` | AC-4 |
| `illegal-lifecycle-transition` | A recovery-row edge is requested with `authority !== "recovery"` or without retry evidence | Validator returns `{ ok: false, error: "illegal-lifecycle-transition" }` (recovery is not an implicit escape hatch) | AC-5 |
| `illegal-lifecycle-transition` | A transition's `from` is a terminal state (`completed`/`blocked`/`failed`/`canceled`) | Validator returns `{ ok: false, error: "illegal-lifecycle-transition" }`; terminal closes lifecycle mutation | AC-6 |
| session-ordinal monotonicity violation | A `SessionLinked` ordinal sequence has a gap, duplicate, decrease, or non-1 start | Monotonicity predicate returns `false` (the rejection `s4` maps to its append failure); a contiguous-from-1 sequence returns `true` | AC-11 |

## Quality bar

- Coverage scope and threshold: the transition table/validator, lifecycle reducer, ordinal-monotonicity
  predicate, and linkage resolver in `packages/sdk/src/core/run-lifecycle/lifecycle/**` at ≥90%, aiming
  for 95%. Type-only imports from `core-01-s1-event-contracts` contribute no instrumented lines and are
  excluded from the scope measurement.
- Coverage command and instrumented lane(s): `pnpm exec vitest run --project unit --coverage
  --passWithNoTests -- packages/sdk/tests/core/run-lifecycle/lifecycle/**` — instruments the unit lane
  over the lifecycle module scope; the full aggregate gate is `pnpm coverage:baseline`.
- Required tests, catalogued by AC and failure row:
  - `transition-table-legal-edges.unit.test.ts` (AC-1; generated over all 50 expanded legal edges (20 table rows; the 3 Any-non-terminal terminal rows expand to 33 edges over the 11 non-terminal source states))
  - `transition-table-illegal-pairs.unit.test.ts` (AC-2; generated over the cross-product minus legal set)
  - `transition-first-edge.unit.test.ts` (AC-3)
  - `transition-factual-refs.unit.test.ts` (AC-4)
  - `transition-recovery-edges.unit.test.ts` (AC-5; one accept + one reject per recovery edge)
  - `transition-terminal-closed.unit.test.ts` (AC-6; one per terminal source)
  - `terminal-vocabulary.unit.test.ts` (AC-7)
  - `lifecycle-reducer.unit.test.ts` (AC-8)
  - `lifecycle-reducer-totality.unit.test.ts` (AC-9)
  - `lifecycle-reducer-terminal.unit.test.ts` (AC-10)
  - `linkage-ordinal-monotonicity.unit.test.ts` (AC-11)
  - `linkage-resolution.unit.test.ts` (AC-12)
  - `linkage-classification.unit.test.ts` (AC-13)
  - `lifecycle-linkage-public-import.unit.test.ts` (AC-14)
  - Negative fixtures: `transition-illegal-pairs.fixture.ts`, `first-transition-wrong-target.fixture.ts`,
    `created-missing-runcreated-ref.fixture.ts`, `configured-missing-policybound-ref.fixture.ts`,
    `task-snapshotted-missing-snapshot-ref.fixture.ts`, `recovery-edge-wrong-authority.fixture.ts`,
    `post-terminal-transition.fixture.ts`, `linkage-ordinal-violations.fixture.ts`.
- Public exposure (import path + public-import test): the legal-edge catalog, transition validator,
  lifecycle reducer, ordinal-monotonicity predicate, and linkage resolver are exported from the `sdk`
  public entrypoint per `epic0-s4-export-templates/PackageExportConvention` (export + barrel + `exports`
  field); proven by `lifecycle-linkage-public-import.unit.test.ts` (AC-14) importing each from `sdk` (not
  a private path). The consumed TYPES are `core-01-s1-event-contracts`'s public exports; this story
  exports only the table/validator/reducer/predicate/resolver behaviors.
- Determinism constraints: every function is pure given its argument values; no ambient `Date.now`,
  `new Date`, `Math.random`, or `crypto.randomUUID`; no clock/ids/storage/provider ports are needed (all
  inputs are caller-supplied payloads and ordered streams). The same input stream yields the same
  reduced state and the same linkage resolution every time.
- Dependency boundaries: `sdk` imports only pure runtime libraries and `core-01-s1-event-contracts`
  types; production source must not import `testkit`, any `provider-*`, `cli`, or `mcp`, and performs no
  append/replay/I/O. Test files are exempt from the production-testkit rule.
- File-size budget (lines per file; default soft cap ~200): `transition-table.ts` (the legal-edge
  catalog + per-edge constraints) ≤ 200 lines; `transition-validator.ts` ≤ 200 lines;
  `lifecycle-reducer.ts` ≤ 150 lines; `linkage-resolver.ts` (ordinal predicate + resolution +
  classification) ≤ 200 lines; barrel `index.ts` ≤ 50 lines. Test files ≤ 200 lines each.
- Domain non-negotiables:
  - `RunLifecycleTransitioned` is the ONLY event that authors lifecycle state; the reducer leaves
    `lifecycle` unchanged for every other event type.
  - The legal-transition table is a closed set — any state-pair not enumerated is illegal (fail-closed
    by construction; recovery edges are not an implicit escape hatch).
  - There is no `abandoned` state; terminal states are exactly `completed|blocked|failed|canceled` and a
    terminal source closes lifecycle mutation.
  - Session linkage is append-only and monotonic: ordinals start at 1 and are strictly contiguous; a
    correction appends `SessionLinkSuperseded` and never clobbers a prior link fact.
  - Missing linkage resolves to `launch.linkage = "unknown"`; ambiguous ownership resolves to
    `launch.linkage = "ambiguous"`.

## Required reading

- `docs/design/30-domain-reference/core/run-lifecycle-and-state/projections-lifecycle-and-tests.md`
  — §Lifecycle state machine (the legal transition table, recovery rows, terminal rules), §Session
  linkage, §Failure and degraded modes, §Testing strategy.
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md` §Core decisions (lifecycle
  authorship, terminal closure, append-only/monotonic linkage).
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/event-log-writer-and-corruption.md`
  §Append protocol (the transition-legality + ordinal-monotonicity validations this story owns the rule
  for; `s4` calls them).
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md` — the consumed type
  definitions.
- `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s1-event-contracts.md` — the
  single producer of all consumed shape declarations.
- `docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/stories/epic0-s4-export-templates.md`
  — `PackageExportConvention` for the `sdk` public entrypoint.
- `docs/engineering/test-lanes.md` — unit lane rules; no real FS/network/process.
- `docs/design/20-sdk-and-packaging/dependency-rules.md` — sdk → pure libs only; testkit excluded from
  production source.

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The `packages/sdk/src/core/run-lifecycle/lifecycle/` module providing the legal-transition table +
validator, the pure lifecycle reducer, the session-ordinal monotonicity predicate, and the linkage
resolver (latest-non-superseded resolution + `known`/`unknown`/`ambiguous` classification), plus the
evidence pack.

## Evidence pack

- Test proving each AC: `transition-table-legal-edges.unit.test.ts` (AC-1);
  `transition-table-illegal-pairs.unit.test.ts` (AC-2); `transition-first-edge.unit.test.ts` (AC-3);
  `transition-factual-refs.unit.test.ts` (AC-4); `transition-recovery-edges.unit.test.ts` (AC-5);
  `transition-terminal-closed.unit.test.ts` (AC-6); `terminal-vocabulary.unit.test.ts` (AC-7);
  `lifecycle-reducer.unit.test.ts` (AC-8); `lifecycle-reducer-totality.unit.test.ts` (AC-9);
  `lifecycle-reducer-terminal.unit.test.ts` (AC-10); `linkage-ordinal-monotonicity.unit.test.ts` (AC-11);
  `linkage-resolution.unit.test.ts` (AC-12); `linkage-classification.unit.test.ts` (AC-13);
  `lifecycle-linkage-public-import.unit.test.ts` (AC-14).
- Test proving each failure/degraded row: `transition-table-illegal-pairs.unit.test.ts` (non-table pair),
  `transition-first-edge.unit.test.ts` (first-edge), `transition-factual-refs.unit.test.ts` (factual
  refs), `transition-recovery-edges.unit.test.ts` (recovery authority), `transition-terminal-closed.unit.test.ts`
  (terminal source), `linkage-ordinal-monotonicity.unit.test.ts` (ordinal violation).
- Negative fixture for every rejection: `transition-illegal-pairs.fixture.ts`,
  `first-transition-wrong-target.fixture.ts`, `created-missing-runcreated-ref.fixture.ts`,
  `configured-missing-policybound-ref.fixture.ts`, `task-snapshotted-missing-snapshot-ref.fixture.ts`,
  `recovery-edge-wrong-authority.fixture.ts`, `post-terminal-transition.fixture.ts`,
  `linkage-ordinal-violations.fixture.ts` (each asserted to drive the rejecting outcome).
- `pnpm check` result, unless blocked by a named unrelated repository issue.
- Coverage command, instrumented lane, and number for the
  `packages/sdk/src/core/run-lifecycle/lifecycle/**` scope.
- Public-import test result for the table/validator, reducer, ordinal predicate, and linkage resolver
  imported from the `sdk` entrypoint (`lifecycle-linkage-public-import.unit.test.ts`).
- Boundary/forbidden-symbol sweep (runnable recipe):
  `grep -REn "testkit|provider-(codex|local|github|markdown)|/cli/|/mcp/|EventLogStore|LeaseStore|execa|child_process|Date\\.now|Math\\.random|crypto\\.randomUUID|new Date\\(" packages/sdk/src/core/run-lifecycle/lifecycle/`
  over path root `packages/sdk/src/core/run-lifecycle/lifecycle/`; forbidden-token set = `testkit`,
  `provider-codex|local|github|markdown`, `/cli/`, `/mcp/` (boundary leaks), `EventLogStore`,
  `LeaseStore` (append/replay leak — this is a pure validate/fold module), `execa`, `child_process`
  (process leak), `Date.now`, `Math.random`, `crypto.randomUUID`, `new Date(` (ambient nondeterminism);
  expected result zero matches (exit code 1), captured into the evidence pack.
- Conformance/runtime evidence: none — this story is a pure validate/fold module; no real process,
  network, filesystem, driver, or credential is used. Append/replay/projection behaviors that consume
  this surface are owned by `s4`/`s5`/`s2`.

## Boundaries and STOP conditions

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

## Characterization Review

Architect-recorded review of this contract's load-bearing scope decisions. Each entry records
rationale, the design line it traces to, the falsification criterion, and the escalation path.

### Decision: transition-table-owned-here

- Rationale: the legal lifecycle transition table is the pure catalog consumed by append enforcement and
  projection folding, so it has one producer outside both consumers.
- Design trace: `docs/design/30-domain-reference/core/run-lifecycle-and-state/projections-lifecycle-and-tests.md`
  (legal transitions table); `story-dag.md` catalog/behavior ownership rule.
- Falsification: `core-01-s4` or `core-01-s5` re-declares the legal transition table or adds a
  behavior-local transition rule.
- Escalation: if append or projection needs a transition not in this table, raise a contract/design
  defect against this story before changing consumers.

### Decision: session-linkage-ordinal-predicate-owned-here

- Rationale: session linkage ordering is a pure append-only invariant shared by writer validation and
  launch projections, so the ordinal predicate must remain in the lifecycle/linkage catalog.
- Design trace: `docs/design/30-domain-reference/core/run-lifecycle-and-state/projections-lifecycle-and-tests.md`
  (session linkage is append-only and ordinals are monotonic).
- Falsification: writer or projection modules define their own monotonicity predicate, or accept a
  linkage sequence this story rejects.
- Escalation: if a handoff scenario needs a different ordinal rule, update the lifecycle/linkage
  contract first; do not fork the predicate in consumers.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - stories](./README.md) · **← Prev:** [core-01-s2-replay-and-corruption - replay and corruption classification implementation story](./core-01-s2-replay-and-corruption.md) · **Next →:** [core-01-s4-run-event-log-and-writer - run event log and writer implementation story](./core-01-s4-run-event-log-and-writer.md)

<!-- /DOCS-NAV -->
