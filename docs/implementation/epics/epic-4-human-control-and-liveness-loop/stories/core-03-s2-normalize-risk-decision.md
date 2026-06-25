---
title: "core-03-s2-normalize-risk-decision - approval normalize risk and decision implementation story"
id: "core-03-s2-normalize-risk-decision"
epic: 4
status: "story: ready"
design:
  - "docs/design/30-domain-reference/core/approval-and-escalation/README.md"
  - "docs/design/30-domain-reference/core/approval-and-escalation/decision-model.md"
  - "docs/design/30-domain-reference/core/approval-and-escalation/interfaces-events-and-tests.md"
---

# core-03-s2-normalize-risk-decision - Normalize, Risk, and Decision

## Purpose

Implement the pure approval decision path: normalize provider-neutral Agent requests from declared
context, classify risk with explicit time, and apply the v1 manual/assisted ladder against recorded
policy and gate evidence.

## Spec Surface

- Functions: `normalizeApprovalRequest`, `classifyApprovalRisk`, `decideApproval`.
- Consumed approval shapes: `core-03-s1/ApprovalContext`, `ApprovalRequest`,
  `ApprovalDecisionInput`, `ApprovalRisk`, `Decision`, `PolicyGrantPlan`, `ApprovalFailureState`.
- Consumed frozen shapes: fnd-01 `ResolvedPolicy`, Epic 3 `RunReplay`, `RunProjections`,
  committed `CapabilityGateRecord`, Epic 2 Agent capability attestations.
- Produced values: normalized `ApprovalRequest`, `ApprovalRiskClassifiedPayload`, and `Decision`.

## Responsibilities

- Keep normalization total and pure; it copies `requestedAt` and `promptRef` from `ApprovalContext`.
- Apply the design `kind -> subject` table and let `subjectOverride` win for
  `protected-policy-change` or `network`.
- Classify high, then medium, then low, using only request, policy, replay/projection evidence,
  attestations, and explicit `classifiedAt`.
- Allow assisted low-risk auto-grant only from a committed `escalation-auto-grant` allow record.
- Select policy-level grant plans only; Agent `ScopedGrant` mapping is `core-03-s4`.

## Dependencies and Inputs

- Covers signals: deterministic risk classification, v1 mode ladder, and policy/risk/gate failure
  behavior.
- Depends on: `core-03-s1-approval-contracts`.
- Frozen inputs: fnd-01 resolved policy, fnd-02 prompt persistence result supplied as
  `ApprovalContext.promptRef`, Epic 2 Agent attestations, Epic 3 capability gate records and linkage.

## Acceptance Criteria

- **AC-1** `normalizeApprovalRequest(input, context)` copies `runId`, `taskId`, `operationId`,
  `sessionId`, `policyRef`, `agentRequestEventId`, `requestedAt`, and `promptRef` exactly from context,
  and maps `kind` to subject unless `subjectOverride` is set - evidence:
  `normalize-approval-request.unit.test.ts` asserts copied values, command-kind mapping, and protected
  policy override precedence.
- **AC-2** High-risk rules are evaluated before medium/low and return `ApprovalRisk = "high"` for
  session scope, unsafe command syntax, wildcard/private host, out-of-workspace file path, ambiguous
  session linkage, missing relay, and self-report-only evidence - evidence:
  `classify-high-risk.unit.test.ts` asserts each named fixture returns `"high"` and includes the rule id.
- **AC-3** Low risk is returned only for exact command requests in workspace cwd with no high rule,
  policy allowlist match, no broader-than-policy scope, fresh positive relay attestation, persistable
  answer channel when parking may be needed, and current session linkage - evidence:
  `classify-low-risk.unit.test.ts` asserts the positive fixture returns `"low"` and each missing
  guarantee fixture returns `"medium"` or `"high"` as specified.
- **AC-4** `classifyApprovalRisk(..., classifiedAt)` returns or emits classification evidence with
  `classifiedAt` equal to the explicit input timestamp and never reads ambient time - evidence:
  `classification-time.unit.test.ts` asserts exact timestamp equality and a forbidden `Date.now|new Date`
  spy reports zero calls.
- **AC-5** Manual mode always produces `decision = "human-required"`; assisted mode still produces
  `human-required` for high risk - evidence: `mode-ladder-human.unit.test.ts` asserts exact decisions
  and `decidedBy === "system"`.
- **AC-6** Assisted low-risk allowlisted requests produce `decision = "grant"` only when a committed
  `CapabilityGateRecord` allows `escalation-auto-grant` for the matching request scope; committed deny
  records produce `approval-gate-denied`, and explicit gate-append failure input produces
  `approval-gate-unwritable` - evidence: `assisted-gate.unit.test.ts` asserts all three exact outcomes.
- **AC-7** Policy grant planning chooses the tightest valid scope in order `per-command`,
  `per-command-prefix`, `per-host`, `session` without widening request or policy - evidence:
  `policy-grant-plan.unit.test.ts` asserts a fixture with command and session options chooses
  `per-command`, and a scope-widening fixture denies.
- **AC-8** `orchestrator-decide` always denies in v1 with a `capability-deferred` reason and no LLM
  replay logic - evidence: `orchestrator-decide-deferred.unit.test.ts` asserts the deny reason.
- **AC-9** The public SDK entrypoint exports `normalizeApprovalRequest`, `classifyApprovalRisk`, and
  `decideApproval` plus their public input/result types - evidence:
  `approval-decision-public-import.unit.test.ts` imports those symbols from `sdk` and constructs one
  normalize/classify/decide fixture without private paths.

## Predicate and Producer Closure

| AC / output | Decision value or produced field | Source |
|---|---|---|
| AC-1 | normalized request fields | `AgentApprovalRequest` and `ApprovalContext` fields |
| AC-1 | `subject` | `subjectOverride` or frozen kind mapping |
| AC-2, AC-3 | risk | normalized request, resolved policy, replay/projections, attestation facts |
| AC-4 | `classifiedAt` | explicit function input |
| AC-5, AC-6 | ladder/gate branch | `ApprovalDecisionInput.mode`, risk, policy, committed gate event id or explicit append-failure input |
| AC-7 | `PolicyGrantPlan` | request command/host/files/session and resolved policy grant rules |
| AC-8 | v1 deferral | Epic 3 capability registry and AD-14 |
| AC-9 | public symbols | owned source files and `packages/sdk/src/index.ts` export wiring |
| `Decision.sourceEventIds` | event provenance | replayed request, policy, gate, and operator decision event ids supplied in input |

## Failure and Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `approval-policy-unavailable` | resolved policy or provenance missing | block before classification/decision | AC-2 |
| `approval-risk-high` | high risk on assisted path | human required; no auto grant | AC-5 |
| `approval-gate-denied` | committed gate deny | require human or deny by policy | AC-6 |
| `approval-gate-unwritable` | gate record append failed explicitly | no autonomous grant; block if no human path | AC-6 |
| `approval-session-ambiguous` | linkage cannot prove current session | block decision | AC-2 |
| `approval-relay-missing` | fresh relay attestation absent | no low-risk auto grant | AC-3 |

## Quality Bar

- Coverage: 95% branch coverage for `packages/sdk/src/core/approval/decision/**`.
- Gate lane: `pnpm check`; unit lane includes AC fixtures above.
- Public exposure: AC-9.
- Boundary sweep:
  `rg -n "provider-codex|provider-local|testkit|child_process|Date\\.now|new Date|Math\\.random|fetch\\(" packages/sdk/src/core/approval/decision packages/sdk/tests/core/approval/decision`
  returns zero source matches.
- File-size budget: 280 lines per implementation file, 360 lines per test file.

## STOP Conditions

Stop if a branch requires a policy value, session value, gate value, or prompt reference not produced by
frozen inputs; do not infer it from story ids, hashes, or prose.

## Characterization Review

### Decision: pure-normalization-context

- Rationale: `normalize` must stay total and replayable; prompt persistence and time sampling arrive as
  context values.
- Design trace: `decision-model.md` field-provenance table for `requestedAt`, `promptRef`, and
  `subjectOverride`.
- Falsification: normalization reads `ArtifactStore`, `Date.now`, or accepts a request without context
  `promptRef`.
- Escalation: return to `core-03-s1`/DAG if the context type cannot carry a required source.

### Decision: committed-gate-before-grant

- Rationale: assisted grant depends on durable core-02 gate evidence, not an evaluator hint.
- Design trace: approval README mode ladder and `interfaces-events-and-tests.md` `gateRecordEventId`.
- Falsification: `decision = "grant"` without a committed allow event id.
- Escalation: block the story as a source-contract defect; do not infer allow from absent failure.

- Verdict: ready; every branch is backed by declared input values and every produced field has a source.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - stories](./README.md) · **← Prev:** [core-03-s1-approval-contracts - approval contracts implementation story](./core-03-s1-approval-contracts.md) · **Next →:** [core-03-s3-pending-park-resume - approval pending park resume implementation story](./core-03-s3-pending-park-resume.md)

<!-- /DOCS-NAV -->
