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

Implement the approval decision path: normalize provider-neutral Agent requests from declared context,
classify risk with explicit time, append risk/decision audit facts, and apply the v1 manual/assisted
ladder against recorded policy and gate evidence.

## Spec Surface

- Functions: `normalizeApprovalRequest`, `classifyApprovalRisk`, `recordApprovalRiskClassified`,
  `decideApproval`, `recordApprovalDecision`.
- Consumed approval shapes: `core-03-s1/ApprovalContext`, `ApprovalRequest`,
  `ApprovalDecisionInput`, `ApprovalRisk`, `Decision`, `PolicyGrantPlan`, `ApprovalFailureState`.
- Consumed frozen shapes: fnd-01 `ResolvedPolicy`, Epic 3 `RunReplay`, `RunProjections`,
  committed `CapabilityGateRecord`, Epic 2 Agent capability attestations.
- Trusted workspace root: `core-03-s1/ApprovalRequest.worktreePath` — the run's trusted workspace
  boundary, copied by `normalize` from `ApprovalContext.worktreePath`, whose value is the recorded
  `RunLaunchProjection.worktreePath` run-launch fact produced by the cross-epic
  `core-01-r2-run-launch-worktree-path` story (frozen earlier, in `epic-r2-run-launch-workspace-fact`).
  It is never the agent-supplied `cwd` or any agent request path; it is the operand the workspace
  containment rules in AC-3/AC-4 test against, and the rules fail closed when it is absent.
- Produced values and facts: normalized `ApprovalRequest`, `ApprovalRiskClassifiedPayload`,
  `ApprovalRiskClassified`, `Decision`, and `ApprovalDecisionRecorded`.

## Responsibilities

- Keep normalization total and pure; it copies `requestedAt`, `promptRef`, and the trusted
  `worktreePath` from `ApprovalContext` (never the agent `cwd`).
- Apply the design `kind -> subject` table and let `subjectOverride` win for
  `protected-policy-change` or `network`.
- Classify high, then medium, then low, using only request, policy, replay/projection evidence,
  attestations, and explicit `classifiedAt`; append `ApprovalRiskClassified` with `durable`
  durability.
- Allow assisted low-risk auto-grant only from a committed `escalation-auto-grant` allow record.
- Select policy-level grant plans only; Agent `ScopedGrant` mapping is `core-03-s4`.
- Append `ApprovalDecisionRecorded` at barrier durability before any Agent answer path consumes the
  committed decision event id.
- Require `protectedPolicyBinding` on recorded decisions whose request subject is
  `protected-policy-change`, sourcing the binding from operator decision input plus the protected-policy
  snapshot/head inputs.

## Dependencies and Inputs

- Covers signals: deterministic risk classification, v1 mode ladder, risk/decision neutral records
  behavior, and policy/risk/gate failure behavior.
- Depends on: `core-03-s1-approval-contracts`; and cross-epic on
  `core-01-r2-run-launch-worktree-path` (in `epic-r2-run-launch-workspace-fact`, frozen earlier) for the
  trusted `RunLaunchProjection.worktreePath` workspace boundary.
- Frozen inputs: fnd-01 resolved policy, fnd-02 prompt persistence result supplied as
  `ApprovalContext.promptRef`, the trusted `RunLaunchProjection.worktreePath` (from
  `core-01-r2-run-launch-worktree-path`) supplied as `ApprovalContext.worktreePath` and copied to
  `ApprovalRequest.worktreePath`, injected SDK `IdGenerator`, Epic 2 Agent attestations, and Epic 3
  writer, capability gate records, and linkage.

## Acceptance Criteria

- **AC-1** `normalizeApprovalRequest(input, context)` copies `runId`, `taskId`, `operationId`,
  `sessionId`, `policyRef`, `agentRequestEventId`, `requestedAt`, `promptRef`, and `worktreePath` exactly
  from context (`worktreePath` is the trusted run-launch workspace boundary, copied from
  `ApprovalContext.worktreePath` — never the agent-supplied `cwd`), and maps `kind` to subject unless
  `subjectOverride` is set - evidence: `normalize-approval-request.unit.test.ts` asserts copied values
  (including `worktreePath` from context and a fixture where the agent `cwd` differs from `worktreePath`),
  command-kind mapping, and protected policy override precedence.
- **AC-2** Missing resolved policy or policy provenance returns `approval-policy-unavailable` before
  classification or decision and appends no `ApprovalRiskClassified` or `ApprovalDecisionRecorded` fact -
  evidence: `policy-unavailable-blocks.unit.test.ts` asserts zero writer calls and the exact token.
- **AC-3** High-risk rules are evaluated before medium/low and return `ApprovalRisk = "high"` for
  session scope, unsafe command syntax, wildcard/private host, out-of-workspace file path, ambiguous
  session linkage, missing relay, and self-report-only evidence. The "file path outside the workspace"
  predicate tests `ApprovalRequest.filePaths` containment against the trusted
  `ApprovalRequest.worktreePath` (copied by `normalize` from `ApprovalContext.worktreePath`, sourced from
  the recorded `RunLaunchProjection.worktreePath` run-launch fact) — **never** the agent-supplied `cwd`.
  When `worktreePath` is absent, containment is unprovable, so the "outside the workspace" predicate
  triggers (fail closed), scoped to requests that carry `filePaths`; a request with no `filePaths` is
  unaffected. This fixes the prior P1 fail-open, which approximated the workspace root from the spoofable
  agent `cwd` - evidence: `classify-high-risk.unit.test.ts` asserts each named fixture returns `"high"`
  and includes the rule id, including an absent-`worktreePath` fixture that carries `filePaths`.
- **AC-4** Low risk is returned only for exact command requests whose `ApprovalRequest.cwd` is **provably
  contained** within the trusted `ApprovalRequest.worktreePath` (the workspace root copied by `normalize`
  from `ApprovalContext.worktreePath`, sourced from the recorded `RunLaunchProjection.worktreePath` —
  never the agent-supplied path), with no high rule, policy allowlist match, no broader-than-policy scope,
  fresh positive relay attestation, persistable answer channel when parking may be needed, and current
  session linkage. When `worktreePath` is absent or `cwd` containment is not provable, the low-risk "cwd
  is inside the workspace" condition is **unmet** and there is no low-risk auto-grant - evidence:
  `classify-low-risk.unit.test.ts` asserts the positive fixture returns `"low"` and each missing guarantee
  fixture (including absent-`worktreePath` and non-contained-`cwd`) returns `"medium"` or `"high"` as
  specified.
- **AC-5** `classifyApprovalRisk(..., classifiedAt)` returns or emits classification evidence with
  `classifiedAt` equal to the explicit input timestamp and never reads ambient time - evidence:
  `classification-time.unit.test.ts` asserts exact timestamp equality and a forbidden `Date.now|new Date`
  spy reports zero calls.
- **AC-6** `recordApprovalRiskClassified` appends `ApprovalRiskClassifiedPayload` with durable
  durability, exact risk, triggered rule ids, evidence event ids, and explicit `classifiedAt` - evidence:
  `record-risk-classified.unit.test.ts` asserts the payload and writer durability.
- **AC-7** Manual mode always produces `decision = "human-required"`; assisted mode still produces
  `human-required` for high risk - evidence: `mode-ladder-human.unit.test.ts` asserts exact decisions
  and `decidedBy === "system"`.
- **AC-8** Ambiguous current-session linkage returns `decision = "blocked"` with
  `approval-session-ambiguous` and no grant plan - evidence:
  `decision-session-ambiguous.unit.test.ts` asserts the exact blocked decision and absent grant.
- **AC-9** Assisted low-risk allowlisted requests produce `decision = "grant"` only when a committed
  `CapabilityGateRecord` allows `escalation-auto-grant` for the matching request scope; committed deny
  records produce `approval-gate-denied`, and explicit gate-append failure input produces
  `approval-gate-unwritable` - evidence: `assisted-gate.unit.test.ts` asserts all three exact outcomes.
- **AC-10** Policy grant planning chooses the tightest valid scope in order `per-command`,
  `per-command-prefix`, `per-host`, `session` without widening request or policy - evidence:
  `policy-grant-plan.unit.test.ts` asserts a fixture with command and session options chooses
  `per-command`, and a scope-widening fixture denies.
- **AC-11** `orchestrator-decide` always denies in v1 with a `capability-deferred` reason and no LLM
  replay logic - evidence: `orchestrator-decide-deferred.unit.test.ts` asserts the deny reason.
- **AC-12** `recordApprovalDecision` appends `ApprovalDecisionRecordedPayload` at barrier durability
  before Agent answer, preserves source event ids, returns the committed decision event id, and requires
  `protectedPolicyBinding` iff the source `ApprovalRequest.subject === "protected-policy-change"` -
  evidence:
  `record-approval-decision.unit.test.ts` asserts barrier durability, event id handoff, binding-required
  and binding-forbidden fixtures.
- **AC-13** `Decision.decisionId` and `PolicyGrantPlan.grantId` are minted from the injected
  `IdGenerator` once per produced value and remain stable across replay when the same generator script is
  supplied - evidence: `approval-decision-ids.unit.test.ts` asserts exact id consumption order and no
  ambient random/UUID call.
- **AC-14** The public SDK entrypoint exports `normalizeApprovalRequest`, `classifyApprovalRisk`,
  `recordApprovalRiskClassified`, `decideApproval`, and `recordApprovalDecision` plus their public
  input/result types, through this story's own export line(s) in `packages/sdk/src/index.ts` (this story
  owns those barrel lines, in its owned pathset) - evidence:
  `approval-decision-public-import.unit.test.ts` imports those symbols from `sdk` and constructs one
  normalize/classify/record/decide fixture without private paths.

## Predicate and Producer Closure

| AC / output | Decision value or produced field | Source |
|---|---|---|
| AC-1 | normalized request fields | `AgentApprovalRequest` and `ApprovalContext` fields |
| AC-1 | `subject` | `subjectOverride` or frozen kind mapping |
| AC-2 | policy unavailable block | resolved policy/provenance input absence |
| AC-3, AC-4 | risk (non-containment rules) | `core-03-s1/ApprovalRequest` fields, fnd-01 `ResolvedPolicy`, Epic 3 replay/projections, Epic 2 attestation facts |
| AC-3 | workspace-containment predicate (relational, two operands) | tested point `core-03-s1/ApprovalRequest.filePaths`; boundary `core-03-s1/ApprovalRequest.worktreePath` (the trusted `RunLaunchProjection.worktreePath` from `core-01-r2-run-launch-worktree-path`, copied via `ApprovalContext.worktreePath`; absent → fail closed to "outside") |
| AC-4 | workspace-containment predicate (relational, two operands) | tested point `core-03-s1/ApprovalRequest.cwd`; boundary `core-03-s1/ApprovalRequest.worktreePath` (the trusted `RunLaunchProjection.worktreePath` from `core-01-r2-run-launch-worktree-path`, copied via `ApprovalContext.worktreePath`; absent or not provably contained → low-risk condition unmet) |
| AC-5, AC-6 | `classifiedAt` and risk fact | explicit function input, triggered rule ids, evidence event ids, `RunWriter.append` result |
| AC-7, AC-8, AC-9 | ladder/gate branch | `ApprovalDecisionInput.mode`, risk, policy, committed gate event id or explicit append-failure input |
| AC-10 | `PolicyGrantPlan` | request command/host/files/session, resolved policy grant rules, injected `IdGenerator` for `grantId` |
| AC-11 | v1 deferral | Epic 3 capability registry and AD-14 |
| AC-12 | `ApprovalDecisionRecorded` event id | `Decision`, source event ids, protected-policy binding inputs, and `RunWriter.append` result |
| AC-13 | `Decision.decisionId`, `PolicyGrantPlan.grantId` | injected SDK `IdGenerator` |
| AC-14 | public symbols | owned source files plus this story's own export line(s) in `packages/sdk/src/index.ts` (owned pathset) |
| `Decision.sourceEventIds` | event provenance | replayed request, policy, gate, and operator decision event ids supplied in input |

## Failure and Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `approval-policy-unavailable` | resolved policy or provenance missing | block before classification/decision | AC-2 |
| `approval-risk-high` | high risk on assisted path | human required; no auto grant | AC-7 |
| `approval-gate-denied` | committed gate deny | require human or deny by policy | AC-9 |
| `approval-gate-unwritable` | gate record append failed explicitly | no autonomous grant; block if no human path | AC-9 |
| `approval-session-ambiguous` | linkage cannot prove current session | block decision | AC-8 |
| `approval-relay-missing` | fresh relay attestation absent | no low-risk auto grant | AC-4 |

## Quality Bar

- Coverage: 95% branch coverage for `packages/sdk/src/core/approval/decision/**`.
- Gate lane: `pnpm check`; unit lane includes AC fixtures above.
- Public exposure: AC-14.
- Barrel ownership: this story owns its own export line(s) in `packages/sdk/src/index.ts` — a normal
  owned file in this story's owned pathset, per `docs/design/20-sdk-and-packaging/sdk-boundary.md`. The
  barrel is an append-only aggregation point shared across concurrent stories; a line-level overlap is
  resolved by rebase, never by a special ownership role.
- Boundary sweep:
  `rg -n "provider-codex|provider-local|testkit|child_process|Date\\.now|new Date|Math\\.random|fetch\\(" packages/sdk/src/core/approval/decision packages/sdk/tests/core/approval/decision`
  returns zero source matches.
- File-size budget: 280 lines per implementation file, 360 lines per test file.

## STOP Conditions

Stop if a branch requires a policy value, session value, gate value, prompt reference, or any workspace
containment/boundary value (such as a workspace root) not produced by frozen inputs; do not infer it from
story ids, hashes, prose, or the agent-supplied request. In particular, never source the workspace
boundary from the agent `cwd` or any agent request path — the only admissible boundary is the trusted
`ApprovalRequest.worktreePath` (the recorded `RunLaunchProjection.worktreePath`), and when it is absent
the containment predicates fail closed.

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
- Design trace: approval README mode ladder and `interfaces-events-and-tests.md` `capabilityGateEventId`.
- Falsification: `decision = "grant"` without a committed allow event id.
- Escalation: block the story as a source-contract defect; do not infer allow from absent failure.

- Verdict: ready; every branch is backed by declared input values and every produced field has a source.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - stories](./README.md) · **← Prev:** [core-03-s1-approval-contracts - approval contracts implementation story](./core-03-s1-approval-contracts.md) · **Next →:** [core-03-s3-pending-park-resume - approval pending park resume implementation story](./core-03-s3-pending-park-resume.md)

<!-- /DOCS-NAV -->
