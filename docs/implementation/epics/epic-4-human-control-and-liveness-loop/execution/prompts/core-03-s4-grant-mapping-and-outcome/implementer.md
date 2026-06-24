# Implementer Prompt: core-03-s4-grant-mapping-and-outcome

## Assigned Routing

- Source story id: `core-03-s4-grant-mapping-and-outcome`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`.
- Model class: `strong-coder`.
- Effort: `high`.
- Suggested-tier floor: `elevated`.
- Reasoning tier: `elevated`.
- Routing rationale: core-03-s4-grant-mapping-and-outcome covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` and carries Agent provider-port handoff behavior for grant mapping, approval answer delivery, and outcome durability without concrete provider protocol coupling. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Exact Task

Implement source story `core-03-s4-grant-mapping-and-outcome` for epic `epic-4-human-control-and-liveness-loop`. Deliver exactly the outcome in the ready source contract and nothing outside it:

Map approved policy-level grants to Agent `ScopedGrant`, answer or deny through the Agent approval
relay, and record final approval outcome facts without embedding provider-specific protocol behavior.

Source story: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s4-grant-mapping-and-outcome.md`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`.

## Why It Matters

- Covers signals: policy-level grant mapping; relay/channel/mapping/outcome failure behavior; neutral
  record behavior part.
- Depends on: `core-03-s1`, `core-03-s2`, `core-03-s3`, and `core-04-s3` for serialized
  `packages/sdk/src/index.ts` export wiring only.
- Decision inputs consumed: original `ApprovalRequest` command/host/file/session evidence,
  `PolicyGrantPlan`, committed `ApprovalDecisionRecorded` event id, Agent relay/channel capability
  attestations, Agent answer result.

DAG dependents for this story: none. Preserve the producer/consumer shape boundaries named in the source DAG and story contract so later stories can consume committed dependency inputs without redeclaring or widening this story's scope.

## Required Reading

- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s4-grant-mapping-and-outcome.md` - ready source story contract for `core-03-s4-grant-mapping-and-outcome`.
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md` - frozen DAG row, dependencies, owned pathset, wave, shared shapes, and suggested-tier floor for `core-03-s4-grant-mapping-and-outcome`.
- `docs/design/30-domain-reference/core/approval-and-escalation/decision-model.md` - normative design named by the source contract.
- `docs/design/30-domain-reference/core/approval-and-escalation/park-resume-and-failures.md` - normative design named by the source contract.
- `docs/design/30-domain-reference/core/approval-and-escalation/interfaces-events-and-tests.md` - normative design named by the source contract.
- `{{DEPENDENCY_COMMITS}}` - runtime slot for committed dependency story inputs before implementation starts.
- `AGENTS.md` and `CLAUDE.md` - repo branch, worktree, mutation, and verification rules.

## Acceptance Criteria

Source story: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s4-grant-mapping-and-outcome.md`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`.

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

### Failure And Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `approval-grant-mapping-invalid` | missing evidence or unsupported/widening mapping | block; do not call Agent | AC-1, AC-2, AC-4 |
| `approval-relay-missing` | relay absent/stale/negative/wrong scope | no answer; block | AC-6 |
| `approval-answer-channel-lost` | channel unavailable | no successful answer | AC-6 |
| `approval-outcome-ambiguous` | Agent result missing/contradictory | failed outcome unless later recovery retries | AC-6 |

## Allowed Writes

Source story: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s4-grant-mapping-and-outcome.md`. Owned pathset from the frozen DAG and source contract:

- `packages/sdk/src/core/approval/grants/**`
- `packages/sdk/src/core/approval/outcomes/**`
- `packages/sdk/src/index.ts`
- `packages/sdk/tests/core/approval/grants/**`
- `packages/sdk/tests/core/approval/outcomes/**`

Every other write is forbidden, including this execution package, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, commits, pushes, PRs, and merges.

## Dependency Inputs

Direct dependency story ids: `core-03-s1-approval-contracts`, `core-03-s2-risk-and-decision`,
`core-03-s3-pending-park-resume`, `core-04-s3-timers-and-wait`.

Dependency commit inputs are supplied at execution time through `{{DEPENDENCY_COMMITS}}`. Use the
committed `core-04-s3-timers-and-wait` input only as the baseline for `packages/sdk/src/index.ts`; do
not import supervision timer/wait shapes or treat the serialization edge as an approval grant/outcome
dependency. Use only producer-owned shared shapes, public import paths, committed events/projections,
provider-port inputs, and frozen cross-epic facts named by
`docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md` or
`docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s4-grant-mapping-and-outcome.md`.
Do not redeclare producer shapes or consume a dependency before its tracker row is `done`.

## Non-Goals And STOP Conditions

### Source Out Of Scope

- Deciding whether a grant is allowed (`core-03-s2`).
- Deciding whether a request can resume (`core-03-s3`).
- Concrete Codex approval enums or driver mapping (Epic 6).

### Source Boundaries And STOP Conditions

- Package/module boundary: `packages/sdk/src/core/approval/grants/**`,
  `packages/sdk/src/core/approval/outcomes/**`, with SDK public-entrypoint export wiring in
  `packages/sdk/src/index.ts`.
- Owned pathset: `packages/sdk/src/core/approval/grants/**`,
  `packages/sdk/src/core/approval/outcomes/**`, `packages/sdk/src/index.ts`,
  `packages/sdk/tests/core/approval/grants/**`, `packages/sdk/tests/core/approval/outcomes/**`.
- Forbidden dependencies: concrete Agent driver behavior, Codex enums, recovery action selection.
- STOP when a policy scope cannot map to Agent `ScopedGrant` without widening or inventing a grant kind.

Also stop and report if dependency inputs are missing, required writes fall outside the allowed pathset, a source gap blocks implementation, or any AC would need reinterpretation.

## Implementation Constraints

### Source Responsibilities

- Map policy scopes to exact Agent grant kinds and scopes with required evidence.
- Reject unmapped or widening mappings, including unsupported Agent grant kinds named by design.
- Answer grant or denial through the Agent approval relay using committed decision event id.
- Record `ApprovalOutcomeRecorded` for answered, denied, expired, blocked, or failed outcomes.

### Source Spec Surface

- Functions exposed: `mapPolicyGrantToScopedGrant`, `answerApprovalDecision`,
  `recordApprovalOutcome`.
- Shapes consumed: `core-03-s1/PolicyGrantPlan`, `Decision`, `Outcome`,
  `ApprovalOutcomeRecordedPayload`, `ApprovalFailureState`; Epic 2 Agent `ScopedGrant`,
  `ApprovalAnswer`, `ApprovalAnswerChannel`.
- Failure tokens raised: `approval-grant-mapping-invalid`, `approval-relay-missing`,
  `approval-answer-channel-lost`, `approval-outcome-ambiguous`.

### Normative Design Constraints

- `decision-model.md` mapping table from `PolicyGrantScope` / denial disposition to Agent
  `ScopedGrant.kind` and `ScopedGrant.scope`.
- `park-resume-and-failures.md` answer/resume states and failure tokens.
- `interfaces-events-and-tests.md` `recordOutcome`, `ApprovalOutcomeRecordedPayload`, and Agent
  consumed interfaces.

Do not introduce implementation choices outside the names, events, failure tokens, determinism rules, boundary rules, import rules, conformance obligations, and safety invariants fixed above.

## Verification

- Coverage scope and threshold: 95% branch coverage for `packages/sdk/src/core/approval/grants/**` and
  `packages/sdk/src/core/approval/outcomes/**`.
- Coverage command and lanes: `pnpm test:unit -- --coverage --coverage.include='packages/sdk/src/core/approval/{grants,outcomes}/**'`.
- Required tests: AC-1..AC-7 and failure rows.
- Public exposure: `sdk` import test for grant mapping, answer, and outcome functions.
- Determinism constraints: mapping is pure; Agent answer receives injected provider only.
- Dependency boundaries: SDK Agent port only; no concrete Codex driver, process, or network.
- File-size budget: 260 lines per implementation file, 320 lines per test file.

- Tests and fixtures named in ACs.
- Negative fixtures for unsupported grants, missing evidence, missing relay, lost channel, ambiguous
  outcome.
- `pnpm check` after implementation.
- Boundary sweep: `rg -n "provider-codex|provider-local|Codex|child_process|fetch\\(" packages/sdk/src/core/approval/grants packages/sdk/src/core/approval/outcomes` returns zero matches.

Require exact command output or an explicit blocked reason for every targeted command, required sweep, evidence-pack item, and `pnpm check`.

## Delivery Report

Report:

- changed files;
- AC coverage by `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`;
- tests and checks run;
- evidence pack;
- open questions;
- blockers.

The report is evidence for later review. It is not permission to update tracker state or perform delivery actions.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Reviewer Prompt: core-03-s3-pending-park-resume](../core-03-s3-pending-park-resume/reviewer.md) · **Next →:** [Reviewer Prompt: core-03-s4-grant-mapping-and-outcome](./reviewer.md)

<!-- /DOCS-NAV -->
