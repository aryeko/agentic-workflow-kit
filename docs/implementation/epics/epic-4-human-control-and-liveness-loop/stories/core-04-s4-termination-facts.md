---
title: "core-04-s4-termination-facts - supervision termination facts implementation story"
id: "core-04-s4-termination-facts"
epic: 4
status: "story: ready"
design:
  - "docs/design/30-domain-reference/core/supervision-and-liveness/README.md"
  - "docs/design/30-domain-reference/core/supervision-and-liveness/liveness-model.md"
---

# core-04-s4-termination-facts - Termination Facts

## Purpose

Append supervisor lifecycle, liveness, timer, supervision-lost, termination-requested,
worker-terminated, and supervisor-stopped facts, handing stale owned workers to Execution Host without
implementing host kill mechanics.

## Spec Surface

- Functions: `startSupervisor`, `recordLivenessAdvanced`, `recordTimerExpired`,
  `recordLivenessStateChanged`, `recordSupervisionLost`, `requestWorkerTermination`,
  `recordWorkerTerminated`, `stopSupervisor`.
- Consumed shapes: supervision event payloads, `LivenessReason`, liveness projection output, timer
  expiry output, Epic 2 `ExecutionHostProvider` termination DTOs, Epic 3 `RunWriter`.

## Responsibilities

- Append supervisor start, liveness advanced, timer expired, and liveness state changed facts with the
  required durable/barrier classes.
- Record `SupervisionLost` at `barrier` when liveness or termination proof cannot be established.
- For stale owned workers with positive termination capability, append termination-requested and call
  `ExecutionHostProvider.terminateWorker`.
- Record `WorkerTerminated` before terminal lifecycle closure or in the same barrier batch as
  `SupervisorStopped`.
- Permit only `SupervisorStopped` as a post-terminal core-04 fact and block all later core-04 appends.

## Dependencies and Inputs

- Covers signals: supervisor facts behavior part and cursor/linkage/progress/stale/termination
  fail-closed behavior.
- Depends on: `core-04-s1-supervision-contracts`, `core-04-s2-liveness-fold`,
  `core-04-s3-timers-wait`.
- Decision inputs: liveness state/reason, timer expiry facts, ownership/worker handle, host capability
  attestation, termination result proof, writer append result, terminal lifecycle state/epoch.

## Acceptance Criteria

- **AC-1** `startSupervisor` appends `SupervisorStartedPayload` with durability `durable`, cursor,
  timer policy, optional expected session/worker handle, started time, and source event ids - evidence:
  `supervisor-start.unit.test.ts` asserts exact payload and durability.
- **AC-2** `recordLivenessAdvanced`, `recordTimerExpired`, and `recordLivenessStateChanged` append
  durable facts whose payload fields equal the producer inputs - evidence:
  `supervisor-facts.unit.test.ts` asserts source sequence, timer/deadline, state transition, and source
  event ids.
- **AC-3** `recordSupervisionLost` appends at `barrier` for cursor unavailable, ambiguous linkage,
  progress unobservable, termination unavailable, and termination unproven - evidence:
  `supervision-lost.unit.test.ts` table-tests exact reasons and durability.
- **AC-4** Startup, idle, no-progress, per-tool, or max-runtime expiry for an owned worker with fresh
  positive termination capability appends `SupervisorTerminationRequested` at `barrier` and calls
  `ExecutionHostProvider.terminateWorker(handle, policy)` exactly once - evidence:
  `termination-request.unit.test.ts` asserts event and mock host call args.
- **AC-5** Missing/stale/negative `canKill`, observe-only ownership, or missing worker handle records
  `termination-unavailable` and makes zero host calls - evidence:
  `termination-unavailable.unit.test.ts` asserts exact reason and zero calls.
- **AC-6** Host termination result without `proof.containmentEmpty === true` records
  `termination-unproven` and does not record `WorkerTerminated` - evidence:
  `termination-unproven.unit.test.ts` asserts exact reason and absent worker-terminated event.
- **AC-7** Proven Agent or Host terminal observation records `WorkerTerminated` at `barrier` before
  terminal lifecycle closure or in the same barrier batch as `SupervisorStopped` - evidence:
  `worker-terminated-order.unit.test.ts` asserts valid batch order and rejects post-terminal worker
  termination.
- **AC-8** `SupervisorStopped` is the only allowed post-terminal core-04 event; after it, no core-04
  supervisor, liveness, timer, termination, or summary fact appends for the run - evidence:
  `supervisor-stopped-terminal.unit.test.ts` asserts terminal-epoch reuse and later append rejection.
- **AC-9** SDK source imports no process API, Local provider, or concrete kill helper - evidence:
  `termination-boundary.unit.test.ts` runs
  `rg -n "child_process|process\\.kill|provider-local|execa" packages/sdk/src/core/supervision/termination`
  and expects zero matches.
- **AC-10** The public SDK entrypoint exports supervisor and termination fact functions, through this
  story's own export line(s) in `packages/sdk/src/index.ts` (this story owns those barrel lines, in its
  owned pathset) - evidence: `termination-public-import.unit.test.ts` imports the full function manifest
  from `sdk` and constructs one termination request fixture without private paths.

## Predicate and Producer Closure

| AC / output | Decision value or produced field | Source |
|---|---|---|
| AC-1..AC-3 | payload fields and durability | `core-04-s1` payload values plus sampled timestamps |
| AC-4 | termination eligibility | liveness/timer reason, ownership, worker handle, host capability |
| AC-5 | unavailable termination | missing/stale/negative capability, observe-only owner, missing handle |
| AC-6 | unproven termination | `TerminationResult.proof.containmentEmpty` |
| AC-7, AC-8 | terminal ordering | Epic 3 lifecycle state, terminal epoch, writer append result |
| AC-9 | boundary | source import text |
| AC-10 | public symbols | owned source files plus this story's own export line(s) in `packages/sdk/src/index.ts` (owned pathset) |

## Failure and Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `event-cursor-unavailable` | cursor failure propagated | barrier `SupervisionLost` | AC-3 |
| `session-linkage-ambiguous` | linkage ambiguous propagated | barrier `SupervisionLost` | AC-3 |
| `agent-progress-unobservable` | progress guarantee missing | barrier `SupervisionLost` | AC-3 |
| `termination-unavailable` | cannot kill or no owned worker/handle | no host call; supervision lost | AC-5 |
| `termination-unproven` | host proof absent or negative | no worker-terminated fact | AC-6 |
| stale timer reasons | stale owned worker timer expired | request termination when eligible | AC-4 |

## Quality Bar

- Coverage: 95% branch coverage for `packages/sdk/src/core/supervision/termination/**`.
- Gate lane: `pnpm check`.
- Public exposure: AC-10.
- Barrel ownership: this story owns its own export line(s) in `packages/sdk/src/index.ts` — a normal
  owned file in this story's owned pathset, per `docs/design/20-sdk-and-packaging/sdk-boundary.md`. The
  barrel is an append-only aggregation point shared across concurrent stories; a line-level overlap is
  resolved by rebase, never by a special ownership role.
- Boundary sweep: AC-9.
- File-size budget: 320 lines per implementation file, 420 lines per test file.

## STOP Conditions

Stop if core must signal/kill/reap/prove-empty directly, choose a recovery action, or render operator
attention. Those are outside Epic 4.

## Characterization Review

### Decision: provider-handoff-not-kill

- Rationale: core-04 records facts and calls the Execution Host port; it must not implement concrete
  process mechanics.
- Design trace: supervision README and liveness-model termination handoff.
- Falsification: SDK core imports process kill APIs, Local provider code, or containment proof helpers.
- Escalation: route missing host behavior to provider-driver scope, not core-04.

### Decision: terminal-ordering-guard

- Rationale: `WorkerTerminated` must be recorded before terminal lifecycle closure except the allowed
  `SupervisorStopped` summary.
- Design trace: supervision README terminal batch rule and liveness-model `SupervisorStopped` paragraph.
- Falsification: `WorkerTerminated` appends post-terminal or any core-04 fact appends after stopped.
- Escalation: block as story defect; do not defer to recovery.

- Verdict: ready; facts, proof sources, and forbidden dependencies are all falsifiable.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - stories](./README.md) · **← Prev:** [core-04-s3-timers-wait - supervision timers wait implementation story](./core-04-s3-timers-wait.md) · **Next →:** [Epic 4 - story DAG](../story-dag.md)

<!-- /DOCS-NAV -->
