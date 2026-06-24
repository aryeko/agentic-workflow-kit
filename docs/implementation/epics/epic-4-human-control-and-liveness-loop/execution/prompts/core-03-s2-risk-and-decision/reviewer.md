# Reviewer Prompt: core-03-s2-risk-and-decision

## Assigned Routing

- Source story id: `core-03-s2-risk-and-decision`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `elevated`.
- Reasoning tier: `elevated`.
- Routing rationale: core-03-s2-risk-and-decision covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8` and carries approval safety boundary over deterministic risk classification, committed capability-gate evidence, and fail-closed decision behavior. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Original Scope

- Story id: `core-03-s2-risk-and-decision`.
- Epic slug: `epic-4-human-control-and-liveness-loop`.
- Source story contract path: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s2-risk-and-decision.md`.
- Allowed pathset: `packages/sdk/src/core/approval/decision/**`, `packages/sdk/src/index.ts`, `packages/sdk/tests/core/approval/decision/**`.
- Direct dependencies: `core-03-s1-approval-contracts`, `core-04-s1-supervision-contracts`.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus committed producer shapes, public import paths, event/projection inputs, and provider-port facts named in the source contract and DAG. The `core-04-s1-supervision-contracts` dependency is only the committed baseline for serialized `packages/sdk/src/index.ts` export wiring; it is not approval shape input.

### Acceptance Criteria

Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.

- **AC-1** `normalizeApprovalRequest(input, context)` returns `ApprovalRequest.schema =
  "kit-vnext.approval-request.v1"` and copies `runId`, `taskId`, `operationId`, `sessionId`,
  `policyRef`, and `agentRequestEventId` from `ApprovalContext` exactly - evidence:
  `normalize-approval-request.unit.test.ts` asserts those six equalities on fixture
  `agent-command-request.fixture.ts`.
- **AC-2** Risk classification evaluates high before medium before low, and high-risk fixtures for
  session scope, missing command on command subject, shell control flow, wildcard/private host, absolute
  file path outside workspace, ambiguous session linkage, and self-report-only evidence each return
  `ApprovalRisk = "high"` - evidence: `classify-risk-high.unit.test.ts` asserts each named fixture
  returns `"high"` and includes the triggering rule id.
- **AC-3** Low risk is returned only for command requests with exact command, workspace cwd, no high
  pattern, policy grant-rule prefix match, bounded requested scope, fresh positive `canRelayApproval`,
  required `canPersistApprovalAnswerChannel` when parking is possible, and current session linkage -
  evidence: `classify-risk-low.unit.test.ts` asserts `low-command-allowlisted.fixture.ts` returns
  `"low"` and `low-missing-persistable-channel.fixture.ts` returns `"medium"`.
- **AC-4** Manual mode always returns `Decision.decision = "human-required"` even for low-risk
  allowlisted requests; high risk always returns `human-required` in assisted mode - evidence:
  `mode-ladder-human-required.unit.test.ts` asserts both exact decision values and
  `decidedBy === "system"`.
- **AC-5** Assisted low-risk allowlisted requests produce a grant decision only when a committed
  `CapabilityGateRecord` for `escalation-auto-grant` exists with allow decision and matching request
  scope; committed deny records return `approval-gate-denied`, and an explicit Epic 3 `core-02-s3`
  `gate-record-unwritable` result returns `approval-gate-unwritable` - evidence:
  `assisted-gate-record.unit.test.ts` asserts fixture `committed-gate-allow.fixture.ts` returns
  `decision === "grant"`, while `gate-denied.fixture.ts` and
  `gate-append-unwritable-result.fixture.ts` set the exact failure states.
- **AC-6** Tightest policy-level grant selection chooses the first satisfiable scope in order
  `per-command`, `per-command-prefix`, `per-host`, `session`, never broader than request or policy -
  evidence: `policy-grant-plan.unit.test.ts` asserts a fixture with both command and session options
  returns `policyGrantPlan.scope === "per-command"`, and `scope-widening.fixture.ts` returns
  `Decision.decision === "deny"`.
- **AC-7** `orchestrator-decide` is never allowed in v1 and records a deny reason tied to
  `capability-deferred`, not LLM replay logic - evidence: `orchestrator-decide-deferred.unit.test.ts`
  asserts `decision === "deny"` and `reason` contains `capability-deferred`.
- **AC-8** The module is pure: identical `ApprovalDecisionInput`, replay, and projections produce
  deep-equal `Decision` values, and no ambient clock/process/network APIs are called - evidence:
  `approval-decision-purity.unit.test.ts` calls the function twice and the unit lane guard reports no
  forbidden API access.

### Failure And Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `approval-policy-unavailable` | missing resolved policy/provenance before classification | block before risk or decision | AC-2 negative fixture variant |
| `approval-risk-high` | high-risk rule fires in assisted path | require human; no auto grant | AC-4 |
| `approval-gate-denied` | committed gate denies | require human or deny per policy | AC-5 |
| `approval-gate-unwritable` | Epic 3 `core-02-s3` returned explicit `gate-record-unwritable` while trying to durably append the gate record | no autonomous grant; blocked if no human path | AC-5 |
| `approval-session-ambiguous` | linkage resolver/raw events cannot prove current session | block decision | AC-2 |
| `approval-relay-missing` | fresh positive Agent relay attestation absent | no low-risk auto grant | AC-3 |

### Dependencies And Frozen Inputs

- Covers signals: risk classification; v1 mode ladder; policy/risk/gate failure behavior.
- Depends on: `core-03-s1-approval-contracts`.
- Cross-epic frozen inputs: Epic 1 `ResolvedPolicy.policy.approval` and
  `ResolvedPolicy.policy.escalationPolicy`; Epic 3 committed `CapabilityGateRecord`; Epic 3
  `core-02-s3` gate-record durability result for append-failure evidence; Epic 3
  `RunReplay`/`RunProjections`; Epic 2 Agent attestations.
- Decision inputs consumed: request fields `subject`, `command`, `cwd`, `host`, `filePaths`,
  `requestedScope`, `answerChannelPersistable`, `requestedAt`, `expiresAt`, `policyRef`;
  resolved policy fields `approval.mode`, `approval.decisionWindowMs`, `escalationPolicy`; replayed
  `CapabilityGateRecord` event ids or explicit `core-02-s3` `gate-record-unwritable` result; current
  non-ambiguous session linkage from core-01 resolver or raw linkage history.

### Non-Goals

- Appending request/pending/decision events (`core-03-s3`).
- Mapping `PolicyGrantPlan` to Agent grants or answering Agent (`core-03-s4`).
- Operator UI or human decision capture (Epic 7, with recorded operator event consumed here).

### STOP Conditions And Boundaries

- Package/module boundary: `packages/sdk/src/core/approval/decision/**`, with SDK public-entrypoint
  export wiring in `packages/sdk/src/index.ts`.
- Owned pathset: `packages/sdk/src/core/approval/decision/**`, `packages/sdk/src/index.ts`,
  `packages/sdk/tests/core/approval/decision/**`.
- Forbidden dependencies: concrete provider packages, process/network APIs, Operator UI.
- STOP when a branch needs a policy value not exposed by Epic 1 policy contracts or a session value not
  exposed by Epic 3 linkage contracts.

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check implementation against source story `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s2-risk-and-decision.md` and AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.

- AC coverage by source `AC-n` id, including every failure, degraded, validation, and negative-fixture row named by the source contract.
- Evidence pack completeness against the source `Quality bar` and `Evidence pack` sections.
- Public API names, exports, and import paths against the source contract and DAG producer/consumer table.
- Dependency boundaries, committed dependency inputs, and `{{DEPENDENCY_COMMITS}}` consistency.
- Stale names and sibling occurrences of any issue found.
- Tests, targeted checks, coverage commands, forbidden-symbol sweeps, and `pnpm check` output.
- Scope control against allowed writes: `packages/sdk/src/core/approval/decision/**`, `packages/sdk/src/index.ts`, `packages/sdk/tests/core/approval/decision/**`.
- Repo conventions and mutation limits from `AGENTS.md` and the source contract.

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Implementer Prompt: core-03-s2-risk-and-decision](./implementer.md) · **Next →:** [Implementer Prompt: core-03-s3-pending-park-resume](../core-03-s3-pending-park-resume/implementer.md)

<!-- /DOCS-NAV -->
