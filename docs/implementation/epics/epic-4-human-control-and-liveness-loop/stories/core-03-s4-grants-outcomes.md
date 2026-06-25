---
title: "core-03-s4-grants-outcomes - approval grants outcomes implementation story"
id: "core-03-s4-grants-outcomes"
epic: 4
status: "story: ready"
design:
  - "docs/design/30-domain-reference/core/approval-and-escalation/decision-model.md"
  - "docs/design/30-domain-reference/core/approval-and-escalation/park-resume-and-failures.md"
  - "docs/design/30-domain-reference/core/approval-and-escalation/interfaces-events-and-tests.md"
---

# core-03-s4-grants-outcomes - Grants and Outcomes

## Purpose

Map policy-level approval grants to Agent `ScopedGrant`, answer or deny through the Agent relay, and
record final approval outcomes without concrete provider behavior.

## Spec Surface

- Functions: `mapPolicyGrantToScopedGrant`, `answerApprovalDecision`, `recordApprovalOutcome`.
- Consumed shapes: `ApprovalRequest`, `PolicyGrantPlan`, `Decision`, `Outcome`,
  `ApprovalOutcomeRecordedPayload`, `ApprovalFailureState`, Epic 2 `ScopedGrant`, `ApprovalAnswer`,
  and `ApprovalAnswerChannel`.
- Runtime objects: Agent approval relay, Epic 3 `RunWriter`.

## Responsibilities

- Map `per-command`, `per-command-prefix`, `per-host`, and `session` to the exact Agent grant kinds and
  scopes only when required evidence exists.
- Reject unsupported, widening, or evidence-missing mappings before any Agent call.
- Include the committed decision event id when answering the Agent.
- Append `ApprovalOutcomeRecorded` for answered, denied, parked/resumed finalization, expired, blocked,
  or failed outcomes.

## Dependencies and Inputs

- Covers signals: policy-to-Agent scoped grant mapping, relay/channel/mapping/outcome failure behavior,
  and neutral records behavior part.
- Depends on: `core-03-s1-approval-contracts`, `core-03-s2-normalize-risk-decision`,
  `core-03-s3-pending-park-resume`.
- Frozen inputs: Epic 2 Agent provider port and attestations; injected SDK `IdGenerator`; Epic 3 writer.

## Acceptance Criteria

- **AC-1** `per-command` maps only to `ScopedGrant.kind = "command-once"` and `scope = "request"` with
  exact command evidence - evidence: `grant-map-command.unit.test.ts` asserts exact fields and
  `missing-command.fixture.ts` returns `approval-grant-mapping-invalid`.
- **AC-2** `per-command-prefix`, `per-host`, and `session` map to the exact design grant kinds/scopes
  only with required prefix, exact host, session id, bounded file paths, and human approval when session
  scoped - evidence: `grant-map-scopes.unit.test.ts` asserts positive fixtures and missing-evidence
  fixtures.
- **AC-3** Deny dispositions map to `deny-continue`, `deny-interrupt`, or `deny-park` with
  `scope = "request"` and denial reason content - evidence: `grant-map-deny.unit.test.ts` asserts each
  exact kind and content.
- **AC-4** Unsupported Agent grant kinds named by design (`filesystem-permission`, `file-change-once`,
  `mcp-elicitation-content`, `tool-user-input-content`), missing required command/host/session/file
  evidence, or any widening mapping return `approval-grant-mapping-invalid` and do not call Agent -
  evidence: `grant-map-invalid.unit.test.ts` asserts all invalid fixtures and zero relay calls.
- **AC-5** `answerApprovalDecision` consumes the committed `ApprovalDecisionRecorded` event id produced
  by `core-03-s2`, passes `Decision.grant` unchanged as `ApprovalAnswer.grant`, and ensures
  policy-level scope strings never cross the Agent boundary - evidence: `answer-approval.unit.test.ts`
  spies on mock Agent input and asserts deep equality.
- **AC-6** Missing relay, lost answer channel, or ambiguous Agent answer result records no successful
  answer and returns `approval-relay-missing`, `approval-answer-channel-lost`, or
  `approval-outcome-ambiguous` - evidence: `answer-fail-closed.unit.test.ts` asserts exact tokens.
- **AC-7** `recordApprovalOutcome` appends `ApprovalOutcomeRecordedPayload` at `barrier`, with
  `Outcome.schema = "kit-vnext.approval-outcome.v1"`, `Outcome.outcomeId` minted from the injected
  `IdGenerator`, and source event ids preserved - evidence: `record-outcome.unit.test.ts` asserts
  durability, schema, id source, and projection fold visibility.
- **AC-8** The public SDK entrypoint exports `mapPolicyGrantToScopedGrant`,
  `answerApprovalDecision`, and `recordApprovalOutcome` - evidence:
  `approval-grants-public-import.unit.test.ts` imports the functions from `sdk` and constructs one grant
  mapping and outcome fixture without private paths.

## Predicate and Producer Closure

| AC / output | Decision value or produced field | Source |
|---|---|---|
| AC-1..AC-4 | mapping validity | `ApprovalRequest` evidence plus `PolicyGrantPlan.scope` |
| AC-5 | Agent answer grant | mapped `ScopedGrant` and committed `ApprovalDecisionRecorded` event id from `core-03-s2` |
| AC-6 | relay/channel failure | Agent attestations, channel refs, answer result |
| AC-7 | outcome append | `Outcome`, injected `IdGenerator` for `outcomeId`, `sourceEventIds`, and `RunWriter.append` result |
| AC-8 | public symbols | owned source files aggregated by the SDK public-entrypoint owner |
| `Outcome.recordedAt` | explicit caller timestamp | injected input, not ambient clock |

## Failure and Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `approval-grant-mapping-invalid` | unsupported, widening, or missing-evidence mapping | block; no Agent call | AC-4 |
| `approval-relay-missing` | relay absent/stale/negative/wrong scope | no answer; block | AC-6 |
| `approval-answer-channel-lost` | answer channel unavailable | no answered outcome | AC-6 |
| `approval-outcome-ambiguous` | Agent result missing or contradictory | failed outcome unless later recovery retries | AC-6 |

## Quality Bar

- Coverage: 95% branch coverage for grants/outcomes modules.
- Gate lane: `pnpm check`.
- Public exposure: AC-8.
- Shared entrypoint ownership: `packages/sdk/src/index.ts` belongs to the export-aggregation owner named
  by `docs/design/20-sdk-and-packaging/sdk-boundary.md`.
- Boundary sweep:
  `rg -n "provider-codex|provider-local|Codex|child_process|fetch\\(" packages/sdk/src/core/approval/grants packages/sdk/src/core/approval/outcomes`
  returns zero matches.
- File-size budget: 280 lines per implementation file, 360 lines per test file.

## STOP Conditions

Stop if a policy scope cannot map to Agent `ScopedGrant` without widening, if concrete Codex enums are
needed, or if retry/recovery selection is required.

## Characterization Review

### Decision: policy-plan-to-agent-grant-boundary

- Rationale: policy grant planning and Agent grant transmission are distinct shapes; the Agent receives
  only `ScopedGrant`.
- Design trace: `decision-model.md` mapping table from policy scope or deny disposition to Agent
  `ScopedGrant`.
- Falsification: `PolicyGrantScope` values cross the Agent boundary or an unsupported grant kind is sent.
- Escalation: block as story defect; concrete driver mapping remains Epic 6.

### Decision: outcomes-are-durable-facts

- Rationale: completion/recovery/operator surfaces consume outcomes from the event log, not relay prose.
- Design trace: `interfaces-events-and-tests.md` `ApprovalOutcomeRecordedPayload`.
- Falsification: answer success is returned without `ApprovalOutcomeRecorded`.
- Escalation: return to this story; do not move outcome recording to Epic 5.

- Verdict: ready; each mapping and failure row is testable from declared inputs.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - stories](./README.md) · **← Prev:** [core-03-s3-pending-park-resume - approval pending park resume implementation story](./core-03-s3-pending-park-resume.md) · **Next →:** [core-04-s1-supervision-contracts - supervision contracts implementation story](./core-04-s1-supervision-contracts.md)

<!-- /DOCS-NAV -->
