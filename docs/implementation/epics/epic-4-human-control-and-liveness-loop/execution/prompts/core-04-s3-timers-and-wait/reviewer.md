# Reviewer Prompt: core-04-s3-timers-and-wait

## Assigned Routing

- Source story id: `core-04-s3-timers-and-wait`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `elevated`.
- Reasoning tier: `elevated`.
- Routing rationale: core-04-s3-timers-and-wait covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8` and carries supervision timer and cursor-wait boundary over liveness projections, explicit clock input, cursor validation, and no-side-effect wait semantics. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Original Scope

- Story id: `core-04-s3-timers-and-wait`.
- Epic slug: `epic-4-human-control-and-liveness-loop`.
- Source story contract path: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s3-timers-and-wait.md`.
- Allowed pathset: `packages/sdk/src/core/supervision/timers/**`, `packages/sdk/src/core/supervision/wait/**`, `packages/sdk/tests/core/supervision/timers/**`, `packages/sdk/tests/core/supervision/wait/**`.
- Direct dependencies: `core-04-s1-supervision-contracts`, `core-04-s2-liveness-fold`.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus committed producer shapes, public import paths, event/projection inputs, and provider-port facts named in the source contract and DAG.

### Acceptance Criteria

Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.

- **AC-1** Timer defaults are applied as startup 120 seconds, idle 15 minutes, no-progress 45 minutes,
  per-tool 30 minutes, approval-SLA 24 hours, and max-runtime 8 hours when policy supplies the design
  defaults - evidence: `timer-defaults.unit.test.ts` asserts exact ISO deadlines from fixed
  `startedAt = 2026-06-23T10:00:00.000Z`.
- **AC-2** Startup timer starts at worker-starting lifecycle or `WorkerSpawned` and stops at current
  `AgentSessionLinked`; overdue startup emits reason `startup-timeout` - evidence:
  `timer-startup.unit.test.ts` asserts no expiry before linked fixture and exact timeout after
  `2026-06-23T10:02:01.000Z`.
- **AC-3** Idle and no-progress timers refresh only from liveness-advancing worker events/progress
  sequences supplied by `core-04-s2`; parent polls and wait results do not refresh them - evidence:
  `timer-idle-no-progress.unit.test.ts` asserts unchanged deadlines after wait timeout fixture.
- **AC-4** Per-tool timer starts from stable current-session tool `itemId`, stops on matching
  `AgentToolObserved`, and does not guess when `tool-tracking-unavailable` is present - evidence:
  `timer-per-tool.unit.test.ts` asserts `tool-timeout` for unmatched item and no per-tool expiry for
  missing item id fixture.
- **AC-5** Approval-SLA starts at `AgentApprovalRequested` and stops at recorded approval answer or
  terminal event; overdue emits `approval-sla-exceeded` and no extra decision-consumed timer exists -
  evidence: `timer-approval-sla.unit.test.ts` asserts exact reason and
  `rg -n "decision.*consumed|consumed.*decision" packages/sdk/src/core/supervision/timers` returns zero.
- **AC-6** Max-runtime starts at worker-starting lifecycle and stops at terminal lifecycle or worker
  terminal observation; overdue emits `max-runtime-exceeded` - evidence:
  `timer-max-runtime.unit.test.ts` asserts exact reason for `max-runtime-overdue.fixture.ts`.
- **AC-7** `wrapWaitRunEvents` rejects mismatched `request.runId` / `cursor.runId` with
  `event-cursor-unavailable`, and delegates matching cursors to Epic 3 wait returning committed events
  after `cursor.afterSequence` or `timedOut = true` - evidence: `wait-wrapper.unit.test.ts` asserts
  mismatched cursor failure and exact delegated request fields for matching cursor.
- **AC-8** Wait wrapper has no liveness side effects: no append call, no projection read, no lease renew,
  and no liveness refresh on success or timeout - evidence: `wait-no-side-effects.unit.test.ts` uses
  spies asserting zero calls to append/project/renew and unchanged `LivenessProjection` fixture.

### Failure And Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `startup-timeout` | startup deadline exceeded | timer-expired fact | AC-2 |
| `idle-timeout` | idle deadline exceeded | timer-expired fact | AC-3 |
| `no-progress-timeout` | progress deadline exceeded | timer-expired fact | AC-3 |
| `tool-timeout` | stable tool item misses deadline | timer-expired fact | AC-4 |
| `approval-sla-exceeded` | approval attention window overdue | approval-overdue signal only | AC-5 |
| `max-runtime-exceeded` | max runtime deadline exceeded | timer-expired fact | AC-6 |
| `event-cursor-unavailable` | cursor mismatch or wait failure | fail closed; no liveness proof | AC-7 |

### Dependencies And Frozen Inputs

- Covers signals: timer signals; `waitRunEvents` wrapper and cursor validation.
- Depends on: `core-04-s1-supervision-contracts`, `core-04-s2-liveness-fold`.
- Decision inputs consumed: `LivenessProjection` timestamps/sequences/timers, `SupervisionTimerPolicy`,
  sampled clock, wait request `runId`, `cursor.runId`, `cursor.afterSequence`, `timeoutMs`,
  `maxEvents`, and Epic 3 wait result.

### Non-Goals

- Liveness fold (`core-04-s2`).
- Appending timer events or requesting termination (`core-04-s4`).
- Any "decision delivered but not consumed" timer.

### STOP Conditions And Boundaries

- Package/module boundary: `packages/sdk/src/core/supervision/timers/**`,
  `packages/sdk/src/core/supervision/wait/**`.
- Owned pathset: those source/test folders.
- Forbidden dependencies: projection mutation in wait, liveness refresh in wait, new timer not in design.
- STOP when a timer beyond the six design timers is needed.

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check implementation against source story `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s3-timers-and-wait.md` and AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.

- AC coverage by source `AC-n` id, including every failure, degraded, validation, and negative-fixture row named by the source contract.
- Evidence pack completeness against the source `Quality bar` and `Evidence pack` sections.
- Public API names, exports, and import paths against the source contract and DAG producer/consumer table.
- Dependency boundaries, committed dependency inputs, and `{{DEPENDENCY_COMMITS}}` consistency.
- Stale names and sibling occurrences of any issue found.
- Tests, targeted checks, coverage commands, forbidden-symbol sweeps, and `pnpm check` output.
- Scope control against allowed writes: `packages/sdk/src/core/supervision/timers/**`, `packages/sdk/src/core/supervision/wait/**`, `packages/sdk/tests/core/supervision/timers/**`, `packages/sdk/tests/core/supervision/wait/**`.
- Repo conventions and mutation limits from `AGENTS.md` and the source contract.

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Implementer Prompt: core-04-s3-timers-and-wait](./implementer.md) · **Next →:** [Implementer Prompt: core-04-s4-termination-handoff](../core-04-s4-termination-handoff/implementer.md)

<!-- /DOCS-NAV -->
