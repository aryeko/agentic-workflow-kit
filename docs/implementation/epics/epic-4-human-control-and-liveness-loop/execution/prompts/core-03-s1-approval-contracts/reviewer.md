# Reviewer Prompt: core-03-s1-approval-contracts

## Assigned Routing

- Source story id: `core-03-s1-approval-contracts`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `elevated`.
- Reasoning tier: `elevated`.
- Routing rationale: core-03-s1-approval-contracts covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6` and carries public approval contract surface, SDK entrypoint export wiring, and single-producer value/event/projection/failure catalog consumed by later approval behavior stories and later epics. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Original Scope

- Story id: `core-03-s1-approval-contracts`.
- Epic slug: `epic-4-human-control-and-liveness-loop`.
- Source story contract path: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s1-approval-contracts.md`.
- Allowed pathset: `packages/sdk/src/core/approval/contracts/**`, `packages/sdk/src/index.ts`,
  `packages/sdk/tests/core/approval/contracts/**`.
- Direct dependencies: none.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus committed producer shapes, public import paths, event/projection inputs, and provider-port facts named in the source contract and DAG.

### Acceptance Criteria

Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`.

- **AC-1** The exported approval primitive unions have exactly the design members: `ApprovalMode =
  "manual" | "assisted"`, `ApprovalRisk = "low" | "medium" | "high"`, `PolicyGrantScope =
  "per-command" | "per-command-prefix" | "per-host" | "session"`, and `ApprovalState` has exactly
  `pending`, `auto-granted`, `human-required`, `answered`, `denied`, `parked`, `resumed`, `expired`,
  `blocked`, `failed` - evidence: `approval-contract-unions.unit.test.ts` runs `never`
  exhaustiveness switches for each union and a negative fixture `approval-mode-auto.fixture.ts` fails
  typecheck for `"auto"`.
- **AC-2** `ApprovalRequest`, `PolicyGrantPlan`, `Decision`, `Outcome`, and `ResumeDecision` expose the
  schema literals and required fields from the design, including `ResumeDecision.outcome =
  "resume" | "expired" | "blocked"` and optional `grant?: ScopedGrant` - evidence:
  `approval-contract-shapes.unit.test.ts` constructs each shape and asserts the five schema strings;
  `resume-decision-missing-source-events.fixture.ts` fails typecheck without `sourceEventIds`.
- **AC-3** The seven V1 approval event payload interfaces expose the exact schema literals and source
  event fields named by design - evidence: `approval-event-payloads.unit.test.ts` constructs one
  payload per event and asserts schema equality, plus `approval-resumed-without-grant.fixture.ts` fails
  typecheck.
- **AC-4** `ApprovalProjection` and `PendingApprovalProjection` expose pending, latest
  decision/outcome, operator attention, and failure maps without reading runtime state - evidence:
  `approval-projection-shapes.unit.test.ts` constructs a projection with one pending request and
  asserts `pendingByRequestId[requestId].decisionDeadline` equals the fixture deadline.
- **AC-5** `ApprovalFailureState` has exactly the 13 design tokens and no others - evidence:
  `approval-failure-state.unit.test.ts` runs an exhaustive `never` switch and
  `approval-failure-unknown.fixture.ts` fails typecheck for `approval-timeout`.
- **AC-6** All public shapes import from the package public entrypoint and no private approval module
  path is required - evidence: `approval-public-import.unit.test.ts` imports the full manifest from
  `sdk` and constructs `ApprovalRequestedPayload` and `ResumeDecision`.

### Failure And Degraded Outcomes

This story declares the catalog but raises no runtime failure. Behavior stories own token triggers.

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `approval-request-unrecordable`..`approval-outcome-ambiguous` | declared catalog member | exported as union member only | AC-5 |

### Dependencies And Frozen Inputs

- Covers signals: neutral records contract part; fail-closed catalog part.
- Depends on: Epic 2 `prov-01-s1-agent-port/ScopedGrant`.
- Depended on by: `core-03-s2`, `core-03-s3`, `core-03-s4`, `core-04-s1` for serialized
  `packages/sdk/src/index.ts` export wiring only, Epic 5, Epic 7.
- Shared shapes consumed: `prov-01-s1-agent-port/ScopedGrant`.
- Decision inputs consumed: none; this story declares shapes only.

### Non-Goals

- Risk classification and mode ladder behavior (`core-03-s2`).
- Pending persistence, park/resume, and projection folds (`core-03-s3`).
- Grant mapping to Agent relay and final outcome behavior (`core-03-s4`).

### STOP Conditions And Boundaries

- Package/module boundary: `packages/sdk/src/core/approval/contracts/**`, with SDK public-entrypoint
  export wiring in `packages/sdk/src/index.ts`.
- Owned pathset: `packages/sdk/src/core/approval/contracts/**`, `packages/sdk/src/index.ts`,
  `packages/sdk/tests/core/approval/contracts/**`.
- Forbidden dependencies: provider packages, `testkit`, process/network APIs, concrete Codex enums.
- STOP when a required approval field is not in the design files named above.

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check implementation against source story `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s1-approval-contracts.md` and AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`.

- AC coverage by source `AC-n` id, including every failure, degraded, validation, and negative-fixture row named by the source contract.
- Evidence pack completeness against the source `Quality bar` and `Evidence pack` sections.
- Public API names, exports, and import paths against the source contract and DAG producer/consumer table.
- Dependency boundaries, committed dependency inputs, and `{{DEPENDENCY_COMMITS}}` consistency.
- Stale names and sibling occurrences of any issue found.
- Tests, targeted checks, coverage commands, forbidden-symbol sweeps, and `pnpm check` output.
- Scope control against allowed writes: `packages/sdk/src/core/approval/contracts/**`,
  `packages/sdk/src/index.ts`, `packages/sdk/tests/core/approval/contracts/**`.
- Repo conventions and mutation limits from `AGENTS.md` and the source contract.

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Implementer Prompt: core-03-s1-approval-contracts](./implementer.md) · **Next →:** [Implementer Prompt: core-03-s2-risk-and-decision](../core-03-s2-risk-and-decision/implementer.md)

<!-- /DOCS-NAV -->
