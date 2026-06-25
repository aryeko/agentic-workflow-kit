---
title: "core-01-r1-create-run-requested-by - source CreateRunInput.requestedBy on the run-creation seam"
id: "core-01-r1-create-run-requested-by"
epic: "r1"
status: "story: ready"
design:
  - "docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md"
  - "docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md"
---

# core-01-r1-create-run-requested-by - CreateRunInput.requestedBy source

## Purpose

Forward-fix the **already-delivered** core-01 run-creation seam (Epic 3, PR #144) so the required
`RunCreatedPayload.requestedBy` has a declared producer. The design-closure amendment (PR #151) adds a
top-level required `requestedBy` to `CreateRunInput`; the delivered code only carries `requestedBy` inside
`payload`, leaving the produced field without a declared input source (audit finding #18). This story adds
the top-level field and sources the payload field from it. No new run-lifecycle behaviour is introduced.

## Normative design

- `docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md`
  — `CreateRunInput` (lines 26–30) now declares top-level `requestedBy: string` (required), and
  `RunCreatedPayload` (line 76) declares required `requestedBy: string`.
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md`
  — the run-creation lineage prose: `RunCreatedPayload.requestedBy` is sourced from
  `CreateRunInput.requestedBy`.

If these sources do not answer a contract question, this story is not ready.

## Spec surface

- Type amended (frozen design; not invented here): `CreateRunInput` gains a top-level **required**
  `requestedBy: string` (positioned per `contracts.md` line 28), alongside the existing
  `payload: RunCreatedPayload`.
- Producer mapping implemented: `createRun(input)` sources the emitted `RunCreatedPayload.requestedBy`
  from `input.requestedBy`.
- Type consumed (unchanged): `RunCreatedPayload { idempotencyKey; operatorRef?; requestedBy }`.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Add a required top-level `requestedBy: string` to `CreateRunInput`.
- In `createRun`, set the produced `RunCreatedPayload.requestedBy` from `input.requestedBy` (the declared
  source), rather than relying on a caller-supplied payload field with no input source.
- Preserve all existing run-creation behaviour and other `CreateRunInput` fields.
- Update core-01 run-lifecycle tests and fixtures to provide and assert the top-level `requestedBy`.

## Out of scope

- Any other `CreateRunInput`/`RunCreatedPayload` field or run-lifecycle behaviour.
- The `RunCreatedPayload` type declaration shape beyond the already-frozen `requestedBy` field.
- Editing the Epic 3 `core-01-s1..` charter, story DAG, or story contracts.

## Dependencies and frozen inputs

- Covers signals: **none** — forward-fix of delivered surface; signal ownership remains Epic 3
  `core-01-s1..`. ACs trace to the frozen amended design seam above.
- Depends on: nothing intra-epic. Band 1.
- Depended on by: nothing intra-epic.
- Shared shapes consumed: none new (amends a core-01-owned type to its frozen design shape).

## Acceptance criteria

- **AC-1** `CreateRunInput` declares a top-level required `requestedBy: string` — evidence:
  `create-run-input-shape.types.test.ts` assigns a `CreateRunInput` fixture that includes
  `requestedBy: "alice"` (tsc zero errors) and a `@ts-expect-error` line confirming that omitting
  `requestedBy` fails to type-check (required, not optional) (pass).

- **AC-2** `createRun` sources the emitted `RunCreatedPayload.requestedBy` from `input.requestedBy` —
  evidence: `create-run-requested-by-source.unit.test.ts` calls `createRun` with
  `requestedBy: "requester-sentinel"` at the top level, drives the resulting writer/replay (or inspects
  the constructed `RunCreated` event), and asserts the emitted payload's
  `requestedBy === "requester-sentinel"` (pass).

- **AC-3** `CreateRunInput` is importable from the `sdk` public entrypoint with the amended shape —
  evidence: `create-run-input-public-import.unit.test.ts` imports `CreateRunInput` (type) from the `sdk`
  entrypoint and constructs a value including the top-level `requestedBy` (compiles, pass).

## Coverage matrix

| Responsibility / spec-surface item | Proven by |
|---|---|
| Top-level required `requestedBy` on `CreateRunInput` | AC-1, AC-3 |
| `createRun` sources `RunCreatedPayload.requestedBy` from `input.requestedBy` | AC-2 |
| Public exposure from `sdk` entrypoint | AC-3 |

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| (type error) | caller omits the now-required top-level `requestedBy` | compilation fails; no run created with an unsourced `requestedBy` | AC-1 |

## Quality bar

- Coverage scope and threshold: `packages/sdk/src/core/run-lifecycle/**` (changed surface) at ≥90%,
  aiming 95%; aggregate gate `pnpm coverage:baseline`.
- Coverage command / instrumented lane: `pnpm exec vitest run --project unit --coverage
  --passWithNoTests -- packages/sdk/tests/core/run-lifecycle/**`.
- Required tests, catalogued by AC:
  - `create-run-input-shape.types.test.ts` (AC-1)
  - `create-run-requested-by-source.unit.test.ts` (AC-2)
  - `create-run-input-public-import.unit.test.ts` (AC-3)
- Public exposure (import path + public-import test): `CreateRunInput` is exported from the `sdk` public
  entrypoint per `epic0-s4-export-templates/PackageExportConvention` (export exists; its shape changes);
  proven by `create-run-input-public-import.unit.test.ts`.
- Determinism constraints: no new ambient time/id usage introduced; `requestedBy` is a passed-through
  string.
- Dependency boundaries: `packages/sdk/src/core/run-lifecycle/**` imports only what it already depends on;
  must not import `testkit`, `provider-*`, `cli`, `mcp` in production source.
- File-size budget (lines per file; default soft cap ~200): no edited file exceeds 400 lines; test files
  ≤ 200 lines each.
- Domain non-negotiables: `requestedBy` is required (not optional); the produced payload field has a
  single declared source (`input.requestedBy`).

## Required reading

- `docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md` (`CreateRunInput`,
  `RunCreatedPayload`).
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md` (lineage prose).
- `docs/reviews/2026-06-25-producer-consumer-closure-audit.md` finding #18.
- The delivered core-01 code under `packages/sdk/src/core/run-lifecycle/` and its tests.

## Deliverable

The amended `packages/sdk/src/core/run-lifecycle/` run-creation seam with top-level required
`requestedBy` on `CreateRunInput`, `createRun` sourcing the payload field from it, updated tests, and the
evidence pack.

## Evidence pack

- Test name proving each AC (see Required tests).
- Negative fixture: `@ts-expect-error` for the omitted-`requestedBy` case (AC-1).
- `pnpm check` result.
- Coverage command, instrumented lane, and number for `packages/sdk/src/core/run-lifecycle/**`.
- Public-import test result for `CreateRunInput` from the `sdk` entrypoint.

## Boundaries and STOP conditions

- Owned pathset (the orchestrator commits strictly this):
  `packages/sdk/src/core/run-lifecycle/**`, `packages/sdk/tests/core/run-lifecycle/**`.
- Forbidden dependencies (production source): `testkit`, any `provider-*` package, `cli`, `mcp`.
- STOP when: the change would alter run-lifecycle behaviour beyond sourcing `requestedBy`, or would
  require editing the amended design or the Epic 3 planning artifacts. Escalate rather than widen scope.

## Characterization Review

### Decision: requestedBy is sourced from a top-level input field

- Rationale: the produced `RunCreatedPayload.requestedBy` is required; the amendment gives it a declared
  source by adding `CreateRunInput.requestedBy` (closes #18).
- Design trace: `contracts.md` lines 26–30 and 76; README lineage prose.
- Falsification: `createRun` emits a `requestedBy` not derived from `input.requestedBy`, or the field is
  optional.
- Escalation: if a different source is intended (e.g. `holder`), STOP and escalate — the amended design
  names `CreateRunInput.requestedBy` as the source.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic R1 - stories](./README.md) · **← Prev:** [Epic R1 - stories](./README.md) · **Next →:** [fnd-04-r1-required-attester-source - drop runtime-only RequiredAttester facts and fix release-match](./fnd-04-r1-required-attester-source.md)

<!-- /DOCS-NAV -->
