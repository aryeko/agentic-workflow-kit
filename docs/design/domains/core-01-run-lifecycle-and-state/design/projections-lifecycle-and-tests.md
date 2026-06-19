---
title: "Run Lifecycle & Event State - projections, lifecycle, and tests"
status: approved
last-reviewed: "2026-06-18"
---

# Projections, Lifecycle, and Tests

## Projection model

The canonical projections are pure replay functions:

- `state`: lifecycle state, current sequence, writer epoch, terminal reason, and degraded health.
- `summary`: task identity, current owner/session facts, latest operator-visible status, and key
  artifact refs.
- `metrics`: counts, durations derived from recorded event timestamps, retry counts, parked time, and
  event health.
- `launch`: resolved policy digest, task snapshot digest, workspace/session linkage facts, and the
  minimal launch record needed for resume/reconciliation.

Projection input is only the ordered committed event stream plus fnd-02 replay health. Rebuild is
`replay(logId) -> validate frames -> fold events through reducers`. Reducers are total: well-formed
unknown future payloads are preserved in `summary.unknownEvents` but do not throw. Projection output
is deterministic for a given log byte sequence. Projection/replay failures are limited to malformed
envelopes, corrupt logs, unavailable logs, or malformed payloads for core-01 declared-relevant event
types.

The `state` reducer folds only `RunLifecycleTransitioned` events. `RunCreated`, `RunPolicyBound`,
`TaskSnapshotRecorded`, `SessionLinked`, and sibling-domain facts can be prerequisites or referenced
evidence for a lifecycle transition, but they never move `state.lifecycle` by themselves.

`metrics.retryCount` is derived only from recovery-authority lifecycle re-entry transitions in the
legal transition table below. Core-01 does not parse sibling-domain retry payloads for this count
unless those facts are referenced by a `RunLifecycleTransitioned` event that re-enters an operational
state.

Projection reducers cannot call fnd-02 append APIs, mutate artifacts, write projection files, inspect
live external state, or call provider contracts. Cached projection snapshots are allowed only as
discardable acceleration; replay remains authoritative.

## Lifecycle state machine

Lifecycle state is authored only by `RunLifecycleTransitioned` events. The allowed states are:
`created`, `configured`, `task_snapshotted`, `workspace_ready`, `worker_starting`, `running`,
`parked`, `runner_verifying`, `forge_waiting`, `merge_waiting`, `settling`, `completed`, `blocked`,
`failed`, and `canceled`.

The initial state before the first lifecycle event is `null`. The first lifecycle transition must be
`null -> created` and must reference the `RunCreated` event id in `sourceEventIds`. The
`created -> configured` transition must reference the resolved-policy fact (`RunPolicyBound`), and
the `configured -> task_snapshotted` transition must reference `TaskSnapshotRecorded`. Those factual
events may be appended in the same atomic batch as their lifecycle transition, but they are not
alternate lifecycle authors.

Legal transitions are exactly the edges in this table. The behavior diagram in `design.md` is
illustrative; validation and generated edge tests use this table as the normative contract.

| From | Legal to | Constraints |
|---|---|---|
| `null` | `created` | First lifecycle transition only; must reference `RunCreated`; `barrier`. |
| `created` | `configured` | Must reference `RunPolicyBound`; `barrier`. |
| `configured` | `task_snapshotted` | Must reference `TaskSnapshotRecorded`; `barrier`. |
| `task_snapshotted` | `workspace_ready` | Workspace evidence fact must be referenced. |
| `workspace_ready` | `worker_starting` | Launch evidence fact must be referenced. |
| `worker_starting` | `running` | Must reference `SessionLinked` for the primary or recovery owner. |
| `running` | `parked`, `runner_verifying` | Parked transitions require attention or approval evidence; verifier entry requires worker-done evidence. |
| `parked` | `running` | Resume fact must be referenced. |
| `runner_verifying` | `forge_waiting` | Verification evidence fact must be referenced. |
| `forge_waiting` | `merge_waiting` | PR/check/review gate evidence fact must be referenced. |
| `merge_waiting` | `settling` | Merge fact must be referenced. |
| `settling` | `completed` | Terminal transition; `barrier`. |
| `runner_verifying` | `running` | Recovery-classified retry only; `authority = "recovery"` and retry evidence required. |
| `forge_waiting` | `runner_verifying` | Recovery-classified retry of verification or Forge evidence gathering only. |
| `merge_waiting` | `forge_waiting` | Recovery-classified retry of Forge gate evidence only. |
| `settling` | `merge_waiting` | Recovery-classified merge reconciliation retry only. |
| Any non-terminal state | `blocked` | Terminal transition; `barrier`; source evidence must explain the unavailable guarantee or required human action. |
| Any non-terminal state | `failed` | Terminal transition; `barrier`; source evidence must classify the failure. |
| Any non-terminal state | `canceled` | Terminal transition; `barrier`; `authority = "operator"` unless policy records a cancellation decision. |

No other transition is legal. Recovery does not provide an implicit escape hatch: a recovery
transition must match one of the recovery rows above, name the prior state in `from`, cite recovery
evidence in `sourceEventIds`, and use `authority = "recovery"`.

Terminal states are `completed`, `blocked`, `failed`, and `canceled`. A terminal transition requires
`barrier` durability and closes lifecycle mutation for that writer epoch.

Post-terminal analysis or export facts may append as non-lifecycle events by a fenced writer, but they
cannot change the terminal lifecycle state.

## Session linkage

Session linkage is append-only. `SessionLinked` records `{ linkOrdinal, sessionId, ownershipClass,
startedAt, sourceEventId, supersedesOrdinal? }`. `linkOrdinal` starts at 1 and is strictly contiguous.
A new link can supersede a prior link for projection purposes, but the prior fact remains in the log.
There is no `SessionLinkUpdated`; corrections append `SessionLinkSuperseded` with a reason and
reference to the new ordinal.

The `launch` projection exposes the latest non-superseded session link plus full link history. Missing
or ambiguous linkage projects to `launch.linkage = "unknown"` and forces supervised degraded operation
for domains that require ownership.

## Event roles

Core-01 owns these event roles:

- `RunCreated`: first factual metadata event for a Run, `barrier`; does not author lifecycle state.
- `RunPolicyBound`: records resolved policy digest and provenance ref, `barrier`; does not author
  lifecycle state.
- `TaskSnapshotRecorded`: records task snapshot digest and source identity, `barrier`; does not author
  lifecycle state.
- `RunLifecycleTransitioned`: the only event that records legal lifecycle transitions, including
  `created`, `configured`, and `task_snapshotted`.
- `SessionLinked`: records append-only session ownership facts, `barrier`; does not author lifecycle
  state unless referenced by a later `RunLifecycleTransitioned`.
- `SessionLinkSuperseded`: records linkage correction or handoff, `barrier`.
- `RunLogTailRepaired`: records fnd-02 tail repair health, `barrier`.
- `RunAppendRejected`: records semantic pre-storage rejections by the currently fenced writer when
  durable recording is still available. Stale-writer, corrupt-log, and unavailable-log failures are
  returned to the caller but are not self-recorded by the rejected writer.

Sibling domains may append additional event types through `RunWriter`. Core-01 consumes only envelope,
lifecycle, linkage, and durability metadata needed for replay safety. Well-formed event payloads from
unknown future types are retained in `summary.unknownEvents` and otherwise ignored.

## Failure and degraded modes

- `stale_writer_fenced`: stale lease epoch or token; append rejected before write.
- `sequence_conflict`: expected sequence does not match replayed tail; caller must replay.
- `illegal_lifecycle_transition`: transition violates the state machine.
- `durability_insufficient`: requested durability cannot author that fact.
- `partial_ack_unknown`: caller lost acknowledgement; replay decides committed versus absent.
- `tail_repaired`: fnd-02 repaired tail bytes; state is usable after `RunLogTailRepaired`.
- `malformed_envelope`: committed bytes decode, but the semantic `RunEventEnvelope` contract is
  invalid.
- `interior_corrupt`: committed history is incoherent; authoritative appends fail closed.
- `event_log_unavailable`: storage health prevents durable append or replay.
- `malformed_declared_payload`: payload for a core-01 declared-relevant event type is invalid.

Capability gates treat `malformed_envelope`, `interior_corrupt`, `event_log_unavailable`,
`malformed_declared_payload`, missing projections, stale writer rejection, or ambiguous session
linkage as autonomous capabilities absent.

## Testing strategy

Tests are core-only and use mock/fake fnd-01 policy inputs plus a deterministic in-memory fnd-02 with
fault injection. No real processes, network, Forge, Agent, Work Source, filesystem, or Driver is used.

Required suites:

- property-test append/replay/projection determinism across generated valid logs;
- property-test reducer totality with unknown but well-formed events;
- generated lifecycle transition tests for every legal table edge and every state-pair not listed as
  legal;
- monotonic sequence and writer-epoch fencing tests, including stale writers after terminal and
  superseded epochs;
- lost-ack and partial-write replay tests for committed, absent, tail-repaired, and interior-corrupt
  cases;
- session linkage monotonicity and supersession tests;
- durability-class rejection tests for every barrier-required event;
- projection purity tests that forbid direct projection writes or live-state reads.
