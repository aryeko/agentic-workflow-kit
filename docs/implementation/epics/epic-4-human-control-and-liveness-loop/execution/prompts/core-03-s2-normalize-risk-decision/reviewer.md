# Reviewer Prompt: core-03-s2-normalize-risk-decision

## Assigned Routing

- Source story id: `core-03-s2-normalize-risk-decision`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, `AC-14`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `elevated` from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md`.
- Reasoning tier: `elevated`.
- Routing rationale: source story `core-03-s2-normalize-risk-decision` covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, `AC-14` and carries approval safety boundary over deterministic risk classification, committed gate evidence, barrier decision facts, and fail-closed behavior.

## Original Scope

- Story id: `core-03-s2-normalize-risk-decision`.
- Epic slug: `epic-4-human-control-and-liveness-loop`.
- Source story contract: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s2-normalize-risk-decision.md`.
- Allowed pathset:
- `packages/sdk/src/core/approval/decision/**`
- `packages/sdk/tests/core/approval/decision/**`
- `packages/sdk/src/index.ts (own export lines)`
- Dependencies: `core-03-s1-approval-contracts`.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` and committed producer shapes/events named by the source DAG and story contract.
- Non-goals: no concrete provider behavior, completion/recovery decisions, operator UI, tracker/package edits, source planning edits, or another story scope.
- STOP condition: Stop if a branch requires a policy value, session value, gate value, or prompt reference not produced by frozen inputs.

Acceptance criteria from the original source contract:

- **AC-1** normalizeApprovalRequest copies run/task/operation/session/policy/request event ids, requestedAt, and promptRef from context and maps kind to subject unless subjectOverride is set.
- **AC-2** Missing resolved policy or provenance returns approval-policy-unavailable before classification or decision and appends no risk or decision fact.
- **AC-3** High-risk rules run before medium/low and classify named high-risk session, command, network, workspace, linkage, relay, and self-report-only cases.
- **AC-4** Low risk is returned only for exact command requests with policy allowlist, bounded scope, fresh relay attestation, persistable channel when needed, and current linkage.
- **AC-5** classifyApprovalRisk uses explicit classifiedAt and never ambient time.
- **AC-6** recordApprovalRiskClassified appends durable payload with exact risk, rule ids, evidence event ids, and classifiedAt.
- **AC-7** Manual mode always yields human-required; assisted mode also yields human-required for high risk.
- **AC-8** Ambiguous current-session linkage returns blocked with approval-session-ambiguous and no grant plan.
- **AC-9** Assisted low-risk allowlisted requests grant only from a committed matching escalation-auto-grant allow record; deny and append-failure inputs fail closed.
- **AC-10** Policy grant planning chooses the tightest valid scope without widening request or policy.
- **AC-11** orchestrator-decide always denies in v1 with capability-deferred and no LLM replay logic.
- **AC-12** recordApprovalDecision appends barrier decision payload before Agent answer, preserves source event ids, returns committed event id, and requires protectedPolicyBinding iff protected-policy-change.
- **AC-13** Decision.decisionId and PolicyGrantPlan.grantId come from injected IdGenerator in stable order with no ambient random/UUID calls.
- **AC-14** Public SDK exports normalize/classify/record/decide functions and public input/result types through this story owned index.ts lines.

Failure and degraded rows to verify:
- approval-policy-unavailable
- approval-risk-high
- approval-gate-denied
- approval-gate-unwritable
- approval-session-ambiguous
- approval-relay-missing

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check source story `core-03-s2-normalize-risk-decision` and source AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, `AC-14` against the runtime slots.

- AC coverage by original source `AC-n` id.
- Each AC is re-proven by a standing gate step such as `type:fixtures`, `coverage:baseline`, `deps`, `typecheck`, relevant unit tests, or `pnpm check`; treat manual-only proof or fixtures outside the build graph as blocking.
- Failure and degraded rows above.
- Evidence pack completeness and exact command output.
- Public API and `sdk` import paths.
- Dependency boundaries and committed dependency inputs from `{{DEPENDENCY_COMMITS}}`.
- Stale names and sibling occurrences of any issue found.
- Tests, sweeps, coverage, and source quality bar:
- normalize-approval-request.unit.test.ts
- policy-unavailable-blocks.unit.test.ts
- classify-high-risk.unit.test.ts
- classify-low-risk.unit.test.ts
- classification-time.unit.test.ts
- record-risk-classified.unit.test.ts
- mode-ladder-human.unit.test.ts
- decision-session-ambiguous.unit.test.ts
- assisted-gate.unit.test.ts
- policy-grant-plan.unit.test.ts
- orchestrator-decide-deferred.unit.test.ts
- record-approval-decision.unit.test.ts
- approval-decision-ids.unit.test.ts
- approval-decision-public-import.unit.test.ts
- 95% branch coverage for approval decision
- boundary sweep for provider/process/time/random/network imports
- pnpm check
- Scope control against allowed writes.
- Repo conventions, no emojis, no provider-specific runtime model ids, no concrete driver imports where forbidden, no hidden ambient time/random/process/network calls where forbidden.

## Verdict Format

Return `APPROVE` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

The reviewer is read-only. Do not stage, commit, push, open or update PRs, merge, close workers, edit tracker state, edit package files, edit source planning files, dispatch implementation work, or write outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Implementer Prompt: core-03-s2-normalize-risk-decision](./implementer.md) · **Next →:** [Implementer Prompt: core-03-s3-pending-park-resume](../core-03-s3-pending-park-resume/implementer.md)

<!-- /DOCS-NAV -->
