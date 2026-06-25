# Implementer Prompt: core-04-s2-liveness-fold

## Assigned Routing

- Source story id: `core-04-s2-liveness-fold`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`.
- Model class: `strong-coder`.
- Effort: `high`.
- Suggested-tier floor: `elevated` from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md`.
- Reasoning tier: `elevated`.
- Routing rationale: source story `core-04-s2-liveness-fold` covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9` and carries shared liveness reducer over committed evidence, explicit clock input, non-refresh classification, and fail-closed supervision-lost states.

## Exact Task

Implement `core-04-s2-liveness-fold` for epic `epic-4-human-control-and-liveness-loop`: Fold committed current-session events plus clock into liveness state and event-class facts. Keep the result limited to source story `core-04-s2-liveness-fold` and source AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`.

## Why It Matters

This story is in wave 2. Its direct dependencies are `core-04-s1-supervision-contracts` and its dependents are `core-04-s3-timers-wait`, `core-04-s4-termination-facts`. The story provides the source-defined approval or supervision surface named by `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s2-liveness-fold.md`; later stories and later epics must consume these facts and public `sdk` imports without redeclaring shapes, inventing provider behavior, or using worker prose as evidence.

## Required Reading

- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s2-liveness-fold.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md`
- `docs/design/30-domain-reference/core/supervision-and-liveness/README.md`
- `docs/design/30-domain-reference/core/supervision-and-liveness/liveness-model.md`
- `docs/engineering/check-gate.md`
- `docs/engineering/test-lanes.md`
- Runtime dependency commits slot: `{{DEPENDENCY_COMMITS}}` for `core-04-s1-supervision-contracts`.

## Acceptance Criteria

Source story: `core-04-s2-liveness-fold`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`.

- **AC-1** Startup linkage advances to active only when Agent session linkage pairs with non-ambiguous core-01 SessionLinked for the current session.
- **AC-2** Current-session AgentProgressObserved refreshes idle and no-progress timers and records worker-progress.
- **AC-3** AgentToolObserved refreshes liveness only with exitCode, outputRef, and stable current-session itemId; missing or unstable item id yields tool-tracking-unavailable while broader timers remain active.
- **AC-4** AgentApprovalRequested with answer channel enters waiting-for-approval, arms approval-SLA, and does not increment lastProgressSequence.
- **AC-5** Terminal observation sets terminal true and state terminated without making stale or terminal workers active.
- **AC-6** The full non-refresh event list never changes lastWorkerEventSequence, lastProgressSequence, or active state.
- **AC-7** Ambiguous linkage and missing Agent progress guarantee return supervision-lost with exact reasons.
- **AC-8** Identical committed events and clock sample return deep-equal projections with no ambient clock/API calls.
- **AC-9** Public SDK exports foldLiveness, classifyLivenessAdvance, and isLivenessRefreshingEvent through this story owned index.ts lines.

Failure and degraded outcomes from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s2-liveness-fold.md`:
- session-linkage-ambiguous
- agent-progress-unobservable
- tool-tracking-unavailable
- worker-terminal-observed

## Allowed Writes

Only these source-owned paths may be changed for `core-04-s2-liveness-fold`:
- `packages/sdk/src/core/supervision/liveness/**`
- `packages/sdk/tests/core/supervision/liveness/**`
- `packages/sdk/src/index.ts (own export lines)`

Every other write is forbidden, including package files, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, commits in another story pathset, and changes to another epic package.

## Dependency Inputs

- Producer story ids: `core-04-s1-supervision-contracts`.
- Dependency commit evidence: `{{DEPENDENCY_COMMITS}}`.
- Public import path: `sdk` for every public symbol this story exposes or consumes.
- Shared shapes and events must be consumed from committed dependency sources named by `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md` and `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s2-liveness-fold.md`; do not redeclare them.

## Non-Goals And STOP Conditions

Non-goals: do not implement concrete provider behavior, completion or recovery decisions, operator UI, PR/merge behavior, or another story's scope.

Source STOP condition for `core-04-s2-liveness-fold`: Stop if liveness requires a concrete Agent protocol event not present in frozen provider contracts or if wait/poll/projection reads are proposed as progress evidence.

Also stop and report if dependency commits are missing, a required source value is absent, an AC requires writes outside the owned pathset, or implementation would require reinterpreting a source AC.

## Implementation Constraints

Honor the story contract exactly: public exports through this story owned `packages/sdk/src/index.ts` lines, deterministic explicit inputs for time/id/randomness, provider-port boundaries, append-only event-log authority, failure tokens named above, and the Dependency Rule from `AGENTS.md`. Do not introduce provider-specific runtime model ids, concrete driver imports, ambient clock reads, process/network calls, or shape redeclarations prohibited by the source story.

## Verification

Run the targeted checks and evidence required by `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s2-liveness-fold.md` for source AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`:
- liveness-startup.unit.test.ts
- liveness-progress.unit.test.ts
- liveness-tool.unit.test.ts
- liveness-approval.unit.test.ts
- liveness-terminal.unit.test.ts
- liveness-non-refreshers.unit.test.ts
- liveness-fail-closed.unit.test.ts
- liveness-determinism.unit.test.ts
- liveness-public-import.unit.test.ts
- 95% branch coverage for liveness
- boundary sweep for provider/process/time/network imports
- pnpm check

Report exact command output or an explicit blocked reason. Do not claim AC coverage from prose alone.

## Commit Cadence

The implementer commits its own work in the story worktree, never the orchestrator:

- Make `pnpm check` green before every commit.
- Make an impl-done commit when the story first proves out, then one commit per fix round.
- Add commit trailers `Story: core-04-s2-liveness-fold` and `Round: <n>`.
- On orchestrator-reported merge-back conflict, rebase the story commits onto the track branch `HEAD`, re-prove the gate, and re-commit.
- Report real logic conflicts rather than forcing a resolution.

## Delivery Report

Return changed files, AC coverage by source AC id, per-round commit hashes, tests and checks run, evidence pack, open questions, and blockers. The implementer does not update tracker state or perform merge, PR, push, publication, worker closure, package, or source-planning actions.

## Mutation Limits

The implementer commits each round within the owned pathset in its own story worktree. It performs no pushes, PRs, merges, tracker edits, package edits, source planning edits, worker closure, or writes outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Reviewer Prompt: core-04-s1-supervision-contracts](../core-04-s1-supervision-contracts/reviewer.md) · **Next →:** [Reviewer Prompt: core-04-s2-liveness-fold](./reviewer.md)

<!-- /DOCS-NAV -->
