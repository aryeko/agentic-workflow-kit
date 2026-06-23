# Implementer Prompt: core-04-s1-supervision-contracts

## Assigned Routing

- Source story id: `core-04-s1-supervision-contracts`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`.
- Model class: `strong-coder`.
- Effort: `high`.
- Suggested-tier floor: `elevated`.
- Reasoning tier: `elevated`.
- Routing rationale: core-04-s1-supervision-contracts covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` and carries public supervision and liveness contract surface and single-producer value/event/projection/failure catalog consumed by later supervision behavior stories and later epics. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Exact Task

Implement source story `core-04-s1-supervision-contracts` for epic `epic-4-human-control-and-liveness-loop`. Deliver exactly the outcome in the ready source contract and nothing outside it:

Declare the supervision and liveness contract surface as the single producer for liveness value types,
timer/wait inputs, event payloads, termination fact shapes, and fail-closed reason catalog.

Source story: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s1-supervision-contracts.md`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`.

## Why It Matters

- Covers signals: supervisor/liveness/timer/termination facts contract part; fail-closed reason catalog.
- Depends on: none inside Epic 4.
- Cross-epic frozen inputs: Epic 3 run-log/cursor types; Epic 2 Agent and Execution Host port types.
- Decision inputs consumed: none; this story declares types only.

DAG dependents for this story: `core-04-s2-liveness-fold`, `core-04-s3-timers-and-wait`, `core-04-s4-termination-handoff`. Preserve the producer/consumer shape boundaries named in the source DAG and story contract so later stories can consume committed dependency inputs without redeclaring or widening this story's scope.

## Required Reading

- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s1-supervision-contracts.md` - ready source story contract for `core-04-s1-supervision-contracts`.
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md` - frozen DAG row, dependencies, owned pathset, wave, shared shapes, and suggested-tier floor for `core-04-s1-supervision-contracts`.
- `docs/design/30-domain-reference/core/supervision-and-liveness/README.md` - normative design named by the source contract.
- `docs/design/30-domain-reference/core/supervision-and-liveness/liveness-model.md` - normative design named by the source contract.
- `docs/design/20-sdk-and-packaging/sdk-boundary.md` - normative design named by the source contract.
- `{{DEPENDENCY_COMMITS}}` - runtime slot; this story has no direct intra-epic dependencies, so the execution run may leave it empty.
- `AGENTS.md` and `CLAUDE.md` - repo branch, worktree, mutation, and verification rules.

## Acceptance Criteria

Source story: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s1-supervision-contracts.md`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`.

- **AC-1** `Clock` is exported as an injected zero-argument function returning an ISO-8601 timestamp
  string, and no contract type permits ambient `Date.now` or `new Date` as an implicit dependency -
  evidence: `supervision-clock-contract.unit.test.ts` imports `Clock` from `sdk`, assigns
  `() => "2026-06-23T10:00:00.000Z"`, and a sweep for `Date.now|new Date` in contracts returns zero.
- **AC-2** `LivenessState` has exactly `not-started`, `starting`, `active`, `waiting-for-approval`,
  `approval-overdue`, `stale`, `supervision-lost`, `termination-requested`, `terminated`; and
  `LivenessReason` has exactly the 13 design reasons - evidence: `liveness-unions.unit.test.ts` runs
  `never` exhaustiveness switches and `liveness-reason-unknown.fixture.ts` fails typecheck.
- **AC-3** `LivenessProjection` exposes `runId`, `state`, optional `reason`, optional
  `currentSessionId`, optional `workerHandleId`, optional sequence fields, optional `staleSince`,
  `timers`, and `terminal` - evidence: `liveness-projection-shape.unit.test.ts` constructs a
  projection and asserts `timers.idle.exceeded === false` for fixture `active-projection.fixture.ts`.
- **AC-4** `SupervisionInputs`, `SupervisionTimerPolicy`, and `SupervisionWaitRequest` expose the exact
  design fields, including timer field names `startupMs`, `idleMs`, `noProgressMs`, `perToolMs`,
  `approvalSlaMs`, and `maxRuntimeMs` - evidence: `supervision-inputs.unit.test.ts` constructs the
  three shapes and `timer-policy-missing-max-runtime.fixture.ts` fails typecheck.
- **AC-5** `SupervisionTimerName` and `LivenessAdvanceClass` expose exactly the design members -
  evidence: `supervision-catalogs.unit.test.ts` exhaustively switches the six timer names and five
  advance classes.
- **AC-6** The eight supervision event payload interfaces expose exact schema literals and required
  source fields, including `LivenessAdvancedPayload.sourceSequence`, `LivenessTimerExpiredPayload.timer`,
  `WorkerTerminatedPayload.observedBy`, and `SupervisorStoppedPayload.terminalSourceEventIds` -
  evidence: `supervision-event-payloads.unit.test.ts` constructs all eight payloads and asserts schema
  equality; `supervisor-stopped-missing-terminal-sources.fixture.ts` fails typecheck.
- **AC-7** All public shapes import from the `sdk` public entrypoint without private module paths -
  evidence: `supervision-public-import.unit.test.ts` imports the manifest from `sdk` and constructs
  `LivenessProjection`, `SupervisionWaitRequest`, and `SupervisorStoppedPayload`.

### Failure And Degraded Outcomes

This story declares the reason catalog but raises no runtime failure. Behavior stories own triggers.

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `startup-timeout`..`worker-terminal-observed` | declared liveness reason member | exported as union member only | AC-2 |

## Allowed Writes

Source story: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s1-supervision-contracts.md`. Owned pathset from the frozen DAG and source contract:

- `packages/sdk/src/core/supervision/contracts/**`
- `packages/sdk/tests/core/supervision/contracts/**`

Every other write is forbidden, including this execution package, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, commits, pushes, PRs, and merges.

## Dependency Inputs

Direct dependency story ids: none.

Dependency commit inputs are supplied at execution time through `{{DEPENDENCY_COMMITS}}`. Use only producer-owned shared shapes, public import paths, committed events/projections, provider-port inputs, and frozen cross-epic facts named by `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md` or `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s1-supervision-contracts.md`. Do not redeclare producer shapes or consume a dependency before its tracker row is `done`.

## Non-Goals And STOP Conditions

### Source Out Of Scope

- Liveness fold behavior (`core-04-s2`).
- Timer evaluation and wait wrapper behavior (`core-04-s3`).
- Termination handoff and event append behavior (`core-04-s4`).

### Source Boundaries And STOP Conditions

- Package/module boundary: `packages/sdk/src/core/supervision/contracts/**`.
- Owned pathset: `packages/sdk/src/core/supervision/contracts/**`,
  `packages/sdk/tests/core/supervision/contracts/**`.
- Forbidden dependencies: concrete providers, process/network APIs, behavior folds.
- STOP when an event payload field is not defined in the supervision design.

Also stop and report if dependency inputs are missing, required writes fall outside the allowed pathset, a source gap blocks implementation, or any AC would need reinterpretation.

## Implementation Constraints

### Source Responsibilities

- Export every supervision/liveness shape from the `sdk` public entrypoint.
- Keep event payloads as value types; do not append or call providers.
- Keep `Clock` as injected `() => string`; no ambient time in reducers.

### Source Spec Surface

- Interfaces / types: `Clock`, `SupervisionInputs`, `SupervisionTimerPolicy`,
  `SupervisionWaitRequest`, `SupervisionTimerName`, `LivenessAdvanceClass`, `LivenessState`,
  `LivenessReason`, `LivenessProjection`.
- Event payloads: `SupervisorStartedPayload`, `LivenessAdvancedPayload`,
  `LivenessTimerExpiredPayload`, `LivenessStateChangedPayload`, `SupervisionLostPayload`,
  `SupervisorTerminationRequestedPayload`, `WorkerTerminatedPayload`, `SupervisorStoppedPayload`.
- Provider/runtime types consumed but not redeclared: Epic 3 `RunEventLog`, `RunWriter`,
  `RunEventCursor`; Epic 2 `AgentEvent`, `ExecutionHostProvider`.

### Normative Design Constraints

- `supervision-and-liveness/README.md` defines `SupervisionInputs`, `Clock`, timer policy, wait
  request, event payloads, and emitted facts.
- `liveness-model.md` defines `LivenessState`, `LivenessReason`, and `LivenessProjection`.
- `sdk-boundary.md` defines `Clock = () => string` as injected SDK boundary time.

Do not introduce implementation choices outside the names, events, failure tokens, determinism rules, boundary rules, import rules, conformance obligations, and safety invariants fixed above.

## Verification

- Coverage scope and threshold: 95% statements/branches for `packages/sdk/src/core/supervision/contracts/**`.
- Coverage command and lanes: `pnpm test:unit -- --coverage --coverage.include='packages/sdk/src/core/supervision/contracts/**'`.
- Required tests: AC-1..AC-7 and negative fixtures above.
- Public exposure: `sdk` entrypoint; public-import test in AC-7.
- Determinism constraints: type-only; `Clock` explicit.
- Dependency boundaries: SDK contracts only; no provider packages, `testkit`, process, network.
- File-size budget: 240 lines per implementation file, 300 lines per test file.

- Tests and fixtures named in ACs.
- `pnpm check` after implementation.
- Boundary sweep: `rg -n "provider-codex|provider-local|testkit|child_process|Date\\.now|new Date|fetch\\(" packages/sdk/src/core/supervision/contracts packages/sdk/tests/core/supervision/contracts` returns zero matches.

Require exact command output or an explicit blocked reason for every targeted command, required sweep, evidence-pack item, and `pnpm check`.

## Delivery Report

Report:

- changed files;
- AC coverage by `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`;
- tests and checks run;
- evidence pack;
- open questions;
- blockers.

The report is evidence for later review. It is not permission to update tracker state or perform delivery actions.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Reviewer Prompt: core-03-s4-grant-mapping-and-outcome](../core-03-s4-grant-mapping-and-outcome/reviewer.md) · **Next →:** [Reviewer Prompt: core-04-s1-supervision-contracts](./reviewer.md)

<!-- /DOCS-NAV -->
