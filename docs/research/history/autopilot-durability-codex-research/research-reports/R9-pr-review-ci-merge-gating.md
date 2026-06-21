# R9 - PR, Review, CI, and Merge Gating

## Executive Recommendation

Adopt a runner-owned, fail-closed merge inspector that treats GitHub branch protection/rulesets as the minimum platform contract, then adds workflow-kit policy for exact-head evidence, review-thread closure, trusted bot findings, stale-base handling, and blocker-evidence PRs. Confidence: high for GitHub.com behavior checked on 2026-06-18; medium for GitHub Enterprise Server and non-GitHub forges because fields and merge queue support vary by version.

## Sources Checked

- `docs/autopilot-durability-codex-research/README.md`, checked 2026-06-18, defines R9 scope and required report format.
- `docs/autopilot-durability/postmortems/2026-06-18-autopilot-unified-issues.md`, checked 2026-06-18, documents Theme H and the incidents where merge/completion relied on self-report or parent judgment.
- `docs/autopilot-durability/design/03-completion-verification-and-merge.md`, checked 2026-06-18, draft design for independent inspectors, fail-closed merge policy, and blocker-evidence PRs.
- `docs/autopilot-durability-codex-research/research-reports/R8-verification-completion-authority.md`, checked 2026-06-18, adjacent lane report recommending exact-head verification and review evidence as completion inputs.
- [GitHub: About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches), checked 2026-06-18, documents required reviews, required status checks, conversation resolution, merge queue, deployments, linear history, and bypass behavior.
- [GitHub REST: Protected branches](https://docs.github.com/en/rest/branches/branch-protection), API examples show version `2026-03-10`, checked 2026-06-18, exposes branch protection, required status checks, required PR reviews, required conversation resolution, and related settings.
- [GitHub: About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets), checked 2026-06-18, documents that rulesets layer with branch protection and that multiple matching rulesets aggregate.
- [GitHub: Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets), checked 2026-06-18, documents ruleset requirements including pull requests, status checks, deployments, code scanning, code quality, signed commits, and linear history.
- [GitHub: About status checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks), checked 2026-06-18, documents checks versus commit statuses, status/check conclusions, skipped jobs, and who can set statuses.
- [GitHub: Troubleshooting required status checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks), checked 2026-06-18, documents latest-SHA requirements, test merge commit behavior, and skipped workflow caveats.
- [GitHub REST: Commit statuses](https://docs.github.com/en/rest/commits/statuses), API examples show version `2026-03-10`, checked 2026-06-18, documents combined commit status semantics for a ref.
- [GitHub REST: Check runs](https://docs.github.com/en/rest/checks/runs), API examples show version `2026-03-10`, checked 2026-06-18, documents check run status/conclusion fields and listing check runs for a Git ref.
- [GitHub REST: Pull requests](https://docs.github.com/en/rest/pulls/pulls), API examples show version `2026-03-10`, checked 2026-06-18, documents pull request merge, `sha` exact-head guard, `merge_method`, `update-branch`, and `expected_head_sha`.
- [GitHub REST: Review requests](https://docs.github.com/en/rest/pulls/review-requests), API examples show version `2026-03-10`, checked 2026-06-18, documents requested reviewers and requesting reviews.
- [GitHub REST: Pull request reviews](https://docs.github.com/en/rest/pulls/reviews), API examples show version `2026-03-10`, checked 2026-06-18, documents review states including `APPROVE`, `REQUEST_CHANGES`, `COMMENT`, and pending review behavior.
- [GitHub REST: Issue comments](https://docs.github.com/en/rest/issues/comments), API examples show version `2026-03-10`, checked 2026-06-18, documents PR issue comments and the distinction from review comments.
- [GitHub GraphQL: Pull requests reference](https://docs.github.com/en/graphql/reference/pulls), checked 2026-06-18, documents `PullRequest` fields such as `reviewDecision`, `mergeStateStatus`, `mergeQueue`, `mergeQueueEntry`, `baseRefOid`, `reviewThreads`, and `PullRequestReviewThread.isResolved`.
- [GitHub GraphQL: Pull request mutations](https://docs.github.com/en/graphql/reference/pulls), checked 2026-06-18, documents `enablePullRequestAutoMerge`, `enqueuePullRequest`, `mergePullRequest`, `requestReviews`, `resolveReviewThread`, and `updatePullRequestBranch`.
- [GitHub: Managing a merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue), checked 2026-06-18, documents merge queue settings and third-party CI requirements.
- [GitHub: Merging a pull request with a merge queue](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/merging-a-pull-request-with-a-merge-queue), checked 2026-06-18, documents enqueue behavior and GitHub CLI behavior for merge queues.
- [GitHub: About merge methods](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/about-merge-methods-on-github), checked 2026-06-18, documents merge commit, squash, rebase, linear-history implications, write-permission requirement, and queue-controlled merge methods.

## Findings

Facts from local sources:

- The unified postmortem identifies merge/completion as underspecified: autonomous runs shipped zero stories, and "merge blocker evidence while story remains blocked" was applied manually rather than as explicit runner policy.
- The draft D3 design already requires independent merge inspectors, fail-closed behavior when GitHub/inspectors are unavailable, and a separate `mergeBlockerEvidence` policy for PRs that document a blocker.
- R8 recommends exact-head evidence for completion and treats child claims as hints. R9 should apply the same exact-head rule to irreversible merge actions.

Facts from GitHub sources:

- Branch protection can require pull request reviews, status checks, conversation resolution, signed commits, linear history, merge queue, and deployments before merging to a protected branch.
- Rulesets can layer with branch protection; multiple matching rulesets aggregate and the most restrictive version of overlapping rules applies. Rulesets can also express merge-relevant requirements such as pull requests, status checks, deployments, code scanning, code quality, signed commits, and linear history.
- Required reviews can require a number of approvals, code owner approval, dismissal of stale approvals, and approval of the most recent reviewable push. GitHub explicitly notes that stale review dismissal is safer against unapproved content being added after approval.
- Required status checks must pass before merging. GitHub treats `successful`, `skipped`, or `neutral` as passing for protected branches; GitHub Actions reports skipped jobs as success for dependent checks, while workflows skipped by path/branch/message filtering can remain pending and block.
- Required checks may need to pass against the latest commit SHA. When a test merge commit has statuses, those can be the relevant checks; otherwise the head commit checks are used.
- Status checks are not inherently trustworthy just because they are green: GitHub documents that write-capable users/integrations can set commit statuses, and checks/commit statuses can be created through APIs. Branch protection can restrict a required status check to a selected app source.
- The REST branch-protection API exposes the active protection for a concrete branch and includes required checks, review requirements, required conversation resolution, linear history, and related settings. It requires administration read permission for private/current protected branch inspection.
- Pull request review data is exposed separately from issue comments. Review states include approval, request changes, comment, and pending reviews; requested reviewers are separately queryable until they submit a review.
- GraphQL exposes `PullRequest.reviewDecision`, `mergeStateStatus`, `mergeable`, `reviewThreads`, `reviewThreads.nodes[].isResolved`, `baseRefOid`, `headRefOid` through the `PullRequest` model, and merge queue fields through `mergeQueue` / `mergeQueueEntry`.
- The REST merge endpoint accepts `sha`, the required expected PR head. If the head changed, GitHub returns a conflict rather than merging. It accepts `merge_method` values `merge`, `squash`, or `rebase`.
- The REST update-branch endpoint accepts `expected_head_sha`, which prevents updating a PR branch if the inspected head has already changed.
- Merge queue is a first-class branch protection option. Once a PR has passed required checks, a write-capable user can add it to the queue; the queue validates the PR changes against the latest target branch plus earlier queued PRs. With a merge queue, the merge method is controlled by the queue configuration rather than chosen per merge.
- GitHub CLI can add a PR to a required merge queue or enable auto-merge depending on check state, but the durable primitive for the kit should be explicit API evidence and policy, not CLI prose.
- GitHub issue comments and review comments are listable, but comments have no universal "blocking" state unless they are represented through review states, unresolved review threads, branch protection conversation resolution, labels, or status/check outputs.

Interpretation:

- GitHub's own merge button is a useful last line of defense, not enough for autonomous safety. The runner needs to know why it is merging or parking, record the evidence, and avoid bypass/admin paths.
- The durable standard is a two-layer gate: platform requirements from branch protection/rulesets plus workflow-kit safety requirements that close gaps GitHub leaves configurable or non-machine-readable.
- "Green CI" is necessary but insufficient. The merge inspector must bind every check/review decision to the exact head SHA it inspected, trusted check source, current base/queue semantics, and the absence of unresolved review/bot findings.
- Bot comments should be treated as human-readable evidence unless the bot also emits a machine-readable status/check/label/review state. A repository can opt into parsing known bot comments, but unknown bot prose should fail closed for autonomous merge.

## Options

Option 1: Delegate to GitHub mergeability.

The runner opens a PR and calls GitHub merge, auto-merge, or `gh pr merge`, relying on GitHub to reject unsafe merges through branch protection. This is simple and benefits from GitHub's native enforcement.

It cannot explain or classify blockers well, does not cover bot comments without branch protection integration, may use admin/bypass paths accidentally, and cannot represent blocker-evidence PRs independently from story completion. It also fails closed only at the final write, after the runner has already lost precise decision authority.

Option 2: Runner-owned merge inspector over GitHub evidence.

The runner fetches branch protection/ruleset policy, PR GraphQL state, required checks/statuses for the exact head or test merge commit, reviews/review requests, unresolved review threads, issue/review comments from configured bot identities, merge queue state, base freshness, and allowed merge methods. It emits a `MergePolicyDecision` before any merge/enqueue call.

This enables explainable fail-closed behavior, exact-head merge guards, queue-aware behavior, re-request loops, and blocker-evidence PR merges that do not mark stories complete. It needs more API work, capability probing, and careful pagination/rate-limit handling.

Option 3: Merge queue as the only autonomous merge path.

The runner never directly merges. It only enqueues PRs after its own preflight checks pass, then waits for the queue to merge or remove the PR. This is robust for busy protected branches and delegates latest-base compatibility to GitHub.

It cannot support repositories without merge queue, local-only workflows, or forges without equivalent queues. It also needs CI configured for `merge_group` / queue branches, and queue failure reasons still need polling and classification.

## Recommendation

Use Option 2 as the default and treat Option 3 as the preferred transport when the protected base requires a merge queue.

The workflow-kit merge inspector should produce a typed `MergeEvidence` record and a `MergePolicyDecision` before merge/enqueue:

- `PrIdentity`: repository, PR number, URL, open/not draft, expected base branch, expected head branch, head SHA, base SHA, PR author, story ID, and tracker PR link match.
- `ProtectionPolicy`: detected branch protection/ruleset settings, required check contexts, expected check sources when available, required review count/code-owner/stale-review/last-push settings, required conversation resolution, required deployments, required linear history, merge queue requirement, allowed merge methods, bypass/admin applicability, and whether inspection permissions were sufficient.
- `CheckEvidence`: exact SHA inspected, whether evidence is for head commit or test merge commit, required contexts, status/check conclusion, check run/status URL, app/source identity, started/completed timestamps, and trust classification.
- `ReviewEvidence`: GraphQL `reviewDecision`, latest review states, requested reviewers/teams, code-owner requirement when discoverable, stale-review policy, most-recent-push approval policy, and any unresolved `CHANGES_REQUESTED` state.
- `ThreadEvidence`: all review threads paginated through GraphQL, unresolved thread count, path/line/thread IDs, outdated flag, latest comment author, and whether branch protection also requires conversation resolution.
- `BotFindingEvidence`: configured bot identities, source type (`review_thread`, `review`, `issue_comment`, `check_run`, `status`, `label`), finding IDs/anchors, resolution marker, commit SHA or timestamp observed, and whether the finding is machine-readable or parsed prose.
- `FreshnessEvidence`: latest fetched base SHA, PR `baseRefOid`, PR `headRefOid`, mergeability/merge-state, strict-status setting, merge queue state, and result of any update-branch/rebase requirement.
- `MergeAction`: direct merge, enable auto-merge, enqueue, park, re-request review, update branch, or manual handoff; include exact API call shape and expected head SHA guard.

Recommended fail-closed merge predicate for normal completion PRs:

```text
autoMergeAllowed =
  policy.autoMerge.enabled
  and child/run control plane satisfies irreversible-action prerequisites from D2/D3
  and PR is open, not draft, and matches expected story branch/base
  and branch protection/ruleset inspection succeeded, or repo policy explicitly allows unprotected merges
  and no admin/bypass merge path is used
  and exact head SHA has not changed since all evidence was collected
  and required local verification or trusted exact-head CI evidence passed
  and all required status checks/check runs are success/neutral/skipped per GitHub, with configured source trust satisfied
  and workflow-kit policy has not disallowed skipped/neutral conclusions for configured critical checks
  and reviewDecision is APPROVED or repo policy explicitly requires no review
  and there are no unresolved required/policy review requests
  and there are no latest blocking CHANGES_REQUESTED reviews
  and all review threads are resolved, unless repo policy explicitly ignores outdated unresolved threads
  and all configured bot findings are resolved or represented by green trusted checks
  and base freshness is satisfied by strict required checks, successful update/rebase plus rerun, or merge queue validation
  and merge method is allowed by repository/ruleset policy
```

If the base branch requires a merge queue, the runner should not call direct merge. It should enqueue the PR with `enqueuePullRequest` or a queue-aware transport, then watch `mergeQueueEntry`, queue checks, and final `merged` state. If queue APIs are unavailable, it should park with `merge-queue-required-unavailable`.

If merge queue is not required, the runner should use the REST merge endpoint with the inspected `sha` field. If the merge method is configured, pass it only after confirming the repository/ruleset allows it. If the repository requires linear history, only `squash` or `rebase` are viable. If merge method policy is unknown, park.

Review re-request policy:

- After the child pushes fixes for review feedback, invalidate all previously collected check/review/thread evidence for older head SHAs.
- If required reviewers or configured bots must re-review, request reviewers through the REST review-request API or GraphQL `requestReviews` mutation only after new verification/check evidence is available.
- Record a `review-rerequested` event with reviewers, teams, bot identities, head SHA, and prior blocker IDs.
- Do not auto-resolve review threads. Only resolve threads when a configured actor explicitly allows the runner to do so and the thread has a matching fix/evidence rule; otherwise leave them for reviewers/bots.

Bot comment policy:

- Prefer bots that emit check runs, commit statuses, formal reviews, labels, or review threads with explicit resolution state.
- For comment-only bots, require per-repo configuration: bot login/app slug, comment signature, blocking markers, resolution markers, whether only comments after the latest head push count, and whether outdated comments can be ignored.
- Unknown bot comments with no configured parser should not block by default for human workflows, but they must block autonomous merge when authored by a configured review bot identity and their resolution cannot be determined.

Blocker-evidence PR policy:

- Add an explicit decision class: `merge_kind: completion | blocker_evidence`.
- A `blocker_evidence` PR may be merged only when `mergeBlockerEvidence.enabled` is true and the normal merge safety predicate passes, except that completion/verification may be replaced by typed blocker evidence proving why the story cannot be completed.
- Merging a `blocker_evidence` PR must never move the story to a complete status. The story remains `blocked` with a durable blocker ID, reproduction/evidence links, merged PR URL/SHA, and recommended next owner/action.
- The PR body/title should state that it records blocker evidence or partial safe cleanup, not completion. The merge event should record `storyStatusAfterMerge: blocked`.
- If `mergeBlockerEvidence` is disabled, the runner may open/update the PR and leave it for manual merge, but it must not auto-merge it.

## Tradeoffs and Risks

- Fail-closed merge inspection will park more runs than a human would, especially when GitHub permissions do not allow branch-protection/ruleset inspection. That is the correct default for autonomous merge.
- GitHub required checks accept `skipped` and `neutral` in several places. Some repos intentionally rely on that; others may see it as unsafe. The kit should mirror GitHub by default but allow critical checks to require `success`.
- Status/check trust is hard. If a write-capable automation token can both change code and set green statuses, the check is weaker evidence. The kit should support trusted app/source allowlists and token separation, but cannot solve compromised CI in repo-local policy alone.
- Review-thread APIs are GraphQL-specific and version-sensitive. Implement capability probes and preserve a degraded `review-thread-state-unavailable` blocker.
- Parsing bot prose is brittle and bot-specific. The durable path is machine-readable bot output; prose parsers should be opt-in adapters with clear provenance.
- Merge queues add safety but also latency and state complexity. A PR can pass preflight and later be removed from the queue after a merge-group check failure; the runner must keep watching until merged or parked.
- Updating a stale branch can dismiss stale approvals depending on protection settings. The runner must treat update/rebase as evidence invalidation and re-run checks/re-request reviews as policy requires.
- Admin/bypass tokens are dangerous for unattended merges. The kit should detect and refuse bypass/admin merge modes unless an explicit manual operator action is in progress.
- Non-GitHub forges may not expose unresolved review threads, branch-protection details, or merge queues. The normalized evidence model should degrade to explicit blockers rather than pretending parity.

## Fallback and Degraded Modes

- No GitHub auth or `gh` unavailable: do not auto-merge GitHub PRs. Park as `collaboration-inspector-unavailable`.
- Branch protection/ruleset inspection forbidden: if repo policy says protected-branch evidence is required, park as `protection-policy-unknown`; if policy explicitly allows unprotected repos, require exact-head PR/check/review evidence from the PR itself.
- Required checks pending/missing/stale: park as `checks-pending`, `checks-missing`, or `checks-stale`; do not infer success from child prose.
- Check source unknown or untrusted: park as `check-source-untrusted` unless repo policy allows any source for that context.
- Review decision `REVIEW_REQUIRED`, `CHANGES_REQUESTED`, unknown, or missing: park as `review-required` / `changes-requested` / `review-state-unknown`; optionally request reviewers.
- Review-thread API unavailable: park as `review-thread-state-unavailable` for autonomous merge unless repo policy explicitly disables thread inspection.
- Unresolved review threads: park as `unresolved-review-thread`; after fixes, re-inspect all threads instead of assuming comments are addressed.
- Configured bot comments/finding state unavailable: park as `bot-finding-state-unknown` if that bot is part of merge policy.
- Base moved or head changed after evidence: discard evidence and rerun inspectors. Use REST merge `sha` or queue APIs to guard against time-of-check/time-of-use drift.
- Branch behind and strict checks required: update/rebase with `expected_head_sha`, then rerun verification/check/review inspection. If update fails, park as `stale-base-update-failed`.
- Merge queue required but queue action unavailable: park as `merge-queue-required-unavailable`.
- Merge method unsupported or conflicts with linear history/ruleset: park as `merge-method-unavailable`.
- Merge endpoint returns 403/405/409/422: record the exact response class, refresh evidence once, and park if still unresolved. Do not retry blindly.
- Blocker-evidence PR with policy disabled: leave PR open and story blocked; require manual merge.

## Validation Spikes

- Build a pure `MergePolicyDecision` table covering green PR, missing branch protection permission, stale base, head changed after inspection, pending check, untrusted check source, skipped critical check, `CHANGES_REQUESTED`, unresolved thread, bot finding, merge queue required, and blocker-evidence PR.
- Prototype a GraphQL PR state query against a real PR fetching `headRefOid`, `baseRefOid`, `reviewDecision`, `mergeStateStatus`, `mergeQueueEntry`, and all `reviewThreads.isResolved` pages.
- Prototype branch-protection/ruleset discovery for a protected branch and record which permissions are required in a private repo.
- Validate exact-head direct merge by inspecting a PR head SHA, pushing a new commit, then confirming REST merge with old `sha` returns a conflict.
- Validate `update-branch` with `expected_head_sha` by racing a new push and confirming GitHub rejects stale update requests.
- Validate merge queue behavior in a test repo: enqueue a passing PR, observe `mergeQueueEntry`, force a merge-group check failure, and record removal/failure evidence.
- Add a fixture where a configured bot posts a blocking review thread, then another where it posts only an issue comment. Ensure unresolved thread blocks natively and comment-only behavior follows repo parser policy.
- Test stale-review invalidation by enabling dismissal of stale approvals, approving a PR, pushing a fix, and confirming review state changes before merge is allowed.
- Test critical-check policy where GitHub treats `skipped` or `neutral` as passing but workflow-kit config requires `success`.

## Open Questions

- Should workflow-kit require protected branches for autonomous merge by default, or allow unprotected repos with an explicit `allowUnprotectedAutoMerge` flag?
- Which check conclusions should be accepted by default for critical checks: GitHub-compatible `success | neutral | skipped`, or stricter `success` only?
- How should trusted check sources be configured: GitHub App slug/id, check run app owner, context name, workflow file path, or all of these?
- Should unresolved but outdated review threads block by default? The safest default is yes, but some teams use outdated unresolved threads as historical discussion.
- Which bot identities should workflow-kit ship adapters for, if any, versus requiring per-repo configuration?
- Should the runner ever resolve review threads automatically, or should it only comment/re-request review and wait for the reviewer/bot?
- For blocker-evidence PRs, what minimum evidence allows merge without local verification: reproduced blocker command output, CI failure artifact, human approval, or all of these?
- How should non-GitHub providers map into the normalized evidence model when they lack conversation resolution or merge queue equivalents?

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../../README.md) · **← Prev:** [R8 - Verification and Completion Authority](./R8-verification-completion-authority.md) · **Next →:** [R10 - Observability and Incident Analysis](./R10-observability-analysis.md)

<!-- /DOCS-NAV -->
