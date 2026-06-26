# Reviewer Prompt - core-05-s1-completion-contracts

## Assigned Routing

- Source story id: `core-05-s1-completion-contracts`
- Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10
- Model class: `frontier-reviewer`
- Effort: `high`
- Suggested-tier floor: `elevated`
- Reasoning tier: `elevated`
- Routing rationale: review must independently verify AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10 for public SDK contract and runtime catalog producer consumed by every core-05 behavior story and core-06 recovery; reviewer routing is fixed to `frontier-reviewer` by package rules.

## Original Scope

- Story id: `core-05-s1-completion-contracts`
- Epic slug: `epic-5-completion-verification-and-recovery`
- Source story contract path: `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-05-s1-completion-contracts.md`
- Acceptance criteria: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10
- Allowed pathset: `packages/sdk/src/core/completion/contracts/**`, `packages/sdk/tests/core/completion/contracts/**`, own `packages/sdk/src/index.ts` export lines
- Dependencies: none
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus producer contracts listed in the source story.

### Acceptance Criteria

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

### Dependencies And Frozen Inputs

- Covers signals: contract parts of all core-05 Story Group Signals.
- Depends on: prior frozen `core-01-s1-event-contracts`, Epic 3 `core-02` gate contracts, Epic 1 policy
  and workspace evidence contracts, and Epic 2 Forge/Execution Host port evidence contracts.
- Depended on by: `core-05-s2`, `core-05-s3`, `core-05-s4`, `core-05-s5`, `core-06-s1`, `core-06-s2`.
- Shared shapes consumed: `core-01-s1-event-contracts/RunEventCursor`,
  `core-01-s1-event-contracts/EvidenceEventRef`, Epic 3 `core-02/CapabilityGateRecord`.
- Decision inputs consumed: none; type-only producer.

### Non-Goals

- Candidate-head selection, verification freshness, merge predicate evaluation, intent emission, and
  post-merge classification behavior (`core-05-s2`..`core-05-s5`).
- Raw Workspace, Forge, Execution Host, CI, review, or PR evidence gathering.
- Concrete provider drivers, real merges, command execution, or network calls.

### STOP Conditions And Boundaries

- Package/module boundary: `packages/sdk/src/core/completion/contracts/**`.
- Owned pathset: `packages/sdk/src/core/completion/contracts/**`,
  `packages/sdk/tests/core/completion/contracts/**`, and this story's own
  `packages/sdk/src/index.ts` export lines.
- Forbidden dependencies: concrete drivers, provider clients, process/network/filesystem calls,
  `testkit` imports from production source, and recovery modules.
- STOP when any design-required state literal or required payload field cannot be represented without
  inventing a type not owned by this story or an earlier frozen producer.

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check all of the following against the original source story and runtime evidence:

- AC coverage by source AC id: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10.
- Each AC names and is re-proven by its standing gate lane; treat proof that is only manual, one-off, or outside the standing gate as BLOCKING.
- Failure, degraded, and validation rows from the story contract.
- Evidence pack completeness.
- Public API and import paths.
- Dependency boundaries and committed dependency inputs.
- Stale names and sibling occurrences.
- Tests and sweeps.
- Scope control against allowed writes.
- Repo conventions and mutation limits.

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

### Failure and Degraded Outcomes

This is the authoritative producer catalog for core-05 failure/degraded/state tokens. It consumes no
failure tokens from another Epic 5 story.

| token | trigger | required behavior | proven by |
|---|---|---|---|
| completion state catalog mismatch | implementation omits, renames, or adds a completion state | `type:fixtures` fails exhaustiveness | AC-1 |
| merge state catalog mismatch | implementation omits, renames, or adds a merge state | `type:fixtures` fails exhaustiveness | AC-2 |
| post-merge state catalog mismatch | implementation omits, renames, or adds a post-merge state | `type:fixtures` fails exhaustiveness | AC-3 |
| changed-file class catalog mismatch | implementation omits, renames, or adds a changed-file class | `type:fixtures` fails exhaustiveness | AC-8 |
| blocker eligibility catalog mismatch | implementation omits, renames, or adds a blocker-eligible state | `type:fixtures` fails exhaustiveness | AC-9 |
| payload shape invalid | required payload field missing or provider-specific field added | named negative fixture fails | AC-4, AC-5 |
| evaluator/replay/evidence shape invalid | required evaluator, replay anchor, or evidence-set field is missing or wrong-shaped | named negative fixture fails | AC-10 |



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

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source AC id or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside allowed paths. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - Completion, verification, and recovery](../../../README.md) · **← Prev:** [Implementer Prompt - core-05-s1-completion-contracts](./implementer.md) · **Next →:** [Implementer Prompt - core-05-s2-completion-evidence](../core-05-s2-completion-evidence/implementer.md)

<!-- /DOCS-NAV -->
