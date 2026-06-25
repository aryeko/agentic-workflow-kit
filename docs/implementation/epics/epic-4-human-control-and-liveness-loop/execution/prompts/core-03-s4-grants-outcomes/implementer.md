# Implementer Prompt: core-03-s4-grants-outcomes

## Assigned Routing

- Source story id: `core-03-s4-grants-outcomes`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.
- Model class: `strong-coder`.
- Effort: `high`.
- Suggested-tier floor: `elevated` from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md`.
- Reasoning tier: `elevated`.
- Routing rationale: source story `core-03-s4-grants-outcomes` covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8` and carries Agent provider-port handoff behavior for grant mapping, approval answer delivery, and outcome durability without concrete provider coupling.

## Exact Task

Implement `core-03-s4-grants-outcomes` for epic `epic-4-human-control-and-liveness-loop`: Map policy grants to Agent ScopedGrant, answer or deny through Agent relay, and record outcomes. Keep the result limited to source story `core-03-s4-grants-outcomes` and source AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.

## Why It Matters

This story is in wave 4. Its direct dependencies are `core-03-s1-approval-contracts`, `core-03-s2-normalize-risk-decision`, `core-03-s3-pending-park-resume` and its dependents are none. The story provides the source-defined approval or supervision surface named by `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s4-grants-outcomes.md`; later stories and later epics must consume these facts and public `sdk` imports without redeclaring shapes, inventing provider behavior, or using worker prose as evidence.

## Required Reading

- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s4-grants-outcomes.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md`
- `docs/design/30-domain-reference/core/approval-and-escalation/decision-model.md`
- `docs/design/30-domain-reference/core/approval-and-escalation/park-resume-and-failures.md`
- `docs/design/30-domain-reference/core/approval-and-escalation/interfaces-events-and-tests.md`
- `docs/engineering/check-gate.md`
- `docs/engineering/test-lanes.md`
- Runtime dependency commits slot: `{{DEPENDENCY_COMMITS}}` for `core-03-s1-approval-contracts`, `core-03-s2-normalize-risk-decision`, `core-03-s3-pending-park-resume`.

## Acceptance Criteria

Source story: `core-03-s4-grants-outcomes`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.

- **AC-1** per-command maps only to ScopedGrant command-once/request with exact command evidence, and missing command returns approval-grant-mapping-invalid.
- **AC-2** per-command-prefix, per-host, and session map to exact design grant kinds/scopes only with required evidence and human approval when session scoped.
- **AC-3** Deny dispositions map to deny-continue, deny-interrupt, or deny-park with request scope and denial reason content.
- **AC-4** Unsupported grant kinds, missing evidence, or widening mappings return approval-grant-mapping-invalid and do not call Agent.
- **AC-5** answerApprovalDecision consumes committed ApprovalDecisionRecorded event id, passes Decision.grant unchanged as ApprovalAnswer.grant, and keeps policy-level scope strings out of the Agent boundary.
- **AC-6** Missing relay, lost answer channel, or ambiguous Agent answer records no successful answer and returns exact fail-closed token.
- **AC-7** recordApprovalOutcome appends barrier outcome payload with exact schema, IdGenerator outcomeId, and preserved source event ids.
- **AC-8** Public SDK exports mapPolicyGrantToScopedGrant, answerApprovalDecision, and recordApprovalOutcome through this story owned index.ts lines.

Failure and degraded outcomes from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s4-grants-outcomes.md`:
- approval-grant-mapping-invalid
- approval-relay-missing
- approval-answer-channel-lost
- approval-outcome-ambiguous

## Allowed Writes

Only these source-owned paths may be changed for `core-03-s4-grants-outcomes`:
- `packages/sdk/src/core/approval/grants/**`
- `packages/sdk/src/core/approval/outcomes/**`
- `packages/sdk/tests/core/approval/grants/**`
- `packages/sdk/tests/core/approval/outcomes/**`
- `packages/sdk/src/index.ts (own export lines)`

Every other write is forbidden, including package files, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, commits in another story pathset, and changes to another epic package.

## Dependency Inputs

- Producer story ids: `core-03-s1-approval-contracts`, `core-03-s2-normalize-risk-decision`, `core-03-s3-pending-park-resume`.
- Dependency commit evidence: `{{DEPENDENCY_COMMITS}}`.
- Public import path: `sdk` for every public symbol this story exposes or consumes.
- Shared shapes and events must be consumed from committed dependency sources named by `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md` and `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s4-grants-outcomes.md`; do not redeclare them.

## Non-Goals And STOP Conditions

Non-goals: do not implement concrete provider behavior, completion or recovery decisions, operator UI, PR/merge behavior, or another story's scope.

Source STOP condition for `core-03-s4-grants-outcomes`: Stop if a policy scope cannot map to Agent ScopedGrant without widening, if concrete Codex enums are needed, or if retry/recovery selection is required.

Also stop and report if dependency commits are missing, a required source value is absent, an AC requires writes outside the owned pathset, or implementation would require reinterpreting a source AC.

## Implementation Constraints

Honor the story contract exactly: public exports through this story owned `packages/sdk/src/index.ts` lines, deterministic explicit inputs for time/id/randomness, provider-port boundaries, append-only event-log authority, failure tokens named above, and the Dependency Rule from `AGENTS.md`. Do not introduce provider-specific runtime model ids, concrete driver imports, ambient clock reads, process/network calls, or shape redeclarations prohibited by the source story.

## Verification

Run the targeted checks and evidence required by `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s4-grants-outcomes.md` for source AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`:
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

Report exact command output or an explicit blocked reason. Do not claim AC coverage from prose alone.

## Commit Cadence

The implementer commits its own work in the story worktree, never the orchestrator:

- Make `pnpm check` green before every commit.
- Make an impl-done commit when the story first proves out, then one commit per fix round.
- Add commit trailers `Story: core-03-s4-grants-outcomes` and `Round: <n>`.
- On orchestrator-reported merge-back conflict, rebase the story commits onto the track branch `HEAD`, re-prove the gate, and re-commit.
- Report real logic conflicts rather than forcing a resolution.

## Delivery Report

Return changed files, AC coverage by source AC id, per-round commit hashes, tests and checks run, evidence pack, open questions, and blockers. The implementer does not update tracker state or perform merge, PR, push, publication, worker closure, package, or source-planning actions.

## Mutation Limits

The implementer commits each round within the owned pathset in its own story worktree. It performs no pushes, PRs, merges, tracker edits, package edits, source planning edits, worker closure, or writes outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Reviewer Prompt: core-03-s3-pending-park-resume](../core-03-s3-pending-park-resume/reviewer.md) · **Next →:** [Reviewer Prompt: core-03-s4-grants-outcomes](./reviewer.md)

<!-- /DOCS-NAV -->
