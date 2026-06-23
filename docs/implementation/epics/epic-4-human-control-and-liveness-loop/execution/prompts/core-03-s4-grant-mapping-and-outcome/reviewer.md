# Reviewer Prompt: core-03-s4-grant-mapping-and-outcome

## Assigned Routing

- Source story id: `core-03-s4-grant-mapping-and-outcome`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `elevated`.
- Reasoning tier: `elevated`.
- Routing rationale: core-03-s4-grant-mapping-and-outcome covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` and carries Agent provider-port handoff behavior for grant mapping, approval answer delivery, and outcome durability without concrete provider protocol coupling. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Original Scope

- Story id: `core-03-s4-grant-mapping-and-outcome`.
- Epic slug: `epic-4-human-control-and-liveness-loop`.
- Source story contract path: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s4-grant-mapping-and-outcome.md`.
- Allowed pathset: `packages/sdk/src/core/approval/grants/**`, `packages/sdk/src/core/approval/outcomes/**`, `packages/sdk/tests/core/approval/grants/**`, `packages/sdk/tests/core/approval/outcomes/**`.
- Direct dependencies: `core-03-s1-approval-contracts`, `core-03-s2-risk-and-decision`, `core-03-s3-pending-park-resume`.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus committed producer shapes, public import paths, event/projection inputs, and provider-port facts named in the source contract and DAG.

### Acceptance Criteria

Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`.

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

### Dependencies And Frozen Inputs

- Covers signals: policy-level grant mapping; relay/channel/mapping/outcome failure behavior; neutral
  record behavior part.
- Depends on: `core-03-s1`, `core-03-s2`, `core-03-s3`.
- Decision inputs consumed: original `ApprovalRequest` command/host/file/session evidence,
  `PolicyGrantPlan`, committed `ApprovalDecisionRecorded` event id, Agent relay/channel capability
  attestations, Agent answer result.

### Non-Goals

- Deciding whether a grant is allowed (`core-03-s2`).
- Deciding whether a request can resume (`core-03-s3`).
- Concrete Codex approval enums or driver mapping (Epic 6).

### STOP Conditions And Boundaries

- Package/module boundary: `packages/sdk/src/core/approval/grants/**`,
  `packages/sdk/src/core/approval/outcomes/**`.
- Owned pathset: those source/test folders.
- Forbidden dependencies: concrete Agent driver behavior, Codex enums, recovery action selection.
- STOP when a policy scope cannot map to Agent `ScopedGrant` without widening or inventing a grant kind.

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check implementation against source story `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s4-grant-mapping-and-outcome.md` and AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`.

- AC coverage by source `AC-n` id, including every failure, degraded, validation, and negative-fixture row named by the source contract.
- Evidence pack completeness against the source `Quality bar` and `Evidence pack` sections.
- Public API names, exports, and import paths against the source contract and DAG producer/consumer table.
- Dependency boundaries, committed dependency inputs, and `{{DEPENDENCY_COMMITS}}` consistency.
- Stale names and sibling occurrences of any issue found.
- Tests, targeted checks, coverage commands, forbidden-symbol sweeps, and `pnpm check` output.
- Scope control against allowed writes: `packages/sdk/src/core/approval/grants/**`, `packages/sdk/src/core/approval/outcomes/**`, `packages/sdk/tests/core/approval/grants/**`, `packages/sdk/tests/core/approval/outcomes/**`.
- Repo conventions and mutation limits from `AGENTS.md` and the source contract.

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Implementer Prompt: core-03-s4-grant-mapping-and-outcome](./implementer.md) · **Next →:** [Implementer Prompt: core-04-s1-supervision-contracts](../core-04-s1-supervision-contracts/implementer.md)

<!-- /DOCS-NAV -->
