# Reviewer Prompt: core-03-s4-grants-outcomes

## Assigned Routing

- Source story id: `core-03-s4-grants-outcomes`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `elevated` from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md`.
- Reasoning tier: `elevated`.
- Routing rationale: source story `core-03-s4-grants-outcomes` covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8` and carries Agent provider-port handoff behavior for grant mapping, approval answer delivery, and outcome durability without concrete provider coupling.

## Original Scope

- Story id: `core-03-s4-grants-outcomes`.
- Epic slug: `epic-4-human-control-and-liveness-loop`.
- Source story contract: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s4-grants-outcomes.md`.
- Allowed pathset:
- `packages/sdk/src/core/approval/grants/**`
- `packages/sdk/src/core/approval/outcomes/**`
- `packages/sdk/tests/core/approval/grants/**`
- `packages/sdk/tests/core/approval/outcomes/**`
- `packages/sdk/src/index.ts (own export lines)`
- Dependencies: `core-03-s1-approval-contracts`, `core-03-s2-normalize-risk-decision`, `core-03-s3-pending-park-resume`.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` and committed producer shapes/events named by the source DAG and story contract.
- Non-goals: no concrete provider behavior, completion/recovery decisions, operator UI, tracker/package edits, source planning edits, or another story scope.
- STOP condition: Stop if a policy scope cannot map to Agent ScopedGrant without widening, if concrete Codex enums are needed, or if retry/recovery selection is required.

Acceptance criteria from the original source contract:

- **AC-1** per-command maps only to ScopedGrant command-once/request with exact command evidence, and missing command returns approval-grant-mapping-invalid.
- **AC-2** per-command-prefix, per-host, and session map to exact design grant kinds/scopes only with required evidence and human approval when session scoped.
- **AC-3** Deny dispositions map to deny-continue, deny-interrupt, or deny-park with request scope and denial reason content.
- **AC-4** Unsupported grant kinds, missing evidence, or widening mappings return approval-grant-mapping-invalid and do not call Agent.
- **AC-5** answerApprovalDecision consumes committed ApprovalDecisionRecorded event id, passes Decision.grant unchanged as ApprovalAnswer.grant, and keeps policy-level scope strings out of the Agent boundary.
- **AC-6** Missing relay, lost answer channel, or ambiguous Agent answer records no successful answer and returns exact fail-closed token.
- **AC-7** recordApprovalOutcome appends barrier outcome payload with exact schema, IdGenerator outcomeId, and preserved source event ids.
- **AC-8** Public SDK exports mapPolicyGrantToScopedGrant, answerApprovalDecision, and recordApprovalOutcome through this story owned index.ts lines.

Failure and degraded rows to verify:
- approval-grant-mapping-invalid
- approval-relay-missing
- approval-answer-channel-lost
- approval-outcome-ambiguous

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check source story `core-03-s4-grants-outcomes` and source AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8` against the runtime slots.

- AC coverage by original source `AC-n` id.
- Each AC is re-proven by a standing gate step such as `type:fixtures`, `coverage:baseline`, `deps`, `typecheck`, relevant unit tests, or `pnpm check`; treat manual-only proof or fixtures outside the build graph as blocking.
- Failure and degraded rows above.
- Evidence pack completeness and exact command output.
- Public API and `sdk` import paths.
- Dependency boundaries and committed dependency inputs from `{{DEPENDENCY_COMMITS}}`.
- Stale names and sibling occurrences of any issue found.
- Tests, sweeps, coverage, and source quality bar:
- grant-map-command.unit.test.ts and missing-command.fixture.ts
- grant-map-scopes.unit.test.ts
- grant-map-deny.unit.test.ts
- grant-map-invalid.unit.test.ts
- answer-approval.unit.test.ts
- answer-fail-closed.unit.test.ts
- record-outcome.unit.test.ts
- approval-grants-public-import.unit.test.ts
- 95% branch coverage for grants/outcomes
- boundary sweep for provider/local/Codex/process/network imports
- pnpm check
- Scope control against allowed writes.
- Repo conventions, no emojis, no provider-specific runtime model ids, no concrete driver imports where forbidden, no hidden ambient time/random/process/network calls where forbidden.

## Verdict Format

Return `APPROVE` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

The reviewer is read-only. Do not stage, commit, push, open or update PRs, merge, close workers, edit tracker state, edit package files, edit source planning files, dispatch implementation work, or write outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Implementer Prompt: core-03-s4-grants-outcomes](./implementer.md) · **Next →:** [Implementer Prompt: core-04-s1-supervision-contracts](../core-04-s1-supervision-contracts/implementer.md)

<!-- /DOCS-NAV -->
