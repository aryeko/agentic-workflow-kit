# Implementer Prompt: core-04-s4-termination-handoff

## Assigned Routing

- Source story id: `core-04-s4-termination-handoff`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`.
- Model class: `strong-coder`.
- Effort: `high`.
- Suggested-tier floor: `elevated`.
- Reasoning tier: `elevated`.
- Routing rationale: core-04-s4-termination-handoff covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9` and carries Execution Host provider-port termination handoff and durable supervision fact boundary without concrete kill mechanics or recovery decisions. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Exact Task

Implement source story `core-04-s4-termination-handoff` for epic `epic-4-human-control-and-liveness-loop`. Deliver exactly the outcome in the ready source contract and nothing outside it:

Record supervisor lifecycle, liveness/timer facts, supervision-lost facts, termination-requested,
worker-terminated, and supervisor-stopped facts through `RunWriter` and Execution Host handoff without
implementing host kill mechanics.

Source story: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s4-termination-handoff.md`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`.

## Why It Matters

- Covers signals: supervisor facts behavior part; cursor/linkage/progress/stale/termination fail-closed
  behavior.
- Depends on: `core-04-s1-supervision-contracts`, `core-04-s2-liveness-fold`,
  `core-04-s3-timers-and-wait`, and `core-03-s4-grant-mapping-and-outcome` for serialized
  `packages/sdk/src/index.ts` export wiring only.
- Decision inputs consumed: liveness state/reason, timer-expired facts, ownership/worker handle,
  Execution Host `canKill` attestation/capability, `TerminationResult.proof.containmentEmpty`, writer
  append result, terminal lifecycle state.

DAG dependents for this story: none. Preserve the producer/consumer shape boundaries named in the source DAG and story contract so later stories can consume committed dependency inputs without redeclaring or widening this story's scope.

## Required Reading

- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s4-termination-handoff.md` - ready source story contract for `core-04-s4-termination-handoff`.
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md` - frozen DAG row, dependencies, owned pathset, wave, shared shapes, and suggested-tier floor for `core-04-s4-termination-handoff`.
- `docs/design/30-domain-reference/core/supervision-and-liveness/README.md` - normative design named by the source contract.
- `docs/design/30-domain-reference/core/supervision-and-liveness/liveness-model.md` - normative design named by the source contract.
- `{{DEPENDENCY_COMMITS}}` - runtime slot for committed dependency story inputs before implementation starts.
- `AGENTS.md` and `CLAUDE.md` - repo branch, worktree, mutation, and verification rules.

## Acceptance Criteria

Source story: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s4-termination-handoff.md`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`.

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

### Failure And Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `event-cursor-unavailable` | wait/cursor unavailable propagated | barrier `SupervisionLost` | AC-3 |
| `session-linkage-ambiguous` | linkage ambiguous propagated | barrier `SupervisionLost` | AC-3 |
| `agent-progress-unobservable` | Agent progress guarantee missing | barrier `SupervisionLost` | AC-3 |
| `termination-unavailable` | cannot kill or no owned worker/handle | no host call; supervision lost | AC-5 |
| `termination-unproven` | host proof absent/negative | no worker terminated; supervision lost | AC-6 |
| `startup-timeout` / `idle-timeout` / `no-progress-timeout` / `tool-timeout` / `max-runtime-exceeded` | stale owned worker timer expired | termination requested when eligible | AC-4 |

## Allowed Writes

Source story: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s4-termination-handoff.md`. Owned pathset from the frozen DAG and source contract:

- `packages/sdk/src/core/supervision/termination/**`
- `packages/sdk/src/index.ts`
- `packages/sdk/tests/core/supervision/termination/**`

Every other write is forbidden, including this execution package, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, commits, pushes, PRs, and merges.

## Dependency Inputs

Direct dependency story ids: `core-04-s1-supervision-contracts`, `core-04-s2-liveness-fold`,
`core-04-s3-timers-and-wait`, `core-03-s4-grant-mapping-and-outcome`.

Dependency commit inputs are supplied at execution time through `{{DEPENDENCY_COMMITS}}`. Use the
committed `core-03-s4-grant-mapping-and-outcome` input only as the baseline for
`packages/sdk/src/index.ts`; do not import approval grant/outcome shapes or treat the serialization
edge as a supervision termination dependency. Use only producer-owned shared shapes, public import
paths, committed events/projections, provider-port inputs, and frozen cross-epic facts named by
`docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md` or
`docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s4-termination-handoff.md`.
Do not redeclare producer shapes or consume a dependency before its tracker row is `done`.

## Non-Goals And STOP Conditions

### Source Out Of Scope

- Signal/kill/reap/prove-empty mechanics (Execution Host provider/Epic 6).
- Completion or recovery decisions over termination facts (Epic 5).
- Operator rendering of attention states (Epic 7).

### Source Boundaries And STOP Conditions

- Package/module boundary: `packages/sdk/src/core/supervision/termination/**`, with SDK
  public-entrypoint export wiring in `packages/sdk/src/index.ts`.
- Owned pathset: `packages/sdk/src/core/supervision/termination/**`, `packages/sdk/src/index.ts`,
  `packages/sdk/tests/core/supervision/termination/**`.
- Forbidden dependencies: Local provider, process kill, recovery decisions, operator UI.
- STOP when a story needs to prove containment empty itself rather than consuming Execution Host proof.

Also stop and report if dependency inputs are missing, required writes fall outside the allowed pathset, a source gap blocks implementation, or any AC would need reinterpretation.

## Implementation Constraints

### Source Responsibilities

- Append `SupervisorStarted`, `LivenessAdvanced`, `LivenessTimerExpired`, and `LivenessStateChanged`
  with required durability.
- Record `SupervisionLost` at `barrier` when liveness cannot be proven.
- On stale owned worker with positive termination capability, append `SupervisorTerminationRequested`
  and call `ExecutionHostProvider.terminateWorker`.
- Record `WorkerTerminated` before terminal lifecycle closure or in the same barrier batch as
  `SupervisorStopped`.
- Ensure `SupervisorStopped` is the only post-terminal core-04 event and no core-04 events append
  after it.

### Source Spec Surface

- Functions exposed: `startSupervisor`, `recordLivenessAdvanced`, `recordTimerExpired`,
  `recordSupervisionLost`, `requestWorkerTermination`, `recordWorkerTerminated`,
  `stopSupervisor`.
- Shapes consumed: `core-04-s1` event payloads and `LivenessReason`; `core-04-s2` projection output;
  `core-04-s3` timer expiry output.
- Runtime objects consumed: Epic 3 `RunWriter`; Epic 2 `ExecutionHostProvider`.
- Failure reasons raised: `termination-unavailable`, `termination-unproven`, plus propagated cursor,
  linkage, progress, stale, and overdue reasons.

### Normative Design Constraints

- `supervision-and-liveness/README.md` defines emitted events, durabilities, terminal batch rules, and
  test strategy.
- `liveness-model.md` defines termination handoff, `termination-unavailable`, `termination-unproven`,
  `WorkerTerminated`, and `SupervisorStopped` constraints.

Do not introduce implementation choices outside the names, events, failure tokens, determinism rules, boundary rules, import rules, conformance obligations, and safety invariants fixed above.

## Verification

- Coverage scope and threshold: 95% branch coverage for `packages/sdk/src/core/supervision/termination/**`.
- Coverage command and lanes: `pnpm test:unit -- --coverage --coverage.include='packages/sdk/src/core/supervision/termination/**'`.
- Required tests: AC-1..AC-9 and failure rows.
- Public exposure: `sdk` import test for supervisor/termination functions.
- Determinism constraints: sampled time from payloads; no ambient process state.
- Dependency boundaries: SDK Execution Host port only; no Local provider.
- File-size budget: 300 lines per implementation file, 380 lines per test file.

- Tests and fixtures named above.
- Negative fixtures for unavailable/unproven termination and post-terminal ordering.
- `pnpm check` after implementation.
- Boundary sweep in AC-9.

Require exact command output or an explicit blocked reason for every targeted command, required sweep, evidence-pack item, and `pnpm check`.

## Delivery Report

Report:

- changed files;
- AC coverage by `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`;
- tests and checks run;
- evidence pack;
- open questions;
- blockers.

The report is evidence for later review. It is not permission to update tracker state or perform delivery actions.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Reviewer Prompt: core-04-s3-timers-and-wait](../core-04-s3-timers-and-wait/reviewer.md) · **Next →:** [Reviewer Prompt: core-04-s4-termination-handoff](./reviewer.md)

<!-- /DOCS-NAV -->
