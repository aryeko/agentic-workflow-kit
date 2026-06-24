---
title: "core-03-s2-risk-and-decision - approval risk and decision implementation story"
id: "core-03-s2-risk-and-decision"
epic: 4
status: "story: ready"
design:
  - "docs/design/30-domain-reference/core/approval-and-escalation/README.md"
  - "docs/design/30-domain-reference/core/approval-and-escalation/decision-model.md"
  - "docs/design/30-domain-reference/core/approval-and-escalation/interfaces-events-and-tests.md"
---

# core-03-s2-risk-and-decision - Risk and Decision

## Purpose

Implement approval normalization, deterministic risk classification, and the v1 mode ladder as pure
decisions over recorded request evidence, resolved policy, replay/projection values, and committed gate
records.

## Normative design

- `README.md` core decisions: request persisted before classification, high risk always human,
  manual/assisted only, assisted grant only after committed `escalation-auto-grant`.
- `decision-model.md` risk rules, mode ladder, tightest grant taxonomy, and Agent grant mapping
  prerequisites.
- `interfaces-events-and-tests.md` `ApprovalEscalation.normalize`, `classify`, and `decide` inputs.

## Spec surface

- Interfaces / types consumed: `core-03-s1/ApprovalRequest`, `ApprovalContext`,
  `ApprovalDecisionInput`, `ApprovalRisk`, `Decision`, `ApprovalFailureState`.
- Functions exposed: `normalizeApprovalRequest`, `classifyApprovalRisk`, `decideApproval`.
- Events / append intents: returns payload-ready values; does not append.
- Failure tokens raised: `approval-policy-unavailable`, `approval-risk-high`,
  `approval-gate-denied`, `approval-gate-unwritable`, `approval-session-ambiguous`,
  `approval-relay-missing`.

## Responsibilities

- Normalize `AgentApprovalRequest` plus `ApprovalContext` into `ApprovalRequest`.
- Classify low/medium/high risk in stable high, medium, low order.
- Apply manual/assisted ladder, policy allowlist, high-risk human requirement, deferred
  `orchestrator-decide`, and committed `escalation-auto-grant` evidence.
- Select the tightest policy-level `PolicyGrantPlan` without mapping to Agent `ScopedGrant`.

## Out of scope

- Appending request/pending/decision events (`core-03-s3`).
- Mapping `PolicyGrantPlan` to Agent grants or answering Agent (`core-03-s4`).
- Operator UI or human decision capture (Epic 7, with recorded operator event consumed here).

## Dependencies and frozen inputs

- Covers signals: risk classification; v1 mode ladder; policy/risk/gate failure behavior.
- Depends on: `core-03-s1-approval-contracts`; `core-04-s1-supervision-contracts` for serialized
  `packages/sdk/src/index.ts` export wiring only.
- Cross-epic frozen inputs: Epic 1 `ResolvedPolicy.policy.approval` and
  `ResolvedPolicy.policy.escalationPolicy`; Epic 3 committed `CapabilityGateRecord`; Epic 3
  `core-02-s3` gate-record durability result for append-failure evidence; Epic 3
  `RunReplay`/`RunProjections`; Epic 2 Agent attestations.
- Decision inputs consumed: request fields `subject`, `command`, `cwd`, `host`, `filePaths`,
  `requestedScope`, `answerChannelPersistable`, `requestedAt`, `expiresAt`, `policyRef`;
  resolved policy fields `approval.mode`, `approval.decisionWindowMs`, `escalationPolicy`; replayed
  `CapabilityGateRecord` event ids or explicit `core-02-s3` `gate-record-unwritable` result; current
  non-ambiguous session linkage from core-01 resolver or raw linkage history.

## Acceptance criteria

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

## Coverage matrix

| Responsibility / spec-surface item | Proven by |
|---|---|
| Normalization | AC-1 |
| High/medium/low risk | AC-2, AC-3 |
| Manual/assisted ladder | AC-4, AC-5, AC-7 |
| Tightest policy grant plan | AC-6 |
| Purity | AC-8 |
| Failure tokens raised here | AC-2, AC-4, AC-5, AC-7 |

## Predicate-input matrix

| AC or failure row | Predicate / branch value | Declared source value | Producer / resolver | Verdict |
|---|---|---|---|---|
| AC-2, AC-3 | risk rules | `ApprovalRequest` fields, resolved policy, replay evidence, linkage | `core-03-s1`, Epic 1, Epic 3 linkage resolver | decidable |
| AC-4, AC-5 | mode and gate allow/unwritable branch | `ApprovalDecisionInput.mode`, committed `CapabilityGateRecord`, or explicit `core-02-s3` gate-record durability failure result | `core-03-s1`, Epic 3 `core-02-s3` | decidable |
| AC-6 | grant scope choice | request `requestedScope`, policy grant rules, request command/host/session | `core-03-s1`, Epic 1 | decidable |
| AC-7 | v1 deferral | requested capability id / action | Epic 3 capability registry | decidable |

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `approval-policy-unavailable` | missing resolved policy/provenance before classification | block before risk or decision | AC-2 negative fixture variant |
| `approval-risk-high` | high-risk rule fires in assisted path | require human; no auto grant | AC-4 |
| `approval-gate-denied` | committed gate denies | require human or deny per policy | AC-5 |
| `approval-gate-unwritable` | Epic 3 `core-02-s3` returned explicit `gate-record-unwritable` while trying to durably append the gate record | no autonomous grant; blocked if no human path | AC-5 |
| `approval-session-ambiguous` | linkage resolver/raw events cannot prove current session | block decision | AC-2 |
| `approval-relay-missing` | fresh positive Agent relay attestation absent | no low-risk auto grant | AC-3 |

## Quality bar

- Coverage scope and threshold: 95% branch coverage for `packages/sdk/src/core/approval/decision/**`.
- Coverage command and lanes: `pnpm test:unit -- --coverage --coverage.include='packages/sdk/src/core/approval/decision/**'`.
- Required tests: AC-1..AC-8 and failure rows.
- Public exposure: `sdk` entrypoint import test for `normalizeApprovalRequest`, `classifyApprovalRisk`,
  and `decideApproval`.
- Determinism constraints: no ambient time/randomness/process/network; `evaluatedAt` is input data.
- Dependency boundaries: consume SDK contracts only; no concrete Agent driver or `testkit` in source.
- File-size budget: 260 lines per implementation file, 320 lines per test file.

## Evidence pack

- Unit tests and fixtures named in ACs.
- Negative fixtures for high-risk branches, unavailable policy, gate-denied/gate-append-unwritable,
  and scope widening.
- `pnpm check` after implementation.
- Boundary sweep: `rg -n "provider-codex|provider-local|testkit|child_process|Date\\.now|new Date|Math\\.random" packages/sdk/src/core/approval/decision packages/sdk/tests/core/approval/decision` returns zero source matches.

## Boundaries and STOP conditions

- Package/module boundary: `packages/sdk/src/core/approval/decision/**`, with SDK public-entrypoint
  export wiring in `packages/sdk/src/index.ts`.
- Owned pathset: `packages/sdk/src/core/approval/decision/**`, `packages/sdk/src/index.ts`,
  `packages/sdk/tests/core/approval/decision/**`.
- Forbidden dependencies: concrete provider packages, process/network APIs, Operator UI.
- STOP when a branch needs a policy value not exposed by Epic 1 policy contracts or a session value not
  exposed by Epic 3 linkage contracts.

## Characterization review

- Scope decision: committed-gate-record-before-grant. Rationale: the design requires recorded gate
  evidence. Falsification: auto grant from pure evaluator return. Escalation: story defect against this
  contract.
- Scope decision: SDK public entrypoint wiring is part of this public behavior story. Rationale: its
  public-import test cannot pass unless the story can add decision exports to `packages/sdk/src/index.ts`;
  the cross-domain dependency is serialization only. Falsification: public import AC excludes the
  package entrypoint from the pathset or runs concurrently with another barrel writer.
- Gate verdict: ready. ACs name exact assertions and predicate sources; every failure row maps to an AC.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - stories](./README.md) · **← Prev:** [core-03-s1-approval-contracts - approval contracts implementation story](./core-03-s1-approval-contracts.md) · **Next →:** [core-03-s3-pending-park-resume - approval pending park resume implementation story](./core-03-s3-pending-park-resume.md)

<!-- /DOCS-NAV -->
