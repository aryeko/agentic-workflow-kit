---
title: "core-03-s4-grant-mapping-and-outcome - approval grant mapping and outcome implementation story"
id: "core-03-s4-grant-mapping-and-outcome"
epic: 4
status: "story: ready"
design:
  - "docs/design/30-domain-reference/core/approval-and-escalation/decision-model.md"
  - "docs/design/30-domain-reference/core/approval-and-escalation/park-resume-and-failures.md"
  - "docs/design/30-domain-reference/core/approval-and-escalation/interfaces-events-and-tests.md"
---

# core-03-s4-grant-mapping-and-outcome - Grant Mapping and Outcome

## Purpose

Map approved policy-level grants to Agent `ScopedGrant`, answer or deny through the Agent approval
relay, and record final approval outcome facts without embedding provider-specific protocol behavior.

## Normative design

- `decision-model.md` mapping table from `PolicyGrantScope` / denial disposition to Agent
  `ScopedGrant.kind` and `ScopedGrant.scope`.
- `park-resume-and-failures.md` answer/resume states and failure tokens.
- `interfaces-events-and-tests.md` `recordOutcome`, `ApprovalOutcomeRecordedPayload`, and Agent
  consumed interfaces.

## Spec surface

- Functions exposed: `mapPolicyGrantToScopedGrant`, `answerApprovalDecision`,
  `recordApprovalOutcome`.
- Shapes consumed: `core-03-s1/PolicyGrantPlan`, `Decision`, `Outcome`,
  `ApprovalOutcomeRecordedPayload`, `ApprovalFailureState`; Epic 2 Agent `ScopedGrant`,
  `ApprovalAnswer`, `ApprovalAnswerChannel`.
- Failure tokens raised: `approval-grant-mapping-invalid`, `approval-relay-missing`,
  `approval-answer-channel-lost`, `approval-outcome-ambiguous`.

## Responsibilities

- Map policy scopes to exact Agent grant kinds and scopes with required evidence.
- Reject unmapped or widening mappings, including unsupported Agent grant kinds named by design.
- Answer grant or denial through the Agent approval relay using committed decision event id.
- Record `ApprovalOutcomeRecorded` for answered, denied, expired, blocked, or failed outcomes.

## Out of scope

- Deciding whether a grant is allowed (`core-03-s2`).
- Deciding whether a request can resume (`core-03-s3`).
- Concrete Codex approval enums or driver mapping (Epic 6).

## Dependencies and frozen inputs

- Covers signals: policy-level grant mapping; relay/channel/mapping/outcome failure behavior; neutral
  record behavior part.
- Depends on: `core-03-s1`, `core-03-s2`, `core-03-s3`.
- Decision inputs consumed: original `ApprovalRequest` command/host/file/session evidence,
  `PolicyGrantPlan`, committed `ApprovalDecisionRecorded` event id, Agent relay/channel capability
  attestations, Agent answer result.

## Acceptance criteria

- **AC-1** Policy scope `per-command` maps only to `ScopedGrant.kind = "command-once"` and
  `scope = "request"` with exact command evidence - evidence: `grant-map-command.unit.test.ts` asserts
  the two exact fields and `missing-command.fixture.ts` returns `approval-grant-mapping-invalid`.
- **AC-2** `per-command-prefix`, `per-host`, and `session` map to
  `command-policy-amendment`/`turn`, `network-permission`/`turn`, and
  `command-session` or `file-change-session`/`session` only when required prefix, exact host,
  session id, and bounded file-path evidence exists - evidence: `grant-map-scopes.unit.test.ts`
  asserts exact kind/scope pairs for all four positive fixtures and exact invalid failure for
  missing-host and unbounded-file fixtures.
- **AC-3** Deny dispositions map to `deny-continue`, `deny-interrupt`, or `deny-park` with
  `scope = "request"` and denial reason content - evidence: `grant-map-deny.unit.test.ts` asserts
  each exact kind and denial content from three fixtures.
- **AC-4** Unsupported or widening mappings, including `filesystem-permission`, `file-change-once`,
  `mcp-elicitation-content`, and `tool-user-input-content`, return blocked decision/outcome with
  `failureState = "approval-grant-mapping-invalid"` - evidence:
  `grant-map-invalid.unit.test.ts` asserts all four unsupported fixtures fail with the exact token.
- **AC-5** `answerApprovalDecision` calls only the Agent provider approval relay with
  `ApprovalAnswer.grant` equal to the mapped `ScopedGrant` and includes the committed decision event id;
  no policy-level grant values cross the Agent boundary - evidence: `answer-approval.unit.test.ts`
  spies on mock Agent provider input and asserts deep equality to mapped grant plus decision event id.
- **AC-6** Missing relay, lost answer channel, or ambiguous Agent answer result records no successful
  answer and returns the exact failure token `approval-relay-missing`,
  `approval-answer-channel-lost`, or `approval-outcome-ambiguous` - evidence:
  `answer-fail-closed.unit.test.ts` asserts those three exact tokens and no `answered` outcome.
- **AC-7** `recordApprovalOutcome` appends `ApprovalOutcomeRecordedPayload` at `barrier`, carries
  `Outcome.schema = "kit-vnext.approval-outcome.v1"`, and projection consumers can rebuild latest
  outcome from it - evidence: `record-outcome.unit.test.ts` asserts append durability, schema equality,
  and latest outcome id after fold.

## Coverage matrix

| Responsibility / spec-surface item | Proven by |
|---|---|
| Grant mapping | AC-1, AC-2, AC-3, AC-4 |
| Agent answer relay | AC-5, AC-6 |
| Outcome recording | AC-7 |
| Failure tokens | AC-1, AC-2, AC-4, AC-6 |

## Predicate-input matrix

| AC or failure row | Predicate / branch value | Declared source value | Producer / resolver | Verdict |
|---|---|---|---|---|
| AC-1..AC-4 | mapping validity | request command/host/session/file evidence, `PolicyGrantPlan.scope` | `core-03-s1`, `core-03-s2` | decidable |
| AC-5, AC-6 | relay/channel availability | Agent capability attestations, answer channel refs, Agent answer result | Epic 2 Agent port/mock | decidable |
| AC-7 | outcome append | `RunWriter` append result, `Outcome` | Epic 3 writer, `core-03-s1` | decidable |

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `approval-grant-mapping-invalid` | missing evidence or unsupported/widening mapping | block; do not call Agent | AC-1, AC-2, AC-4 |
| `approval-relay-missing` | relay absent/stale/negative/wrong scope | no answer; block | AC-6 |
| `approval-answer-channel-lost` | channel unavailable | no successful answer | AC-6 |
| `approval-outcome-ambiguous` | Agent result missing/contradictory | failed outcome unless later recovery retries | AC-6 |

## Quality bar

- Coverage scope and threshold: 95% branch coverage for `packages/sdk/src/core/approval/grants/**` and
  `packages/sdk/src/core/approval/outcomes/**`.
- Coverage command and lanes: `pnpm test:unit -- --coverage --coverage.include='packages/sdk/src/core/approval/{grants,outcomes}/**'`.
- Required tests: AC-1..AC-7 and failure rows.
- Public exposure: `sdk` import test for grant mapping, answer, and outcome functions.
- Determinism constraints: mapping is pure; Agent answer receives injected provider only.
- Dependency boundaries: SDK Agent port only; no concrete Codex driver, process, or network.
- File-size budget: 260 lines per implementation file, 320 lines per test file.

## Evidence pack

- Tests and fixtures named in ACs.
- Negative fixtures for unsupported grants, missing evidence, missing relay, lost channel, ambiguous
  outcome.
- `pnpm check` after implementation.
- Boundary sweep: `rg -n "provider-codex|provider-local|Codex|child_process|fetch\\(" packages/sdk/src/core/approval/grants packages/sdk/src/core/approval/outcomes` returns zero matches.

## Boundaries and STOP conditions

- Package/module boundary: `packages/sdk/src/core/approval/grants/**`,
  `packages/sdk/src/core/approval/outcomes/**`.
- Owned pathset: those source/test folders.
- Forbidden dependencies: concrete Agent driver behavior, Codex enums, recovery action selection.
- STOP when a policy scope cannot map to Agent `ScopedGrant` without widening or inventing a grant kind.

## Characterization review

- Scope decision: grant mapping is separate from risk decision and pending resume. Rationale: Agent
  boundary conversion has distinct failure tokens. Falsification: policy-level grant crosses Agent
  boundary. Escalation: story defect.
- Gate verdict: ready. Each mapping and failure row is directly testable from declared input values.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - stories](./README.md) · **← Prev:** [core-03-s3-pending-park-resume - approval pending park resume implementation story](./core-03-s3-pending-park-resume.md) · **Next →:** [core-04-s1-supervision-contracts - supervision contracts implementation story](./core-04-s1-supervision-contracts.md)

<!-- /DOCS-NAV -->
