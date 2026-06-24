---
title: "core-04-s3-timers-and-wait - supervision timers and wait wrapper implementation story"
id: "core-04-s3-timers-and-wait"
epic: 4
status: "story: ready"
design:
  - "docs/design/30-domain-reference/core/supervision-and-liveness/README.md"
  - "docs/design/30-domain-reference/core/supervision-and-liveness/liveness-model.md"
---

# core-04-s3-timers-and-wait - Timers and Wait

## Purpose

Evaluate supervision timers from liveness projection and explicit clock input, and expose the
`waitRunEvents` wrapper over Epic 3 cursor wait without mutating or refreshing liveness.

## Normative design

- `liveness-model.md` defines timer starts/stops/defaults and timeout reasons.
- `supervision-and-liveness/README.md` defines `SupervisionWaitRequest` and the wrapper's no-side-effect
  behavior.
- Epic 4 charter defers any "decision delivered but not consumed" timer; this story must not author it.

## Spec surface

- Functions exposed: `evaluateSupervisionTimers`, `wrapWaitRunEvents`.
- Shapes consumed: `core-04-s1/SupervisionTimerPolicy`, `SupervisionTimerName`,
  `LivenessProjection`, `LivenessReason`, `SupervisionWaitRequest`, `LivenessTimerExpiredPayload`.
- Runtime objects consumed: Epic 3 `RunEventLog.waitRunEvents`.
- Failure reasons raised: `startup-timeout`, `idle-timeout`, `no-progress-timeout`, `tool-timeout`,
  `approval-sla-exceeded`, `max-runtime-exceeded`, `event-cursor-unavailable`.

## Responsibilities

- Start/stop the six timers exactly as design defines.
- Return timer-expired facts with exact reason and deadline.
- Validate `cursor.runId === request.runId` before delegating wait.
- Ensure wait success/timeout never appends events, reads projections, refreshes liveness, renews
  leases, or proves worker liveness.

## Out of scope

- Liveness fold (`core-04-s2`).
- Appending timer events or requesting termination (`core-04-s4`).
- Any "decision delivered but not consumed" timer.

## Dependencies and frozen inputs

- Covers signals: timer signals; `waitRunEvents` wrapper and cursor validation.
- Depends on: `core-04-s1-supervision-contracts`, `core-04-s2-liveness-fold`;
  `core-03-s3-pending-park-resume` for serialized `packages/sdk/src/index.ts` export wiring only.
- Decision inputs consumed: `LivenessProjection` timestamps/sequences/timers, `SupervisionTimerPolicy`,
  sampled clock, wait request `runId`, `cursor.runId`, `cursor.afterSequence`, `timeoutMs`,
  `maxEvents`, and Epic 3 wait result.

## Acceptance criteria

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

## Coverage matrix

| Responsibility / spec-surface item | Proven by |
|---|---|
| Timer defaults and starts/stops | AC-1..AC-6 |
| Deferred consumed-decision timer exclusion | AC-5 |
| Cursor validation/delegation | AC-7 |
| Wait no side effects | AC-8 |
| Failure reasons | AC-2, AC-4, AC-5, AC-6, AC-7 |

## Predicate-input matrix

| AC or failure row | Predicate / branch value | Declared source value | Producer / resolver | Verdict |
|---|---|---|---|---|
| AC-1..AC-6 | timer deadlines | projection event timestamps/sequences, policy durations, sampled clock | `core-04-s1`, `core-04-s2` | decidable |
| AC-7 | cursor validity | `request.runId`, `cursor.runId`, `afterSequence` | Epic 3 cursor type | decidable |
| AC-8 | side effects | calls to injected wait/log collaborators | Epic 3 log object | decidable |

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `startup-timeout` | startup deadline exceeded | timer-expired fact | AC-2 |
| `idle-timeout` | idle deadline exceeded | timer-expired fact | AC-3 |
| `no-progress-timeout` | progress deadline exceeded | timer-expired fact | AC-3 |
| `tool-timeout` | stable tool item misses deadline | timer-expired fact | AC-4 |
| `approval-sla-exceeded` | approval attention window overdue | approval-overdue signal only | AC-5 |
| `max-runtime-exceeded` | max runtime deadline exceeded | timer-expired fact | AC-6 |
| `event-cursor-unavailable` | cursor mismatch or wait failure | fail closed; no liveness proof | AC-7 |

## Quality bar

- Coverage scope and threshold: 95% branch coverage for `packages/sdk/src/core/supervision/timers/**`
  and `packages/sdk/src/core/supervision/wait/**`.
- Coverage command and lanes: `pnpm test:unit -- --coverage --coverage.include='packages/sdk/src/core/supervision/{timers,wait}/**'`.
- Required tests: AC-1..AC-8 and failure rows.
- Public exposure: `sdk` import test for timer evaluator and wait wrapper.
- Determinism constraints: sampled clock input only.
- Dependency boundaries: SDK only; wait delegates to Epic 3 port/object.
- File-size budget: 280 lines per implementation file, 340 lines per test file.

## Evidence pack

- Tests and fixtures named above.
- `pnpm check` after implementation.
- Boundary sweeps for no consumed-decision timer and no process/network/provider imports.

## Boundaries and STOP conditions

- Package/module boundary: `packages/sdk/src/core/supervision/timers/**`,
  `packages/sdk/src/core/supervision/wait/**`, with SDK public-entrypoint export wiring in
  `packages/sdk/src/index.ts`.
- Owned pathset: `packages/sdk/src/core/supervision/timers/**`,
  `packages/sdk/src/core/supervision/wait/**`, `packages/sdk/src/index.ts`,
  `packages/sdk/tests/core/supervision/timers/**`, `packages/sdk/tests/core/supervision/wait/**`.
- Forbidden dependencies: projection mutation in wait, liveness refresh in wait, new timer not in design.
- STOP when a timer beyond the six design timers is needed.

## Characterization review

- Scope decision: wait wrapper is not liveness proof. Rationale: design says wait responses never
  refresh liveness. Falsification: wait changes liveness projection. Escalation: story defect.
- Scope decision: SDK public entrypoint wiring is part of this public behavior story. Rationale: its
  public-import test cannot pass unless the story can add timer/wait exports to
  `packages/sdk/src/index.ts`; the cross-domain dependency is serialization only. Falsification: public
  import AC excludes the package entrypoint from the pathset or runs concurrently with another barrel
  writer.
- Gate verdict: ready. ACs map every timer and wait failure to concrete assertions.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - stories](./README.md) · **← Prev:** [core-04-s2-liveness-fold - liveness fold implementation story](./core-04-s2-liveness-fold.md) · **Next →:** [core-04-s4-termination-handoff - supervision termination handoff implementation story](./core-04-s4-termination-handoff.md)

<!-- /DOCS-NAV -->
