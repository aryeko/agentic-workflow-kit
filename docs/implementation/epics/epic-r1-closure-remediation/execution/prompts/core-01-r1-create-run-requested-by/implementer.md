# Implementer Prompt: core-01-r1-create-run-requested-by

## Assigned Routing

- Source story id: `core-01-r1-create-run-requested-by`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`.
- Model class: `general-coder`.
- Effort: `medium`.
- Suggested-tier floor: `light`.
- Reasoning tier: `standard`.
- Routing rationale: core-01-r1 covers AC-1..AC-3; an additive single-field change, but on the public
  shared `CreateRunInput` shape (cross-domain contract), so `standard` ≥ floor `light`. No provider-specific
  runtime model id.

## Exact Task

Story `core-01-r1-create-run-requested-by` (epic `epic-r1-closure-remediation`). Single outcome: add a
top-level **required** `requestedBy: string` to `CreateRunInput`, and source the emitted
`RunCreatedPayload.requestedBy` from `input.requestedBy` (closing audit finding #18). Forward-fix of
already-shipped Epic 3 code; preserve all other `CreateRunInput` fields and run-creation behaviour. Do not
reopen Epic 3 planning artifacts.

## Why It Matters

`RunCreatedPayload.requestedBy` is required but the delivered `createRun` sources it from
`input.payload.requestedBy`, which has no declared producer from the run-creation inputs (the closure
defect). The amendment gives it a declared source: a top-level `CreateRunInput.requestedBy`.
`CreateRunInput` is a public shared type consumed across domains.

## Required Reading

- Source story contract: `docs/implementation/epics/epic-r1-closure-remediation/stories/core-01-r1-create-run-requested-by.md`.
- Frozen DAG: `docs/implementation/epics/epic-r1-closure-remediation/story-dag.md`.
- Amended design: `docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md`
  (lines 26–30 `CreateRunInput`, line 76 `RunCreatedPayload`) and `.../README.md` (lineage prose).
- Delivered code to change: `packages/sdk/src/core/run-lifecycle/contracts/envelope.ts` (`CreateRunInput`)
  and the `createRun` implementation that builds `RunCreatedPayload` (e.g. `.../log/create-run.ts`).
- `docs/engineering/test-lanes.md`.

## Acceptance Criteria

- **AC-1** `CreateRunInput` declares a top-level **required** `requestedBy: string`. Test:
  `create-run-input-shape.types.test.ts` — fixture with `requestedBy: "alice"` (tsc zero errors) +
  `@ts-expect-error` for the omitted-`requestedBy` case (required, not optional).
- **AC-2** `createRun` sources the emitted `RunCreatedPayload.requestedBy` from `input.requestedBy`. Test:
  `create-run-requested-by-source.unit.test.ts` — call `createRun` with `requestedBy: "requester-sentinel"`
  at the top level and assert the emitted payload's `requestedBy === "requester-sentinel"`.
- **AC-3** `CreateRunInput` is importable from the `sdk` public entrypoint with the amended shape. Test:
  `create-run-input-public-import.unit.test.ts`.

### Failure / degraded tokens

| token | trigger | required behavior | proven by |
|---|---|---|---|
| (type error) | caller omits the now-required top-level `requestedBy` | compilation fails; no run created with an unsourced `requestedBy` | AC-1 |

## Allowed Writes

Exactly the source contract's owned pathset; all other writes forbidden:

- `packages/sdk/src/core/run-lifecycle/**`
- `packages/sdk/tests/core/run-lifecycle/**`

## Dependency Inputs

- None intra-epic. `{{DEPENDENCY_COMMITS}}`: none. Amends a core-01-owned public type to its frozen design
  shape.

## Non-Goals And STOP Conditions

- Non-goals: any other `CreateRunInput`/`RunCreatedPayload` field or run-lifecycle behaviour; editing Epic 3
  planning artifacts.
- STOP when: the change would alter run-lifecycle behaviour beyond sourcing `requestedBy`, or would require
  editing the amended design or Epic 3 planning artifacts.

## Implementation Constraints

- `requestedBy` is required (not optional); the produced payload field has a single declared source
  (`input.requestedBy`). Do not have callers supply `requestedBy` twice — the payload field is derived.
- Update fixtures/tests that construct `CreateRunInput` to provide the top-level `requestedBy`.
- Determinism: introduce no ambient time/id usage; `requestedBy` is a passed-through string.
- Imports: production source must not import `testkit`, `provider-*`, `cli`, `mcp`.
- TDD: failing test first (RED) → implement (GREEN) → refactor.

## Verification

- Targeted: `pnpm exec vitest run --project unit --coverage --passWithNoTests -- packages/sdk/tests/core/run-lifecycle/**`.
- Repo gate: `pnpm check` green over the worktree.
- Evidence pack: per-AC test names; the AC-1 `@ts-expect-error` fixture; coverage number for the changed
  surface; the public-import result.

## Delivery Report

Return: changed files; AC coverage by `AC-n`; tests/checks and results; evidence pack; open questions;
blockers. Do not claim done without `pnpm check` output.

## Mutation Limits

No staging, commits, pushes, PRs, merges, tracker/package edits, or writes outside the allowed pathset.
Implement and report; the orchestrator commits the approved pathset.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic R1 - Delivered-code closure remediation](../../../README.md) · **← Prev:** [Epic R1 Execution Package Plan](../../plan.md) · **Next →:** [Reviewer Prompt: core-01-r1-create-run-requested-by](./reviewer.md)

<!-- /DOCS-NAV -->
