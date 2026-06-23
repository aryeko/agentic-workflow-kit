---
title: "core-03-s1-approval-contracts - approval contracts implementation story"
id: "core-03-s1-approval-contracts"
epic: 4
status: "story: ready"
design:
  - "docs/design/30-domain-reference/core/approval-and-escalation/decision-model.md"
  - "docs/design/30-domain-reference/core/approval-and-escalation/interfaces-events-and-tests.md"
  - "docs/design/30-domain-reference/core/approval-and-escalation/park-resume-and-failures.md"
---

# core-03-s1-approval-contracts - Approval Contracts

## Purpose

Declare the approval relay contract surface as the single producer for core-03 value types, event
payloads, projection shapes, interfaces, and failure-state catalog.

## Normative design

- `decision-model.md` defines `ApprovalMode`, `ApprovalRisk`, `ApprovalState`, `ApprovalSubject`,
  `PolicyGrantScope`, `ApprovalRequest`, `PolicyGrantPlan`, `Decision`, and `Outcome`.
- `interfaces-events-and-tests.md` defines `ApprovalEscalation`, input types, `ResumeDecision`, V1
  event payloads, and approval projections.
- `park-resume-and-failures.md` defines `ApprovalFailureState` and token semantics.
- Epic 0 export convention: exported SDK shapes must be importable through the `sdk` public entrypoint.

## Spec surface

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

## Responsibilities

- Export every shape above from the `sdk` public entrypoint.
- Keep Agent `ScopedGrant` as an imported provider-port shape; do not redefine it in core-03.
- Keep these contracts type-only: no runtime policy decisions, no event appends, no Agent calls.

## Out of scope

- Risk classification and mode ladder behavior (`core-03-s2`).
- Pending persistence, park/resume, and projection folds (`core-03-s3`).
- Grant mapping to Agent relay and final outcome behavior (`core-03-s4`).

## Dependencies and frozen inputs

- Covers signals: neutral records contract part; fail-closed catalog part.
- Depends on: Epic 2 `prov-01-s1-agent-port/ScopedGrant`.
- Depended on by: `core-03-s2`, `core-03-s3`, `core-03-s4`, Epic 5, Epic 7.
- Shared shapes consumed: `prov-01-s1-agent-port/ScopedGrant`.
- Decision inputs consumed: none; this story declares shapes only.

## Acceptance criteria

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

## Coverage matrix

| Responsibility / spec-surface item | Proven by |
|---|---|
| Primitive unions and neutral records | AC-1, AC-2 |
| Resume decision | AC-2 |
| Event payloads | AC-3 |
| Projection shapes | AC-4 |
| Failure catalog | AC-5 |
| Public SDK exposure | AC-6 |

## Predicate-input matrix

| AC or failure row | Predicate / branch value | Declared source value | Producer / resolver | Verdict |
|---|---|---|---|---|
| AC-1..AC-6 | type membership and required fields | exported TypeScript declarations | this story | decidable |

## Failure and degraded outcomes

This story declares the catalog but raises no runtime failure. Behavior stories own token triggers.

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `approval-request-unrecordable`..`approval-outcome-ambiguous` | declared catalog member | exported as union member only | AC-5 |

## Quality bar

- Coverage scope and threshold: 95% statements/branches for `packages/sdk/src/core/approval/contracts/**`.
- Coverage command and lanes: `pnpm test:unit -- --coverage --coverage.include='packages/sdk/src/core/approval/contracts/**'`.
- Required tests: AC-1..AC-6 tests and negative fixtures above.
- Public exposure: `sdk` entrypoint; public-import test in AC-6.
- Determinism constraints: type-only, no runtime reads.
- Dependency boundaries: `sdk` may import provider-port types only through SDK-internal public seams; no
  provider packages, `testkit`, process, network, CLI, MCP.
- File-size budget: 220 lines per implementation file, 260 lines per test file.

## Evidence pack

- Tests named in AC-1..AC-6.
- Negative fixtures for illegal union members and missing required fields.
- `pnpm check` after implementation.
- Boundary sweep: `rg -n "provider-codex|provider-local|testkit|child_process|Date\\.now|new Date" packages/sdk/src/core/approval/contracts packages/sdk/tests/core/approval/contracts` returns zero matches.

## Boundaries and STOP conditions

- Package/module boundary: `packages/sdk/src/core/approval/contracts/**`.
- Owned pathset: `packages/sdk/src/core/approval/contracts/**`, `packages/sdk/tests/core/approval/contracts/**`.
- Forbidden dependencies: provider packages, `testkit`, process/network APIs, concrete Codex enums.
- STOP when a required approval field is not in the design files named above.

## Characterization review

- Scope decision: approval contracts are value types. Rationale: consumers use these as data shapes;
  falsified if a behavior story redeclares them. Escalation: return to DAG.
- Gate verdict: ready. All ACs have concrete assertions, public import is named, no runtime predicate is
  hidden, and failure tokens are catalog-only here.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - stories](./README.md) · **← Prev:** [Epic 4 - stories](./README.md) · **Next →:** [core-03-s2-risk-and-decision - approval risk and decision implementation story](./core-03-s2-risk-and-decision.md)

<!-- /DOCS-NAV -->
