# Reviewer Prompt: core-04-s1-supervision-contracts

## Assigned Routing

- Source story id: `core-04-s1-supervision-contracts`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `elevated`.
- Reasoning tier: `elevated`.
- Routing rationale: core-04-s1-supervision-contracts covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` and carries public supervision and liveness contract surface and single-producer value/event/projection/failure catalog consumed by later supervision behavior stories and later epics. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Original Scope

- Story id: `core-04-s1-supervision-contracts`.
- Epic slug: `epic-4-human-control-and-liveness-loop`.
- Source story contract path: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s1-supervision-contracts.md`.
- Allowed pathset: `packages/sdk/src/core/supervision/contracts/**`, `packages/sdk/tests/core/supervision/contracts/**`.
- Direct dependencies: none.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus committed producer shapes, public import paths, event/projection inputs, and provider-port facts named in the source contract and DAG.

### Acceptance Criteria

Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`.

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

### Dependencies And Frozen Inputs

- Covers signals: supervisor/liveness/timer/termination facts contract part; fail-closed reason catalog.
- Depends on: none inside Epic 4.
- Cross-epic frozen inputs: Epic 3 run-log/cursor types; Epic 2 Agent and Execution Host port types.
- Decision inputs consumed: none; this story declares types only.

### Non-Goals

- Liveness fold behavior (`core-04-s2`).
- Timer evaluation and wait wrapper behavior (`core-04-s3`).
- Termination handoff and event append behavior (`core-04-s4`).

### STOP Conditions And Boundaries

- Package/module boundary: `packages/sdk/src/core/supervision/contracts/**`.
- Owned pathset: `packages/sdk/src/core/supervision/contracts/**`,
  `packages/sdk/tests/core/supervision/contracts/**`.
- Forbidden dependencies: concrete providers, process/network APIs, behavior folds.
- STOP when an event payload field is not defined in the supervision design.

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check implementation against source story `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-04-s1-supervision-contracts.md` and AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`.

- AC coverage by source `AC-n` id, including every failure, degraded, validation, and negative-fixture row named by the source contract.
- Evidence pack completeness against the source `Quality bar` and `Evidence pack` sections.
- Public API names, exports, and import paths against the source contract and DAG producer/consumer table.
- Dependency boundaries, committed dependency inputs, and `{{DEPENDENCY_COMMITS}}` consistency.
- Stale names and sibling occurrences of any issue found.
- Tests, targeted checks, coverage commands, forbidden-symbol sweeps, and `pnpm check` output.
- Scope control against allowed writes: `packages/sdk/src/core/supervision/contracts/**`, `packages/sdk/tests/core/supervision/contracts/**`.
- Repo conventions and mutation limits from `AGENTS.md` and the source contract.

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Implementer Prompt: core-04-s1-supervision-contracts](./implementer.md) · **Next →:** [Implementer Prompt: core-04-s2-liveness-fold](../core-04-s2-liveness-fold/implementer.md)

<!-- /DOCS-NAV -->
