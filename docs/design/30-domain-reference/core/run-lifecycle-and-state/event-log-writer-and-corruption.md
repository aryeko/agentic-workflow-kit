---
title: "Run Lifecycle & Event State - event log, writer, and corruption protocol"
status: approved
last-reviewed: "2026-06-18"
---

# Event Log, Writer, and Corruption Protocol

## Event envelope

Every authored run fact is a `RunEventEnvelope` persisted as an opaque payload in the fnd-02 framed
log. The envelope is the semantic contract; fnd-02 owns physical frame metadata.

Required fields:

- `schema`: always `kit-vnext.run-event.v1`.
- `runId`: stable Run identity.
- `eventId`: deterministic idempotency key for the authored fact.
- `sequence`: contiguous per-Run sequence, starting at 1.
- `writerEpoch`: current fnd-02 lease epoch for `run-writer:<runId>`.
- `domain` and `type`: emitting domain and event name.
- `durability`: effective semantic durability applied to the committed fnd-02 batch.
- `occurredAt`: when the producing domain observed the fact.
- `recordedAt`: assigned by the writer immediately before append.
- `payloadDigest` and `payload`: canonical JSON payload and digest.
- `causationId` and `correlationId`: optional trace links.
- `artifactRefs`: optional fnd-02 artifact references. Each string is an `ArtifactRef.id` resolvable
  via `ArtifactStore.resolve(id)`; core-01 stores ids opaquely.

Payload schemas are owned by emitting domains. Well-formed unknown future payload types are
preserved in replay, copied into `summary.unknownEvents`, and ignored by projections unless
explicitly declared relevant. They do not fail replay or projection.

For lifecycle state, the declared relevant payload is always `RunLifecycleTransitioned`. No other
event type authors the lifecycle projection, including `RunCreated`, `RunPolicyBound`, or
`TaskSnapshotRecorded`.

Replay fails only for malformed envelopes, corrupt logs, unavailable logs, or malformed payloads for
event types core-01 declares relevant to its projections and state machine.

## Append protocol

Each Run has one live writer represented by the fnd-02 lease `run-writer:<runId>`.
`RunEventLog.openWriter` requires a fresh `LeaseCapability`; `RunWriter.append` sends a batch to
fnd-02 with `expectedSequence = lastCommittedSequence + 1`. fnd-02 rejects stale lease names, tokens,
or epochs before bytes are written.

`createRun` is not a separate lifecycle author. It acquires the first writer lease and commits a
`barrier` batch containing `RunCreated` plus `RunLifecycleTransitioned { from: null, to: "created" }`.
Policy binding and task snapshotting follow the same pattern: the factual event and the lifecycle
transition can be committed together, but only the lifecycle event moves state.

Before calling `EventLogStore.append`, the writer validates:

- envelope `writerEpoch` equals the lease epoch;
- batch sequences are contiguous and begin at the expected sequence;
- every `RunLifecycleTransitioned` payload is legal from the current replayed state;
- `created`, `configured`, and `task-snapshotted` state changes are represented by
  `RunLifecycleTransitioned` events that reference the factual `RunCreated`, `RunPolicyBound`, and
  `TaskSnapshotRecorded` event ids in the same committed history;
- terminal lifecycle events are idempotent only by exact `eventId` and digest;
- session linkage ordinals are monotonic;
- requested durability is sufficient for the event type.

The writer then normalizes the batch to fnd-02's single-batch durability. The effective durability is
the strongest requested durability across the intents (`barrier` stronger than `durable`). Every
intent must still request at least the minimum durability required by its event type; for example, a
terminal lifecycle event requested as `durable` is rejected with `durability-insufficient` even if
another intent in the batch requested `barrier`. After validation, the writer constructs one fnd-02
`AppendBatch` with that effective durability, serializes every envelope with the same effective
durability value, and appends the batch atomically. It never splits one `RunWriter.append` call into
multiple fnd-02 appends because that would break atomic creation, policy binding, task snapshot, and
lifecycle transition commits.

After append returns an `AppendReceipt`, the writer returns the committed sequence range, writer epoch,
effective durability, payload digests, fnd-02 frame digest, and log health. Core-01 never returns
fnd-02 `NonDurableAck` from the canonical Run log because canonical Run events are always `durable` or
`barrier`.

## Writer-epoch fencing and partial-write recovery

A stale writer is any writer whose lease capability no longer fences current. Stale writers cannot
append, including after terminal or superseded epochs. Release is an optimization; epoch fencing is the
safety mechanism.

If a caller loses acknowledgement after append, recovery is replay-only:

1. Replay the log and observe the last committed sequence, writer epoch, event ids, and digests.
2. Reacquire or renew `run-writer:<runId>`.
3. If the lost batch appears with identical ids and digests, report it committed.
4. If the batch is absent, append a fresh batch at the next sequence.
5. If a conflicting id or digest appears, fail closed with `sequence-conflict`.

The writer never scans bytes directly and never repairs frames. It consumes fnd-02 replay health.

## Durability classes

FND-02 supports a lower-level `buffered` write, but core-01 does not expose it in
`RunDurabilityClass` and never writes it to the authored Run log. A future UI progress stream may use
a separate non-authoritative store, but it must have no canonical sequence, projection, gating,
coordination, lifecycle, evidence, or recovery impact.

| Durability | Allowed semantic use |
|---|---|
| `durable` | Normal authored facts, including progress, evidence pointers, and non-terminal lifecycle changes that do not gate irreversible action. |
| `barrier` | Run creation, resolved policy binding, task snapshot, session linkage, approval parked/resumed facts, lifecycle terminal events, corruption records, and any fact that gates an irreversible action. |

If policy or a caller requests weaker durability than the mapping allows, append fails with
`durability-insufficient`. If a caller attempts to append a canonical Run event with fnd-02
`buffered`, the writer rejects it before storage append.

`RunAppendRejected` is authored only by the currently fenced writer for semantic pre-storage
rejections while the log remains writable, such as `illegal-lifecycle-transition` or
`durability-insufficient`. A stale writer cannot append its own rejection; `stale-writer-fenced`
returns only as `RunAppendFailure`. Likewise, `interior-corrupt` and `event-log-unavailable` cannot be
recorded by appending a rejection because authoritative append is already unavailable.

## Corruption handling

Core-01 accepts fnd-02 health as authoritative:

- `log-tail-repaired`: append `RunLogTailRepaired` at `barrier` durability when a writer is available,
  then continue from the last committed sequence.
- `log-interior-corrupt`: mark projections `degradedHealth = "interior-corrupt"`, refuse lifecycle
  mutation and authoritative appends, and require recovery coordination to start from read-only
  evidence.
- `network-fs-degraded`, `read-only`, or `unusable`: refuse authoritative append and expose
  `event-log-unavailable`.

Core-01 never edits the log to repair semantic mistakes. Semantic corrections are new events.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Run Lifecycle & Event State](./README.md) · **← Prev:** [Run Lifecycle & Event State - contracts](./contracts.md) · **Next →:** [Run Lifecycle & Event State - projections, lifecycle, and tests](./projections-lifecycle-and-tests.md)

<!-- /DOCS-NAV -->
