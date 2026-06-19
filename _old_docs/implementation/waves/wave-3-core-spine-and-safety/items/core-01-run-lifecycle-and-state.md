---
title: "core-01 — Run Lifecycle & Event State — implementation charter"
id: "core-01"
wave: 3
layer: "core (control plane)"
status: "item: ready"
spec: "docs/design/domains/core/core-01-run-lifecycle-and-state/ (README.md + contracts.md + event-log-writer-and-corruption.md + projections-lifecycle-and-tests.md)"
---

# core-01 — Run Lifecycle & Event State

**Purpose.** The spine of the control plane: the append-only run event log (single source of truth),
the single-leased-writer append protocol with writer-epoch fencing, the pure projection model, and the
run lifecycle state machine — so run activity is authored as events and every projection is a
deterministic replay of them. (FR-11, NFR-OBS, NFR-DET, NFR-SAFE; AD-3, AD-6.)

**Spec (normative).** Implement `docs/design/domains/core/core-01-run-lifecycle-and-state/`
(`README.md` + `contracts.md` + `event-log-writer-and-corruption.md` + `projections-lifecycle-and-tests.md`).
The event envelope, the append/fencing protocol, the durability mapping, the **legal transition table**,
the projection reducers, and the failure-mode set are normative. Ambiguous or under-specified → **STOP
and surface** to the architect; do not invent.

## Spec surface (manifest)

What the normative spec defines and the implementation must expose/consume, by name:

- **Interfaces:** `RunEventLog` (`createRun`, `openWriter`, `replay`, `waitRunEvents`, `project`),
  `RunWriter` (`append`, `renew`).
- **Types:** `Result<TValue,TFailure>`, `RunDurabilityClass` (`"durable" | "barrier"`),
  `RunLifecycleState` (the 15-state union: 10 operational + `task-snapshotted` + 4 terminal),
  `RunDegradedHealth` (`"ok" | "tail-repaired" | "interior-corrupt" | "event-log-unavailable"`),
  `RunEventEnvelope<TPayload>`, `EvidenceEventRef`, `CreateRunInput`, `AppendIntent<TPayload>`,
  `RunAppendReceipt`, `RunReplay`, `RunEventCursor`, `WaitRunEventsRequest`, `WaitRunEventsResult`,
  `RunProjections` = `{ state, summary, metrics, launch }`, `RunStateProjection`,
  `RunSummaryProjection`, `RunMetricsProjection`, `RunLaunchProjection`, `RunAppendFailureCode`,
  `RunAppendFailure`, `RunReplayFailure`, `RunLogCorruptionRecord`, `RunLogHealthRecord`.
- **Event payloads (events core-01 authors):** `RunCreatedPayload`, `RunPolicyBoundPayload`,
  `TaskSnapshotRecordedPayload`, `RunLifecycleTransitionPayload`, `SessionLinkedPayload`,
  `SessionLinkSupersededPayload`, `RunAppendRejectedPayload`, `RunLogTailRepairedPayload`
  — i.e. the events `RunCreated`, `RunPolicyBound`, `TaskSnapshotRecorded`, `RunLifecycleTransitioned`
  (the **only** lifecycle author), `SessionLinked`, `SessionLinkSuperseded`, `RunAppendRejected`,
  `RunLogTailRepaired`.
- **Failure & degraded outcomes (tokens):** `stale-writer-fenced`, `sequence-conflict`,
  `illegal-lifecycle-transition`, `durability-insufficient`, `partial-ack-unknown`, `tail-repaired`,
  `malformed-envelope`, `interior-corrupt`, `event-log-unavailable`, `malformed-declared-payload`
  — detailed in the table below.

(Done requires every item here present, with the spec's names, shapes, and semantics.)

## Responsibilities (in scope)

- The `RunEventEnvelope` schema and the append protocol: single leased writer, contiguous monotonic
  per-Run `sequence` (starts at 1), `writerEpoch` fencing, atomic multi-intent batch with
  strongest-requested durability normalization, partial-write/lost-ack replay recovery.
- The lifecycle state machine over the **legal transition table** — validated on append and reduced on
  replay; `RunLifecycleTransitioned` is the sole lifecycle author.
- The four projections (`state` / `summary` / `metrics` / `launch`) as pure, total reducer folds over
  the committed event stream plus fnd-02 replay health; never authored directly.
- Append-only session linkage (monotonic `linkOrdinal`, supersession without clobber).
- Durability-class mapping and rejection; corruption handling (tail-repair append; interior-corrupt /
  unavailable fail-closed) consuming fnd-02 health as authoritative.
- `waitRunEvents` as a bounded poll-over-`replay` cursor primitive (no lease, no append, no liveness).

## Out of scope

- Domain-specific payload **semantics** of sibling events (each domain owns its payload meaning;
  core-01 preserves well-formed unknown payloads in `summary.unknownEvents`).
- Liveness/timers/operator blocking derived from `waitRunEvents` (core-04).
- Recovery action selection / coordination (core-06), analysis (core-07), Work Source task intake and
  status authority (prov-03 / Work Source — see Reconciliation note, README §9).
- The fnd-02 physical frame layout, lease primitive, and byte-level repair (foundation; consumed, not
  reimplemented). The fnd-02 `buffered` write tier (never exposed in `RunDurabilityClass`).

## Requirements owned

FR-11 (run-activity authority, separated from Work Source task status); NFR-OBS (every run-state change
is an event); NFR-DET (projections are pure functions of recorded evidence); NFR-SAFE (coherent
fail-closed state). NFR-SOLID (foundation-only deps) and NFR-TEST (mock-only core) are satisfied by the
boundaries below. **Plus full core-01 design-spec compliance** (README + 3 aspect files).

## Dependencies & frozen contracts

Depends on **fnd-01** (resolved policy inputs only) and **fnd-02** (`LeaseStore`/`LeaseCapability`,
`EventLogStore.openForAppend`/`append`/`replay` (+ `LogHandle`), `AppendBatch`/`AppendReceipt`, `DurabilityClass`, replay health,
`ArtifactRef.id`). Depended on by core-02/04/05/06/07 and edge-01. Must **NOT** depend on
contracts, drivers, edge, sibling core packages, or any SDK (architecture.md §2; package-map.md).

Cross-item contracts (named once, per R5 — never "the fields fnd-02 supplies"):

- **Consumed from fnd-02:** a `LeaseCapability` carrying the `run-writer:<runId>` lease name, token,
  and epoch; `EventLogStore.openForAppend(logId, lease): LogHandle` minting an opaque `LogHandle`
  (`{ logId, leaseName, epoch, token }` — the fencing boundary), then `append(handle, batch)` rejecting
  a stale handle (lease name/token/epoch) **before** bytes are written and accepting `expectedSequence`; replay health values `log-tail-repaired`,
  `log-interior-corrupt`, `network-fs-degraded`, `read-only`, `unusable`; an `AppendReceipt` exposing a
  frame digest; `ArtifactRef.id` resolvable via `ArtifactStore.resolve(id)` (stored opaquely here).
- **Produced for siblings:** `RunEventEnvelope` (schema `"kit-vnext.run-event.v1"`, fields exactly as
  `contracts.md`), `EvidenceEventRef = { eventId; sequence; payloadDigest; type }`, and the
  `RunProjections` set — consumed verbatim by core-02/04/05/06/07.

## Libraries

Allowed: `zod` (envelope/payload schema validation, JSON-Schema-representable), `fast-check` +
`@fast-check/vitest` (property tests, test-only). **Forbidden:** any provider/native SDK, `execa`,
`child_process`, `octokit`, SQLite clients, `awilix`, `pino`/`@opentelemetry/*`, and **any real
process, network, filesystem, Forge, Agent, Work Source, or Driver** (dependency-policy.md). Clock and
id are injected ports — no ambient `Date.now`/`new Date()`/`crypto.randomUUID`/`Math.random`.

## Acceptance criteria (the shared rubric)

Each AC is a single assertion, true or false against a test. No "exactly as specified".

- **AC-1 (envelope schema)** `RunEventEnvelope` validates a value with `schema: "kit-vnext.run-event.v1"`
  and all required fields, and rejects one missing/ill-typed required field (one negative case per
  required field); `sequence` is a contiguous per-Run integer starting at 1. — *contracts.md; event-log §"Event envelope".*
- **AC-2 (createRun = barrier seed)** `createRun` acquires the first `run-writer:<runId>` lease and
  commits **one atomic `barrier` batch** containing `RunCreated` plus
  `RunLifecycleTransitioned { from: null, to: "created" }` that references the `RunCreated` `eventId`;
  it returns a `RunWriter`, not a separate lifecycle author. — *event-log §"Append protocol"; projections §"Lifecycle state machine".*
- **AC-3 (legal transitions — full matrix)** A generated test over **every** ordered `RunLifecycleState`
  pair (plus `from: null`) accepts a `RunLifecycleTransitioned` append **iff** the pair is one of the
  exactly-legal edges in the transition table (the 20 legal edge types: 13 forward + 4 recovery +
  `blocked`/`failed`/`canceled` from any non-terminal); every other pair yields
  `illegal-lifecycle-transition`. — *projections §"Lifecycle state machine" (the table).*
- **AC-4 (lifecycle is the sole author)** The `state` reducer folds **only** `RunLifecycleTransitioned`;
  appending `RunCreated`/`RunPolicyBound`/`TaskSnapshotRecorded`/`SessionLinked` without a matching
  transition leaves `state.lifecycle` unchanged. — *projections §"Projection model"/"Event roles".*
- **AC-5 (transition prerequisites)** `created→configured` is rejected unless its `sourceEventIds`
  reference a committed `RunPolicyBound`; `configured→task-snapshotted` unless it references
  `TaskSnapshotRecorded`; `worker-starting→running` unless it references `SessionLinked` for the
  primary/recovery owner; rejection is `illegal-lifecycle-transition`. — *event-log §"Append protocol"; projections (the table constraints).*
- **AC-6 (recovery edges are constrained)** A recovery-classified transition (e.g. `runner-verifying→running`)
  is accepted **only** when it matches a recovery row, names the prior state in `from`, cites recovery
  evidence in `sourceEventIds`, and sets `authority: "recovery"`; otherwise `illegal-lifecycle-transition`.
  — *projections §"Lifecycle state machine" (recovery rows).*
- **AC-7 (writer-epoch fencing)** A `RunWriter` whose lease epoch no longer fences current is rejected
  with `stale-writer-fenced` before any storage write — including after terminal and after superseded
  epochs. — *event-log §"Writer-epoch fencing and partial-write recovery".*
- **AC-8 (sequence discipline)** `append` with `expectedSequence ≠ lastCommittedSequence + 1` (or a
  non-contiguous in-batch sequence) is rejected with `sequence-conflict`; the committed range in the
  receipt is contiguous. — *contracts.md (`RunAppendReceipt`); event-log §"Append protocol".*
- **AC-9 (lost-ack replay recovery)** After a lost acknowledgement, replay-only recovery: an already-committed
  batch with identical `eventId`s and digests is reported committed; an absent batch is re-appended at the
  next sequence; a conflicting id/digest fails closed with `sequence-conflict`. The unresolved case surfaces
  `partial-ack-unknown`. — *event-log §"Writer-epoch fencing and partial-write recovery".*
- **AC-10 (atomic batch + strongest durability)** A multi-intent `append` maps to exactly one fnd-02
  `AppendBatch` using the strongest requested durability in the batch, never split; every committed
  envelope and the receipt record that **effective** durability. — *README §4; event-log §"Append protocol".*
- **AC-11 (durability mapping enforced)** Every barrier-required fact (run creation, policy binding,
  task snapshot, session linkage, parked/resumed approval facts, **all** terminal transitions,
  corruption records) requested below `barrier` is rejected with `durability-insufficient` — even if
  another intent in the same batch requested `barrier`; `buffered` is never accepted on the canonical
  log. — *event-log §"Durability classes"; projections (table: terminal/barrier rows).*
- **AC-12 (session linkage monotone, append-only)** `SessionLinked.linkOrdinal` starts at 1 and is
  strictly contiguous; a non-contiguous ordinal is rejected; `SessionLinkSuperseded` changes which link
  the `launch` projection exposes as current **without** removing the prior fact from the log;
  missing/ambiguous linkage projects `launch.linkage = "unknown"`/`"ambiguous"`. — *projections §"Session linkage".*
- **AC-13 (projection purity + determinism)** Reducers never call append APIs, mutate artifacts, write
  projection files, or read live external state; replaying the same committed byte stream yields
  byte-identical `RunProjections` (property test over generated valid logs). — *projections §"Projection model"; NFR-DET.*
- **AC-14 (reducer totality)** A well-formed envelope of an unknown future `type` is preserved in
  `summary.unknownEvents`, does not throw, and does not move `state.lifecycle`. — *event-log §"Event envelope"; projections §"Projection model".*
- **AC-15 (tail-repair recovery)** On fnd-02 `log-tail-repaired`, core-01 appends `RunLogTailRepaired`
  at `barrier` (when a writer is available) and continues from the last committed sequence; replay/receipt
  health reports `tail-repaired`. — *event-log §"Corruption handling".*
- **AC-16 (interior-corrupt fails closed)** On fnd-02 `log-interior-corrupt`, projections report
  `degradedHealth = "interior-corrupt"`, lifecycle mutation and authoritative append are refused, and
  `replay` returns `RunReplayFailure { code: "interior-corrupt" }`; the log is never edited to repair
  semantics. — *event-log §"Corruption handling".*
- **AC-17 (log unavailable fails closed)** On `network-fs-degraded`/`read-only`/`unusable`, authoritative
  append and replay surface `event-log-unavailable`; no partial or buffered write is emitted. — *event-log §"Corruption handling"/"Durability classes".*
- **AC-18 (malformed payload/envelope)** A committed envelope that violates the `RunEventEnvelope`
  contract yields `malformed-envelope`; a malformed payload for a core-01 declared-relevant type
  (lifecycle/linkage) yields `malformed-declared-payload`; both via `RunReplayFailure`, never a thrown
  error. — *contracts.md (`RunReplayFailure`); projections §"Projection model".*
- **AC-19 (rejection authorship)** Semantic pre-storage rejections by the currently fenced writer while
  the log is writable (e.g. `illegal-lifecycle-transition`, `durability-insufficient`) author a
  `RunAppendRejected`; `stale-writer-fenced`, `interior-corrupt`, and `event-log-unavailable` are
  returned to the caller and are **not** self-recorded. — *event-log §"Durability classes"; projections §"Event roles".*
- **AC-20 (waitRunEvents is read-only)** `waitRunEvents` delivers committed events after
  `cursor.afterSequence` (respecting `maxEvents`) or returns `timedOut: true` after `timeoutMs`; it
  acquires/renews no lease, appends nothing, writes no projection, and mutates no liveness state. —
  *README §5; contracts.md (`WaitRunEventsResult`).*
- **AC-21 (Dependency Rule + determinism ports)** dependency-cruiser confirms the package imports only
  foundation (+ test-only); no contracts/core/edge/driver/SDK import; a grep finds no ambient
  `Date.now`/`new Date()`/`crypto.randomUUID`/`Math.random` in non-test source (clock/id injected). —
  *architecture.md §2; dependency-policy.md (determinism ports); package-map.md.*

## Failure & degraded outcomes (first-class)

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `stale-writer-fenced` | lease epoch/token no longer fences current (incl. post-terminal, post-superseded) | reject before any write; `RunAppendFailure`; not self-recorded | AC-7 |
| `sequence-conflict` | `expectedSequence ≠ tail+1`, non-contiguous batch, or conflicting id/digest on replay | fail closed; caller must replay | AC-8, AC-9 |
| `illegal-lifecycle-transition` | transition not in the legal table, or recovery edge missing constraints | reject; author `RunAppendRejected` (writable log) | AC-3, AC-5, AC-6, AC-19 |
| `durability-insufficient` | a barrier-required fact requested below `barrier`, or a `buffered` canonical append | reject before storage; never weaken durability | AC-11 |
| `partial-ack-unknown` | acknowledgement lost; commit vs absence unresolved | replay decides; surface token until resolved | AC-9 |
| `tail-repaired` | fnd-02 `log-tail-repaired` | append `RunLogTailRepaired` (`barrier`); continue from last committed; health `tail-repaired` | AC-15 |
| `malformed-envelope` | committed bytes decode but violate `RunEventEnvelope` | `RunReplayFailure`; no throw; gate treats capability absent | AC-18 |
| `interior-corrupt` | fnd-02 `log-interior-corrupt` (incoherent history) | refuse lifecycle mutation + authoritative append; `degradedHealth: "interior-corrupt"`; no semantic edit | AC-16 |
| `event-log-unavailable` | fnd-02 `network-fs-degraded` / `read-only` / `unusable` | refuse authoritative append + replay; no partial/buffered write | AC-17 |
| `malformed-declared-payload` | payload for a core-01 declared-relevant type (lifecycle/linkage) is invalid | `RunReplayFailure`; no throw | AC-18 |

## Quality bar

- Coverage ≥ 90% lines/branches (aim 95%), enforced by
  `vitest run --coverage --coverage.thresholds.lines=90 --coverage.thresholds.branches=90` for this
  package (paste the number in the evidence pack). The verify gate does not enforce a threshold today —
  see the wave charter.
- Required tests (catalogue, not examples): the per-required-field envelope rejections (AC-1); the
  `createRun` atomic-barrier seed (AC-2); the **full legal-transition matrix** — every ordered
  state-pair + `null`, legal accepted / illegal rejected, including the 4 recovery edges and the
  `blocked`/`failed`/`canceled` fan-in (AC-3, AC-6); transition-prerequisite references (AC-5);
  lifecycle-as-sole-author + reducer totality on unknown events (AC-4, AC-14); writer-epoch fencing
  incl. post-terminal and post-superseded (AC-7); sequence-conflict + lost-ack replay for committed /
  absent / conflicting / unresolved (AC-8, AC-9); atomic single-batch + strongest-durability (AC-10);
  `durability-insufficient` for **every** barrier-required event type incl. the mixed-batch case and
  `buffered` rejection (AC-11); session-linkage monotonicity + supersession + ambiguous→`unknown`
  (AC-12); the append/replay/projection determinism property over generated valid logs (AC-13);
  tail-repair / interior-corrupt / unavailable / malformed-envelope / malformed-declared-payload paths
  (AC-15–AC-18); rejection-authorship vs returned-only (AC-19); `waitRunEvents` deliver / timeout /
  no-side-effects (AC-20); the depcruise foundation-only lane + the ambient-time/randomness grep (AC-21).
  Tests use only mock/fake fnd-01 and a deterministic in-memory fnd-02 with fault injection.
- File ≤ 800 lines; clock/id injected (no ambient `Date.now`/`new Date()`/`crypto.randomUUID`/`Math.random`);
  no SDK / `execa` / `child_process` / real process / network / filesystem; immutable projection outputs
  (reducers return new objects, never mutate the event stream or prior projection).

## Required reading

This domain's spec (`README.md` + `contracts.md` + `event-log-writer-and-corruption.md` +
`projections-lifecycle-and-tests.md`); `architecture.md` §2 (Dependency Rule) and §3 (capability
attestation — for the "capabilities absent" fail-closed clause); `decisions.md` AD-3, AD-6;
`requirements.md` FR-11, NFR-OBS/DET/SAFE/SOLID/TEST; `dependency-policy.md` (determinism ports, layer
placement, library acceptance); `testing-policy.md` (unit/integration lanes, property-test
requirement, coverage floor); `package-map.md` (`core-01` naming + layer); `fnd-01` resolved-policy
inputs; `fnd-02` `LeaseStore`/`EventLogStore`/`DurabilityClass`/replay-health/`ArtifactRef` exports.
Nothing else.

## Deliverable

The `@kit-vnext/core-01` package (`packages/core-01`) providing the `RunEventLog` + `RunWriter`
contract, the envelope/payload/projection/failure types in the manifest, the append-protocol +
fencing + recovery implementation, the lifecycle state machine over the legal table, and the four pure
projections — backed by a deterministic in-memory fnd-02 fake for tests. Plus the **evidence pack**: a
test named per AC and per failure-outcome row; `pnpm check` output + the coverage number; the
dependency-cruiser foundation-only lane output; the ambient-time/randomness grep result (0 hits in
non-test source).

## Boundaries

Stay in `packages/core-01`; depend only on foundation (fnd-01, fnd-02). Never import a contract, a
sibling core package, a driver, edge, or any SDK; never spawn a process, open the network, or touch a
real filesystem; never write a projection directly or edit the log to repair semantic history. **STOP
and surface** (do not edit another package or guess) when: a sibling-domain append path the spec
implies is undefined (which siblings receive the live `RunWriter` vs return `AppendIntent`s, and the
exact contract that grants writer access); the exact fnd-02 lease-capability / append-receipt /
replay-health shapes are not pinned by the frozen fnd-02 contract; or any transition constraint, durability
mapping, or evidence-reference rule is ambiguous in the four spec files.

## Open questions (surface to the architect; do not resolve here)

- **Q1 (sibling writer access).** §1 / §6 say siblings "either return `AppendIntent`s for the owning
  flow or use the active leased `RunWriter` when their approved contract exposes one," but the core-01
  spec does not enumerate **which** siblings get the live writer or the contract that grants it. core-01
  exposes `RunWriter`; the grant is a sibling/core-04/05/06 obligation, not a core-01 assertion — surfaced,
  not invented.
- **Q2 (`waitRunEvents` cancellation/back-pressure).** The spec defines bounded poll-over-`replay` with
  `timeoutMs`/`maxEvents` but not consumer-side cancellation or back-pressure between polls; the
  implementation picks a bounded behavior and flags it (core-04 owns liveness).
- **Q3 (terminal idempotency window).** Post-terminal non-lifecycle facts may reuse the terminal writer
  epoch "until lease expiry" (README §4; projections §"Lifecycle state machine"); the spec leaves the
  expiry source to fnd-02's lease TTL. Confirm core-01 reads expiry from the fnd-02 `LeaseCapability`
  rather than computing its own.
- **Q4 (`metrics.retryCount` source).** `retryCount` derives only from recovery-authority re-entry
  transitions referenced by a `RunLifecycleTransitioned`; confirm no sibling retry payload is parsed for
  this count (projections §"Projection model").
