# Reviewer Prompt: core-04-s1-supervision-contracts

## Assigned Routing

- Source story id: `core-04-s1-supervision-contracts`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `elevated` from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md`.
- Reasoning tier: `elevated`.
- Routing rationale: source story `core-04-s1-supervision-contracts` covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` and carries public supervision/liveness contract producer and reason catalog consumed by later supervision behavior stories and later epics.

## Original Scope

- Story id: `core-04-s1-supervision-contracts`.
- Epic slug: `epic-4-human-control-and-liveness-loop`.
- Source story contract: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s1-supervision-contracts.md`.
- Allowed pathset:
- `packages/sdk/src/core/supervision/contracts/**`
- `packages/sdk/tests/core/supervision/contracts/**`
- `packages/sdk/src/index.ts (own export lines)`
- Dependencies: none.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` and committed producer shapes/events named by the source DAG and story contract.
- Non-goals: no concrete provider behavior, completion/recovery decisions, operator UI, tracker/package edits, source planning edits, or another story scope.
- STOP condition: Stop if a payload field is not in supervision design, if a concrete provider type is needed, or if behavior appears in this type-only producer.

Acceptance criteria from the original source contract:

- **AC-1** Clock is exported as an injected zero-argument ISO timestamp function and no contract shape permits ambient clock reads.
- **AC-2** LivenessState and LivenessReason have exactly the design members, including approval-overdue, termination-requested, termination-unavailable, and worker-terminal-observed.
- **AC-3** LivenessProjection requires runId, state, timers, and terminal, and allows optional reason/session/worker/sequence/stale fields exactly as design defines.
- **AC-4** SupervisionInputs, SupervisionTimerPolicy, and SupervisionWaitRequest expose exact fields including six timer durations and cursor request fields.
- **AC-5** SupervisionTimerName and LivenessAdvanceClass exactly match the six timer names and five advance classes.
- **AC-6** The eight event payloads expose exact schema literals and required source fields, including sourceSequence, deadline, observedBy, and terminalSourceEventIds.
- **AC-7** Every manifest symbol imports from sdk through this story owned export lines in packages/sdk/src/index.ts, with no private path.

Failure and degraded rows to verify:
- Declares the full LivenessReason catalog; behavior stories own runtime triggers.

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check source story `core-04-s1-supervision-contracts` and source AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` against the runtime slots.

- AC coverage by original source `AC-n` id.
- Each AC is re-proven by a standing gate step such as `type:fixtures`, `coverage:baseline`, `deps`, `typecheck`, relevant unit tests, or `pnpm check`; treat manual-only proof or fixtures outside the build graph as blocking.
- Failure and degraded rows above.
- Evidence pack completeness and exact command output.
- Public API and `sdk` import paths.
- Dependency boundaries and committed dependency inputs from `{{DEPENDENCY_COMMITS}}`.
- Stale names and sibling occurrences of any issue found.
- Tests, sweeps, coverage, and source quality bar:
- supervision-clock.unit.test.ts and Date.now/new Date sweep
- liveness-catalogs.unit.test.ts and negative fixtures
- liveness-projection.unit.test.ts
- supervision-inputs.unit.test.ts and missing maxRuntimeMs fixture
- supervision-catalogs.unit.test.ts
- supervision-payloads.unit.test.ts and negative fixtures
- supervision-public-import.unit.test.ts
- 95% statements/branches for supervision contracts
- boundary sweep for provider/testkit/process/time/network imports
- pnpm check
- Scope control against allowed writes.
- Repo conventions, no emojis, no provider-specific runtime model ids, no concrete driver imports where forbidden, no hidden ambient time/random/process/network calls where forbidden.

## Verdict Format

Return `APPROVE` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

The reviewer is read-only. Do not stage, commit, push, open or update PRs, merge, close workers, edit tracker state, edit package files, edit source planning files, dispatch implementation work, or write outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Implementer Prompt: core-04-s1-supervision-contracts](./implementer.md) · **Next →:** [Implementer Prompt: core-04-s2-liveness-fold](../core-04-s2-liveness-fold/implementer.md)

<!-- /DOCS-NAV -->
