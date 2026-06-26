# Implementer Prompt - core-05-s1-completion-contracts

## Assigned Routing

- Source story id: `core-05-s1-completion-contracts`
- Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10
- Model class: `strong-coder`
- Effort: `high`
- Suggested-tier floor: `elevated`
- Reasoning tier: `elevated`
- Routing rationale: minimal compliant route. The frozen DAG sets an elevated floor, and public SDK contract and runtime catalog producer consumed by every core-05 behavior story and core-06 recovery; no critical/frontier escalation is authorized by the source contract.

## Exact Task

Implement `core-05-s1-completion-contracts` for epic `epic-5-completion-verification-and-recovery`: Produce completion/merge value types, state catalogs, event payloads, evaluator interfaces, and failure-token catalogs.

Source story: `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-05-s1-completion-contracts.md`. Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10.

## Why It Matters

Produce the public completion/merge contract surface: exact-head evidence types, decision-state
catalogs, event payloads, evaluator interfaces, and failure tokens consumed by core-05 behavior stories,
core-06 recovery, and Epic 7.

Downstream dependents: `core-05-s2-completion-evidence`, `core-05-s3-merge-readiness`, `core-05-s4-forge-intents-and-blockers`, `core-05-s5-post-merge-outcomes`, `core-06-s1-recovery-contracts`, `core-06-s2-recovery-classifier`. Dependency inputs and public contracts from this story must be stable before those dependents run.

## Required Reading

- `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-05-s1-completion-contracts.md`
- `docs/implementation/epics/epic-5-completion-verification-and-recovery/story-dag.md`
- The two core-05 normative design files listed above.
- Prior frozen contracts for `RunEventCursor`, `EvidenceEventRef`, and `CapabilityGateRecord`.
- Runtime dependency commits: `{{DEPENDENCY_COMMITS}}` for producer stories listed below.

## Acceptance Criteria

- **AC-1** The exported `CompletionDecisionState` catalog contains exactly `completion-verified`,
  `completion-pending-evidence`, `claim-evidence-mismatch`, `verification-failed`,
  `verification-uncertain`, `workspace-dirty`, `head-ambiguous`, `changed-file-policy-absent`,
  `changed-files-outside-allowlist`, `protected-policy-change-unapproved`,
  `forge-evidence-unavailable`, and `event-log-unwritable` - evidence:
  `type:fixtures` positive catalog fixture plus a `never` exhaustiveness switch over the exact list.
- **AC-2** The exported `MergeDecisionState` catalog contains exactly `merge-ready`,
  `merge-policy-disabled`, `merge-required-check-missing`, `merge-required-check-failed`,
  `merge-review-not-approved`, `merge-unresolved-review-threads`,
  `merge-protection-snapshot-stale`, `merge-branch-not-fresh`, `merge-head-ambiguous`,
  `merge-forge-unavailable`, `merge-capability-denied`, and `merge-intent-unwritable` - evidence:
  `type:fixtures` exhaustiveness fixture that fails if a literal is added, removed, or renamed.
- **AC-3** The exported `PostMergeOutcomeState` catalog contains exactly `post-merge-confirmed`,
  `post-merge-retryable-refused`, `post-merge-blocked`, `post-merge-failed`, and
  `post-merge-outcome-ambiguous` - evidence: `type:fixtures` exhaustive switch and positive fixture.
- **AC-8** The exported changed-file class catalog contains exactly `allowed-task-change`,
  `protected-policy-change`, `runner-evidence-change`, `outside-allowlist`, and `unclassified` -
  evidence: `type:fixtures` exhaustive switch and positive fixture over the exact list.
- **AC-9** The exported blocker-evidence eligibility catalog contains exactly the eligible completion
  states `completion-pending-evidence`, `claim-evidence-mismatch`, `verification-failed`,
  `verification-uncertain`, `protected-policy-change-unapproved` and eligible merge states
  `merge-policy-disabled`, `merge-required-check-missing`, `merge-required-check-failed`,
  `merge-review-not-approved`, `merge-unresolved-review-threads`,
  `merge-protection-snapshot-stale`, `merge-branch-not-fresh`, and `merge-capability-denied` -
  evidence: `type:fixtures` exhaustive switch plus negative fixture
  `blocker-eligibility-excludes-ambiguous-and-unwritable-states`.
- **AC-4** `CompletionDecisionPayload` and `MergeDecisionPayload` require the design fields and reject
  missing `schema`, `runId`, `state`, `cursor`/`completionEventId`, `evidenceRefs`/`forgeRefs`, and
  `evaluatedAt` where required - evidence: `type:fixtures` positive constructors plus named negative
  fixtures `completion-payload-missing-cursor` and `merge-payload-missing-completion-event`.
- **AC-5** Core-05 event payload types enumerate the six design events and their `barrier` payload
  schemas without adding provider-specific driver fields - evidence: `type:fixtures` positive event
  payload fixture and negative fixture `forge-intent-provider-driver-field-rejected`.
- **AC-6** Public SDK importability exposes all symbols named in the Spec Surface from `sdk`, including
  this story's own `packages/sdk/src/index.ts` export lines - evidence: `typecheck` public-import test
  importing each symbol from `sdk`.
- **AC-7** Runtime catalogs are frozen substrate, not erased-only type aliases - evidence:
  `coverage:baseline` asserts `Object.isFrozen(COMPLETION_DECISION_STATES) === true` and equivalent
  assertions for merge, post-merge, changed-file, and recovery-consumed blocker catalogs.
- **AC-10** `CompletionMergeEvaluator`, `CompletionReplayAnchor`, and `CompletionEvidenceSet` require the
  design fields used by downstream stories: evaluator input/output states, replay cursor/window fields,
  exact-head evidence refs, verification refs, policy snapshot refs, and optional Forge refs - evidence:
  `type:fixtures` positive constructors plus negative fixtures
  `completion-replay-anchor-missing-cursor`, `completion-evidence-set-missing-head`, and
  `completion-merge-evaluator-wrong-state-rejected`.

## Allowed Writes

- Package/module boundary: `packages/sdk/src/core/completion/contracts/**`.
- Owned pathset: `packages/sdk/src/core/completion/contracts/**`,
  `packages/sdk/tests/core/completion/contracts/**`, and this story's own
  `packages/sdk/src/index.ts` export lines.
- Forbidden dependencies: concrete drivers, provider clients, process/network/filesystem calls,
  `testkit` imports from production source, and recovery modules.
- STOP when any design-required state literal or required payload field cannot be represented without
  inventing a type not owned by this story or an earlier frozen producer.

Every other write is forbidden, including execution package files, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, and unrelated SDK surfaces.

## Dependency Inputs

- Covers signals: contract parts of all core-05 Story Group Signals.
- Depends on: prior frozen `core-01-s1-event-contracts`, Epic 3 `core-02` gate contracts, Epic 1 policy
  and workspace evidence contracts, and Epic 2 Forge/Execution Host port evidence contracts.
- Depended on by: `core-05-s2`, `core-05-s3`, `core-05-s4`, `core-05-s5`, `core-06-s1`, `core-06-s2`.
- Shared shapes consumed: `core-01-s1-event-contracts/RunEventCursor`,
  `core-01-s1-event-contracts/EvidenceEventRef`, Epic 3 `core-02/CapabilityGateRecord`.
- Decision inputs consumed: none; type-only producer.

Execution-time dependency commits: none. Runtime execution must provide {{DEPENDENCY_COMMITS}} for producer stories that have reached tracker status merged.

## Non-Goals And STOP Conditions

- Candidate-head selection, verification freshness, merge predicate evaluation, intent emission, and
  post-merge classification behavior (`core-05-s2`..`core-05-s5`).
- Raw Workspace, Forge, Execution Host, CI, review, or PR evidence gathering.
- Concrete provider drivers, real merges, command execution, or network calls.

- Package/module boundary: `packages/sdk/src/core/completion/contracts/**`.
- Owned pathset: `packages/sdk/src/core/completion/contracts/**`,
  `packages/sdk/tests/core/completion/contracts/**`, and this story's own
  `packages/sdk/src/index.ts` export lines.
- Forbidden dependencies: concrete drivers, provider clients, process/network/filesystem calls,
  `testkit` imports from production source, and recovery modules.
- STOP when any design-required state literal or required payload field cannot be represented without
  inventing a type not owned by this story or an earlier frozen producer.

Also STOP and report if source gaps, missing dependency inputs, required writes outside the owned pathset, or any need to reinterpret an AC appears.

## Implementation Constraints

The implementation constraints are the source-owned spec surface and responsibilities below. Do not introduce implementation choices outside this contract. Preserve deterministic, fail-closed, event-log, dependency-boundary, and public-import constraints exactly as written.

### Spec Surface

- Interfaces / types: `CompletionMergeEvaluator`, `CompletionReplayAnchor`, `CompletionEvidenceSet`,
  `CompletionDecisionPayload`, `MergeDecisionPayload`, `CompletionDecisionState`,
  `MergeDecisionState`, `PostMergeOutcomeState`, changed-file class union, blocker-eligible state
  catalog, `ForgeOperationIntentPayload`, `MergeIntentPayload`, `PostMergeOutcomePayload`.
- Events / append intents: payload types for `ProtectedPolicySnapshotRecorded`,
  `CompletionDecisionRecorded`, `MergeDecisionRecorded`, `ForgeOperationIntentRecorded`,
  `MergeIntentRecorded`, and `PostMergeOutcomeRecorded`.
- Provider operations / commands: none; this story declares value types only.
- Failure and degraded tokens: the exact core-05 completion/merge/post-merge tokens listed in the DAG
  failure-token reconciliation.
- Evidence records / attestations: `EvidenceEventRef` and `RunEventCursor` are consumed from
  `core-01-s1-event-contracts`; capability gate refs are consumed from Epic 3 core-02 contracts.

### Responsibilities

- Declare the design's completion, merge, changed-file, intent, and post-merge payload types exactly
  once.
- Export runtime-frozen catalogs (`as const` plus derived union) for all core-05 state/token sets.
- Expose every public symbol through the SDK entrypoint and prove importability through public imports.
- Provide positive and negative type fixtures for required/forbidden payload fields and catalog
  exhaustiveness.

## Verification

The verification contract is the source-owned coverage matrix, quality bar, and evidence pack below. The repo gate is `pnpm check`; report exact command output or an explicit blocked reason.

### Coverage Matrix

| Responsibility / spec-surface item | Proven by | Standing gate lane |
|---|---|---|
| Completion decision state catalog | AC-1 | `type:fixtures` |
| Merge decision state catalog | AC-2 | `type:fixtures` |
| Post-merge outcome state catalog | AC-3 | `type:fixtures` |
| Changed-file class catalog | AC-8 | `type:fixtures` |
| Blocker-evidence eligibility catalog | AC-9 | `type:fixtures` |
| Completion and merge payload required fields | AC-4 | `type:fixtures` |
| Core-05 event payload schema names | AC-5 | `type:fixtures` |
| Public SDK export/import path | AC-6 | `typecheck` |
| Runtime-frozen catalog substrate | AC-7 | `coverage:baseline` |
| Evaluator, replay anchor, and evidence set shapes | AC-10 | `type:fixtures` |

- Coverage scope and threshold: contract catalog runtime values, 90% statement/branch minimum where
  runtime constants are emitted.
- Coverage command and instrumented lanes: `pnpm check` via `coverage:baseline` and `type:fixtures`.
- Required tests, catalogued by AC and failure row: AC-1..AC-10 fixtures above.
- Public exposure: `sdk` import path plus public-import test in AC-6.
- Determinism constraints: no ambient time, random ids, provider clients, filesystem, process, or network.
- Dependency boundaries: may import only contracts from earlier frozen epics and foundation/provider
  type surfaces allowed by the Dependency Rule.
- File-size budget: 220 lines per source or test file; split catalog, payload, and public-import tests
  before 400 lines; 800 hard cap.
- Domain non-negotiables: evidence over prose; exact-head fields stay data only here.

- Positive and negative `type:fixtures` for every catalog and payload.
- Public-import test for every exported symbol.
- `coverage:baseline` output for runtime-frozen catalogs.
- `pnpm check` result.
- Boundary sweep:
  `grep -REn "Date\\.now|new Date\\(|Math\\.random|crypto\\.randomUUID|child_process|node:net|node:http|node:https|@octokit|from \"testkit\"|from \"@kit/testkit\"" packages/sdk/src/core/completion/contracts packages/sdk/tests/core/completion/contracts`
  returns zero matches except test fixture imports explicitly under tests.

## Commit Cadence

The implementer commits its own work in the story worktree, never the orchestrator:

- make the gate green (`pnpm check`) before every commit;
- make an impl-done commit when the story first proves out, then one commit per fix round;
- tag each commit with trailers `Story: core-05-s1-completion-contracts` and `Round: <n>`;
- on an orchestrator-reported merge-back conflict, rebase the story commits onto the track branch `HEAD`, re-prove with a green gate, and re-commit;
- report a real logic conflict instead of forcing a resolution.

The implementer commits only within the owned pathset in its own story worktree. It never pushes, opens or updates PRs, merges, closes contexts, edits the tracker, or marks stories complete.

## Delivery Report

Report changed files, AC coverage by AC id, per-round commit hashes, tests/checks run, evidence pack, open questions, and blockers. The report and per-round commits are evidence for review and merge-back.

## Mutation Limits

The implementer commits each round within the owned pathset in its own story worktree and rebases only on orchestrator request. It performs no pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - Completion, verification, and recovery](../../../README.md) · **← Prev:** [Epic 5 Execution Plan](../../plan.md) · **Next →:** [Reviewer Prompt - core-05-s1-completion-contracts](./reviewer.md)

<!-- /DOCS-NAV -->
