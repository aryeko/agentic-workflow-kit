# Reviewer Prompt: core-01-r1-create-run-requested-by

## Assigned Routing

- Source story id: `core-01-r1-create-run-requested-by`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`.
- Model class: `frontier-reviewer`.
- Effort: `medium`.
- Suggested-tier floor: `light`.
- Reasoning tier: `standard`.
- Routing rationale: public shared `CreateRunInput` type; confirm required-not-optional + single source.
  At or above the DAG floor; no provider-specific runtime model id.

## Original Scope

- Story id: `core-01-r1-create-run-requested-by`.
- Epic slug: `epic-r1-closure-remediation`.
- Source story contract path: `docs/implementation/epics/epic-r1-closure-remediation/stories/core-01-r1-create-run-requested-by.md`.
- Allowed pathset: `packages/sdk/src/core/run-lifecycle/**`, `packages/sdk/tests/core/run-lifecycle/**`.
- Direct dependencies: none. Dependency inputs: `{{DEPENDENCY_COMMITS}}` (none intra-epic).

### Acceptance Criteria

- **AC-1** `CreateRunInput` has a top-level **required** `requestedBy: string` (type test +
  `@ts-expect-error` for omission).
- **AC-2** `createRun` sources emitted `RunCreatedPayload.requestedBy` from `input.requestedBy` (sentinel
  assertion).
- **AC-3** `CreateRunInput` importable from `sdk` with the amended shape.

### Dependencies And Frozen Inputs

Covers signals: none (forward-fix; owner Epic 3 `core-01-s1..`). Depends on / depended on by: none
intra-epic. Shared shapes consumed: none new.

### Non-Goals

Other fields/behaviour; Epic 3 planning edits.

### STOP Conditions And Boundaries

Owned pathset only; forbidden production deps `testkit`/`provider-*`/`cli`/`mcp`; STOP if a fix needs a
design or Epic 3 planning change.

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

- **AC coverage:** each `AC-n` proven by the named test with a concrete assertion.
- **Correctness:** `requestedBy` is required (not optional); `createRun` derives the payload field from
  `input.requestedBy` (single source — no double-supply); other `CreateRunInput` fields and run-creation
  behaviour unchanged.
- **Stale names / sibling occurrences:** all `CreateRunInput` construction sites (fixtures, callers within
  the pathset) updated to provide the top-level `requestedBy`; no test still relies on the old shape.
- **Evidence pack completeness:** coverage number, public-import result, `@ts-expect-error` fixture.
- **Repo conventions / mutation limits:** no commits/PRs/tracker edits; writes within pathset.

## Verdict Format

Return `APPROVED` when no blocking findings remain. Otherwise list findings severity-ordered, each with
file/line, the required fix, and the violated `AC-n` or boundary.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker/package edits, or source-planning edits.
Inspect and return a verdict only.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic R1 - Delivered-code closure remediation](../../../README.md) · **← Prev:** [Implementer Prompt: core-01-r1-create-run-requested-by](./implementer.md) · **Next →:** [Implementer Prompt: fnd-04-r1-required-attester-source](../fnd-04-r1-required-attester-source/implementer.md)

<!-- /DOCS-NAV -->
