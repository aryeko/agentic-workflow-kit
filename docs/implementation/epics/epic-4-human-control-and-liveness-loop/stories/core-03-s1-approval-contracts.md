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

Produce the approval type surface once: neutral request/decision/outcome values, park/resume results,
event payloads, projections, protected-policy binding, and the approval failure catalog.

## Spec Surface

- Types and interfaces: `ApprovalEscalation`, `ApprovalContext`, `ApprovalDecisionInput`,
  `ApprovalOutcomeInput`, `ApprovalResumeInput`, `ApprovalParkInput`, `ParkDecision`,
  `ResumeDecision`, `ApprovalProjection`, `PendingApprovalProjection`.
- DTOs and unions: `ApprovalMode`, `ApprovalRisk`, `ApprovalState`, `ApprovalSubject`,
  `PolicyGrantScope`, `PolicyGrantPlan`, `Decision`, `Outcome`, `ProtectedPolicyApprovalBinding`.
- Event payloads: `ApprovalRequestedPayload`, `ApprovalPendingPersistedPayload`,
  `ApprovalRiskClassifiedPayload`, `ApprovalDecisionRecordedPayload`, `ApprovalParkedPayload`,
  `ApprovalResumedPayload`, `ApprovalOutcomeRecordedPayload`.
- Failure catalog: the full `ApprovalFailureState` union from `park-resume-and-failures.md`.

## Responsibilities

- Define every manifest symbol for aggregation by the SDK public-entrypoint owner; this story does not
  own `packages/sdk/src/index.ts`.
- Keep `ScopedGrant` imported from the Agent provider port; do not redeclare it in core-03.
- Make `promptRef`, `requestedAt`, `classifiedAt`, protected-policy binding fields, and source event
  ids required wherever the design requires them.
- Declare types only. No event append, policy decision, Agent relay call, storage call, or ambient clock
  read belongs here.

## Dependencies and Inputs

- Covers signals: approval neutral records contract part and approval failure catalog split.
- Frozen inputs: Epic 1 fnd-02 `ArtifactRef.id` convention for `ApprovalContext.promptRef`; Epic 2
  `prov-01-s1-agent-port/ScopedGrant`.
- Depended on by: `core-03-s2-normalize-risk-decision`, `core-03-s3-pending-park-resume`,
  `core-03-s4-grants-outcomes`, Epic 5, and Epic 7.

## Acceptance Criteria

- **AC-1** The primitive approval unions exactly match the design: `ApprovalMode` excludes `auto`,
  `ApprovalRisk` has low/medium/high, `PolicyGrantScope` has the four policy scopes, and
  `ApprovalSubject` includes `protected-policy-change` and `network` - evidence:
  `approval-unions.unit.test.ts` uses exhaustive switches and `approval-mode-auto.fixture.ts` fails
  typecheck.
- **AC-2** `ApprovalRequest` requires `promptRef` and `requestedAt`, and `ApprovalContext` requires
  `requestedAt` and `promptRef` with optional `subjectOverride?: ApprovalSubject` - evidence:
  `approval-request-context.unit.test.ts` constructs command, protected-policy, and network fixtures;
  missing-field fixtures for `promptRef` and `requestedAt` fail typecheck.
- **AC-3** `Decision`, `Outcome`, `ApprovalParkInput`, `ParkDecision`, and `ResumeDecision` expose the
  exact schema literals and required source fields, including `ParkDecision.sourceEventIds` and
  `ResumeDecision.outcome = "resume" | "expired" | "blocked"` - evidence:
  `approval-decision-results.unit.test.ts` asserts schema strings and negative fixtures reject a
  resume result without `sourceEventIds`.
- **AC-4** `ApprovalDecisionRecordedPayload` carries `protectedPolicyBinding` typed as
  `ProtectedPolicyApprovalBinding`, required iff the approval request subject is
  `protected-policy-change`; when present, the binding requires `runId`, `candidateHeadSha`, and
  `protectedPolicySnapshotEventId`, and permits optional `newPolicyDigest` only - evidence:
  `protected-policy-binding.unit.test.ts` constructs the required binding for protected-policy requests,
  omits it for non-protected subjects, and negative fixtures reject a protected-policy decision without
  `protectedPolicySnapshotEventId`.
- **AC-5** All seven V1 event payloads expose exact schema literals and required event-source fields,
  including `ApprovalRiskClassifiedPayload.classifiedAt` and `ApprovalParkedPayload.parkedAt` -
  evidence: `approval-payloads.unit.test.ts` constructs one payload per event and asserts the schema
  strings.
- **AC-6** `ApprovalProjection` and `PendingApprovalProjection` expose pending, latest decision/outcome,
  operator-attention, and failure-state maps, with `decisionDeadline` required on each pending row -
  evidence: `approval-projections.unit.test.ts` constructs a one-request projection and asserts the
  deadline and attention reason.
- **AC-7** Every manifest symbol imports from `sdk` with no private path - evidence:
  `approval-public-import.unit.test.ts` imports the full manifest and constructs `ApprovalRequest`,
  `ApprovalDecisionRecordedPayload`, `ParkDecision`, and `ResumeDecision`.

## Predicate and Producer Closure

| Output or branch | Source |
|---|---|
| `ApprovalRequest` copied identifiers | `ApprovalContext` fields: `runId`, `taskId`, `operationId`, `sessionId`, `policyRef`, `agentRequestEventId` |
| `ApprovalRequest.requestedAt` | `ApprovalContext.requestedAt`, copied from `AgentApprovalRequested.at` |
| `ApprovalRequest.promptRef` | fnd-02 `ArtifactRef.id` supplied as `ApprovalContext.promptRef` |
| `ApprovalRequest.subject` | `ApprovalContext.subjectOverride` when present; otherwise the frozen `AgentApprovalRequest.kind` mapping |
| Answer-channel fields | `AgentApprovalRequest.answerChannel` |
| `ApprovalRiskClassifiedPayload.classifiedAt` | explicit `classifiedAt` input to the classifier |
| `ProtectedPolicyApprovalBinding` | Operator approval event plus protected-policy snapshot event id |
| Public symbols | files under `packages/sdk/src/core/approval/contracts/**`; aggregated by the SDK public-entrypoint owner |

## Failure and Degraded Outcomes

This story declares failure tokens but raises none at runtime. Behavior stories own each trigger.

| token group | trigger | required behavior | proven by |
|---|---|---|---|
| Full `ApprovalFailureState` union | exported catalog membership | importable exact union; no behavior | AC-1 |

## Quality Bar

- Coverage: 95% statements/branches for `packages/sdk/src/core/approval/contracts/**`.
- Gate lane: `pnpm check`; unit lane includes the tests and type fixtures above.
- Public exposure: AC-7.
- Shared entrypoint ownership: `packages/sdk/src/index.ts` belongs to the export-aggregation owner named
  by `docs/design/20-sdk-and-packaging/sdk-boundary.md`.
- Boundary sweep:
  `rg -n "provider-codex|provider-local|testkit|child_process|Date\\.now|new Date|fetch\\(" packages/sdk/src/core/approval/contracts packages/sdk/tests/core/approval/contracts`
  returns zero matches.
- File-size budget: 240 lines per implementation file, 300 lines per test file.

## STOP Conditions

Stop if a required approval field is not declared in the design, if a behavior is needed to construct a
type, or if a story needs a concrete Agent driver enum instead of the provider-port `ScopedGrant`.

## Characterization Review

### Decision: approval-contracts-as-value-producer

- Rationale: multiple approval behavior stories and later epics consume the same data shapes, so they
  need one producer.
- Design trace: `decision-model.md` neutral shapes and `interfaces-events-and-tests.md` payloads.
- Falsification: a behavior story redeclares `ApprovalRequest`, `Decision`, payloads, or failure tokens.
- Escalation: return to the DAG; do not split or duplicate the contract surface.

### Decision: prompt-ref-contract-only

- Rationale: fnd-02 persistence happens before normalization, while this story only declares the
  required `promptRef` value that proves closure.
- Design trace: approval README flow and decision-model field provenance for `promptRef`.
- Falsification: `ApprovalRequest` can be constructed without `promptRef` or contracts call
  `ArtifactStore`.
- Escalation: block as a producer-closure defect.

- Verdict: ready; ACs have exact assertions, public import is named, and required produced fields name
  sources.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - stories](./README.md) · **← Prev:** [Epic 4 - stories](./README.md) · **Next →:** [core-03-s2-normalize-risk-decision - approval normalize risk and decision implementation story](./core-03-s2-normalize-risk-decision.md)

<!-- /DOCS-NAV -->
