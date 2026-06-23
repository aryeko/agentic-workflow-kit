# Implementer Prompt: core-03-s1-approval-contracts

## Assigned Routing

- Source story id: `core-03-s1-approval-contracts`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`.
- Model class: `strong-coder`.
- Effort: `high`.
- Suggested-tier floor: `elevated`.
- Reasoning tier: `elevated`.
- Routing rationale: core-03-s1-approval-contracts covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6` and carries public approval contract surface and single-producer value/event/projection/failure catalog consumed by later approval behavior stories and later epics. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Exact Task

Implement source story `core-03-s1-approval-contracts` for epic `epic-4-human-control-and-liveness-loop`. Deliver exactly the outcome in the ready source contract and nothing outside it:

Declare the approval relay contract surface as the single producer for core-03 value types, event
payloads, projection shapes, interfaces, and failure-state catalog.

Source story: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s1-approval-contracts.md`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`.

## Why It Matters

- Covers signals: neutral records contract part; fail-closed catalog part.
- Depends on: Epic 2 `prov-01-s1-agent-port/ScopedGrant`.
- Depended on by: `core-03-s2`, `core-03-s3`, `core-03-s4`, Epic 5, Epic 7.
- Shared shapes consumed: `prov-01-s1-agent-port/ScopedGrant`.
- Decision inputs consumed: none; this story declares shapes only.

DAG dependents for this story: `core-03-s2-risk-and-decision`, `core-03-s3-pending-park-resume`, `core-03-s4-grant-mapping-and-outcome`. Preserve the producer/consumer shape boundaries named in the source DAG and story contract so later stories can consume committed dependency inputs without redeclaring or widening this story's scope.

## Required Reading

- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s1-approval-contracts.md` - ready source story contract for `core-03-s1-approval-contracts`.
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md` - frozen DAG row, dependencies, owned pathset, wave, shared shapes, and suggested-tier floor for `core-03-s1-approval-contracts`.
- `docs/design/30-domain-reference/core/approval-and-escalation/decision-model.md` - normative design named by the source contract.
- `docs/design/30-domain-reference/core/approval-and-escalation/interfaces-events-and-tests.md` - normative design named by the source contract.
- `docs/design/30-domain-reference/core/approval-and-escalation/park-resume-and-failures.md` - normative design named by the source contract.
- `{{DEPENDENCY_COMMITS}}` - runtime slot; this story has no direct intra-epic dependencies, so the execution run may leave it empty.
- `AGENTS.md` and `CLAUDE.md` - repo branch, worktree, mutation, and verification rules.

## Acceptance Criteria

Source story: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s1-approval-contracts.md`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`.

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

## Allowed Writes

Source story: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s1-approval-contracts.md`. Owned pathset from the frozen DAG and source contract:

- `packages/sdk/src/core/approval/contracts/**`
- `packages/sdk/tests/core/approval/contracts/**`

Every other write is forbidden, including this execution package, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, commits, pushes, PRs, and merges.

## Dependency Inputs

Direct dependency story ids: none.

Dependency commit inputs are supplied at execution time through `{{DEPENDENCY_COMMITS}}`. Use only producer-owned shared shapes, public import paths, committed events/projections, provider-port inputs, and frozen cross-epic facts named by `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md` or `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s1-approval-contracts.md`. Do not redeclare producer shapes or consume a dependency before its tracker row is `done`.

## Non-Goals And STOP Conditions

### Source Out Of Scope

- Risk classification and mode ladder behavior (`core-03-s2`).
- Pending persistence, park/resume, and projection folds (`core-03-s3`).
- Grant mapping to Agent relay and final outcome behavior (`core-03-s4`).

### Source Boundaries And STOP Conditions

- Package/module boundary: `packages/sdk/src/core/approval/contracts/**`.
- Owned pathset: `packages/sdk/src/core/approval/contracts/**`, `packages/sdk/tests/core/approval/contracts/**`.
- Forbidden dependencies: provider packages, `testkit`, process/network APIs, concrete Codex enums.
- STOP when a required approval field is not in the design files named above.

Also stop and report if dependency inputs are missing, required writes fall outside the allowed pathset, a source gap blocks implementation, or any AC would need reinterpretation.

## Implementation Constraints

### Source Responsibilities

- Export every shape above from the `sdk` public entrypoint.
- Keep Agent `ScopedGrant` as an imported provider-port shape; do not redefine it in core-03.
- Keep these contracts type-only: no runtime policy decisions, no event appends, no Agent calls.

### Source Spec Surface

- Interfaces / types: `ApprovalEscalation`, `ApprovalContext`, `ApprovalDecisionInput`,
  `ApprovalOutcomeInput`, `ApprovalResumeInput`, `ResumeDecision`, `ApprovalProjection`,
  `PendingApprovalProjection`.
- DTOs / unions: `ApprovalMode`, `ApprovalRisk`, `ApprovalState`, `ApprovalSubject`,
  `PolicyGrantScope`, `PolicyGrantPlan`, `Decision`, `Outcome`.
- Events / append payloads: `ApprovalRequestedPayload`, `ApprovalPendingPersistedPayload`,
  `ApprovalRiskClassifiedPayload`, `ApprovalDecisionRecordedPayload`, `ApprovalParkedPayload`,
  `ApprovalResumedPayload`, `ApprovalOutcomeRecordedPayload`.
- Failure tokens: full `ApprovalFailureState` union:
  `approval-request-unrecordable`, `approval-relay-missing`, `approval-answer-channel-lost`,
  `approval-session-ambiguous`, `approval-owner-missing`, `approval-policy-unavailable`,
  `approval-risk-high`, `approval-gate-denied`, `approval-gate-unwritable`,
  `approval-grant-mapping-invalid`, `approval-expired`, `approval-event-log-unavailable`,
  `approval-outcome-ambiguous`.

### Normative Design Constraints

- `decision-model.md` defines `ApprovalMode`, `ApprovalRisk`, `ApprovalState`, `ApprovalSubject`,
  `PolicyGrantScope`, `ApprovalRequest`, `PolicyGrantPlan`, `Decision`, and `Outcome`.
- `interfaces-events-and-tests.md` defines `ApprovalEscalation`, input types, `ResumeDecision`, V1
  event payloads, and approval projections.
- `park-resume-and-failures.md` defines `ApprovalFailureState` and token semantics.
- Epic 0 export convention: exported SDK shapes must be importable through the `sdk` public entrypoint.

Do not introduce implementation choices outside the names, events, failure tokens, determinism rules, boundary rules, import rules, conformance obligations, and safety invariants fixed above.

## Verification

- Coverage scope and threshold: 95% statements/branches for `packages/sdk/src/core/approval/contracts/**`.
- Coverage command and lanes: `pnpm test:unit -- --coverage --coverage.include='packages/sdk/src/core/approval/contracts/**'`.
- Required tests: AC-1..AC-6 tests and negative fixtures above.
- Public exposure: `sdk` entrypoint; public-import test in AC-6.
- Determinism constraints: type-only, no runtime reads.
- Dependency boundaries: `sdk` may import provider-port types only through SDK-internal public seams; no
  provider packages, `testkit`, process, network, CLI, MCP.
- File-size budget: 220 lines per implementation file, 260 lines per test file.

- Tests named in AC-1..AC-6.
- Negative fixtures for illegal union members and missing required fields.
- `pnpm check` after implementation.
- Boundary sweep: `rg -n "provider-codex|provider-local|testkit|child_process|Date\\.now|new Date" packages/sdk/src/core/approval/contracts packages/sdk/tests/core/approval/contracts` returns zero matches.

Require exact command output or an explicit blocked reason for every targeted command, required sweep, evidence-pack item, and `pnpm check`.

## Delivery Report

Report:

- changed files;
- AC coverage by `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`;
- tests and checks run;
- evidence pack;
- open questions;
- blockers.

The report is evidence for later review. It is not permission to update tracker state or perform delivery actions.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Epic 4 Execution Package Plan](../../plan.md) · **Next →:** [Reviewer Prompt: core-03-s1-approval-contracts](./reviewer.md)

<!-- /DOCS-NAV -->
