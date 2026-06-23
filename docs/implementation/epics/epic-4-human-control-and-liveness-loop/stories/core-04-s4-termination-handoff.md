---
title: "core-04-s4-termination-handoff - supervision termination handoff implementation story"
id: "core-04-s4-termination-handoff"
epic: 4
status: "story: ready"
design:
  - "docs/design/30-domain-reference/core/supervision-and-liveness/README.md"
  - "docs/design/30-domain-reference/core/supervision-and-liveness/liveness-model.md"
---

# core-04-s4-termination-handoff - Termination Handoff

## Purpose

Record supervisor lifecycle, liveness/timer facts, supervision-lost facts, termination-requested,
worker-terminated, and supervisor-stopped facts through `RunWriter` and Execution Host handoff without
implementing host kill mechanics.

## Normative design

- `supervision-and-liveness/README.md` defines emitted events, durabilities, terminal batch rules, and
  test strategy.
- `liveness-model.md` defines termination handoff, `termination-unavailable`, `termination-unproven`,
  `WorkerTerminated`, and `SupervisorStopped` constraints.

## Spec surface

- Functions exposed: `startSupervisor`, `recordLivenessAdvanced`, `recordTimerExpired`,
  `recordSupervisionLost`, `requestWorkerTermination`, `recordWorkerTerminated`,
  `stopSupervisor`.
- Shapes consumed: `core-04-s1` event payloads and `LivenessReason`; `core-04-s2` projection output;
  `core-04-s3` timer expiry output.
- Runtime objects consumed: Epic 3 `RunWriter`; Epic 2 `ExecutionHostProvider`.
- Failure reasons raised: `termination-unavailable`, `termination-unproven`, plus propagated cursor,
  linkage, progress, stale, and overdue reasons.

## Responsibilities

- Append `SupervisorStarted`, `LivenessAdvanced`, `LivenessTimerExpired`, and `LivenessStateChanged`
  with required durability.
- Record `SupervisionLost` at `barrier` when liveness cannot be proven.
- On stale owned worker with positive termination capability, append `SupervisorTerminationRequested`
  and call `ExecutionHostProvider.terminateWorker`.
- Record `WorkerTerminated` before terminal lifecycle closure or in the same barrier batch as
  `SupervisorStopped`.
- Ensure `SupervisorStopped` is the only post-terminal core-04 event and no core-04 events append
  after it.

## Out of scope

- Signal/kill/reap/prove-empty mechanics (Execution Host provider/Epic 6).
- Completion or recovery decisions over termination facts (Epic 5).
- Operator rendering of attention states (Epic 7).

## Dependencies and frozen inputs

- Covers signals: supervisor facts behavior part; cursor/linkage/progress/stale/termination fail-closed
  behavior.
- Depends on: `core-04-s1-supervision-contracts`, `core-04-s2-liveness-fold`,
  `core-04-s3-timers-and-wait`.
- Decision inputs consumed: liveness state/reason, timer-expired facts, ownership/worker handle,
  Execution Host `canKill` attestation/capability, `TerminationResult.proof.containmentEmpty`, writer
  append result, terminal lifecycle state.

## Acceptance criteria

- **AC-1** `startSupervisor` appends `SupervisorStartedPayload` with `durability = "durable"`, cursor,
  timer policy, optional expected session/worker handle, and source event ids - evidence:
  `supervisor-start.unit.test.ts` asserts exact event type, durability, and cursor fields.
- **AC-2** `recordLivenessAdvanced`, `recordTimerExpired`, and `LivenessStateChanged` append durable
  facts with source sequence/class, timer/reason/deadline, and state transition fields exactly from
  producer payloads - evidence: `supervisor-fact-append.unit.test.ts` asserts exact payload fields for
  three fixture events.
- **AC-3** `recordSupervisionLost` appends `SupervisionLostPayload` at `barrier` for
  `event-cursor-unavailable`, `session-linkage-ambiguous`, `agent-progress-unobservable`,
  `termination-unavailable`, and `termination-unproven` - evidence: `supervision-lost.unit.test.ts`
  table-tests five reasons and asserts barrier durability.
- **AC-4** Startup, idle, no-progress, per-tool, and max-runtime expiry for an owned worker with fresh
  positive termination capability appends `SupervisorTerminationRequestedPayload` at `barrier` and calls
  `ExecutionHostProvider.terminateWorker(handle, policy)` exactly once - evidence:
  `termination-request.unit.test.ts` asserts event type/durability and mock host call args.
- **AC-5** Missing/stale/negative `canKill`, observe-only ownership, or missing worker handle records
  `SupervisionLostPayload.reason = "termination-unavailable"` and does not call host termination -
  evidence: `termination-unavailable.unit.test.ts` asserts exact reason and zero host calls for three
  fixtures.
- **AC-6** Host result without `proof.containmentEmpty === true` records
  `SupervisionLostPayload.reason = "termination-unproven"` and does not record `WorkerTerminated` -
  evidence: `termination-unproven.unit.test.ts` asserts exact reason and no worker-terminated event.
- **AC-7** Proven Agent/Host terminal observation records `WorkerTerminatedPayload` at `barrier` before
  terminal lifecycle closure or in the same barrier batch as `SupervisorStopped` - evidence:
  `worker-terminated-order.unit.test.ts` asserts event order in `same-batch-close.fixture.ts` and
  rejects `post-terminal-worker-terminated.fixture.ts`.
- **AC-8** `SupervisorStoppedPayload` is the single allowed post-terminal core-04 event; after it, no
  supervisor, liveness, progress, timer, termination, or terminal-summary facts append for the run -
  evidence: `supervisor-stopped-terminal.unit.test.ts` asserts a post-terminal stopped event succeeds
  under terminal epoch reuse and all later core-04 append attempts return blocked.
- **AC-9** SDK source never imports process APIs, Local provider, or concrete kill helpers - evidence:
  `termination-boundary.unit.test.ts` runs `rg -n "child_process|process\\.kill|provider-local|execa|containment" packages/sdk/src/core/supervision/termination` and expects zero matches.

## Coverage matrix

| Responsibility / spec-surface item | Proven by |
|---|---|
| Supervisor/liveness/timer fact appends | AC-1, AC-2 |
| Supervision lost | AC-3, AC-5, AC-6 |
| Termination request handoff | AC-4 |
| Worker terminated / stopped ordering | AC-7, AC-8 |
| Boundary against concrete kill | AC-9 |

## Predicate-input matrix

| AC or failure row | Predicate / branch value | Declared source value | Producer / resolver | Verdict |
|---|---|---|---|---|
| AC-1..AC-3 | event payload and durability | producer payloads, liveness reasons | `core-04-s1`, `core-04-s2`, `core-04-s3` | decidable |
| AC-4..AC-6 | termination eligibility/proof | ownership, worker handle, host capability, termination result | Epic 2 Execution Host, Epic 3 run state | decidable |
| AC-7, AC-8 | terminal append legality | lifecycle state, terminal epoch, source event ids | Epic 3 lifecycle/writer | decidable |
| AC-9 | forbidden implementation dependency | import text | repo source | decidable |

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `event-cursor-unavailable` | wait/cursor unavailable propagated | barrier `SupervisionLost` | AC-3 |
| `session-linkage-ambiguous` | linkage ambiguous propagated | barrier `SupervisionLost` | AC-3 |
| `agent-progress-unobservable` | Agent progress guarantee missing | barrier `SupervisionLost` | AC-3 |
| `termination-unavailable` | cannot kill or no owned worker/handle | no host call; supervision lost | AC-5 |
| `termination-unproven` | host proof absent/negative | no worker terminated; supervision lost | AC-6 |
| `startup-timeout` / `idle-timeout` / `no-progress-timeout` / `tool-timeout` / `max-runtime-exceeded` | stale owned worker timer expired | termination requested when eligible | AC-4 |

## Quality bar

- Coverage scope and threshold: 95% branch coverage for `packages/sdk/src/core/supervision/termination/**`.
- Coverage command and lanes: `pnpm test:unit -- --coverage --coverage.include='packages/sdk/src/core/supervision/termination/**'`.
- Required tests: AC-1..AC-9 and failure rows.
- Public exposure: `sdk` import test for supervisor/termination functions.
- Determinism constraints: sampled time from payloads; no ambient process state.
- Dependency boundaries: SDK Execution Host port only; no Local provider.
- File-size budget: 300 lines per implementation file, 380 lines per test file.

## Evidence pack

- Tests and fixtures named above.
- Negative fixtures for unavailable/unproven termination and post-terminal ordering.
- `pnpm check` after implementation.
- Boundary sweep in AC-9.

## Boundaries and STOP conditions

- Package/module boundary: `packages/sdk/src/core/supervision/termination/**`.
- Owned pathset: that source/test folder.
- Forbidden dependencies: Local provider, process kill, recovery decisions, operator UI.
- STOP when a story needs to prove containment empty itself rather than consuming Execution Host proof.

## Characterization review

- Scope decision: termination is handoff, not kill. Rationale: design forbids core from signalling or
  proving-empty directly. Falsification: process API import or concrete Local provider call.
- Gate verdict: ready. ACs name exact event ordering, failure behavior, and forbidden-symbol sweep.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - stories](./README.md) · **← Prev:** [core-04-s3-timers-and-wait - supervision timers and wait wrapper implementation story](./core-04-s3-timers-and-wait.md) · **Next →:** [Epic 4 - story DAG](../story-dag.md)

<!-- /DOCS-NAV -->
