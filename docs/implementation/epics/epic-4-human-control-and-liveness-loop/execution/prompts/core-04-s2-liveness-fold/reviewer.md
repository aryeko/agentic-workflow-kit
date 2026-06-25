# Reviewer Prompt: core-04-s2-liveness-fold

## Assigned Routing

- Source story id: `core-04-s2-liveness-fold`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `elevated` from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md`.
- Reasoning tier: `elevated`.
- Routing rationale: source story `core-04-s2-liveness-fold` covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9` and carries shared liveness reducer over committed evidence, explicit clock input, non-refresh classification, and fail-closed supervision-lost states.

## Original Scope

- Story id: `core-04-s2-liveness-fold`.
- Epic slug: `epic-4-human-control-and-liveness-loop`.
- Source story contract: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s2-liveness-fold.md`.
- Allowed pathset:
- `packages/sdk/src/core/supervision/liveness/**`
- `packages/sdk/tests/core/supervision/liveness/**`
- `packages/sdk/src/index.ts (own export lines)`
- Dependencies: `core-04-s1-supervision-contracts`.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` and committed producer shapes/events named by the source DAG and story contract.
- Non-goals: no concrete provider behavior, completion/recovery decisions, operator UI, tracker/package edits, source planning edits, or another story scope.
- STOP condition: Stop if liveness requires a concrete Agent protocol event not present in frozen provider contracts or if wait/poll/projection reads are proposed as progress evidence.

Acceptance criteria from the original source contract:

- **AC-1** Startup linkage advances to active only when Agent session linkage pairs with non-ambiguous core-01 SessionLinked for the current session.
- **AC-2** Current-session AgentProgressObserved refreshes idle and no-progress timers and records worker-progress.
- **AC-3** AgentToolObserved refreshes liveness only with exitCode, outputRef, and stable current-session itemId; missing or unstable item id yields tool-tracking-unavailable while broader timers remain active.
- **AC-4** AgentApprovalRequested with answer channel enters waiting-for-approval, arms approval-SLA, and does not increment lastProgressSequence.
- **AC-5** Terminal observation sets terminal true and state terminated without making stale or terminal workers active.
- **AC-6** The full non-refresh event list never changes lastWorkerEventSequence, lastProgressSequence, or active state.
- **AC-7** Ambiguous linkage and missing Agent progress guarantee return supervision-lost with exact reasons.
- **AC-8** Identical committed events and clock sample return deep-equal projections with no ambient clock/API calls.
- **AC-9** Public SDK exports foldLiveness, classifyLivenessAdvance, and isLivenessRefreshingEvent through this story owned index.ts lines.

Failure and degraded rows to verify:
- session-linkage-ambiguous
- agent-progress-unobservable
- tool-tracking-unavailable
- worker-terminal-observed

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check source story `core-04-s2-liveness-fold` and source AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9` against the runtime slots.

- AC coverage by original source `AC-n` id.
- Each AC is re-proven by a standing gate step such as `type:fixtures`, `coverage:baseline`, `deps`, `typecheck`, relevant unit tests, or `pnpm check`; treat manual-only proof or fixtures outside the build graph as blocking.
- Failure and degraded rows above.
- Evidence pack completeness and exact command output.
- Public API and `sdk` import paths.
- Dependency boundaries and committed dependency inputs from `{{DEPENDENCY_COMMITS}}`.
- Stale names and sibling occurrences of any issue found.
- Tests, sweeps, coverage, and source quality bar:
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
- Scope control against allowed writes.
- Repo conventions, no emojis, no provider-specific runtime model ids, no concrete driver imports where forbidden, no hidden ambient time/random/process/network calls where forbidden.

## Verdict Format

Return `APPROVE` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

The reviewer is read-only. Do not stage, commit, push, open or update PRs, merge, close workers, edit tracker state, edit package files, edit source planning files, dispatch implementation work, or write outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Implementer Prompt: core-04-s2-liveness-fold](./implementer.md) · **Next →:** [Implementer Prompt: core-04-s3-timers-wait](../core-04-s3-timers-wait/implementer.md)

<!-- /DOCS-NAV -->
