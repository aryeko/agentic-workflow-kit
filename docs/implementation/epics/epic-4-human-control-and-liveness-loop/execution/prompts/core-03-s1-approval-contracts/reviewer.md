# Reviewer Prompt: core-03-s1-approval-contracts

## Assigned Routing

- Source story id: `core-03-s1-approval-contracts`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `elevated` from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md`.
- Reasoning tier: `elevated`.
- Routing rationale: source story `core-03-s1-approval-contracts` covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` and carries public approval contract producer and failure catalog consumed by later approval behavior stories and later epics.

## Original Scope

- Story id: `core-03-s1-approval-contracts`.
- Epic slug: `epic-4-human-control-and-liveness-loop`.
- Source story contract: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s1-approval-contracts.md`.
- Allowed pathset:
- `packages/sdk/src/core/approval/contracts/**`
- `packages/sdk/tests/core/approval/contracts/**`
- `packages/sdk/src/index.ts (own export lines)`
- Dependencies: none.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` and committed producer shapes/events named by the source DAG and story contract.
- Non-goals: no concrete provider behavior, completion/recovery decisions, operator UI, tracker/package edits, source planning edits, or another story scope.
- STOP condition: Stop if a required approval field is not declared in the design, if behavior is needed to construct a type, or if a concrete Agent driver enum is needed instead of provider-port ScopedGrant.

Acceptance criteria from the original source contract:

- **AC-1** Primitive approval unions exactly match the design: ApprovalMode excludes auto, ApprovalRisk is low/medium/high, PolicyGrantScope has the four policy scopes, and ApprovalSubject includes protected-policy-change and network.
- **AC-2** ApprovalRequest requires promptRef and requestedAt; ApprovalContext requires requestedAt and promptRef and has optional subjectOverride. Both ApprovalContext and ApprovalRequest also expose an optional worktreePath?: string (the run's trusted workspace root, matching the frozen design — orchestration-injected on ApprovalContext, copied by normalize onto ApprovalRequest; never the agent cwd), proven by a positive (WITH), an absent (WITHOUT), and a wrong-type negative (e.g. worktreePath: 123, fails typecheck) fixture for each type.
- **AC-3** Decision, Outcome, ApprovalParkInput, ParkDecision, and ResumeDecision expose exact schema literals and required source fields, including ParkDecision.sourceEventIds and ResumeDecision outcome literals.
- **AC-4** ApprovalDecisionRecordedPayload carries ProtectedPolicyApprovalBinding required iff the request subject is protected-policy-change, with the required run/head/snapshot fields and only optional newPolicyDigest.
- **AC-5** All seven V1 approval event payloads expose exact schema literals and required event-source fields, including classifiedAt and parkedAt.
- **AC-6** ApprovalProjection and PendingApprovalProjection expose pending, latest decision/outcome, operator-attention, and failure-state maps, with decisionDeadline required on each pending row.
- **AC-7** Every manifest symbol imports from sdk through this story owned export lines in packages/sdk/src/index.ts, with no private path.

Failure and degraded rows to verify:
- Declares the full ApprovalFailureState catalog; behavior stories own runtime triggers.

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check source story `core-03-s1-approval-contracts` and source AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` against the runtime slots.

- AC coverage by original source `AC-n` id.
- Each AC is re-proven by a standing gate step such as `type:fixtures`, `coverage:baseline`, `deps`, `typecheck`, relevant unit tests, or `pnpm check`; treat manual-only proof or fixtures outside the build graph as blocking.
- Failure and degraded rows above.
- Evidence pack completeness and exact command output.
- Public API and `sdk` import paths.
- Dependency boundaries and committed dependency inputs from `{{DEPENDENCY_COMMITS}}`.
- Stale names and sibling occurrences of any issue found.
- Tests, sweeps, coverage, and source quality bar:
- approval-unions.unit.test.ts and approval-mode-auto.fixture.ts
- approval-request-context.unit.test.ts and missing-field fixtures; require both ApprovalContext and ApprovalRequest to expose the optional worktreePath?: string field matching the frozen design, proven by present/absent fixtures for each type
- approval-decision-results.unit.test.ts
- protected-policy-binding.unit.test.ts
- approval-payloads.unit.test.ts
- approval-projections.unit.test.ts
- approval-public-import.unit.test.ts
- 95% statements/branches for approval contracts
- boundary sweep for provider/testkit/process/time/network imports
- pnpm check
- Scope control against allowed writes.
- Repo conventions, no emojis, no provider-specific runtime model ids, no concrete driver imports where forbidden, no hidden ambient time/random/process/network calls where forbidden.

## Verdict Format

Return `APPROVE` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

The reviewer is read-only. Do not stage, commit, push, open or update PRs, merge, close workers, edit tracker state, edit package files, edit source planning files, dispatch implementation work, or write outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Implementer Prompt: core-03-s1-approval-contracts](./implementer.md) · **Next →:** [Implementer Prompt: core-03-s2-normalize-risk-decision](../core-03-s2-normalize-risk-decision/implementer.md)

<!-- /DOCS-NAV -->
