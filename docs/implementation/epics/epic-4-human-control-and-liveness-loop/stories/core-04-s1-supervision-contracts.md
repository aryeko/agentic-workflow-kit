---
title: "core-04-s1-supervision-contracts - supervision contracts implementation story"
id: "core-04-s1-supervision-contracts"
epic: 4
status: "story: ready"
design:
  - "docs/design/30-domain-reference/core/supervision-and-liveness/README.md"
  - "docs/design/30-domain-reference/core/supervision-and-liveness/liveness-model.md"
  - "docs/design/20-sdk-and-packaging/sdk-boundary.md"
---

# core-04-s1-supervision-contracts - Supervision Contracts

## Purpose

Declare the supervision and liveness contract surface as the single producer for liveness value types,
timer/wait inputs, event payloads, termination fact shapes, and fail-closed reason catalog.

## Normative design

- `supervision-and-liveness/README.md` defines `SupervisionInputs`, `Clock`, timer policy, wait
  request, event payloads, and emitted facts.
- `liveness-model.md` defines `LivenessState`, `LivenessReason`, and `LivenessProjection`.
- `sdk-boundary.md` defines `Clock = () => string` as injected SDK boundary time.

## Spec surface

- Interfaces / types: `Clock`, `SupervisionInputs`, `SupervisionTimerPolicy`,
  `SupervisionWaitRequest`, `SupervisionTimerName`, `LivenessAdvanceClass`, `LivenessState`,
  `LivenessReason`, `LivenessProjection`.
- Event payloads: `SupervisorStartedPayload`, `LivenessAdvancedPayload`,
  `LivenessTimerExpiredPayload`, `LivenessStateChangedPayload`, `SupervisionLostPayload`,
  `SupervisorTerminationRequestedPayload`, `WorkerTerminatedPayload`, `SupervisorStoppedPayload`.
- Provider/runtime types consumed but not redeclared: Epic 3 `RunEventLog`, `RunWriter`,
  `RunEventCursor`; Epic 2 `AgentEvent`, `ExecutionHostProvider`.

## Responsibilities

- Export every supervision/liveness shape from the `sdk` public entrypoint.
- Keep event payloads as value types; do not append or call providers.
- Keep `Clock` as injected `() => string`; no ambient time in reducers.

## Out of scope

- Liveness fold behavior (`core-04-s2`).
- Timer evaluation and wait wrapper behavior (`core-04-s3`).
- Termination handoff and event append behavior (`core-04-s4`).

## Dependencies and frozen inputs

- Covers signals: supervisor/liveness/timer/termination facts contract part; fail-closed reason catalog.
- Depends on: `core-03-s1-approval-contracts` for serialized `packages/sdk/src/index.ts` export wiring
  only; this story consumes no approval shapes.
- Cross-epic frozen inputs: Epic 3 run-log/cursor types; Epic 2 Agent and Execution Host port types.
- Decision inputs consumed: none; this story declares types only.

## Acceptance criteria

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

## Coverage matrix

| Responsibility / spec-surface item | Proven by |
|---|---|
| Clock contract | AC-1 |
| Liveness unions/projection | AC-2, AC-3 |
| Supervision inputs and timer policy | AC-4 |
| Timer/advance catalogs | AC-5 |
| Event payloads | AC-6 |
| Public SDK exposure | AC-7 |

## Predicate-input matrix

| AC or failure row | Predicate / branch value | Declared source value | Producer / resolver | Verdict |
|---|---|---|---|---|
| AC-1..AC-7 | type membership and required fields | exported TypeScript declarations | this story | decidable |

## Failure and degraded outcomes

This story declares the reason catalog but raises no runtime failure. Behavior stories own triggers.

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `startup-timeout`..`worker-terminal-observed` | declared liveness reason member | exported as union member only | AC-2 |

## Quality bar

- Coverage scope and threshold: 95% statements/branches for `packages/sdk/src/core/supervision/contracts/**`.
- Coverage command and lanes: `pnpm test:unit -- --coverage --coverage.include='packages/sdk/src/core/supervision/contracts/**'`.
- Required tests: AC-1..AC-7 and negative fixtures above.
- Public exposure: `sdk` entrypoint; public-import test in AC-7.
- Determinism constraints: type-only; `Clock` explicit.
- Dependency boundaries: SDK contracts only; no provider packages, `testkit`, process, network.
- File-size budget: 240 lines per implementation file, 300 lines per test file.

## Evidence pack

- Tests and fixtures named in ACs.
- `pnpm check` after implementation.
- Boundary sweep: `rg -n "provider-codex|provider-local|testkit|child_process|Date\\.now|new Date|fetch\\(" packages/sdk/src/core/supervision/contracts packages/sdk/tests/core/supervision/contracts` returns zero matches.

## Boundaries and STOP conditions

- Package/module boundary: `packages/sdk/src/core/supervision/contracts/**`, with SDK public-entrypoint
  export wiring in `packages/sdk/src/index.ts`.
- Owned pathset: `packages/sdk/src/core/supervision/contracts/**`,
  `packages/sdk/src/index.ts`,
  `packages/sdk/tests/core/supervision/contracts/**`.
- Forbidden dependencies: concrete providers, process/network APIs, behavior folds.
- STOP when an event payload field is not defined in the supervision design.

## Characterization review

- Scope decision: supervision contracts are value types. Rationale: consumers use them as fixtures and
  later projections. Falsification: behavior stories redeclare payloads. Escalation: return to DAG.
- Scope decision: SDK public entrypoint wiring is part of this public producer and is serialized after
  `core-03-s1`. Rationale: AC-7 is not executable unless this story can edit `packages/sdk/src/index.ts`;
  falsification: AC-7 requires public `sdk` imports while the pathset excludes the package entrypoint or
  runs concurrently with the other shared-barrel writer. Escalation: return to DAG or introduce a
  separate export-wiring story if shared export ownership expands.
- Gate verdict: ready. Every exported shape has a concrete assertion and public import test.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - stories](./README.md) · **← Prev:** [core-03-s4-grant-mapping-and-outcome - approval grant mapping and outcome implementation story](./core-03-s4-grant-mapping-and-outcome.md) · **Next →:** [core-04-s2-liveness-fold - liveness fold implementation story](./core-04-s2-liveness-fold.md)

<!-- /DOCS-NAV -->
