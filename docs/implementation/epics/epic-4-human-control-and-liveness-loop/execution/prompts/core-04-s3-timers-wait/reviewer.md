# Reviewer Prompt: core-04-s3-timers-wait

## Assigned Routing

- Source story id: `core-04-s3-timers-wait`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `elevated` from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md`.
- Reasoning tier: `elevated`.
- Routing rationale: source story `core-04-s3-timers-wait` covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9` and carries supervision timer and cursor-wait boundary over liveness projections, explicit clock input, cursor validation, and no-side-effect wait semantics.

## Original Scope

- Story id: `core-04-s3-timers-wait`.
- Epic slug: `epic-4-human-control-and-liveness-loop`.
- Source story contract: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s3-timers-wait.md`.
- Allowed pathset:
- `packages/sdk/src/core/supervision/timers/**`
- `packages/sdk/src/core/supervision/wait/**`
- `packages/sdk/tests/core/supervision/timers/**`
- `packages/sdk/tests/core/supervision/wait/**`
- `packages/sdk/src/index.ts (own export lines)`
- Dependencies: `core-04-s1-supervision-contracts`, `core-04-s2-liveness-fold`.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` and committed producer shapes/events named by the source DAG and story contract.
- Non-goals: no concrete provider behavior, completion/recovery decisions, operator UI, tracker/package edits, source planning edits, or another story scope.
- STOP condition: Stop if a seventh timer is needed, if wait must mutate projections or liveness, or if cursor semantics cannot be consumed from Epic 3.

Acceptance criteria from the original source contract:

- **AC-1** Default policy produces exact startup, idle, no-progress, per-tool, approval-SLA, and max-runtime deadlines from fixed source times.
- **AC-2** Startup timer starts at worker-starting lifecycle or WorkerSpawned, stops at current AgentSessionLinked, and expires as startup-timeout.
- **AC-3** Idle and no-progress timers refresh only from liveness-advancing worker/progress sequences; parent polls and waits do not refresh deadlines.
- **AC-4** Per-tool timer starts from stable current-session tool itemId, stops on matching completion, and does not guess when tool-tracking-unavailable is present.
- **AC-5** Approval-SLA starts at AgentApprovalRequested, stops at recorded answer or terminal event, emits approval-sla-exceeded, and no consumed-decision timer symbol exists.
- **AC-6** Max-runtime starts at worker-starting lifecycle, stops at terminal lifecycle or terminal observation, and emits max-runtime-exceeded.
- **AC-7** wrapWaitRunEvents rejects mismatched request/cursor run ids with event-cursor-unavailable and delegates matching cursors unchanged.
- **AC-8** Wait wrapper has no liveness side effects: append, project, renew, and refresh spies remain zero on success and timeout.
- **AC-9** Public SDK exports evaluateSupervisionTimers and wrapWaitRunEvents through this story owned index.ts lines.

Failure and degraded rows to verify:
- startup-timeout
- idle-timeout
- no-progress-timeout
- tool-timeout
- approval-sla-exceeded
- max-runtime-exceeded
- event-cursor-unavailable

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check source story `core-04-s3-timers-wait` and source AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9` against the runtime slots.

- AC coverage by original source `AC-n` id.
- Each AC is re-proven by a standing gate step such as `type:fixtures`, `coverage:baseline`, `deps`, `typecheck`, relevant unit tests, or `pnpm check`; treat manual-only proof or fixtures outside the build graph as blocking.
- Failure and degraded rows above.
- Evidence pack completeness and exact command output.
- Public API and `sdk` import paths.
- Dependency boundaries and committed dependency inputs from `{{DEPENDENCY_COMMITS}}`.
- Stale names and sibling occurrences of any issue found.
- Tests, sweeps, coverage, and source quality bar:
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
- Scope control against allowed writes.
- Repo conventions, no emojis, no provider-specific runtime model ids, no concrete driver imports where forbidden, no hidden ambient time/random/process/network calls where forbidden.

## Verdict Format

Return `APPROVE` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

The reviewer is read-only. Do not stage, commit, push, open or update PRs, merge, close workers, edit tracker state, edit package files, edit source planning files, dispatch implementation work, or write outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Implementer Prompt: core-04-s3-timers-wait](./implementer.md) · **Next →:** [Implementer Prompt: core-04-s4-termination-facts](../core-04-s4-termination-facts/implementer.md)

<!-- /DOCS-NAV -->
