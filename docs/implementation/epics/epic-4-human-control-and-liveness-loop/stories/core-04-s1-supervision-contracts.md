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

Produce the supervision and liveness type surface once: clock, timer/wait inputs, liveness projection,
event payloads, termination facts, and fail-closed reason catalog.

## Spec Surface

- Types and interfaces: `Clock`, `SupervisionInputs`, `SupervisionTimerPolicy`,
  `SupervisionWaitRequest`, `SupervisionTimerName`, `LivenessAdvanceClass`, `LivenessState`,
  `LivenessReason`, `LivenessProjection`.
- Event payloads: `SupervisorStartedPayload`, `LivenessAdvancedPayload`,
  `LivenessTimerExpiredPayload`, `LivenessStateChangedPayload`, `SupervisionLostPayload`,
  `SupervisorTerminationRequestedPayload`, `WorkerTerminatedPayload`, `SupervisorStoppedPayload`.
- Consumed but not redeclared: Epic 3 `RunEventLog`, `RunWriter`, `RunEventCursor`; Epic 2 Agent and
  Execution Host provider types.

## Responsibilities

- Export every manifest symbol through `sdk`.
- Keep `Clock = () => string` as the only time source contract.
- Declare payload fields required by design, including source sequences, source event ids, worker
  handle ids, termination proof refs, and terminal summary ids.
- Do not append events, fold liveness, evaluate timers, or call providers.

## Dependencies and Inputs

- Covers signals: supervision/liveness/timer/termination facts contract part and failure reason catalog.
- Depends on: none.
- Frozen inputs: Epic 2 Agent and Execution Host port type names; Epic 3 cursor/log type names.

## Acceptance Criteria

- **AC-1** `Clock` is exported as an injected zero-argument function returning an ISO timestamp string,
  and no contract shape permits ambient clock reads - evidence: `supervision-clock.unit.test.ts`
  assigns a fixed clock and a sweep for `Date.now|new Date` in contracts returns zero.
- **AC-2** `LivenessState` and `LivenessReason` have exactly the design members, including
  `approval-overdue`, `termination-requested`, `termination-unavailable`, and
  `worker-terminal-observed` - evidence: `liveness-catalogs.unit.test.ts` uses exhaustive switches and
  unknown-member negative fixtures.
- **AC-3** `LivenessProjection` requires `runId`, `state`, `timers`, and `terminal`, and allows optional
  reason/session/worker/sequence/stale fields exactly as design defines - evidence:
  `liveness-projection.unit.test.ts` constructs active, stale, and terminated fixtures.
- **AC-4** `SupervisionInputs`, `SupervisionTimerPolicy`, and `SupervisionWaitRequest` expose exact
  fields, including the six timer durations and cursor request fields - evidence:
  `supervision-inputs.unit.test.ts` constructs all inputs and missing `maxRuntimeMs` fails typecheck.
- **AC-5** `SupervisionTimerName` and `LivenessAdvanceClass` exactly match the six timer names and five
  advance classes - evidence: `supervision-catalogs.unit.test.ts` exhaustive switches both unions.
- **AC-6** The eight event payloads expose exact schema literals and required source fields, including
  `LivenessAdvancedPayload.sourceSequence`, `LivenessTimerExpiredPayload.deadline`,
  `WorkerTerminatedPayload.observedBy`, and `SupervisorStoppedPayload.terminalSourceEventIds` -
  evidence: `supervision-payloads.unit.test.ts` constructs each payload and negative fixtures reject
  missing terminal sources.
- **AC-7** Every manifest symbol imports from `sdk` with no private module path - evidence:
  `supervision-public-import.unit.test.ts` imports and constructs `LivenessProjection`,
  `SupervisionWaitRequest`, and `SupervisorStoppedPayload`.

## Predicate and Producer Closure

| Output or branch | Source |
|---|---|
| Contract unions | frozen supervision design tables |
| `LivenessProjection` fields | committed event values and explicit clock samples consumed by later stories |
| `LivenessAdvancedPayload.sourceSequence` | source run event envelope sequence |
| `LivenessTimerExpiredPayload.deadline` | timer evaluation output from `core-04-s3` |
| `WorkerTerminatedPayload.proofRef` / `containmentEmpty` | Agent or Execution Host terminal observation/proof |
| `SupervisorStoppedPayload.terminalSourceEventIds` | terminal source event ids being summarized |
| Public symbols | owned files under `packages/sdk/src/core/supervision/contracts/**` plus SDK entrypoint |

## Failure and Degraded Outcomes

This story declares liveness reasons but raises none at runtime. Behavior stories own triggers.

| token group | trigger | required behavior | proven by |
|---|---|---|---|
| Full `LivenessReason` union | exported catalog membership | importable exact union; no behavior | AC-2 |

## Quality Bar

- Coverage: 95% statements/branches for `packages/sdk/src/core/supervision/contracts/**`.
- Gate lane: `pnpm check`.
- Public exposure: AC-7.
- Boundary sweep:
  `rg -n "provider-codex|provider-local|testkit|child_process|Date\\.now|new Date|fetch\\(" packages/sdk/src/core/supervision/contracts packages/sdk/tests/core/supervision/contracts`
  returns zero matches.
- File-size budget: 260 lines per implementation file, 320 lines per test file.

## STOP Conditions

Stop if a payload field is not in supervision design, if a concrete provider type is needed, or if a
behavior requirement appears in this type-only producer.

## Characterization Review

### Decision: supervision-contracts-as-value-producer

- Rationale: liveness fold, timers, termination, and later epics consume the same supervision values and
  payloads.
- Design trace: supervision README contracts/events and liveness-model projection.
- Falsification: behavior stories redeclare `LivenessState`, `LivenessReason`, payloads, or timer
  names.
- Escalation: return to the DAG and this contract story; do not create behavior-local copies.

### Decision: clock-is-injected

- Rationale: reducers and timers must be deterministic over explicit clock samples.
- Design trace: supervision README `Clock` paragraph and SDK boundary clock.
- Falsification: contract or behavior permits ambient `Date.now` / `new Date` reads.
- Escalation: block as a determinism defect.

- Verdict: ready; public exposure and producer-closure sources are explicit.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - stories](./README.md) · **← Prev:** [core-03-s4-grants-outcomes - approval grants outcomes implementation story](./core-03-s4-grants-outcomes.md) · **Next →:** [core-04-s2-liveness-fold - liveness fold implementation story](./core-04-s2-liveness-fold.md)

<!-- /DOCS-NAV -->
