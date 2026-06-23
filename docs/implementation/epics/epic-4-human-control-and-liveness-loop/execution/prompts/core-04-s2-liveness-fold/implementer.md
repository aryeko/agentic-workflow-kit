# Implementer Prompt: core-04-s2-liveness-fold

## Assigned Routing

- Source story id: `core-04-s2-liveness-fold`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.
- Model class: `strong-coder`.
- Effort: `high`.
- Suggested-tier floor: `elevated`.
- Reasoning tier: `elevated`.
- Routing rationale: core-04-s2-liveness-fold covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8` and carries shared liveness reducer contract over committed evidence, explicit clock input, non-refresh event classification, and fail-closed supervision-lost states. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Exact Task

Implement source story `core-04-s2-liveness-fold` for epic `epic-4-human-control-and-liveness-loop`. Deliver exactly the outcome in the ready source contract and nothing outside it:

Implement the pure liveness fold over committed event values plus sampled clock input, proving exactly
which current-session event classes advance liveness and which event classes never refresh it.

Source story: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s2-liveness-fold.md`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.

## Why It Matters

- Covers signals: liveness fold; advancing event classes; never-refresh event classes.
- Depends on: `core-04-s1-supervision-contracts`.
- Decision inputs consumed: committed event `domain`/`type`/payload, `sessionId`, `workerHandleId`,
  `itemId`, `exitCode`, `outputRef`, `answerChannelRef`, source sequence, current clock sample,
  linkage resolver/raw linkage events.

DAG dependents for this story: `core-04-s3-timers-and-wait`, `core-04-s4-termination-handoff`. Preserve the producer/consumer shape boundaries named in the source DAG and story contract so later stories can consume committed dependency inputs without redeclaring or widening this story's scope.

## Required Reading

- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s2-liveness-fold.md` - ready source story contract for `core-04-s2-liveness-fold`.
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md` - frozen DAG row, dependencies, owned pathset, wave, shared shapes, and suggested-tier floor for `core-04-s2-liveness-fold`.
- `docs/design/30-domain-reference/core/supervision-and-liveness/README.md` - normative design named by the source contract.
- `docs/design/30-domain-reference/core/supervision-and-liveness/liveness-model.md` - normative design named by the source contract.
- `{{DEPENDENCY_COMMITS}}` - runtime slot for committed dependency story inputs before implementation starts.
- `AGENTS.md` and `CLAUDE.md` - repo branch, worktree, mutation, and verification rules.

## Acceptance Criteria

Source story: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s2-liveness-fold.md`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.

- **AC-1** Startup linkage advances from `not-started` or `starting` to `active` only when
  `AgentSessionLinked` is paired with non-ambiguous core-01 `SessionLinked` for the current session -
  evidence: `liveness-startup.unit.test.ts` asserts `startup-linked.fixture.ts` moves to `active` and
  `session-linked-only.fixture.ts` remains non-active.
- **AC-2** `AgentProgressObserved` for the current session refreshes idle and no-progress timers and
  records `LivenessAdvancedPayload.advanceClass = "worker-progress"` - evidence:
  `liveness-progress.unit.test.ts` asserts `lastWorkerEventSequence` and `lastProgressSequence` equal
  the fixture event sequence.
- **AC-3** `AgentToolObserved` refreshes liveness only when it has `exitCode`, `outputRef`, and stable
  current-session `itemId`; missing/unstable item id sets `reason = "tool-tracking-unavailable"` while
  broader timers remain active - evidence: `liveness-tool.unit.test.ts` asserts exact reason for
  `tool-missing-item-id.fixture.ts`.
- **AC-4** `AgentApprovalRequested` with `answerChannelRef` enters `waiting-for-approval` and arms
  approval-SLA but does not count as implementation progress - evidence:
  `liveness-approval-request.unit.test.ts` asserts state `waiting-for-approval`,
  `lastWorkerEventSequence` updated, and `lastProgressSequence` unchanged.
- **AC-5** Terminal observation stops liveness supervision and sets terminal projection without making
  the worker active - evidence: `liveness-terminal.unit.test.ts` asserts state `terminated` and
  `terminal === true` for `agent-session-terminal.fixture.ts`.
- **AC-6** The explicit non-refresh list never changes `lastWorkerEventSequence`,
  `lastProgressSequence`, or state to `active` - evidence: `liveness-non-refreshers.unit.test.ts`
  table-tests parent poll, wait response, wait timeout, reconnect, projection read, lifecycle-only,
  Agent approval answer, Operator decision, runner command, Forge, Work Source, and raw host output.
- **AC-7** Ambiguous linkage or missing Agent progress guarantee returns `state =
  "supervision-lost"` with exact reason `session-linkage-ambiguous` or
  `agent-progress-unobservable` - evidence: `liveness-fail-closed.unit.test.ts` asserts both exact
  reason values.
- **AC-8** The fold is deterministic: two calls with identical committed events and clock sample return
  deep-equal `LivenessProjection` values and do not call ambient time - evidence:
  `liveness-fold-determinism.unit.test.ts` asserts deep equality and zero `Date.now`/`new Date` access.

### Failure And Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `session-linkage-ambiguous` | linkage cannot prove current session | `supervision-lost` | AC-7 |
| `agent-progress-unobservable` | Agent progress guarantee missing | `supervision-lost` | AC-7 |
| `tool-tracking-unavailable` | current tool item id absent/unstable | no per-tool claim; broader timers continue | AC-3 |
| `worker-terminal-observed` | Agent/Host terminal observation | terminated projection | AC-5 |

## Allowed Writes

Source story: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s2-liveness-fold.md`. Owned pathset from the frozen DAG and source contract:

- `packages/sdk/src/core/supervision/liveness/**`
- `packages/sdk/tests/core/supervision/liveness/**`

Every other write is forbidden, including this execution package, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, commits, pushes, PRs, and merges.

## Dependency Inputs

Direct dependency story ids: `core-04-s1-supervision-contracts`.

Dependency commit inputs are supplied at execution time through `{{DEPENDENCY_COMMITS}}`. Use only producer-owned shared shapes, public import paths, committed events/projections, provider-port inputs, and frozen cross-epic facts named by `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md` or `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s2-liveness-fold.md`. Do not redeclare producer shapes or consume a dependency before its tracker row is `done`.

## Non-Goals And STOP Conditions

### Source Out Of Scope

- Timer deadline computation (`core-04-s3`).
- Appending liveness events (`core-04-s4`).
- Agent event emission or concrete provider behavior (Epic 6).

### Source Boundaries And STOP Conditions

- Package/module boundary: `packages/sdk/src/core/supervision/liveness/**`.
- Owned pathset: source/test liveness folders.
- Forbidden dependencies: runtime log objects, providers, process/network APIs.
- STOP when liveness requires a concrete Agent protocol event not present in Epic 2 Agent port.

Also stop and report if dependency inputs are missing, required writes fall outside the allowed pathset, a source gap blocks implementation, or any AC would need reinterpretation.

## Implementation Constraints

### Source Responsibilities

- Advance liveness only for current-session startup linkage, worker progress, tool completion,
  approval request, and terminal observation.
- Never refresh liveness from parent polls, waits, reconnects, projection reads, lifecycle-only events,
  `SessionLinked` without Agent linkage, spawned/attached host events, capability attestations, Agent
  approval answers, Operator decisions, runner commands, Forge/Work Source events, or raw host output.
- Return `supervision-lost` when current session linkage or Agent progress guarantee cannot be proven.

### Source Spec Surface

- Functions exposed: `foldLiveness`, `classifyLivenessAdvance`, `isLivenessRefreshingEvent`.
- Shapes consumed: `core-04-s1/LivenessProjection`, `LivenessState`, `LivenessReason`,
  `LivenessAdvanceClass`, `LivenessAdvancedPayload`.
- Cross-epic consumed value types: Epic 3 run event values and session linkage payloads; Epic 2 Agent
  event DTOs.
- Failure reasons raised: `session-linkage-ambiguous`, `agent-progress-unobservable`,
  `tool-tracking-unavailable`, `worker-terminal-observed`.

### Normative Design Constraints

- `liveness-model.md` lists advancing event classes, non-refresh event classes, state/reason unions,
  stale/supervision-lost meanings, and terminal behavior.
- `supervision-and-liveness/README.md` states liveness is a pure fold over committed run events and
  explicit clock input.

Do not introduce implementation choices outside the names, events, failure tokens, determinism rules, boundary rules, import rules, conformance obligations, and safety invariants fixed above.

## Verification

- Coverage scope and threshold: 95% branch coverage for `packages/sdk/src/core/supervision/liveness/**`.
- Coverage command and lanes: `pnpm test:unit -- --coverage --coverage.include='packages/sdk/src/core/supervision/liveness/**'`.
- Required tests: AC-1..AC-8 and failure rows.
- Public exposure: `sdk` import test for liveness fold and classifiers.
- Determinism constraints: no ambient time; pure over event values and sampled clock.
- Dependency boundaries: SDK contracts only.
- File-size budget: 280 lines per implementation file, 360 lines per test file.

- Tests and fixtures named above.
- `pnpm check` after implementation.
- Boundary sweep: `rg -n "provider-codex|provider-local|child_process|Date\\.now|new Date|fetch\\(" packages/sdk/src/core/supervision/liveness packages/sdk/tests/core/supervision/liveness` returns zero matches.

Require exact command output or an explicit blocked reason for every targeted command, required sweep, evidence-pack item, and `pnpm check`.

## Delivery Report

Report:

- changed files;
- AC coverage by `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`;
- tests and checks run;
- evidence pack;
- open questions;
- blockers.

The report is evidence for later review. It is not permission to update tracker state or perform delivery actions.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Reviewer Prompt: core-04-s1-supervision-contracts](../core-04-s1-supervision-contracts/reviewer.md) · **Next →:** [Reviewer Prompt: core-04-s2-liveness-fold](./reviewer.md)

<!-- /DOCS-NAV -->
