# Implementer Prompt: core-04-s4-termination-facts

## Assigned Routing

- Source story id: `core-04-s4-termination-facts`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`.
- Model class: `strong-coder`.
- Effort: `high`.
- Suggested-tier floor: `elevated` from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md`.
- Reasoning tier: `elevated`.
- Routing rationale: source story `core-04-s4-termination-facts` covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10` and carries Execution Host provider-port termination handoff and durable supervision fact boundary without concrete kill mechanics or recovery decisions.

## Exact Task

Implement `core-04-s4-termination-facts` for epic `epic-4-human-control-and-liveness-loop`: Append supervisor lifecycle/lost/termination facts and hand stale owned workers to Execution Host. Keep the result limited to source story `core-04-s4-termination-facts` and source AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`.

## Why It Matters

This story is in wave 4. Its direct dependencies are `core-04-s1-supervision-contracts`, `core-04-s2-liveness-fold`, `core-04-s3-timers-wait` and its dependents are none. The story provides the source-defined approval or supervision surface named by `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s4-termination-facts.md`; later stories and later epics must consume these facts and public `sdk` imports without redeclaring shapes, inventing provider behavior, or using worker prose as evidence.

## Required Reading

- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s4-termination-facts.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md`
- `docs/design/30-domain-reference/core/supervision-and-liveness/README.md`
- `docs/design/30-domain-reference/core/supervision-and-liveness/liveness-model.md`
- `docs/engineering/check-gate.md`
- `docs/engineering/test-lanes.md`
- Runtime dependency commits slot: `{{DEPENDENCY_COMMITS}}` for `core-04-s1-supervision-contracts`, `core-04-s2-liveness-fold`, `core-04-s3-timers-wait`.

## Acceptance Criteria

Source story: `core-04-s4-termination-facts`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`.

- **AC-1** startSupervisor appends durable SupervisorStartedPayload with cursor, timer policy, optional expected session/worker handle, started time, and source event ids.
- **AC-2** recordLivenessAdvanced, recordTimerExpired, and recordLivenessStateChanged append durable facts equal to producer inputs.
- **AC-3** recordSupervisionLost appends at barrier for cursor unavailable, ambiguous linkage, progress unobservable, termination unavailable, and termination unproven.
- **AC-4** Stale owned-worker timer expiry with fresh positive termination capability appends SupervisorTerminationRequested at barrier and calls terminateWorker exactly once.
- **AC-5** Missing/stale/negative canKill, observe-only ownership, or missing worker handle records termination-unavailable and makes zero host calls.
- **AC-6** Host termination result without proof.containmentEmpty true records termination-unproven and does not record WorkerTerminated.
- **AC-7** Proven Agent or Host terminal observation records WorkerTerminated at barrier before terminal lifecycle closure or in the same barrier batch as SupervisorStopped.
- **AC-8** SupervisorStopped is the only post-terminal core-04 event; after it, no later core-04 supervisor/liveness/timer/termination/summary fact appends for the run.
- **AC-9** SDK source imports no process API, Local provider, or concrete kill helper.
- **AC-10** Public SDK exports supervisor and termination fact functions through this story owned index.ts lines.

Failure and degraded outcomes from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s4-termination-facts.md`:
- event-cursor-unavailable
- session-linkage-ambiguous
- agent-progress-unobservable
- termination-unavailable
- termination-unproven
- stale timer reasons

## Allowed Writes

Only these source-owned paths may be changed for `core-04-s4-termination-facts`:
- `packages/sdk/src/core/supervision/termination/**`
- `packages/sdk/tests/core/supervision/termination/**`
- `packages/sdk/src/index.ts (own export lines)`

Every other write is forbidden, including package files, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, commits in another story pathset, and changes to another epic package.

## Dependency Inputs

- Producer story ids: `core-04-s1-supervision-contracts`, `core-04-s2-liveness-fold`, `core-04-s3-timers-wait`.
- Dependency commit evidence: `{{DEPENDENCY_COMMITS}}`.
- Public import path: `sdk` for every public symbol this story exposes or consumes.
- Shared shapes and events must be consumed from committed dependency sources named by `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md` and `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s4-termination-facts.md`; do not redeclare them.

## Non-Goals And STOP Conditions

Non-goals: do not implement concrete provider behavior, completion or recovery decisions, operator UI, PR/merge behavior, or another story's scope.

Source STOP condition for `core-04-s4-termination-facts`: Stop if core must signal, kill, reap, prove empty directly, choose recovery, or render operator attention.

Also stop and report if dependency commits are missing, a required source value is absent, an AC requires writes outside the owned pathset, or implementation would require reinterpreting a source AC.

## Implementation Constraints

Honor the story contract exactly: public exports through this story owned `packages/sdk/src/index.ts` lines, deterministic explicit inputs for time/id/randomness, provider-port boundaries, append-only event-log authority, failure tokens named above, and the Dependency Rule from `AGENTS.md`. Do not introduce provider-specific runtime model ids, concrete driver imports, ambient clock reads, process/network calls, or shape redeclarations prohibited by the source story.

## Verification

Run the targeted checks and evidence required by `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s4-termination-facts.md` for source AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`:
- supervisor-start.unit.test.ts
- supervisor-facts.unit.test.ts
- supervision-lost.unit.test.ts
- termination-request.unit.test.ts
- termination-unavailable.unit.test.ts
- termination-unproven.unit.test.ts
- worker-terminated-order.unit.test.ts
- supervisor-stopped-terminal.unit.test.ts
- termination-boundary.unit.test.ts
- termination-public-import.unit.test.ts
- 95% branch coverage for termination
- boundary sweep for process kill/local provider helpers
- pnpm check

Report exact command output or an explicit blocked reason. Do not claim AC coverage from prose alone.

## Commit Cadence

The implementer commits its own work in the story worktree, never the orchestrator:

- Make `pnpm check` green before every commit.
- Make an impl-done commit when the story first proves out, then one commit per fix round.
- Add commit trailers `Story: core-04-s4-termination-facts` and `Round: <n>`.
- On orchestrator-reported merge-back conflict, rebase the story commits onto the track branch `HEAD`, re-prove the gate, and re-commit.
- Report real logic conflicts rather than forcing a resolution.

## Delivery Report

Return changed files, AC coverage by source AC id, per-round commit hashes, tests and checks run, evidence pack, open questions, and blockers. The implementer does not update tracker state or perform merge, PR, push, publication, worker closure, package, or source-planning actions.

## Mutation Limits

The implementer commits each round within the owned pathset in its own story worktree. It performs no pushes, PRs, merges, tracker edits, package edits, source planning edits, worker closure, or writes outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Reviewer Prompt: core-04-s3-timers-wait](../core-04-s3-timers-wait/reviewer.md) · **Next →:** [Reviewer Prompt: core-04-s4-termination-facts](./reviewer.md)

<!-- /DOCS-NAV -->
