# Implementer Prompt - core-05-s2-completion-evidence

## Assigned Routing

- Source story id: `core-05-s2-completion-evidence`
- Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9
- Model class: `strong-coder`
- Effort: `high`
- Suggested-tier floor: `elevated`
- Reasoning tier: `elevated`
- Routing rationale: minimal compliant route. The frozen DAG sets an elevated floor, and fail-closed exact-head completion predicate over committed evidence and barrier append behavior; no critical/frontier escalation is authorized by the source contract.

## Exact Task

Implement `core-05-s2-completion-evidence` for epic `epic-5-completion-verification-and-recovery`: Select candidate head, evaluate protected-policy/changed-file gate, verify freshness, and append completion decisions.

Source story: `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-05-s2-completion-evidence.md`. Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9.

## Why It Matters

Evaluate candidate-head evidence, protected-policy snapshots, changed-file policy, verification
freshness, and completion decisions from committed replay data, without trusting worker prose or
gathering raw evidence.

Downstream dependents: `core-05-s3-merge-readiness`, `core-05-s4-forge-intents-and-blockers`. Dependency inputs and public contracts from this story must be stable before those dependents run.

## Required Reading

- `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-05-s2-completion-evidence.md`
- `docs/implementation/epics/epic-5-completion-verification-and-recovery/story-dag.md`
- Core-05 normative design files.
- `core-05-s1-completion-contracts`.
- Fro
- Runtime dependency commits: `{{DEPENDENCY_COMMITS}}` for producer stories listed below.

## Acceptance Criteria

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

## Allowed Writes

- Package/module boundary: `packages/sdk/src/core/completion/evidence/**`.
- Owned pathset: `packages/sdk/src/core/completion/evidence/**`,
  `packages/sdk/tests/core/completion/evidence/**`, and this story's own SDK barrel export lines.
- Forbidden dependencies: Forge clients, Execution Host command runners, git/filesystem/process/network
  APIs, concrete drivers, recovery modules.
- STOP when any branch value such as policy approval, path allowlist, clean head, or command freshness is
  not supplied by declared replay/projection/policy evidence.

Every other write is forbidden, including execution package files, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, and unrelated SDK surfaces.

## Dependency Inputs

- Covers signals: candidate-head selection and exact-head evidence refs; protected policy snapshot
  records and changed-file policy signals; completion decision states and `claim-evidence-mismatch`;
  verification freshness.
- Depends on: `core-05-s1-completion-contracts`; prior fro

Execution-time dependency commits: `core-05-s1-completion-contracts`. Runtime execution must provide {{DEPENDENCY_COMMITS}} for producer stories that have reached tracker status merged.

## Non-Goals And STOP Conditions

- Merge-readiness predicate and `MergeDecisionRecorded` (`core-05-s3`).
- Forge/merge/blocker intents (`core-05-s4`) and post-merge classification (`core-05-s5`).
- Running commands, reading git state, inspecting Forge, or approving protected-policy changes.

- Package/module boundary: `packages/sdk/src/core/completion/evidence/**`.
- Owned pathset: `packages/sdk/src/core/completion/evidence/**`,
  `packages/sdk/tests/core/completion/evidence/**`, and this story's own SDK barrel export lines.
- Forbidden dependencies: Forge clients, Execution Host command runners, git/filesystem/process/network
  APIs, concrete drivers, recovery modules.
- STOP when any branch value such as policy approval, path allowlist, clean head, or command freshness is
  not supplied by declared replay/projection/policy evidence.

Also STOP and report if source gaps, missing dependency inputs, required writes outside the owned pathset, or any need to reinterpret an AC appears.

## Implementation Constraints

## Spec Surface

- Interfaces / types: `selectCompletionCandidateHead`, `classifyChangedPaths`,
  `isVerificationFresh`, `evaluateCompletion`.
- Events / append intents: `ProtectedPolicySnapshotRecorded`, `CompletionDecisionRecorded`.
- Provider operations / commands: none; consumes recorded Workspace, Execution Host, Forge/claim, and
  approval evidence only as event refs and projections.
- Failure and degraded tokens: consumes `core-05-s1` completion and changed-file catalogs verbatim.
- Evidence records / attestations: consumes `CompletionReplayAnchor`, `LocalGitEvidenceRecorded`,
  `RunnerCommandCaptured`, `HostOperationFailed`, `ApprovalDecisionRecorded(protected-policy-change)`,
  policy allowlist, and `RunEventCursor`.

## Responsibilities

- Select exactly one clean latest usable `LocalGitEvidence.headSha` for the active Worktree lease, or
  fail closed.
- Record or consume launch-time protected-policy snapshots with verifier command and protected path-set
  digests.
- Classify changed paths into the five design classes and map invalid classes to exact completion
  states.
- Determine verification freshness from runner-owned verify capture bracketed by clean matching local
  git evidence before and after the command.
- Append `CompletionDecisionRecorded` with cursor, evidence refs, exact head when available, and named
  fail-closed state.

Do not introduce implementation choices outside the source contract. Preserve deterministic, fail-closed, event-log, dependency-boundary, and public-import constraints exactly as written.

## Verification

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

The repo gate is `pnpm check`. Report exact command output or an explicit blocked reason.

## Commit Cadence

The implementer commits its own work in the story worktree, never the orchestrator:

- make the gate green (`pnpm check`) before every commit;
- make an impl-done commit when the story first proves out, then one commit per fix round;
- tag each commit with trailers `Story: core-05-s2-completion-evidence` and `Round: <n>`;
- on an orchestrator-reported merge-back conflict, rebase the story commits onto the track branch `HEAD`, re-prove with a green gate, and re-commit;
- report a real logic conflict instead of forcing a resolution.

The implementer commits only within the owned pathset in its own story worktree. It never pushes, opens or updates PRs, merges, closes contexts, edits the tracker, or marks stories complete.

## Delivery Report

Report changed files, AC coverage by AC id, per-round commit hashes, tests/checks run, evidence pack, open questions, and blockers. The report and per-round commits are evidence for review and merge-back.

## Mutation Limits

The implementer commits each round within the owned pathset in its own story worktree and rebases only on orchestrator request. It performs no pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - Completion, verification, and recovery](../../../README.md) · **← Prev:** [Reviewer Prompt - core-05-s1-completion-contracts](../core-05-s1-completion-contracts/reviewer.md) · **Next →:** [Reviewer Prompt - core-05-s2-completion-evidence](./reviewer.md)

<!-- /DOCS-NAV -->
