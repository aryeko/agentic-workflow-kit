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

Implement the pure liveness fold over committed event values plus sampled clock input, proving exactly
which current-session event classes advance liveness and which event classes never refresh it.

## Normative design

- `liveness-model.md` lists advancing event classes, non-refresh event classes, state/reason unions,
  stale/supervision-lost meanings, and terminal behavior.
- `supervision-and-liveness/README.md` states liveness is a pure fold over committed run events and
  explicit clock input.

## Spec surface

- Functions exposed: `foldLiveness`, `classifyLivenessAdvance`, `isLivenessRefreshingEvent`.
- Shapes consumed: `core-04-s1/LivenessProjection`, `LivenessState`, `LivenessReason`,
  `LivenessAdvanceClass`, `LivenessAdvancedPayload`.
- Cross-epic consumed value types: Epic 3 run event values and session linkage payloads; Epic 2 Agent
  event DTOs.
- Failure reasons raised: `session-linkage-ambiguous`, `agent-progress-unobservable`,
  `tool-tracking-unavailable`, `worker-terminal-observed`.

## Responsibilities

- Advance liveness only for current-session startup linkage, worker progress, tool completion,
  approval request, and terminal observation.
- Never refresh liveness from parent polls, waits, reconnects, projection reads, lifecycle-only events,
  `SessionLinked` without Agent linkage, spawned/attached host events, capability attestations, Agent
  approval answers, Operator decisions, runner commands, Forge/Work Source events, or raw host output.
- Return `supervision-lost` when current session linkage or Agent progress guarantee cannot be proven.

## Out of scope

- Timer deadline computation (`core-04-s3`).
- Appending liveness events (`core-04-s4`).
- Agent event emission or concrete provider behavior (Epic 6).

## Dependencies and frozen inputs

- Covers signals: liveness fold; advancing event classes; never-refresh event classes.
- Depends on: `core-04-s1-supervision-contracts`.
- Decision inputs consumed: committed event `domain`/`type`/payload, `sessionId`, `workerHandleId`,
  `itemId`, `exitCode`, `outputRef`, `answerChannelRef`, source sequence, current clock sample,
  linkage resolver/raw linkage events.

## Acceptance criteria

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

## Coverage matrix

| Responsibility / spec-surface item | Proven by |
|---|---|
| Startup/progress/tool/approval/terminal advancing classes | AC-1..AC-5 |
| Never-refresh catalog | AC-6 |
| Fail-closed liveness reasons | AC-3, AC-7 |
| Determinism | AC-8 |

## Predicate-input matrix

| AC or failure row | Predicate / branch value | Declared source value | Producer / resolver | Verdict |
|---|---|---|---|---|
| AC-1, AC-7 | current session linkage | Agent/core-01 linkage event fields | Epic 3 linkage resolver/raw history | decidable |
| AC-2..AC-5 | event class and session match | Agent event payload fields and sequence | Epic 2 Agent port, Epic 3 envelope | decidable |
| AC-6 | non-refresh event type | committed event domain/type | Epic 3 envelope | decidable |
| AC-8 | clock | sampled timestamp argument | `core-04-s1/Clock` caller sample | decidable |

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `session-linkage-ambiguous` | linkage cannot prove current session | `supervision-lost` | AC-7 |
| `agent-progress-unobservable` | Agent progress guarantee missing | `supervision-lost` | AC-7 |
| `tool-tracking-unavailable` | current tool item id absent/unstable | no per-tool claim; broader timers continue | AC-3 |
| `worker-terminal-observed` | Agent/Host terminal observation | terminated projection | AC-5 |

## Quality bar

- Coverage scope and threshold: 95% branch coverage for `packages/sdk/src/core/supervision/liveness/**`.
- Coverage command and lanes: `pnpm test:unit -- --coverage --coverage.include='packages/sdk/src/core/supervision/liveness/**'`.
- Required tests: AC-1..AC-8 and failure rows.
- Public exposure: `sdk` import test for liveness fold and classifiers.
- Determinism constraints: no ambient time; pure over event values and sampled clock.
- Dependency boundaries: SDK contracts only.
- File-size budget: 280 lines per implementation file, 360 lines per test file.

## Evidence pack

- Tests and fixtures named above.
- `pnpm check` after implementation.
- Boundary sweep: `rg -n "provider-codex|provider-local|child_process|Date\\.now|new Date|fetch\\(" packages/sdk/src/core/supervision/liveness packages/sdk/tests/core/supervision/liveness` returns zero matches.

## Boundaries and STOP conditions

- Package/module boundary: `packages/sdk/src/core/supervision/liveness/**`.
- Owned pathset: source/test liveness folders.
- Forbidden dependencies: runtime log objects, providers, process/network APIs.
- STOP when liveness requires a concrete Agent protocol event not present in Epic 2 Agent port.

## Characterization review

- Scope decision: liveness fold consumes value events, not live streams. Rationale: design requires pure
  replayable fold. Falsification: implementation reads `AsyncIterable<AgentEvent>` directly here.
- Gate verdict: ready. ACs enumerate advancing and non-refresh classes with exact assertions.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - stories](./README.md) · **← Prev:** [core-04-s1-supervision-contracts - supervision contracts implementation story](./core-04-s1-supervision-contracts.md) · **Next →:** [core-04-s3-timers-and-wait - supervision timers and wait wrapper implementation story](./core-04-s3-timers-and-wait.md)

<!-- /DOCS-NAV -->
