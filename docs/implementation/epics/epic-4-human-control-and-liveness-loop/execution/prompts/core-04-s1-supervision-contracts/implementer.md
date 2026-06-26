# Implementer Prompt: core-04-s1-supervision-contracts

## Assigned Routing

- Source story id: `core-04-s1-supervision-contracts`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`.
- Model class: `strong-coder`.
- Effort: `high`.
- Suggested-tier floor: `elevated` from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md`.
- Reasoning tier: `elevated`.
- Routing rationale: source story `core-04-s1-supervision-contracts` covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` and carries public supervision/liveness contract producer and reason catalog consumed by later supervision behavior stories and later epics.

## Exact Task

Implement `core-04-s1-supervision-contracts` for epic `epic-4-human-control-and-liveness-loop`: Produce supervision/liveness value types, timer/wait inputs, event payloads, projections, and reason catalog. Mint the enumerable catalogs as runtime `as const` arrays + derived union types (not bare erased `type` unions); pure interfaces stay interfaces and event-payload `schema` fields stay pinned string-literal types (no separately exported runtime constant). Keep the result limited to source story `core-04-s1-supervision-contracts` and source AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`.

## Why It Matters

This story is in wave 1. Its direct dependencies are none and its dependents are `core-04-s2-liveness-fold`, `core-04-s3-timers-wait`, `core-04-s4-termination-facts`. The story provides the source-defined approval or supervision surface named by `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s1-supervision-contracts.md`; later stories and later epics must consume these facts and public `sdk` imports without redeclaring shapes, inventing provider behavior, or using worker prose as evidence.

## Required Reading

- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s1-supervision-contracts.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md`
- `docs/design/30-domain-reference/core/supervision-and-liveness/README.md`
- `docs/design/30-domain-reference/core/supervision-and-liveness/liveness-model.md`
- `docs/design/20-sdk-and-packaging/sdk-boundary.md`
- `docs/engineering/check-gate.md`
- `docs/engineering/test-lanes.md`
- Runtime dependency commits slot: `{{DEPENDENCY_COMMITS}}` for none.

## Acceptance Criteria

Source story: `core-04-s1-supervision-contracts`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`.

- **AC-1** Clock is exported as an injected zero-argument ISO timestamp function and no contract shape permits ambient clock reads.
- **AC-2** The exported `as const` arrays `LIVENESS_STATES` and `LIVENESS_REASONS` (with their derived unions `LivenessState`/`LivenessReason`) have exactly the design members, including approval-overdue, termination-requested, termination-unavailable, and worker-terminal-observed; exhaustive membership is iterated over the runtime catalog arrays and exhaustive switches cover the derived unions.
- **AC-3** LivenessProjection requires runId, state, timers, and terminal, and allows optional reason/session/worker/sequence/stale fields exactly as design defines.
- **AC-4** SupervisionInputs, SupervisionTimerPolicy, and SupervisionWaitRequest expose exact fields including six timer durations and cursor request fields.
- **AC-5** The exported `as const` arrays `SUPERVISION_TIMER_NAMES` and `LIVENESS_ADVANCE_CLASSES` (with their derived unions `SupervisionTimerName`/`LivenessAdvanceClass`) exactly match the six timer names and five advance classes; membership is iterated over the runtime catalog arrays and exhaustive switches cover both derived unions.
- **AC-6** The eight event payloads expose exact schema literals and required source fields, including sourceSequence, deadline, observedBy, and terminalSourceEventIds.
- **AC-7** Every manifest symbol imports from sdk through this story owned export lines in packages/sdk/src/index.ts, with no private path.

Failure and degraded outcomes from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s1-supervision-contracts.md`:
- Declares the full LivenessReason catalog; behavior stories own runtime triggers.

## Allowed Writes

Only these source-owned paths may be changed for `core-04-s1-supervision-contracts`:
- `packages/sdk/src/core/supervision/contracts/**`
- `packages/sdk/tests/core/supervision/contracts/**`
- `packages/sdk/src/index.ts (own export lines)`

Every other write is forbidden, including package files, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, commits in another story pathset, and changes to another epic package.

## Dependency Inputs

- Producer story ids: none.
- Dependency commit evidence: `{{DEPENDENCY_COMMITS}}`.
- Public import path: `sdk` for every public symbol this story exposes or consumes.
- Shared shapes and events must be consumed from committed dependency sources named by `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md` and `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s1-supervision-contracts.md`; do not redeclare them.

## Non-Goals And STOP Conditions

Non-goals: do not implement concrete provider behavior, completion or recovery decisions, operator UI, PR/merge behavior, or another story's scope.

Source STOP condition for `core-04-s1-supervision-contracts`: Stop if a payload field is not in supervision design, if a concrete provider type is needed, or if behavior appears in this type-only producer.

Value, not behavior: a frozen `as const` catalog array is a runtime value, not behavior — it raises nothing and runs no logic, so minting and exporting the catalogs does not violate the "raises none at runtime" / type-only-producer STOP condition (per `docs/engineering/testing-policy.md#proof-substrate`). Do not read the required `as const` catalogs as forbidden runtime behavior.

Also stop and report if dependency commits are missing, a required source value is absent, an AC requires writes outside the owned pathset, or implementation would require reinterpreting a source AC.

## Implementation Constraints

Honor the story contract exactly: public exports through this story owned `packages/sdk/src/index.ts` lines, deterministic explicit inputs for time/id/randomness, provider-port boundaries, append-only event-log authority, failure tokens named above, and the Dependency Rule from `AGENTS.md`. Do not introduce provider-specific runtime model ids, concrete driver imports, ambient clock reads, process/network calls, or shape redeclarations prohibited by the source story.

Substrate (required, not optional): mint the enumerable catalogs `SupervisionTimerName` (`SUPERVISION_TIMER_NAMES`), `LivenessAdvanceClass` (`LIVENESS_ADVANCE_CLASSES`), `LivenessState` (`LIVENESS_STATES`), and `LivenessReason` (`LIVENESS_REASONS`) as runtime `as const` arrays plus derived union types — `export const LIVENESS_REASONS = [...] as const; export type LivenessReason = (typeof LIVENESS_REASONS)[number];` — with members exactly as design lists and none added; the four catalog arrays are the coverage-lane substrate. Pure interfaces (`Clock`, `SupervisionInputs`, `SupervisionTimerPolicy`, `SupervisionWaitRequest`, `LivenessProjection`) stay interfaces, and event-payload `schema` fields stay pinned string-literal types per design (do not mint them as separately exported runtime constants — that would add public SDK symbols beyond the manifest). Do not render the catalogs as bare erased `type` unions — that erased rendering produces no runtime substrate and vacuously satisfies the coverage lane.

## Verification

Run the targeted checks and evidence required by `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s1-supervision-contracts.md` for source AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`:
- supervision-clock.unit.test.ts and Date.now/new Date sweep
- liveness-catalogs.unit.test.ts iterating the `LIVENESS_STATES`/`LIVENESS_REASONS` runtime arrays and negative fixtures
- liveness-projection.unit.test.ts
- supervision-inputs.unit.test.ts and missing maxRuntimeMs fixture
- supervision-catalogs.unit.test.ts iterating the `SUPERVISION_TIMER_NAMES`/`LIVENESS_ADVANCE_CLASSES` runtime arrays
- supervision-payloads.unit.test.ts and negative fixtures
- supervision-public-import.unit.test.ts
- 95% statements/branches for supervision contracts (measured over the real `as const` catalog arrays — not a vacuous `0/0`→100%)
- boundary sweep for provider/testkit/process/time/network imports
- pnpm check

Report exact command output or an explicit blocked reason. Do not claim AC coverage from prose alone.

## Commit Cadence

The implementer commits its own work in the story worktree, never the orchestrator:

- Make `pnpm check` green before every commit.
- Make an impl-done commit when the story first proves out, then one commit per fix round.
- Add commit trailers `Story: core-04-s1-supervision-contracts` and `Round: <n>`.
- On orchestrator-reported merge-back conflict, rebase the story commits onto the track branch `HEAD`, re-prove the gate, and re-commit.
- Report real logic conflicts rather than forcing a resolution.

## Delivery Report

Return changed files, AC coverage by source AC id, per-round commit hashes, tests and checks run, evidence pack, open questions, and blockers. The implementer does not update tracker state or perform merge, PR, push, publication, worker closure, package, or source-planning actions.

## Mutation Limits

The implementer commits each round within the owned pathset in its own story worktree. It performs no pushes, PRs, merges, tracker edits, package edits, source planning edits, worker closure, or writes outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Reviewer Prompt: core-03-s4-grants-outcomes](../core-03-s4-grants-outcomes/reviewer.md) · **Next →:** [Reviewer Prompt: core-04-s1-supervision-contracts](./reviewer.md)

<!-- /DOCS-NAV -->
