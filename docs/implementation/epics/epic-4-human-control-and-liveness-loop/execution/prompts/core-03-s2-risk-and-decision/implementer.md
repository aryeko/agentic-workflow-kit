# Implementer Prompt: core-03-s2-risk-and-decision

## Assigned Routing

- Source story id: `core-03-s2-risk-and-decision`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.
- Model class: `strong-coder`.
- Effort: `high`.
- Suggested-tier floor: `elevated`.
- Reasoning tier: `elevated`.
- Routing rationale: core-03-s2-risk-and-decision covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8` and carries approval safety boundary over deterministic risk classification, committed capability-gate evidence, and fail-closed decision behavior. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Exact Task

Implement source story `core-03-s2-risk-and-decision` for epic `epic-4-human-control-and-liveness-loop`. Deliver exactly the outcome in the ready source contract and nothing outside it:

Implement approval normalization, deterministic risk classification, and the v1 mode ladder as pure
decisions over recorded request evidence, resolved policy, replay/projection values, and committed gate
records.

Source story: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s2-risk-and-decision.md`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.

## Why It Matters

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

DAG dependents for this story: `core-03-s3-pending-park-resume`, `core-03-s4-grant-mapping-and-outcome`. Preserve the producer/consumer shape boundaries named in the source DAG and story contract so later stories can consume committed dependency inputs without redeclaring or widening this story's scope.

## Required Reading

- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s2-risk-and-decision.md` - ready source story contract for `core-03-s2-risk-and-decision`.
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md` - frozen DAG row, dependencies, owned pathset, wave, shared shapes, and suggested-tier floor for `core-03-s2-risk-and-decision`.
- `docs/design/30-domain-reference/core/approval-and-escalation/README.md` - normative design named by the source contract.
- `docs/design/30-domain-reference/core/approval-and-escalation/decision-model.md` - normative design named by the source contract.
- `docs/design/30-domain-reference/core/approval-and-escalation/interfaces-events-and-tests.md` - normative design named by the source contract.
- `{{DEPENDENCY_COMMITS}}` - runtime slot for committed dependency story inputs before implementation starts.
- `AGENTS.md` and `CLAUDE.md` - repo branch, worktree, mutation, and verification rules.

## Acceptance Criteria

Source story: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s2-risk-and-decision.md`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.

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

## Allowed Writes

Source story: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s2-risk-and-decision.md`. Owned pathset from the frozen DAG and source contract:

- `packages/sdk/src/core/approval/decision/**`
- `packages/sdk/tests/core/approval/decision/**`

Every other write is forbidden, including this execution package, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, commits, pushes, PRs, and merges.

## Dependency Inputs

Direct dependency story ids: `core-03-s1-approval-contracts`.

Dependency commit inputs are supplied at execution time through `{{DEPENDENCY_COMMITS}}`. Use only producer-owned shared shapes, public import paths, committed events/projections, provider-port inputs, and frozen cross-epic facts named by `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md` or `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s2-risk-and-decision.md`. Do not redeclare producer shapes or consume a dependency before its tracker row is `done`.

## Non-Goals And STOP Conditions

### Source Out Of Scope

- Appending request/pending/decision events (`core-03-s3`).
- Mapping `PolicyGrantPlan` to Agent grants or answering Agent (`core-03-s4`).
- Operator UI or human decision capture (Epic 7, with recorded operator event consumed here).

### Source Boundaries And STOP Conditions

- Package/module boundary: `packages/sdk/src/core/approval/decision/**`.
- Owned pathset: `packages/sdk/src/core/approval/decision/**`, `packages/sdk/tests/core/approval/decision/**`.
- Forbidden dependencies: concrete provider packages, process/network APIs, Operator UI.
- STOP when a branch needs a policy value not exposed by Epic 1 policy contracts or a session value not
  exposed by Epic 3 linkage contracts.

Also stop and report if dependency inputs are missing, required writes fall outside the allowed pathset, a source gap blocks implementation, or any AC would need reinterpretation.

## Implementation Constraints

### Source Responsibilities

- Normalize `AgentApprovalRequest` plus `ApprovalContext` into `ApprovalRequest`.
- Classify low/medium/high risk in stable high, medium, low order.
- Apply manual/assisted ladder, policy allowlist, high-risk human requirement, deferred
  `orchestrator-decide`, and committed `escalation-auto-grant` evidence.
- Select the tightest policy-level `PolicyGrantPlan` without mapping to Agent `ScopedGrant`.

### Source Spec Surface

- Interfaces / types consumed: `core-03-s1/ApprovalRequest`, `ApprovalContext`,
  `ApprovalDecisionInput`, `ApprovalRisk`, `Decision`, `ApprovalFailureState`.
- Functions exposed: `normalizeApprovalRequest`, `classifyApprovalRisk`, `decideApproval`.
- Events / append intents: returns payload-ready values; does not append.
- Failure tokens raised: `approval-policy-unavailable`, `approval-risk-high`,
  `approval-gate-denied`, `approval-gate-unwritable`, `approval-session-ambiguous`,
  `approval-relay-missing`.

### Normative Design Constraints

- `README.md` core decisions: request persisted before classification, high risk always human,
  manual/assisted only, assisted grant only after committed `escalation-auto-grant`.
- `decision-model.md` risk rules, mode ladder, tightest grant taxonomy, and Agent grant mapping
  prerequisites.
- `interfaces-events-and-tests.md` `ApprovalEscalation.normalize`, `classify`, and `decide` inputs.

Do not introduce implementation choices outside the names, events, failure tokens, determinism rules, boundary rules, import rules, conformance obligations, and safety invariants fixed above.

## Verification

- Coverage scope and threshold: 95% branch coverage for `packages/sdk/src/core/approval/decision/**`.
- Coverage command and lanes: `pnpm test:unit -- --coverage --coverage.include='packages/sdk/src/core/approval/decision/**'`.
- Required tests: AC-1..AC-8 and failure rows.
- Public exposure: `sdk` entrypoint import test for `normalizeApprovalRequest`, `classifyApprovalRisk`,
  and `decideApproval`.
- Determinism constraints: no ambient time/randomness/process/network; `evaluatedAt` is input data.
- Dependency boundaries: consume SDK contracts only; no concrete Agent driver or `testkit` in source.
- File-size budget: 260 lines per implementation file, 320 lines per test file.

- Unit tests and fixtures named in ACs.
- Negative fixtures for high-risk branches, unavailable policy, gate-denied/gate-append-unwritable,
  and scope widening.
- `pnpm check` after implementation.
- Boundary sweep: `rg -n "provider-codex|provider-local|testkit|child_process|Date\\.now|new Date|Math\\.random" packages/sdk/src/core/approval/decision packages/sdk/tests/core/approval/decision` returns zero source matches.

Require exact command output or an explicit blocked reason for every targeted command, required sweep, evidence-pack item, and `pnpm check`.

## Delivery Report

Report:

- changed files;
- AC coverage by `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`;
- tests and checks run;
- evidence pack;
- open questions;
- blockers.

The report is evidence for later review. It is not permission to update tracker state or perform delivery actions.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Reviewer Prompt: core-03-s1-approval-contracts](../core-03-s1-approval-contracts/reviewer.md) · **Next →:** [Reviewer Prompt: core-03-s2-risk-and-decision](./reviewer.md)

<!-- /DOCS-NAV -->
