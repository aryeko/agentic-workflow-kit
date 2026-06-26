# Reviewer Prompt - core-05-s2-completion-evidence

## Assigned Routing

- Source story id: `core-05-s2-completion-evidence`
- Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9
- Model class: `frontier-reviewer`
- Effort: `high`
- Suggested-tier floor: `elevated`
- Reasoning tier: `elevated`
- Routing rationale: review must independently verify AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9 for fail-closed exact-head completion predicate over committed evidence and barrier append behavior; reviewer routing is fixed to `frontier-reviewer` by package rules.

## Original Scope

- Story id: `core-05-s2-completion-evidence`
- Epic slug: `epic-5-completion-verification-and-recovery`
- Source story contract path: `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-05-s2-completion-evidence.md`
- Acceptance criteria: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9
- Allowed pathset: `packages/sdk/src/core/completion/evidence/**`, `packages/sdk/tests/core/completion/evidence/**`, own `packages/sdk/src/index.ts` export lines
- Dependencies: `core-05-s1-completion-contracts`
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus producer contracts listed in the source story.

### Acceptance Criteria

- **AC-1** Candidate-head selection returns a single latest usable clean `headSha` at or before
  `evaluatedThrough.afterSequence`, and returns `head-ambiguous` or `workspace-dirty` when evidence is
  missing, multiple, or dirty - evidence: `coverage:baseline` table tests
  `candidate-single-clean-head`, `candidate-ambiguous-heads`, and `candidate-dirty-worktree`.
- **AC-2** Protected-policy snapshots record the resolved policy ref, base SHA, verifier command digest,
  protected CI/package/config path-set digests, and source evidence refs - evidence:
  `coverage:baseline` assertion that `ProtectedPolicySnapshotRecorded.payload.schema ===
  "kit-vnext.protected-policy-snapshot-recorded.v1"` and required fields equal fixture values.
- **AC-3** Changed-path classification returns exactly `allowed-task-change`,
  `protected-policy-change`, `runner-evidence-change`, `outside-allowlist`, or `unclassified`, and maps
  `outside-allowlist` to `changed-files-outside-allowlist`, absent policy/protected sets to
  `changed-file-policy-absent`, and unapproved protected policy changes to
  `protected-policy-change-unapproved` - evidence: `coverage:baseline` table
  `changed-path-gate-matrix` asserts every class and state mapping.
- **AC-4** Verification is fresh only when the verify command capture is complete, exit code `0`, the
  command digest equals the protected-policy snapshot verifier digest, and pre/post local git evidence
  is clean for the same `headSha` - evidence: `coverage:baseline`
  `verification-freshness-matrix` asserts fresh, failed, uncertain, and head-changed cases.
- **AC-5** `claim-evidence-mismatch` is emitted when worker prose claims done but local or verification
  evidence for the exact head is missing or negative; missing Forge/review/thread evidence does not block
  `completion-verified` unless the claim explicitly asserts merge readiness - evidence:
  `coverage:baseline` fixtures `claim-done-no-verify`, `claim-done-negative-verify`, and
  `completion-without-forge-pr-evidence`.
- **AC-6** `CompletionDecisionRecorded` is appended at barrier durability with `runId`, `state`,
  optional exact `headSha`, `cursor`, cited `evidenceRefs`, and `evaluatedAt`; append failure returns
  `event-log-unwritable` and no success payload - evidence: `coverage:baseline`
  `completion-decision-append-fields` and `completion-decision-log-unwritable`.
- **AC-7** Public SDK importability exposes completion evidence functions through this story's SDK export
  lines - evidence: `typecheck` public-import test imports the four functions from `sdk`.
- **AC-8** `completion-pending-evidence` is emitted when a single clean candidate head exists but
  required independent completion evidence is absent and no worker claim turns the absence into
  `claim-evidence-mismatch` - evidence: `coverage:baseline` fixture
  `completion-pending-missing-independent-evidence`.
- **AC-9** `forge-evidence-unavailable` is emitted only when a worker claim explicitly asserts merge
  readiness and required Forge-side evidence for that claim is missing or unavailable; ordinary
  completion without Forge evidence can still be `completion-verified` - evidence:
  `coverage:baseline` fixtures `merge-claim-forge-evidence-unavailable` and
  `completion-without-forge-pr-evidence`.

### Dependencies And Frozen Inputs

- Covers signals: candidate-head selection and exact-head evidence refs; protected policy snapshot
  records and changed-file policy signals; completion decision states and `claim-evidence-mismatch`;
  verification freshness.
- Depends on: `core-05-s1-completion-contracts`; prior fro

### Non-Goals

- Merge-readiness predicate and `MergeDecisionRecorded` (`core-05-s3`).
- Forge/merge/blocker intents (`core-05-s4`) and post-merge classification (`core-05-s5`).
- Running commands, reading git state, inspecting Forge, or approving protected-policy changes.

### STOP Conditions And Boundaries

- Package/module boundary: `packages/sdk/src/core/completion/evidence/**`.
- Owned pathset: `packages/sdk/src/core/completion/evidence/**`,
  `packages/sdk/tests/core/completion/evidence/**`, and this story's own SDK barrel export lines.
- Forbidden dependencies: Forge clients, Execution Host command runners, git/filesystem/process/network
  APIs, concrete drivers, recovery modules.
- STOP when any branch value such as policy approval, path allowlist, clean head, or command freshness is
  not supplied by declared replay/projection/policy evidence.

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

- AC coverage by source AC id: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9.
- Each AC names and is re-proven by its standing gate lane; treat proof that is only manual, one-off, or outside the standing gate as BLOCKING.
- Failure, degraded, and validation rows from the story contract.
- Evidence pack completeness.
- Public API and import paths.
- Dependency boundaries and committed dependency inputs.
- Stale names and sibling occurrences.
- Tests and sweeps.
- Scope control against allowed writes.
- Repo conventions and mutation limits.

## Coverage Matrix

| Responsibility / spec-surface item | Proven by | Standing gate lane |
|---|---|---|
| Candidate-head selection | AC-1 | `coverage:baseline` |
| Protected policy snapshot payload | AC-2 | `coverage:baseline` |
| Changed-file policy classifications and state mappings | AC-3 | `coverage:baseline` |
| Verification freshness | AC-4 | `coverage:baseline` |
| Claim/prose mismatch handling | AC-5 | `coverage:baseline` |
| Completion decision barrier append and unwritable failure | AC-6 | `coverage:baseline` |
| Public SDK exports | AC-7 | `typecheck` |
| Pending completion evidence state | AC-8 | `coverage:baseline` |
| Forge evidence unavailable for merge-readiness claim | AC-9 | `coverage:baseline` |

## Failure and Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `workspace-dirty` | selected local git evidence is dirty | no completion success; record fail-closed decision | AC-1 |
| `head-ambiguous` | no single latest usable head can be selected | no Forge write intent; record fail-closed decision | AC-1 |
| `changed-file-policy-absent` | allowlist/protected path-set source is absent | fail closed before merge/intent eligibility | AC-3 |
| `changed-files-outside-allowlist` | changed path matches none of the allowed/protected/evidence classes | fail closed | AC-3 |
| `protected-policy-change-unapproved` | protected-policy path changed without recorded approval | fail closed | AC-3 |
| `verification-failed` | complete verify capture exits non



- Coverage scope and threshold: `packages/sdk/src/core/completion/evidence/**`, 95% branch/statement.
- Coverage command and instrumented lanes: `pnpm check` via `coverage:baseline`.
- Required tests: AC-1..AC-9 plus every failure row.
- Public exposure: `sdk` import path for evaluator helpers; public-import test in AC-7.
- Determinism constraints: injected `evaluatedAt` only; no ambient clock, git reads, command execution,
  Forge calls, network, process APIs, or filesystem reads.
- Dependency boundaries: no concrete driver imports; input evidence must be committed replay/projection
  data or fro

- Table tests and negative fixtures named in AC-1..AC-9, including
  `completion-pending-missing-independent-evidence` and `merge-claim-forge-evidence-unavailable`.
- Public-import test in AC-7.
- `pnpm check` result.
- Boundary sweep:
  `grep -REn "Date\\.now|new Date\\(|Math\\.random|crypto\\.randomUUID|execa|child_process|node:net|node:http|node:https|@octokit|spawn\\(|simple-git|from \"testkit\"|from \"@kit/testkit\"" packages/sdk/src/core/completion/evidence packages/sdk/tests/core/completion/evidence`
  returns

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source AC id or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside allowed paths. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - Completion, verification, and recovery](../../../README.md) · **← Prev:** [Implementer Prompt - core-05-s2-completion-evidence](./implementer.md) · **Next →:** [Implementer Prompt - core-05-s3-merge-readiness](../core-05-s3-merge-readiness/implementer.md)

<!-- /DOCS-NAV -->
