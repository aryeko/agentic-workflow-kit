# Implementer Prompt: core-04-s3-timers-and-wait

## Assigned Routing

- Source story id: `core-04-s3-timers-and-wait`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.
- Model class: `strong-coder`.
- Effort: `high`.
- Suggested-tier floor: `elevated`.
- Reasoning tier: `elevated`.
- Routing rationale: core-04-s3-timers-and-wait covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8` and carries supervision timer and cursor-wait boundary over liveness projections, explicit clock input, cursor validation, and no-side-effect wait semantics. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Exact Task

Implement source story `core-04-s3-timers-and-wait` for epic `epic-4-human-control-and-liveness-loop`. Deliver exactly the outcome in the ready source contract and nothing outside it:

Evaluate supervision timers from liveness projection and explicit clock input, and expose the
`waitRunEvents` wrapper over Epic 3 cursor wait without mutating or refreshing liveness.

Source story: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s3-timers-and-wait.md`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.

## Why It Matters

- Covers signals: timer signals; `waitRunEvents` wrapper and cursor validation.
- Depends on: `core-04-s1-supervision-contracts`, `core-04-s2-liveness-fold`, and
  `core-03-s3-pending-park-resume` for serialized `packages/sdk/src/index.ts` export wiring only.
- Decision inputs consumed: `LivenessProjection` timestamps/sequences/timers, `SupervisionTimerPolicy`,
  sampled clock, wait request `runId`, `cursor.runId`, `cursor.afterSequence`, `timeoutMs`,
  `maxEvents`, and Epic 3 wait result.

DAG dependents for this story: `core-04-s4-termination-handoff`. Preserve the producer/consumer shape boundaries named in the source DAG and story contract so later stories can consume committed dependency inputs without redeclaring or widening this story's scope.

## Required Reading

- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s3-timers-and-wait.md` - ready source story contract for `core-04-s3-timers-and-wait`.
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md` - frozen DAG row, dependencies, owned pathset, wave, shared shapes, and suggested-tier floor for `core-04-s3-timers-and-wait`.
- `docs/design/30-domain-reference/core/supervision-and-liveness/README.md` - normative design named by the source contract.
- `docs/design/30-domain-reference/core/supervision-and-liveness/liveness-model.md` - normative design named by the source contract.
- `{{DEPENDENCY_COMMITS}}` - runtime slot for committed dependency story inputs before implementation starts.
- `AGENTS.md` and `CLAUDE.md` - repo branch, worktree, mutation, and verification rules.

## Acceptance Criteria

Source story: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s3-timers-and-wait.md`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.

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

## Allowed Writes

Source story: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s3-timers-and-wait.md`. Owned pathset from the frozen DAG and source contract:

- `packages/sdk/src/core/supervision/timers/**`
- `packages/sdk/src/core/supervision/wait/**`
- `packages/sdk/src/index.ts`
- `packages/sdk/tests/core/supervision/timers/**`
- `packages/sdk/tests/core/supervision/wait/**`

Every other write is forbidden, including this execution package, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, commits, pushes, PRs, and merges.

## Dependency Inputs

Direct dependency story ids: `core-04-s1-supervision-contracts`, `core-04-s2-liveness-fold`,
`core-03-s3-pending-park-resume`.

Dependency commit inputs are supplied at execution time through `{{DEPENDENCY_COMMITS}}`. Use the
committed `core-03-s3-pending-park-resume` input only as the baseline for
`packages/sdk/src/index.ts`; do not import approval pending/projection shapes or treat the
serialization edge as a supervision timer dependency. Use only producer-owned shared shapes, public
import paths, committed events/projections, provider-port inputs, and frozen cross-epic facts named by
`docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md` or
`docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s3-timers-and-wait.md`.
Do not redeclare producer shapes or consume a dependency before its tracker row is `done`.

## Non-Goals And STOP Conditions

### Source Out Of Scope

- Liveness fold (`core-04-s2`).
- Appending timer events or requesting termination (`core-04-s4`).
- Any "decision delivered but not consumed" timer.

### Source Boundaries And STOP Conditions

- Package/module boundary: `packages/sdk/src/core/supervision/timers/**`,
  `packages/sdk/src/core/supervision/wait/**`, with SDK public-entrypoint export wiring in
  `packages/sdk/src/index.ts`.
- Owned pathset: `packages/sdk/src/core/supervision/timers/**`,
  `packages/sdk/src/core/supervision/wait/**`, `packages/sdk/src/index.ts`,
  `packages/sdk/tests/core/supervision/timers/**`, `packages/sdk/tests/core/supervision/wait/**`.
- Forbidden dependencies: projection mutation in wait, liveness refresh in wait, new timer not in design.
- STOP when a timer beyond the six design timers is needed.

Also stop and report if dependency inputs are missing, required writes fall outside the allowed pathset, a source gap blocks implementation, or any AC would need reinterpretation.

## Implementation Constraints

### Source Responsibilities

- Start/stop the six timers exactly as design defines.
- Return timer-expired facts with exact reason and deadline.
- Validate `cursor.runId === request.runId` before delegating wait.
- Ensure wait success/timeout never appends events, reads projections, refreshes liveness, renews
  leases, or proves worker liveness.

### Source Spec Surface

- Functions exposed: `evaluateSupervisionTimers`, `wrapWaitRunEvents`.
- Shapes consumed: `core-04-s1/SupervisionTimerPolicy`, `SupervisionTimerName`,
  `LivenessProjection`, `LivenessReason`, `SupervisionWaitRequest`, `LivenessTimerExpiredPayload`.
- Runtime objects consumed: Epic 3 `RunEventLog.waitRunEvents`.
- Failure reasons raised: `startup-timeout`, `idle-timeout`, `no-progress-timeout`, `tool-timeout`,
  `approval-sla-exceeded`, `max-runtime-exceeded`, `event-cursor-unavailable`.

### Normative Design Constraints

- `liveness-model.md` defines timer starts/stops/defaults and timeout reasons.
- `supervision-and-liveness/README.md` defines `SupervisionWaitRequest` and the wrapper's no-side-effect
  behavior.
- Epic 4 charter defers any "decision delivered but not consumed" timer; this story must not author it.

Do not introduce implementation choices outside the names, events, failure tokens, determinism rules, boundary rules, import rules, conformance obligations, and safety invariants fixed above.

## Verification

- Coverage scope and threshold: 95% branch coverage for `packages/sdk/src/core/supervision/timers/**`
  and `packages/sdk/src/core/supervision/wait/**`.
- Coverage command and lanes: `pnpm test:unit -- --coverage --coverage.include='packages/sdk/src/core/supervision/{timers,wait}/**'`.
- Required tests: AC-1..AC-8 and failure rows.
- Public exposure: `sdk` import test for timer evaluator and wait wrapper.
- Determinism constraints: sampled clock input only.
- Dependency boundaries: SDK only; wait delegates to Epic 3 port/object.
- File-size budget: 280 lines per implementation file, 340 lines per test file.

- Tests and fixtures named above.
- `pnpm check` after implementation.
- Boundary sweeps for no consumed-decision timer and no process/network/provider imports.

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

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Reviewer Prompt: core-04-s2-liveness-fold](../core-04-s2-liveness-fold/reviewer.md) · **Next →:** [Reviewer Prompt: core-04-s3-timers-and-wait](./reviewer.md)

<!-- /DOCS-NAV -->
