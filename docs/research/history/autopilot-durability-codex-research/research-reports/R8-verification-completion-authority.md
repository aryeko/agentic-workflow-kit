# R8 - Verification and Completion Authority

## Executive Recommendation

Adopt a runner-owned completion inspector that proves `done` from independently gathered Git, verification, CI, PR, review, and blocker evidence tied to exact commit SHAs; child prose and tracker edits should be recorded only as hints. Confidence: high.

## Sources Checked

- `docs/autopilot-durability-codex-research/README.md`, checked 2026-06-18, defines R8 scope and required report format.
- `docs/autopilot-durability/postmortems/2026-06-18-autopilot-unified-issues.md`, checked 2026-06-18, documents Theme H: completion and merge depended on self-report rather than evidence.
- `docs/autopilot-durability/design/03-completion-verification-and-merge.md`, checked 2026-06-18, draft design for independent inspectors and claim/evidence mismatch.
- `docs/autopilot-durability/design/05-observability-and-analysis.md`, checked 2026-06-18, draft design for structured telemetry and analyzer correlation.
- `packages/orchestrator/src/runner/CompletionGate.ts`, checked 2026-06-18, current completion gate implementation.
- `packages/orchestrator/src/git/GitInspector.ts`, checked 2026-06-18, current local Git evidence implementation.
- `packages/orchestrator/src/collaboration/CollaborationInspector.ts`, checked 2026-06-18, current GitHub collaboration evidence implementation.
- `packages/orchestrator/src/drivers/promptRenderer.ts`, checked 2026-06-18, current child instruction that tracker status is completion authority.
- [Git `diff` documentation](https://git-scm.com/docs/git-diff), checked 2026-06-18, establishes merge-base diff forms for changed-file evidence.
- [Git `merge-base --is-ancestor` documentation](https://man7.org/linux/man-pages/man1/git-merge-base.1.html), checked 2026-06-18, establishes ancestry/freshness exit semantics.
- [Node.js `child_process` documentation](https://nodejs.org/api/child_process.html), version 26.3.1, checked 2026-06-18, establishes runner-owned process execution and stdout/stderr/exit-code capture.
- [GitHub status checks documentation](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks), checked 2026-06-18, documents checks/statuses, required checks, and who can create statuses.
- [GitHub protected branch REST API](https://docs.github.com/en/rest/branches/branch-protection), API version shown as 2026-03-10 in examples, checked 2026-06-18, documents required status-check contexts.
- [GitHub check runs REST API](https://docs.github.com/en/rest/checks/runs), API version shown as 2026-03-10 in examples, checked 2026-06-18, documents check runs for an exact Git ref.
- [GitHub Actions workflow artifacts documentation](https://docs.github.com/en/actions/tutorials/store-and-share-data), checked 2026-06-18, documents storing data after workflow completion.
- [GitHub Actions workflow run logs documentation](https://docs.github.com/en/actions/how-tos/monitor-workflows/use-workflow-run-logs), checked 2026-06-18, documents downloadable logs and artifacts.
- [GitHub CLI `gh pr merge` manual](https://cli.github.com/manual/gh_pr_merge), checked 2026-06-18, documents `--match-head-commit`.
- [GitHub GraphQL public schema](https://docs.github.com/en/graphql/overview/public-schema) downloaded from `https://docs.github.com/public/fpt/schema.docs.graphql`, `Last-Modified: Thu, 18 Jun 2026 15:48:55 GMT`, checked 2026-06-18, confirms `PullRequest.reviewThreads`, `PullRequestReviewThread.isResolved`, `headRefOid`, `reviewDecision`, `mergeStateStatus`, and `statusCheckRollup`.

## Findings

Facts from local sources:

- The current `CompletionGate.evaluate` first reads the returned tracker status. If the returned story is not in a configured complete status, completion fails before independent PR/CI evidence becomes authoritative.
- The current prompt tells the child: "The tracker row status is the only completion authority; child prose is not enough." That avoids raw prose, but still lets the child make the authoritative tracker edit.
- The postmortem documents the failure mode directly: a less careful child could set `done` without verification and pass the old gate, while an honest child that left the story `specced` blocked the run.
- Current `GitInspector` already gathers useful local signals: story branch, head SHA, base SHA, uncommitted paths, commit count since launch/base, and merged PR evidence inferred from the tracker PR link and base commit message.
- Current `CollaborationInspector` already uses `gh pr view` plus branch-protection status-check contexts, PR head SHA, review signal, status-check rollup, and branch existence. It does not yet model unresolved review threads or trusted check provenance.

Facts from external sources:

- Git supports deterministic diff evidence against a merge base, including `A...B` / `--merge-base` forms for "what changed on this branch since the common ancestor."
- Git supports ancestry checks via `merge-base --is-ancestor`; exit status 0 means ancestor, 1 means not ancestor, and other non-zero statuses are errors.
- Node's `child_process.spawn()` gives the parent process stdout, stderr, and close/exit code events; this is enough for the runner to observe verification commands directly instead of accepting a child's summary.
- GitHub required status checks must pass before merging into a protected branch, but GitHub also states that users with write access can create checks and commit statuses through APIs. Status checks are therefore external evidence, not cryptographic proof, unless token separation and trusted check sources are enforced.
- GitHub REST APIs expose required status-check contexts and check runs for a specific commit ref.
- GitHub Actions stores workflow logs and artifacts after completion and supports downloading logs/artifacts, making CI output a viable evidence source when tied to an exact run and head SHA.
- GitHub CLI supports `gh pr merge --match-head-commit <SHA>`, which prevents merging if the PR head changed after inspection.
- The GitHub GraphQL public schema exposes PR review threads and their `isResolved` state, plus PR `reviewDecision`, `mergeStateStatus`, `statusCheckRollup`, and head/base OIDs.

Interpretation:

- "Done" needs two separate authorities: completion authority for the tracker/story state, and merge authority for irreversible repository changes. A blocker-evidence PR may be mergeable while the story remains blocked; these must not be collapsed.
- The runner should treat child output as a proposal. It can tell the runner where to look, but the runner must gather the evidence itself with credentials, process execution, and APIs owned by the supervising workflow.
- Verification can still be gamed by code changes that weaken tests, package scripts, CI workflows, or config. Changed-file scope and diff inspection are therefore part of verification authority, not just review convenience.

## Options

Option 1: Child-authored completion with post-hoc spot checks.

This preserves the current workflow: the child edits the tracker to `done`, reports verification, and the runner checks for obvious Git/PR problems after the fact. It is easy to implement and keeps child autonomy high.

It cannot prove `done` independently. It remains vulnerable to missing verification, fabricated command summaries, stale PR heads, accidental tracker edits, and weakened test scripts. It also reproduces the incident failure mode where honesty determines safety.

Option 2: Runner-owned inspector gate after child exit.

The child implements and may propose a result, but the runner performs the authoritative settle step. The runner snapshots Git, runs configured local verification or reads trusted CI evidence, checks PR/branch/review/blocker state, compares child claims to evidence, and then updates the tracker projection/row.

This enables fail-closed completion decisions and clean mismatch states. It cannot by itself prevent the child from weakening tests or CI in the diff, so it must include changed-file policy and trusted-check provenance.

Option 3: CI-only completion authority.

The runner treats a protected PR with required checks green as the completion authority and avoids local verification capture except as diagnostic evidence.

This uses an established external system and scales across machines. It cannot cover offline/local-only repos, does not prove unrequired gates, can be delayed or unavailable, and may miss modified local verification scripts unless CI is configured from protected base or trusted workflow sources.

## Recommendation

Use Option 2 as the default authority model, with CI as an accepted evidence source when it is tied to the same head SHA and trusted check identity.

The runner must independently gather these evidence records before declaring a story complete:

- `GitEvidence`: current branch, expected story branch, head SHA, base SHA at launch, latest fetched base SHA, ancestry/freshness result, commit count, uncommitted paths excluding known runtime artifacts, diff stat, changed-file list from merge base, and policy classification of changed paths.
- `VerificationEvidence`: configured command identity, argv, cwd, started/finished timestamps, exit code, signal, stdout/stderr output refs, output digests, runner identity, head SHA before and after the command, and whether the command was observed locally, rerun by the runner, or derived from CI.
- `CIEvidence`: PR number, exact head SHA, workflow/check run IDs, required context list, check status/conclusion, run URL, log/artifact refs, and trusted source identity where available.
- `PREvidence`: PR URL/number/state, head branch, head SHA, base branch, base SHA, mergeability/merge-state signal, branch existence, and whether the PR corresponds to the expected story branch.
- `ReviewEvidence`: required review decision, configured bot/human review signal, unresolved review thread count and refs, unresolved bot findings, and whether findings were resolved after the latest diff-changing commit.
- `BlockerEvidence`: typed blockers with source and reproduction evidence: failed verification, missing dependency/network access, auth failure, stale base, merge conflict, unavailable inspector, unresolved review, missing PR, changed-file policy violation, or claim/evidence mismatch.
- `ClaimReconciliation`: child-declared status, claimed verification commands, claimed PR refs, claimed blockers, and a comparison result against runner-gathered evidence.

Child claims that may only be hints:

- "I ran tests", "verification passed", or a pasted output summary.
- "The story is done" or a tracker row changed to `done`.
- "PR is open/green/merged" or a PR URL in prose.
- "No blockers" or "review comments resolved."
- Claimed changed files, branch names, CI status, base freshness, or merge readiness.

The runner may use those claims to decide which inspector to run first or which PR number to query, but a claim with no matching independent evidence should become `claim-evidence-mismatch`, not completion.

Verification output capture should be runner-owned:

- The command spec should come from `.workflow/config.yaml` or repo policy, not from child prose. Child-requested commands can be recorded as requested hints.
- The runner should execute local verification using `spawn`/`execFile`-style process APIs with explicit argv/cwd/env allowlist, not an opaque child transcript.
- Capture stdout and stderr as byte streams to append-only run artifacts. Store full output by content-addressed file or immutable evidence ref; include a bounded inline tail for reports.
- Record exit code, signal, timeout, start/end timestamps, runner PID/session identity, command hash, cwd, env allowlist hash, head SHA before/after, and output SHA-256.
- If output is truncated for UI, the truncation must be explicit and the digest must cover the full captured stream.
- If the child already ran the command and the driver can observe actual tool-call stdout/stderr/exit code, that observed driver capture can count. A natural-language summary cannot.
- If local verification cannot run, use CI evidence only when it is tied to the exact PR head SHA and trusted contexts; otherwise park as `verification-unavailable`.

Changed-file scope should be a first-class gate:

- Always compute the diff from merge base to story head.
- Classify changes to verification scripts, package scripts, lockfiles, CI workflows, repo config, generated artifacts, tracker files, and story-owned product files.
- Treat changes that can weaken verification or bypass policy as elevated risk requiring reviewer/owner approval or trusted CI from protected workflow definitions.
- Require the tracker update and PR link to be consistent with the inspected PR, but do not let tracker status drive completion.

## Tradeoffs and Risks

- Runner-side verification costs time and compute, especially when the child already ran tests. The cost is justified for autonomous completion because self-report is the incident root cause.
- Some repos require credentials, services, browsers, or network to verify. The runner needs explicit degraded states rather than implicit success.
- GitHub statuses/checks are not inherently unforgeable because write-capable actors can create statuses. The kit should record check source/app identity and allow repositories to configure trusted contexts.
- CI artifacts/logs have retention limits and can be deleted by users with sufficient access. The runner should snapshot essential CI evidence into the run artifact at settle time.
- Local verification can be made meaningless by changing tests or scripts. Diff-scope policy and review evidence must be part of completion, not a separate optional concern.
- Fail-closed behavior will block more runs at first. That is acceptable; the system should surface precise blocker evidence rather than silently claiming completion.
- Review-thread inspection through GraphQL is version-sensitive; the public schema confirms fields on 2026-06-18, but implementation should capability-probe and degrade safely.

## Fallback and Degraded Modes

- No local verify capability: mark `verification-unavailable`; accept CI only if exact-head, trusted-context evidence exists.
- No GitHub auth or `gh` unavailable: complete only in local/no-PR policy modes where configured; otherwise mark `collaboration-inspector-unavailable`.
- Branch protection unavailable or forbidden by permissions: record unknown required checks and fail closed for auto-merge; allow manual handoff.
- Review-thread GraphQL unavailable: record `review-thread-state-unavailable`; fail closed for policies that require no unresolved threads.
- PR missing: if policy requires PR, mark blocked with `pr-missing`; if no-PR policy is configured, require local verification and branch evidence.
- Base branch moved after verification: mark `stale-base`; require rebase/update and rerun verification.
- Head SHA changed after inspection: discard stale evidence and rerun inspectors; use `--match-head-commit` for merge.
- Child says done but evidence is absent or contradictory: mark `claim-evidence-mismatch`; preserve the child claim as diagnostic data only.
- Blocker-evidence PR exists: if `mergeBlockerEvidence` is disabled, do not merge and keep story blocked. If enabled, runner may merge the evidence PR only after merge gates pass while keeping the story in a blocked terminal state.

## Validation Spikes

- Build a pure `CompletionDecision` fixture table with combinations for: child says done/no evidence, verification pass/no PR, CI green/stale base, PR merged/story blocked, unresolved review thread, changed test script, and inspector unavailable.
- Add a runner-owned verify wrapper prototype that runs a harmless configured command, captures stdout/stderr/exit code/digest/head SHA, and proves a fabricated child summary cannot satisfy the gate.
- Replay the June 2026 incident artifacts and assert RV01 becomes `claim-evidence-mismatch` rather than complete.
- Prototype GraphQL review-thread inspection against a real PR and assert unresolved `isResolved: false` threads block merge readiness.
- Prototype exact-head CI lookup: collect required contexts, check runs/status rollup for the PR head SHA, and reject evidence after pushing a new commit.
- Add a fixture where the child modifies `package.json` test scripts or CI workflow files; assert changed-file policy escalates the run even if local verification passes.
- Validate `gh pr merge --match-head-commit` behavior in a test repo by inspecting one head SHA, pushing another, and confirming the merge is rejected.
- Test output truncation by running a command with large stdout/stderr and verifying the full digest and artifact ref remain available.

## Open Questions

- Which check sources should be trusted by default: required contexts only, GitHub Actions only, specific GitHub App IDs, or repo-configured allowlists?
- Should the runner itself update the tracker row after evidence passes, or should it require the child's tracker edit plus runner confirmation?
- How strict should changed-file policy be for verification-related files: block, require human review, or allow if CI from protected base passes?
- What is the minimum local-only completion contract for repositories without GitHub PRs?
- Should `done` mean "implementation branch verified and PR ready" while `verified` means "merged/CI accepted on base", or should status semantics change in vNext?
- How much raw verification output should be retained locally by default, and what retention/cleanup policy should avoid creating evidence sprawl?

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../../README.md) · **← Prev:** [R7 - Recovery, Resume, and Relaunch](./R7-recovery-resume-relaunch.md) · **Next →:** [R9 - PR, Review, CI, and Merge Gating](./R9-pr-review-ci-merge-gating.md)

<!-- /DOCS-NAV -->
