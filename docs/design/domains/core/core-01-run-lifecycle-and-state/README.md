---
title: "Run Lifecycle & Event State - design"
id: "core-01"
layer: "core"
status: approved
owner: "domain designer"
last-reviewed: "2026-06-18"
depends-on:
  - "fnd-01-configuration-and-policy"
  - "fnd-02-storage-and-artifacts"
---

# Run Lifecycle & Event State - design

## Mandate

**Purpose.** The spine of the control plane: the append-only event log (single source of truth),
the projection model, the writer discipline, and the run lifecycle state machine.

### Responsibilities (in scope)
- The event envelope and append protocol: single leased writer, monotonic sequence, writer-epoch
  fencing, partial-write recovery.
- Projections (`state` / `summary` / `metrics` / `launch`) as pure functions of the log — never
  authored directly.
- The run lifecycle state machine and its transitions.
- Session linkage as an append-only fact (monotonic, never clobbered).
- Physical durability of the log (append atomicity, corruption handling: tail vs interior).

### Out of scope
- Domain-specific event semantics (each domain defines its own events).
- Analysis (core-07), recovery/coordination actions (core-06) — this provides the primitives they use.

### Requirements owned
FR-11 (run-activity authority), NFR-OBS, NFR-DET, NFR-SAFE (coherent state).

### Dependencies (Dependency Rule)
- Depends on: Foundation — fnd-01 (config) and fnd-02 (Storage & Artifacts: persistence + lease primitive).
- Must NOT: depend on drivers or other core domains for state authorship.

### Required reading
Standard set + [fnd-01](../../foundation/fnd-01-configuration-and-policy/README.md).

### Deliverable
`README.md` defining: event envelope; writer/lease/fencing model; projection set + deterministic
rebuild; lifecycle states/transitions; durability classes; corruption handling.

### Definition of done (domain-specific)
- Projections are pure functions; replaying a log yields identical projections (property-tested).
- No projection is ever written directly; linkage is monotonic.
- Stale-writer writes after a terminal/superseded epoch are rejected.

### Open questions
- Durability class per event (which events fsync). Storage backend (filesystem first; SQLite later?).

## 1. Purpose & boundaries

Run Lifecycle & Event State is the authored run-state spine for the Control plane. It defines the
semantic event envelope, append protocol, single leased writer, monotonic sequence discipline,
writer-epoch fencing, pure projections, lifecycle state machine, append-only session linkage,
durability mapping, and corruption handling over the Storage & Artifacts primitives.

Out of scope: domain-specific payload semantics, recovery action selection, analysis, supervision,
approval adjudication, completion gates, Forge operations, Work Source status writes, and concrete
Driver behavior. Core-01 owns writer fencing and the append protocol; sibling domains either return
`AppendIntent` batches for the owning core flow to append or, where their approved contract says so,
receive the active leased `RunWriter` to append their own records through the same core-01 protocol.

Dependency Rule: this design depends only on Configuration & Policy for resolved policy inputs and
Storage & Artifacts for log, lease, durability, and artifact primitives. It introduces no dependency on
Drivers or other core domains for state authorship.

## 2. Required reading

Read: [README.md](../../../README.md), [architecture.md](../../../architecture.md),
[requirements.md](../../../requirements.md), [conventions.md](../../../conventions.md),
[glossary.md](../../../glossary.md), [domains/README.md](../../README.md),
[_templates/domain-design-template.md](../../../_templates/domain-design-template.md),
[README.md#mandate](README.md#mandate), [fnd-01 Configuration & Policy design](../../foundation/fnd-01-configuration-and-policy/README.md),
and [fnd-02 Storage & Artifacts design](../../foundation/fnd-02-storage-and-artifacts/README.md).

## 3. Context diagram

```mermaid
flowchart LR
  subgraph CORE["Control plane"]
    RL["Run Lifecycle & Event State"]
    OTHER["Other core domains"]
  end
  subgraph FND["Foundation"]
    CFG["Configuration & Policy"]
    STA["Storage & Artifacts"]
  end
  OP["Operator & Entry Surface"] -->|"start/cancel intent"| RL
  OTHER -->|"return AppendIntents or append with leased writer"| RL
  RL -->|"read resolved policy"| CFG
  RL -->|"lease + append + replay"| STA
  RL -->|"projections + replay health"| OTHER
  RL -->|"inspect state/summary/launch"| OP
```

## 4. Design

Low-level detail is split to keep this entrypoint focused:

- [Contracts](contracts.md) defines the host-neutral TypeScript contract for the run event log,
  writer, envelopes, append/replay failures, projections, lifecycle payloads, linkage payloads, and
  health records.
- [Event log, writer, and corruption protocol](event-log-writer-and-corruption.md) defines the
  event envelope, append protocol, single leased writer, monotonic sequences, writer-epoch fencing,
  lost-ack recovery, durability classes, and tail/interior corruption handling.
- [Projections, lifecycle, and tests](projections-lifecycle-and-tests.md) defines the pure
  projection set, deterministic rebuild, lifecycle state machine, session linkage, emitted/consumed
  events, degraded modes, and mock-only/property-test strategy.

Core decisions:

- The Event log is the only authored run state. Projections are read-only outputs from replay and are
  never written directly.
- `RunLifecycleTransitioned` is the only event type that authors lifecycle state, including the
  initial `created`, `configured`, and `task_snapshotted` transitions. `RunCreated`,
  `RunPolicyBound`, and `TaskSnapshotRecorded` are factual payload events consumed by summary and
  launch projections; they do not move lifecycle state on their own.
- Every authored event uses the `RunEventEnvelope` schema and a contiguous per-Run `sequence`.
- A fnd-02 `run-writer:<runId>` lease is required to append; its epoch is copied into every event and
  fences stale writers.
- A terminal lifecycle transition closes lifecycle mutation for that writer epoch. Post-terminal
  non-lifecycle facts may reuse the terminal writer epoch until lease expiry, but they cannot change
  the terminal state; a fresh epoch is required only after lease loss.
- Session linkage is append-only. A later link can supersede a prior link in projection output, but no
  link fact is clobbered.
- Canonical Run events use only `durable` or `barrier` durability. Core-01 does not request fnd-02
  `buffered` writes for the authored Run log because they may disappear and cannot support lifecycle,
  gating, coordination, recovery, or evidence state.
- A multi-intent append is one atomic semantic batch. The writer maps it to one fnd-02 `AppendBatch`
  using the strongest requested durability in the batch and records that effective durability on every
  committed envelope and on the receipt; it never splits a semantic batch to satisfy mixed durability.
- Physical repair never rewrites semantic history. Tail repair truncates only uncommitted bytes per
  fnd-02; semantic corrections are new events.

## 5. Contracts & interfaces

Core-01 exposes a host-neutral run log contract in [Contracts](contracts.md): `RunEventLog`,
`RunWriter`, event envelopes, append/replay failures, projections, lifecycle payloads, linkage
payloads, and health records.

Consumed interfaces: fnd-01 resolved policy data; fnd-02 `LeaseStore`, `EventLogStore`,
`DurabilityClass`, replay health, and append receipts. The detailed append and replay contracts are in
[Event log, writer, and corruption protocol](event-log-writer-and-corruption.md).

`CreateRunInput.idempotencyKey` and `operatorRef` are API request metadata used before any event
exists; `RunCreatedPayload` stores the same values durably so replay remains self-contained after the
request object is gone.

`RunEventCursor` is sequence-based and host-neutral. `waitRunEvents` is the low-level cursor primitive
that core-04 wraps for liveness and operator blocking; core-01 does not derive liveness or timers from
it. Because fnd-02 exposes replay rather than subscribe, core-01 implements a bounded
poll-over-`EventLogStore.replay`: deliver committed events after `cursor.afterSequence`, or return
`timedOut = true` when `timeoutMs` elapses. Waiting does not acquire or renew leases, append health
records, mutate liveness state, write projections, or otherwise change the canonical log.

## 6. Events & data

Core-01 emitted events: `RunCreated`, `RunPolicyBound`, `TaskSnapshotRecorded`,
`RunLifecycleTransitioned`, `SessionLinked`, `SessionLinkSuperseded`, `RunLogTailRepaired`, and
`RunAppendRejected`. Only `RunLifecycleTransitioned` authors lifecycle state; the factual events it
references provide metadata and gating evidence for the transition payload.

Consumed events: any valid `RunEventEnvelope` appended through core-01's single leased `RunWriter`.
Sibling domains may contribute records by returning `AppendIntent`s for the owning flow or by using
the active leased writer when their approved contract exposes one. Core-01 consumes only envelope,
lifecycle, linkage, and durability metadata needed for projections and state-machine safety;
payload-specific meaning stays with the emitting domain. Well-formed unknown future payloads do not
fail replay or projection and are preserved in `summary.unknownEvents`.

Projected data: `state`, `summary`, `metrics`, and `launch`. Reducers are pure functions and cannot
call append APIs, mutate artifacts, write projection files, or inspect live external state. Projection
details are in [Projections, lifecycle, and tests](projections-lifecycle-and-tests.md).

## 7. Behavior diagram

```mermaid
stateDiagram-v2
  [*] --> created: lifecycle(created) after RunCreated
  created --> configured: lifecycle(configured) after RunPolicyBound
  configured --> task_snapshotted: lifecycle(task_snapshotted) after TaskSnapshotRecorded
  task_snapshotted --> workspace_ready: lifecycle
  workspace_ready --> worker_starting: lifecycle
  worker_starting --> running: lifecycle after SessionLinked
  running --> parked: approval/session wait
  parked --> running: resume fact
  running --> runner_verifying: worker done fact
  runner_verifying --> forge_waiting: verification evidence fact
  forge_waiting --> merge_waiting: PR/gate evidence fact
  merge_waiting --> settling: merge fact
  settling --> completed: terminal barrier
  completed --> [*]
```

This diagram shows the main flow only. The authoritative transition contract, including terminal and
recovery-classified edges, is the legal transition table in
[Projections, lifecycle, and tests](projections-lifecycle-and-tests.md).

## 8. Failure & degraded modes

Named fail-closed modes: `stale_writer_fenced`, `sequence_conflict`,
`illegal_lifecycle_transition`, `durability_insufficient`, `partial_ack_unknown`, `tail_repaired`,
`malformed_envelope`, `interior_corrupt`, `event_log_unavailable`, and
`malformed_declared_payload`.

Capability gates must treat `malformed_envelope`, `interior_corrupt`, `event_log_unavailable`,
`malformed_declared_payload`, missing projections, stale writer rejection, or ambiguous session
linkage as autonomous capabilities absent.

## 9. Testing strategy

Satisfies FR-1 for durable task snapshot recording, FR-11 for separated run-activity authority,
NFR-OBS for evented state changes, NFR-DET for pure replay, NFR-SAFE for coherent fail-closed state,
NFR-SOLID for foundation-only dependencies, and NFR-TEST for mock-only core execution.

Tests use only mock/fake fnd-01 policy inputs and a deterministic in-memory fnd-02 implementation with
fault injection. No real processes, network, Forge, Agent, Work Source, or filesystem are used in
core-01 tests. Property tests cover append/replay/projection determinism, reducer totality, lifecycle
edges, writer-epoch fencing, lost acknowledgements, partial writes, session linkage monotonicity,
durability rejection, and projection purity.

## 10. Open questions

None for v1. Prior integration-review questions are resolved as follows:

- Terminal vocabulary stays `completed`, `blocked`, `failed`, and `canceled`; there is no distinct
  `abandoned` terminal state. Core-06 maps abandonment evidence onto `blocked` or `failed`.
- Post-terminal non-lifecycle facts, such as `SupervisorStopped` or `AnalysisRecorded`, may reuse the
  terminal writer epoch until lease expiry. A fresh epoch is required only after lease loss.

## 11. Definition of done

- [x] All sections complete; guidance notes removed.
- [x] Files are focused; low-level detail is split into cohesive subfiles.
- [x] Complies with the Dependency Rule; dependencies listed and justified.
- [x] Uses glossary vocabulary.
- [x] States the FR/NFR ids satisfied; shows how NFR-TEST is met.
- [x] Failure/degraded modes defined (fail-closed).
- [x] Provider-domain validation is not applicable to this core domain.
- [x] Diagrams present and consistent with architecture.md naming.
- [x] Open questions captured, not silently resolved.
