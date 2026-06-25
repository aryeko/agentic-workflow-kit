---
title: "core-04-s3-timers-wait - supervision timers wait implementation story"
id: "core-04-s3-timers-wait"
epic: 4
status: "story: ready"
design:
  - "docs/design/30-domain-reference/core/supervision-and-liveness/README.md"
  - "docs/design/30-domain-reference/core/supervision-and-liveness/liveness-model.md"
---

# core-04-s3-timers-wait - Timers and Wait

## Purpose

Evaluate startup, idle, no-progress, per-tool, approval-SLA, and max-runtime timers, and expose the
`waitRunEvents` wrapper over the Epic 3 cursor primitive without liveness side effects.

## Spec Surface

- Functions: `evaluateSupervisionTimers`, `wrapWaitRunEvents`.
- Consumed shapes: `SupervisionTimerPolicy`, `SupervisionTimerName`, `LivenessProjection`,
  `LivenessReason`, `SupervisionWaitRequest`, `LivenessTimerExpiredPayload`.
- Runtime object: Epic 3 `RunEventLog.waitRunEvents`.

## Responsibilities

- Start and stop all six timers exactly as `liveness-model.md` defines.
- Return timer-expired facts with exact timer, reason, deadline, observed time, and source event ids.
- Validate `request.runId === cursor.runId` before delegating wait.
- Prove wait success or timeout never appends, reads projections, renews leases, or refreshes liveness.
- Exclude the deferred "decision delivered but not consumed" timer.

## Dependencies and Inputs

- Covers signals: timer signals and `waitRunEvents` wrapper behavior/cursor validation.
- Depends on: `core-04-s1-supervision-contracts`, `core-04-s2-liveness-fold`.
- Decision inputs: liveness projection timestamps/sequences/timers, timer policy, sampled clock, wait
  request fields, cursor fields, and Epic 3 wait result.

## Acceptance Criteria

- **AC-1** Default policy produces deadlines of startup 120 seconds, idle 15 minutes, no-progress
  45 minutes, per-tool 30 minutes, approval-SLA 24 hours, and max-runtime 8 hours from fixed source
  times - evidence: `timer-defaults.unit.test.ts` asserts exact ISO deadlines.
- **AC-2** Startup timer starts at worker-starting lifecycle or `WorkerSpawned`, stops at current
  `AgentSessionLinked`, and expires as `startup-timeout` - evidence: `timer-startup.unit.test.ts`
  asserts linked and overdue fixtures.
- **AC-3** Idle and no-progress timers refresh only from liveness-advancing worker/progress sequences;
  parent polls and wait results do not refresh deadlines - evidence:
  `timer-idle-no-progress.unit.test.ts` asserts unchanged deadlines after wait timeout fixture.
- **AC-4** Per-tool timer starts from a stable current-session tool `itemId`, stops on matching
  completion, and does not guess when `tool-tracking-unavailable` is present - evidence:
  `timer-per-tool.unit.test.ts` asserts exact `tool-timeout` and no guessed timer.
- **AC-5** Approval-SLA starts at `AgentApprovalRequested`, stops at recorded approval answer or terminal
  event, and overdue emits `approval-sla-exceeded`; no consumed-decision timer symbol exists -
  evidence: `timer-approval-sla.unit.test.ts` asserts the reason and
  `rg -n "decision.*consumed|consumed.*decision" packages/sdk/src/core/supervision/timers` returns zero.
- **AC-6** Max-runtime starts at worker-starting lifecycle and stops at terminal lifecycle or worker
  terminal observation; overdue emits `max-runtime-exceeded` - evidence:
  `timer-max-runtime.unit.test.ts` asserts exact reason.
- **AC-7** `wrapWaitRunEvents` rejects mismatched request/cursor run ids with `event-cursor-unavailable`
  and delegates matching cursors to Epic 3 wait with unchanged cursor fields - evidence:
  `wait-wrapper.unit.test.ts` asserts both cases.
- **AC-8** Wait wrapper has no liveness side effects: append, project, renew, and liveness-refresh spies
  all remain zero on success and timeout - evidence: `wait-no-side-effects.unit.test.ts` asserts zero
  calls and unchanged projection fixture.
- **AC-9** The public SDK entrypoint exports `evaluateSupervisionTimers` and `wrapWaitRunEvents` -
  evidence: `supervision-timers-public-import.unit.test.ts` imports both functions from `sdk` and
  constructs one timer and wait fixture without private paths.

## Predicate and Producer Closure

| AC / output | Decision value or produced field | Source |
|---|---|---|
| AC-1..AC-6 | timer deadlines | projection timestamps/sequences, policy durations, sampled clock |
| AC-2..AC-6 | timer reason | expired timer kind from design table |
| AC-7 | cursor validity | `request.runId`, `cursor.runId`, `cursor.afterSequence` |
| AC-8 | no side effects | injected collaborator call counts |
| AC-9 | public symbols | owned source files and `packages/sdk/src/index.ts` export wiring |
| `LivenessTimerExpiredPayload.sourceEventIds` | source events used to compute the deadline | liveness projection/timer input |

## Failure and Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `startup-timeout` | startup deadline exceeded | timer expired fact | AC-2 |
| `idle-timeout` | idle deadline exceeded | timer expired fact | AC-3 |
| `no-progress-timeout` | progress deadline exceeded | timer expired fact | AC-3 |
| `tool-timeout` | stable tool item misses deadline | timer expired fact | AC-4 |
| `approval-sla-exceeded` | approval attention window overdue | approval-overdue signal only | AC-5 |
| `max-runtime-exceeded` | runtime deadline exceeded | timer expired fact | AC-6 |
| `event-cursor-unavailable` | cursor mismatch or wait failure | fail closed; no liveness proof | AC-7 |

## Quality Bar

- Coverage: 95% branch coverage for timers and wait modules.
- Gate lane: `pnpm check`.
- Public exposure: AC-9.
- Boundary sweeps: no consumed-decision timer symbol, no process/network/provider imports, no projection
  mutation in wait.
- File-size budget: 300 lines per implementation file, 380 lines per test file.

## STOP Conditions

Stop if a seventh timer is needed, if wait must mutate projections or liveness, or if cursor semantics
cannot be consumed from Epic 3.

## Characterization Review

### Decision: wait-wrapper-read-only

- Rationale: `waitRunEvents` is a cursor convenience over Epic 3 and must not become progress proof.
- Design trace: supervision README wait paragraph and liveness-model non-refresh list.
- Falsification: wait appends, reads projections, renews leases, or changes liveness.
- Escalation: block as story defect; operator side effects belong to Epic 7.

### Decision: only-six-timers

- Rationale: Epic 4 owns exactly the six supervision timers in the design; the consumed-decision timer
  is deferred by the charter.
- Design trace: liveness-model timer table and Epic 4 deferred-work row.
- Falsification: a seventh timer symbol or AC appears.
- Escalation: raise a design update before adding scope.

- Verdict: ready; all timer and wait branches are sourced and falsifiable.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - stories](./README.md) · **← Prev:** [core-04-s2-liveness-fold - liveness fold implementation story](./core-04-s2-liveness-fold.md) · **Next →:** [core-04-s4-termination-facts - supervision termination facts implementation story](./core-04-s4-termination-facts.md)

<!-- /DOCS-NAV -->
