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

- Pure interfaces (stay interfaces — no enumerable members): `Clock`, `SupervisionInputs`,
  `SupervisionTimerPolicy`, `SupervisionWaitRequest`, `LivenessProjection`.
- Enumerable catalogs — exported as runtime `as const` arrays + derived union types, e.g.
  `export const LIVENESS_REASONS = [...] as const; export type LivenessReason = (typeof
  LIVENESS_REASONS)[number];`: `SupervisionTimerName` (`SUPERVISION_TIMER_NAMES`),
  `LivenessAdvanceClass` (`LIVENESS_ADVANCE_CLASSES`), `LivenessState` (`LIVENESS_STATES`),
  `LivenessReason` (`LIVENESS_REASONS`). Design writes these as `type` unions (`liveness-model.md`
  `LivenessState`/`LivenessReason`; supervision `README.md` `SupervisionTimerName`/`LivenessAdvanceClass`)
  and is neutral on runtime representation; minting them as `as const` arrays + derived unions is a
  permitted authoring upgrade — members exactly as design lists, none added — justified by the AC-2/AC-5
  exhaustive-membership proofs and downstream liveness-fold/timers consumption (per
  `docs/engineering/testing-policy.md#proof-substrate`).
- Event payloads (interfaces; each `schema` literal also exported as an `as const` constant so the
  pathset emits runtime substrate): `SupervisorStartedPayload`, `LivenessAdvancedPayload`,
  `LivenessTimerExpiredPayload`, `LivenessStateChangedPayload`, `SupervisionLostPayload`,
  `SupervisorTerminationRequestedPayload`, `WorkerTerminatedPayload`, `SupervisorStoppedPayload`.
- Consumed but not redeclared: Epic 3 `RunEventLog`, `RunWriter`, `RunEventCursor`; Epic 2 Agent and
  Execution Host provider types.

## Responsibilities

- Export every manifest symbol through `sdk`.
- Keep `Clock = () => string` as the only time source contract.
- Declare payload fields required by design, including source sequences, source event ids, worker
  handle ids, termination proof refs, and terminal summary ids.
- Mint the enumerable catalogs as frozen `as const` arrays (runtime **values**, not behavior). Per
  `docs/engineering/testing-policy.md#proof-substrate`: *a frozen `as const` array is a runtime value,
  not behavior: it raises nothing and runs no logic. It therefore does not violate a "raises none at
  runtime" / "type-only producer" STOP condition.* Exporting the catalog value is not raising it, so the
  Failure section's "declares liveness reasons but raises none at runtime" stays true.
- Do not append events, fold liveness, evaluate timers, or call providers.

## Dependencies and Inputs

- Covers signals: supervision/liveness/timer/termination facts contract part and failure reason catalog.
- Depends on: none.
- Frozen inputs: Epic 2 Agent and Execution Host port type names; Epic 3 cursor/log type names.

## Acceptance Criteria

- **AC-1** `Clock` is exported as an injected zero-argument function returning an ISO timestamp string,
  and no contract shape permits ambient clock reads - evidence: `supervision-clock.unit.test.ts`
  assigns a fixed clock and a sweep for `Date.now|new Date` in contracts returns zero.
- **AC-2** The exported `as const` arrays `LIVENESS_STATES` and `LIVENESS_REASONS` (with their derived
  unions `LivenessState`/`LivenessReason`) have exactly the design members, including `approval-overdue`,
  `termination-requested`, `termination-unavailable`, and `worker-terminal-observed` - evidence:
  `liveness-catalogs.unit.test.ts` iterates the runtime catalog arrays for exhaustive membership and uses
  exhaustive switches over the derived unions plus unknown-member negative fixtures.
- **AC-3** `LivenessProjection` requires `runId`, `state`, `timers`, and `terminal`, and allows optional
  reason/session/worker/sequence/stale fields exactly as design defines - evidence:
  `liveness-projection.unit.test.ts` constructs active, stale, and terminated fixtures.
- **AC-4** `SupervisionInputs`, `SupervisionTimerPolicy`, and `SupervisionWaitRequest` expose exact
  fields, including the six timer durations and cursor request fields - evidence:
  `supervision-inputs.unit.test.ts` constructs all inputs and missing `maxRuntimeMs` fails typecheck.
- **AC-5** The exported `as const` arrays `SUPERVISION_TIMER_NAMES` and `LIVENESS_ADVANCE_CLASSES` (with
  their derived unions `SupervisionTimerName`/`LivenessAdvanceClass`) exactly match the six timer names
  and five advance classes - evidence: `supervision-catalogs.unit.test.ts` iterates the runtime catalog
  arrays for exhaustive membership and exhaustive switches both derived unions.
- **AC-6** The eight event payloads expose exact schema literals and required source fields, including
  `LivenessAdvancedPayload.sourceSequence`, `LivenessTimerExpiredPayload.deadline`,
  `WorkerTerminatedPayload.observedBy`, and `SupervisorStoppedPayload.terminalSourceEventIds` -
  evidence: `supervision-payloads.unit.test.ts` constructs each payload and negative fixtures reject
  missing terminal sources.
- **AC-7** Every manifest symbol imports from `sdk` with no private module path, exported through this
  story's own export line(s) in `packages/sdk/src/index.ts` (this story owns those barrel lines, in its
  owned pathset) - evidence: `supervision-public-import.unit.test.ts` imports from `sdk` and constructs
  `LivenessProjection`, `SupervisionWaitRequest`, and `SupervisorStoppedPayload`.

## Predicate and Producer Closure

| Output or branch | Source |
|---|---|
| Contract unions (derived from the exported `as const` catalog arrays) | frozen supervision design tables |
| `LivenessProjection` fields | committed event values and explicit clock samples consumed by later stories |
| `LivenessAdvancedPayload.sourceSequence` | source run event envelope sequence |
| `LivenessTimerExpiredPayload.deadline` | timer evaluation output from `core-04-s3` |
| `WorkerTerminatedPayload.proofRef` / `containmentEmpty` | Agent or Execution Host terminal observation/proof |
| `SupervisorStoppedPayload.terminalSourceEventIds` | terminal source event ids being summarized |
| Public symbols | files under `packages/sdk/src/core/supervision/contracts/**` plus this story's own export line(s) in `packages/sdk/src/index.ts` (owned pathset) |

## Failure and Degraded Outcomes

This story declares liveness reasons but raises none at runtime. Behavior stories own triggers.

| token group | trigger | required behavior | proven by |
|---|---|---|---|
| Full `LivenessReason` union | exported catalog membership | importable exact union; no behavior | AC-2 |

## Quality Bar

- Coverage: 95% statements/branches for `packages/sdk/src/core/supervision/contracts/**`. This lane is
  legitimate per the **Proof-substrate match** Gate-4 box: the owned pathset is guaranteed to emit runtime
  substrate (the `as const` catalog arrays + the exported `schema` literals), so V8 measures real
  statements rather than a vacuous `0/0`→100%. See `docs/engineering/testing-policy.md#proof-substrate`.
- Gate lane: `pnpm check`.
- Public exposure: AC-7.
- Barrel ownership: this story owns its own export line(s) in `packages/sdk/src/index.ts` — a normal
  owned file in this story's owned pathset, per `docs/design/20-sdk-and-packaging/sdk-boundary.md`. The
  barrel is an append-only aggregation point shared across concurrent stories; a line-level overlap is
  resolved by rebase, never by a special ownership role.
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
