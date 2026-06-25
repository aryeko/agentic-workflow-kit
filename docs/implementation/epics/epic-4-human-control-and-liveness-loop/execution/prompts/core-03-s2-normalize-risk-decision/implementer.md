# Implementer Prompt: core-03-s2-normalize-risk-decision

## Assigned Routing

- Source story id: `core-03-s2-normalize-risk-decision`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, `AC-14`.
- Model class: `strong-coder`.
- Effort: `high`.
- Suggested-tier floor: `elevated` from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md`.
- Reasoning tier: `elevated`.
- Routing rationale: source story `core-03-s2-normalize-risk-decision` covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, `AC-14` and carries approval safety boundary over deterministic risk classification, committed gate evidence, barrier decision facts, and fail-closed behavior.

## Exact Task

Implement `core-03-s2-normalize-risk-decision` for epic `epic-4-human-control-and-liveness-loop`: Normalize approval requests, classify risk with explicit time, record risk and decision facts, and apply the v1 ladder. Keep the result limited to source story `core-03-s2-normalize-risk-decision` and source AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, `AC-14`.

## Why It Matters

This story is in wave 2. Its direct dependencies are `core-03-s1-approval-contracts` and its dependents are `core-03-s3-pending-park-resume`, `core-03-s4-grants-outcomes`. The story provides the source-defined approval or supervision surface named by `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s2-normalize-risk-decision.md`; later stories and later epics must consume these facts and public `sdk` imports without redeclaring shapes, inventing provider behavior, or using worker prose as evidence.

## Required Reading

- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s2-normalize-risk-decision.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md`
- `docs/design/30-domain-reference/core/approval-and-escalation/README.md`
- `docs/design/30-domain-reference/core/approval-and-escalation/decision-model.md`
- `docs/design/30-domain-reference/core/approval-and-escalation/interfaces-events-and-tests.md`
- `docs/engineering/check-gate.md`
- `docs/engineering/test-lanes.md`
- Runtime dependency commits slot: `{{DEPENDENCY_COMMITS}}` for `core-03-s1-approval-contracts`.

## Acceptance Criteria

Source story: `core-03-s2-normalize-risk-decision`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, `AC-14`.

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

Failure and degraded outcomes from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s2-normalize-risk-decision.md`:
- approval-policy-unavailable
- approval-risk-high
- approval-gate-denied
- approval-gate-unwritable
- approval-session-ambiguous
- approval-relay-missing

## Allowed Writes

Only these source-owned paths may be changed for `core-03-s2-normalize-risk-decision`:
- `packages/sdk/src/core/approval/decision/**`
- `packages/sdk/tests/core/approval/decision/**`
- `packages/sdk/src/index.ts (own export lines)`

Every other write is forbidden, including package files, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, commits in another story pathset, and changes to another epic package.

## Dependency Inputs

- Producer story ids: `core-03-s1-approval-contracts`.
- Dependency commit evidence: `{{DEPENDENCY_COMMITS}}`.
- Public import path: `sdk` for every public symbol this story exposes or consumes.
- Shared shapes and events must be consumed from committed dependency sources named by `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md` and `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s2-normalize-risk-decision.md`; do not redeclare them.

## Non-Goals And STOP Conditions

Non-goals: do not implement concrete provider behavior, completion or recovery decisions, operator UI, PR/merge behavior, or another story's scope.

Source STOP condition for `core-03-s2-normalize-risk-decision`: Stop if a branch requires a policy value, session value, gate value, or prompt reference not produced by frozen inputs.

Also stop and report if dependency commits are missing, a required source value is absent, an AC requires writes outside the owned pathset, or implementation would require reinterpreting a source AC.

## Implementation Constraints

Honor the story contract exactly: public exports through this story owned `packages/sdk/src/index.ts` lines, deterministic explicit inputs for time/id/randomness, provider-port boundaries, append-only event-log authority, failure tokens named above, and the Dependency Rule from `AGENTS.md`. Do not introduce provider-specific runtime model ids, concrete driver imports, ambient clock reads, process/network calls, or shape redeclarations prohibited by the source story.

## Verification

Run the targeted checks and evidence required by `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s2-normalize-risk-decision.md` for source AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, `AC-14`:
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

Report exact command output or an explicit blocked reason. Do not claim AC coverage from prose alone.

## Commit Cadence

The implementer commits its own work in the story worktree, never the orchestrator:

- Make `pnpm check` green before every commit.
- Make an impl-done commit when the story first proves out, then one commit per fix round.
- Add commit trailers `Story: core-03-s2-normalize-risk-decision` and `Round: <n>`.
- On orchestrator-reported merge-back conflict, rebase the story commits onto the track branch `HEAD`, re-prove the gate, and re-commit.
- Report real logic conflicts rather than forcing a resolution.

## Delivery Report

Return changed files, AC coverage by source AC id, per-round commit hashes, tests and checks run, evidence pack, open questions, and blockers. The implementer does not update tracker state or perform merge, PR, push, publication, worker closure, package, or source-planning actions.

## Mutation Limits

The implementer commits each round within the owned pathset in its own story worktree. It performs no pushes, PRs, merges, tracker edits, package edits, source planning edits, worker closure, or writes outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Reviewer Prompt: core-03-s1-approval-contracts](../core-03-s1-approval-contracts/reviewer.md) · **Next →:** [Reviewer Prompt: core-03-s2-normalize-risk-decision](./reviewer.md)

<!-- /DOCS-NAV -->
