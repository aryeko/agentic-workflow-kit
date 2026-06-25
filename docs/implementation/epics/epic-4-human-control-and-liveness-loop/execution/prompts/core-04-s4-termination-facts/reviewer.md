# Reviewer Prompt: core-04-s4-termination-facts

## Assigned Routing

- Source story id: `core-04-s4-termination-facts`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `elevated` from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md`.
- Reasoning tier: `elevated`.
- Routing rationale: source story `core-04-s4-termination-facts` covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10` and carries Execution Host provider-port termination handoff and durable supervision fact boundary without concrete kill mechanics or recovery decisions.

## Original Scope

- Story id: `core-04-s4-termination-facts`.
- Epic slug: `epic-4-human-control-and-liveness-loop`.
- Source story contract: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s4-termination-facts.md`.
- Allowed pathset:
- `packages/sdk/src/core/supervision/termination/**`
- `packages/sdk/tests/core/supervision/termination/**`
- `packages/sdk/src/index.ts (own export lines)`
- Dependencies: `core-04-s1-supervision-contracts`, `core-04-s2-liveness-fold`, `core-04-s3-timers-wait`.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` and committed producer shapes/events named by the source DAG and story contract.
- Non-goals: no concrete provider behavior, completion/recovery decisions, operator UI, tracker/package edits, source planning edits, or another story scope.
- STOP condition: Stop if core must signal, kill, reap, prove empty directly, choose recovery, or render operator attention.

Acceptance criteria from the original source contract:

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

Failure and degraded rows to verify:
- event-cursor-unavailable
- session-linkage-ambiguous
- agent-progress-unobservable
- termination-unavailable
- termination-unproven
- stale timer reasons

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check source story `core-04-s4-termination-facts` and source AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10` against the runtime slots.

- AC coverage by original source `AC-n` id.
- Each AC is re-proven by a standing gate step such as `type:fixtures`, `coverage:baseline`, `deps`, `typecheck`, relevant unit tests, or `pnpm check`; treat manual-only proof or fixtures outside the build graph as blocking.
- Failure and degraded rows above.
- Evidence pack completeness and exact command output.
- Public API and `sdk` import paths.
- Dependency boundaries and committed dependency inputs from `{{DEPENDENCY_COMMITS}}`.
- Stale names and sibling occurrences of any issue found.
- Tests, sweeps, coverage, and source quality bar:
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
- Scope control against allowed writes.
- Repo conventions, no emojis, no provider-specific runtime model ids, no concrete driver imports where forbidden, no hidden ambient time/random/process/network calls where forbidden.

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

The reviewer is read-only. Do not stage, commit, push, open or update PRs, merge, close workers, edit tracker state, edit package files, edit source planning files, dispatch implementation work, or write outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Implementer Prompt: core-04-s4-termination-facts](./implementer.md) · **Next →:** [Epic 4 Execution Tracker](../../tracker.md)

<!-- /DOCS-NAV -->
