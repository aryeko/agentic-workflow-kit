# Reviewer Prompt: core-04-s4-termination-handoff

## Assigned Routing

- Source story id: `core-04-s4-termination-handoff`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `elevated`.
- Reasoning tier: `elevated`.
- Routing rationale: core-04-s4-termination-handoff covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9` and carries Execution Host provider-port termination handoff and durable supervision fact boundary without concrete kill mechanics or recovery decisions. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Original Scope

- Story id: `core-04-s4-termination-handoff`.
- Epic slug: `epic-4-human-control-and-liveness-loop`.
- Source story contract path: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s4-termination-handoff.md`.
- Allowed pathset: `packages/sdk/src/core/supervision/termination/**`, `packages/sdk/src/index.ts`, `packages/sdk/tests/core/supervision/termination/**`.
- Direct dependencies: `core-04-s1-supervision-contracts`, `core-04-s2-liveness-fold`, `core-04-s3-timers-and-wait`, `core-03-s4-grant-mapping-and-outcome`.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus committed producer shapes, public import paths, event/projection inputs, and provider-port facts named in the source contract and DAG. The `core-03-s4-grant-mapping-and-outcome` dependency is only the committed baseline for serialized `packages/sdk/src/index.ts` export wiring; it is not supervision termination shape input.

### Acceptance Criteria

Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`.

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

### Dependencies And Frozen Inputs

- Covers signals: supervisor facts behavior part; cursor/linkage/progress/stale/termination fail-closed
  behavior.
- Depends on: `core-04-s1-supervision-contracts`, `core-04-s2-liveness-fold`,
  `core-04-s3-timers-and-wait`.
- Decision inputs consumed: liveness state/reason, timer-expired facts, ownership/worker handle,
  Execution Host `canKill` attestation/capability, `TerminationResult.proof.containmentEmpty`, writer
  append result, terminal lifecycle state.

### Non-Goals

- Signal/kill/reap/prove-empty mechanics (Execution Host provider/Epic 6).
- Completion or recovery decisions over termination facts (Epic 5).
- Operator rendering of attention states (Epic 7).

### STOP Conditions And Boundaries

- Package/module boundary: `packages/sdk/src/core/supervision/termination/**`, with SDK
  public-entrypoint export wiring in `packages/sdk/src/index.ts`.
- Owned pathset: `packages/sdk/src/core/supervision/termination/**`, `packages/sdk/src/index.ts`,
  `packages/sdk/tests/core/supervision/termination/**`.
- Forbidden dependencies: Local provider, process kill, recovery decisions, operator UI.
- STOP when a story needs to prove containment empty itself rather than consuming Execution Host proof.

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check implementation against source story `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s4-termination-handoff.md` and AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`.

- AC coverage by source `AC-n` id, including every failure, degraded, validation, and negative-fixture row named by the source contract.
- Evidence pack completeness against the source `Quality bar` and `Evidence pack` sections.
- Public API names, exports, and import paths against the source contract and DAG producer/consumer table.
- Dependency boundaries, committed dependency inputs, and `{{DEPENDENCY_COMMITS}}` consistency.
- Stale names and sibling occurrences of any issue found.
- Tests, targeted checks, coverage commands, forbidden-symbol sweeps, and `pnpm check` output.
- Scope control against allowed writes: `packages/sdk/src/core/supervision/termination/**`, `packages/sdk/src/index.ts`, `packages/sdk/tests/core/supervision/termination/**`.
- Repo conventions and mutation limits from `AGENTS.md` and the source contract.

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Implementer Prompt: core-04-s4-termination-handoff](./implementer.md) · **Next →:** [Epic 4 Execution Tracker](../../tracker.md)

<!-- /DOCS-NAV -->
