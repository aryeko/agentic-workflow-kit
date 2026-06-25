---
title: "core-04-s2-liveness-fold - liveness fold implementation story"
id: "core-04-s2-liveness-fold"
epic: 4
status: "story: ready"
design:
  - "docs/design/30-domain-reference/core/supervision-and-liveness/README.md"
  - "docs/design/30-domain-reference/core/supervision-and-liveness/liveness-model.md"
---

# core-04-s2-liveness-fold - Liveness Fold

## Purpose

Implement the pure fold from committed current-session worker events plus explicit clock input to
`LivenessProjection`, proving exactly what advances liveness and what never refreshes it.

## Spec Surface

- Functions: `foldLiveness`, `classifyLivenessAdvance`, `isLivenessRefreshingEvent`.
- Consumed shapes: `LivenessProjection`, `LivenessState`, `LivenessReason`,
  `LivenessAdvanceClass`, `LivenessAdvancedPayload`.
- Cross-epic value inputs: Epic 3 event envelopes and session linkage payloads; Epic 2 Agent event
  DTOs.

## Responsibilities

- Advance liveness only for current-session startup linkage, worker progress, tool completion,
  approval request, and terminal observation.
- Keep parent polls, wait results, reconnects, projection reads, lifecycle-only events, bare
  `SessionLinked`, worker-spawned/host-attached events, capability attestations, approval answers,
  Operator decisions, runner commands, Forge/Work Source events, and raw host output inert.
- Return `supervision-lost` when current session linkage or Agent progress guarantees are unprovable.
- Never read live streams or ambient time inside the fold.

## Dependencies and Inputs

- Covers signals: liveness state fold, current-session advancing event classes, and never-refresh event
  classes.
- Depends on: `core-04-s1-supervision-contracts`.
- Decision inputs: committed event domain/type/payload, session id, worker handle id, item id, exit
  code, output ref, answer channel ref, source sequence, linkage evidence, and explicit clock sample.

## Acceptance Criteria

- **AC-1** Startup linkage advances to `active` only when an Agent session linkage event pairs with
  non-ambiguous core-01 `SessionLinked` for the current session - evidence:
  `liveness-startup.unit.test.ts` asserts linked and unpaired fixtures.
- **AC-2** Current-session `AgentProgressObserved` refreshes idle and no-progress timers and records
  advance class `worker-progress` - evidence: `liveness-progress.unit.test.ts` asserts exact worker and
  progress sequences.
- **AC-3** `AgentToolObserved` refreshes liveness only with `exitCode`, `outputRef`, and stable
  current-session `itemId`; missing/unstable item id yields `tool-tracking-unavailable` while broader
  timers remain active - evidence: `liveness-tool.unit.test.ts` asserts both cases.
- **AC-4** `AgentApprovalRequested` with answer channel enters `waiting-for-approval`, arms approval-SLA,
  and does not increment `lastProgressSequence` - evidence:
  `liveness-approval.unit.test.ts` asserts those exact projection fields.
- **AC-5** Terminal observation sets `terminal = true` and state `terminated` without making stale or
  terminal workers active - evidence: `liveness-terminal.unit.test.ts` asserts terminal fixtures.
- **AC-6** The non-refresh event list never changes `lastWorkerEventSequence`,
  `lastProgressSequence`, or state to `active` - evidence: `liveness-non-refreshers.unit.test.ts`
  table-tests the full design list.
- **AC-7** Ambiguous linkage and missing Agent progress guarantee return `state = "supervision-lost"`
  with exact reasons `session-linkage-ambiguous` and `agent-progress-unobservable` - evidence:
  `liveness-fail-closed.unit.test.ts` asserts exact reason values.
- **AC-8** Two calls with identical committed events and clock sample return deep-equal projections and
  no ambient clock/API calls - evidence: `liveness-determinism.unit.test.ts` asserts equality and zero
  `Date.now|new Date` use.
- **AC-9** The public SDK entrypoint exports `foldLiveness`, `classifyLivenessAdvance`, and
  `isLivenessRefreshingEvent` - evidence: `liveness-public-import.unit.test.ts` imports the functions
  from `sdk` and constructs one liveness fixture without private paths.

## Predicate and Producer Closure

| AC / output | Decision value or produced field | Source |
|---|---|---|
| AC-1, AC-7 | current session | Agent linkage event plus Epic 3 linkage projection/raw history |
| AC-2..AC-5 | event class | committed Agent/Host event payload fields and source sequence |
| AC-3 | stable tool id | current-session `itemId` plus matching tool completion evidence |
| AC-4 | approval wait state | `AgentApprovalRequested.answerChannelRef` |
| AC-6 | non-refreshing status | committed event domain/type list from design |
| AC-8 | clock | explicit sampled timestamp argument |
| AC-9 | public symbols | owned source files and `packages/sdk/src/index.ts` export wiring |

## Failure and Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `session-linkage-ambiguous` | current session cannot be proven | supervision lost | AC-7 |
| `agent-progress-unobservable` | Agent progress guarantee unavailable | supervision lost | AC-7 |
| `tool-tracking-unavailable` | stable tool item id absent | no per-tool claim; broader timers continue | AC-3 |
| `worker-terminal-observed` | terminal worker event observed | terminated projection | AC-5 |

## Quality Bar

- Coverage: 95% branch coverage for `packages/sdk/src/core/supervision/liveness/**`.
- Gate lane: `pnpm check`.
- Public exposure: AC-9.
- Boundary sweep:
  `rg -n "provider-codex|provider-local|child_process|Date\\.now|new Date|fetch\\(" packages/sdk/src/core/supervision/liveness packages/sdk/tests/core/supervision/liveness`
  returns zero matches.
- File-size budget: 300 lines per implementation file, 380 lines per test file.

## STOP Conditions

Stop if liveness requires a concrete Agent protocol event not present in frozen provider contracts or if
wait/poll/projection reads are proposed as progress evidence.

## Characterization Review

### Decision: committed-events-only

- Rationale: liveness must be replayable and must not depend on live Agent stream state.
- Design trace: liveness-model statement that liveness is a pure fold over committed run events plus
  clock.
- Falsification: fold reads an `AsyncIterable<AgentEvent>` or provider object directly.
- Escalation: move stream consumption to a provider or recording story; keep this fold pure.

### Decision: wait-and-poll-are-inert

- Rationale: read-side observation cannot make stale workers look active.
- Design trace: liveness-model non-refresh event list.
- Falsification: wait, poll, reconnect, projection read, or Operator decision updates worker/progress
  sequences or active state.
- Escalation: block as safety defect; operator behavior belongs to Epic 7.

- Verdict: ready; every event class and fail-closed branch has a concrete input source.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - stories](./README.md) · **← Prev:** [core-04-s1-supervision-contracts - supervision contracts implementation story](./core-04-s1-supervision-contracts.md) · **Next →:** [core-04-s3-timers-wait - supervision timers wait implementation story](./core-04-s3-timers-wait.md)

<!-- /DOCS-NAV -->
