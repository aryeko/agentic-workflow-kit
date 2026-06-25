# Implementer Prompt: core-04-s3-timers-wait

## Assigned Routing

- Source story id: `core-04-s3-timers-wait`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`.
- Model class: `strong-coder`.
- Effort: `high`.
- Suggested-tier floor: `elevated` from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md`.
- Reasoning tier: `elevated`.
- Routing rationale: source story `core-04-s3-timers-wait` covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9` and carries supervision timer and cursor-wait boundary over liveness projections, explicit clock input, cursor validation, and no-side-effect wait semantics.

## Exact Task

Implement `core-04-s3-timers-wait` for epic `epic-4-human-control-and-liveness-loop`: Evaluate six supervision timers and wrap Epic 3 cursor wait without liveness side effects. Keep the result limited to source story `core-04-s3-timers-wait` and source AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`.

## Why It Matters

This story is in wave 3. Its direct dependencies are `core-04-s1-supervision-contracts`, `core-04-s2-liveness-fold` and its dependents are `core-04-s4-termination-facts`. The story provides the source-defined approval or supervision surface named by `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s3-timers-wait.md`; later stories and later epics must consume these facts and public `sdk` imports without redeclaring shapes, inventing provider behavior, or using worker prose as evidence.

## Required Reading

- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s3-timers-wait.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md`
- `docs/design/30-domain-reference/core/supervision-and-liveness/README.md`
- `docs/design/30-domain-reference/core/supervision-and-liveness/liveness-model.md`
- `docs/engineering/check-gate.md`
- `docs/engineering/test-lanes.md`
- Runtime dependency commits slot: `{{DEPENDENCY_COMMITS}}` for `core-04-s1-supervision-contracts`, `core-04-s2-liveness-fold`.

## Acceptance Criteria

Source story: `core-04-s3-timers-wait`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`.

- **AC-1** Default policy produces exact startup, idle, no-progress, per-tool, approval-SLA, and max-runtime deadlines from fixed source times.
- **AC-2** Startup timer starts at worker-starting lifecycle or WorkerSpawned, stops at current AgentSessionLinked, and expires as startup-timeout.
- **AC-3** Idle and no-progress timers refresh only from liveness-advancing worker/progress sequences; parent polls and waits do not refresh deadlines.
- **AC-4** Per-tool timer starts from stable current-session tool itemId, stops on matching completion, and does not guess when tool-tracking-unavailable is present.
- **AC-5** Approval-SLA starts at AgentApprovalRequested, stops at recorded answer or terminal event, emits approval-sla-exceeded, and no consumed-decision timer symbol exists.
- **AC-6** Max-runtime starts at worker-starting lifecycle, stops at terminal lifecycle or terminal observation, and emits max-runtime-exceeded.
- **AC-7** wrapWaitRunEvents rejects mismatched request/cursor run ids with event-cursor-unavailable and delegates matching cursors unchanged.
- **AC-8** Wait wrapper has no liveness side effects: append, project, renew, and refresh spies remain zero on success and timeout.
- **AC-9** Public SDK exports evaluateSupervisionTimers and wrapWaitRunEvents through this story owned index.ts lines.

Failure and degraded outcomes from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s3-timers-wait.md`:
- startup-timeout
- idle-timeout
- no-progress-timeout
- tool-timeout
- approval-sla-exceeded
- max-runtime-exceeded
- event-cursor-unavailable

## Allowed Writes

Only these source-owned paths may be changed for `core-04-s3-timers-wait`:
- `packages/sdk/src/core/supervision/timers/**`
- `packages/sdk/src/core/supervision/wait/**`
- `packages/sdk/tests/core/supervision/timers/**`
- `packages/sdk/tests/core/supervision/wait/**`
- `packages/sdk/src/index.ts (own export lines)`

Every other write is forbidden, including package files, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, commits in another story pathset, and changes to another epic package.

## Dependency Inputs

- Producer story ids: `core-04-s1-supervision-contracts`, `core-04-s2-liveness-fold`.
- Dependency commit evidence: `{{DEPENDENCY_COMMITS}}`.
- Public import path: `sdk` for every public symbol this story exposes or consumes.
- Shared shapes and events must be consumed from committed dependency sources named by `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md` and `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s3-timers-wait.md`; do not redeclare them.

## Non-Goals And STOP Conditions

Non-goals: do not implement concrete provider behavior, completion or recovery decisions, operator UI, PR/merge behavior, or another story's scope.

Source STOP condition for `core-04-s3-timers-wait`: Stop if a seventh timer is needed, if wait must mutate projections or liveness, or if cursor semantics cannot be consumed from Epic 3.

Also stop and report if dependency commits are missing, a required source value is absent, an AC requires writes outside the owned pathset, or implementation would require reinterpreting a source AC.

## Implementation Constraints

Honor the story contract exactly: public exports through this story owned `packages/sdk/src/index.ts` lines, deterministic explicit inputs for time/id/randomness, provider-port boundaries, append-only event-log authority, failure tokens named above, and the Dependency Rule from `AGENTS.md`. Do not introduce provider-specific runtime model ids, concrete driver imports, ambient clock reads, process/network calls, or shape redeclarations prohibited by the source story.

## Verification

Run the targeted checks and evidence required by `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s3-timers-wait.md` for source AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`:
- timer-defaults.unit.test.ts
- timer-startup.unit.test.ts
- timer-idle-no-progress.unit.test.ts
- timer-per-tool.unit.test.ts
- timer-approval-sla.unit.test.ts and consumed-decision sweep
- timer-max-runtime.unit.test.ts
- wait-wrapper.unit.test.ts
- wait-no-side-effects.unit.test.ts
- supervision-timers-public-import.unit.test.ts
- 95% branch coverage for timers and wait
- boundary sweeps for no consumed-decision timer, process/network/provider imports, and no wait projection mutation
- pnpm check

Report exact command output or an explicit blocked reason. Do not claim AC coverage from prose alone.

## Commit Cadence

The implementer commits its own work in the story worktree, never the orchestrator:

- Make `pnpm check` green before every commit.
- Make an impl-done commit when the story first proves out, then one commit per fix round.
- Add commit trailers `Story: core-04-s3-timers-wait` and `Round: <n>`.
- On orchestrator-reported merge-back conflict, rebase the story commits onto the track branch `HEAD`, re-prove the gate, and re-commit.
- Report real logic conflicts rather than forcing a resolution.

## Delivery Report

Return changed files, AC coverage by source AC id, per-round commit hashes, tests and checks run, evidence pack, open questions, and blockers. The implementer does not update tracker state or perform merge, PR, push, publication, worker closure, package, or source-planning actions.

## Mutation Limits

The implementer commits each round within the owned pathset in its own story worktree. It performs no pushes, PRs, merges, tracker edits, package edits, source planning edits, worker closure, or writes outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Reviewer Prompt: core-04-s2-liveness-fold](../core-04-s2-liveness-fold/reviewer.md) · **Next →:** [Reviewer Prompt: core-04-s3-timers-wait](./reviewer.md)

<!-- /DOCS-NAV -->
