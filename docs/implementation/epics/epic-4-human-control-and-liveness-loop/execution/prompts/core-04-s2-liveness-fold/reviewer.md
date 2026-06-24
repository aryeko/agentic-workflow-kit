# Reviewer Prompt: core-04-s2-liveness-fold

## Assigned Routing

- Source story id: `core-04-s2-liveness-fold`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `elevated`.
- Reasoning tier: `elevated`.
- Routing rationale: core-04-s2-liveness-fold covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8` and carries shared liveness reducer contract over committed evidence, explicit clock input, non-refresh event classification, and fail-closed supervision-lost states. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Original Scope

- Story id: `core-04-s2-liveness-fold`.
- Epic slug: `epic-4-human-control-and-liveness-loop`.
- Source story contract path: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s2-liveness-fold.md`.
- Allowed pathset: `packages/sdk/src/core/supervision/liveness/**`, `packages/sdk/src/index.ts`, `packages/sdk/tests/core/supervision/liveness/**`.
- Direct dependencies: `core-04-s1-supervision-contracts`, `core-03-s2-risk-and-decision`.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus committed producer shapes, public import paths, event/projection inputs, and provider-port facts named in the source contract and DAG. The `core-03-s2-risk-and-decision` dependency is only the committed baseline for serialized `packages/sdk/src/index.ts` export wiring; it is not supervision shape input.

### Acceptance Criteria

Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.

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

### Dependencies And Frozen Inputs

- Covers signals: liveness fold; advancing event classes; never-refresh event classes.
- Depends on: `core-04-s1-supervision-contracts`.
- Decision inputs consumed: committed event `domain`/`type`/payload, `sessionId`, `workerHandleId`,
  `itemId`, `exitCode`, `outputRef`, `answerChannelRef`, source sequence, current clock sample,
  linkage resolver/raw linkage events.

### Non-Goals

- Timer deadline computation (`core-04-s3`).
- Appending liveness events (`core-04-s4`).
- Agent event emission or concrete provider behavior (Epic 6).

### STOP Conditions And Boundaries

- Package/module boundary: `packages/sdk/src/core/supervision/liveness/**`, with SDK public-entrypoint
  export wiring in `packages/sdk/src/index.ts`.
- Owned pathset: `packages/sdk/src/core/supervision/liveness/**`, `packages/sdk/src/index.ts`,
  `packages/sdk/tests/core/supervision/liveness/**`.
- Forbidden dependencies: runtime log objects, providers, process/network APIs.
- STOP when liveness requires a concrete Agent protocol event not present in Epic 2 Agent port.

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check implementation against source story `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s2-liveness-fold.md` and AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.

- AC coverage by source `AC-n` id, including every failure, degraded, validation, and negative-fixture row named by the source contract.
- Evidence pack completeness against the source `Quality bar` and `Evidence pack` sections.
- Public API names, exports, and import paths against the source contract and DAG producer/consumer table.
- Dependency boundaries, committed dependency inputs, and `{{DEPENDENCY_COMMITS}}` consistency.
- Stale names and sibling occurrences of any issue found.
- Tests, targeted checks, coverage commands, forbidden-symbol sweeps, and `pnpm check` output.
- Scope control against allowed writes: `packages/sdk/src/core/supervision/liveness/**`, `packages/sdk/src/index.ts`, `packages/sdk/tests/core/supervision/liveness/**`.
- Repo conventions and mutation limits from `AGENTS.md` and the source contract.

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Implementer Prompt: core-04-s2-liveness-fold](./implementer.md) · **Next →:** [Implementer Prompt: core-04-s3-timers-and-wait](../core-04-s3-timers-and-wait/implementer.md)

<!-- /DOCS-NAV -->
