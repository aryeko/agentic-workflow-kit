# agentic-workflow-kit config (`.workflow/config.yaml`)

The single source of truth for how agentic-workflow-kit behaves in a repo. Every field is
optional with the default shown; `workflow-init` writes a fully-populated file. The
machine-readable mirror is `config.schema.json` (validated in CI).

## Top level

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `version` | const `1` | `1` | Schema version. Must be exactly `1`. Required. |

## `paths`

Where work lives.

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `tracksDir` | string | `docs/tracks` | Trackers at `<tracksDir>/<name>/README.md`. |
| `specsDir` | string | `docs/specs` | Per-story specs. |
| `plansDir` | string | `docs/plans` | Implementation plans. |
| `archiveDir` | string | `docs/tracks/archive` | Finished trackers. |
| `prdsDir` | string | `docs/prds` | PRD directories at `<prdsDir>/<slug>/` (written by `define-product`). |

## `statuses`

The automation-significant buckets of the status vocabulary (see `tracker-contract.md`).

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `eligible` | string[] | `[specced, plan-approved]` | A story can be picked when its status is here. |
| `inProgress` | string | `implementing` | Status a claimed story is moved to. |
| `complete` | string[] | `[done, verified]` | Satisfies a dependency / marks a story finished. |

## `tracker`

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `idPattern` | string (regex) | `^[A-Z]{2,}[0-9]+$` | Valid story IDs, e.g. `PC06`, `SP12`. |

## `verify`

Commands used as gates. Auto-detected from the package manager when unset (`null`).

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `changed` | string \| null | `null` | Fast per-task gate. |
| `full` | string \| null | `null` | Merge gate (full suite). |

## `git`

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `strategy` | `worktree` \| `branch` | `worktree` | Isolation strategy. |
| `branchPattern` | string | `{track}/{id-lc}-{slug}` | Branch name template. |
| `baseBranch` | string | `main` | Base branch for PRs. |
| `commitOnBase` | `forbid` \| `allow` | `forbid` | Whether committing on the base branch is allowed. |
| `worktreeDir` | string | `.worktrees` | Repo-relative, non-escaping directory for orchestrator-managed story worktrees. |

## `pr` — PR + merge policy (the headline knob)

The only block that differs between a push-and-merge repo and a gated-automerge repo.

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `create` | boolean | `true` | Open a PR at all? `false` pushes the branch and stops. |
| `ci.wait` | boolean | `false` | Wait for CI to be green before merging? |
| `ci.command` | string \| null | `null` | How to wait; defaults to `gh pr checks {pr} --watch`. |
| `review.wait` | `none` \| `bot` \| `human` | `none` | Whether to wait for a review before merging. |
| `review.bot` | string | `none` | Which bot (e.g. `codex`) when `review.wait: bot`. |
| `review.triageComments` | boolean | `false` | Require a reply to every bot comment before merge? |
| `review.maxFixBatches` | integer | `1` | Maximum fix batches for findings from the first external PR review pass. |
| `review.rerequestAfterFix` | boolean | `false` | Request/wait for a fresh external review after each fix batch? |
| `review.waitTimeoutMinutes` | integer | `30` | Maximum time to wait for a configured PR review signal before stopping. |
| `merge.auto` | boolean | `false` | Auto-merge once gates pass? |
| `merge.method` | `squash` \| `merge` \| `rebase` | `squash` | Merge method. |
| `merge.deleteBranch` | boolean | `true` | Delete the branch after merge. |

### Codex bot review semantics

When `review.wait: bot` and `review.bot: codex`, the review gate is based on Codex's GitHub
reaction/comment signals, not on GitHub native approval state:

- Eyes reaction on the PR body: review started or pending. This is not approval.
- Thumbs-up reaction on the PR body: clear/no findings.
- PR review comments or PR comments from Codex: findings. With `review.triageComments: true`, each
  finding must be fixed or explicitly replied to before merge.
- A native `PullRequestReview` with `APPROVED` or `CHANGES_REQUESTED` is not required from Codex.
- Mentioning `@codex` is only a fallback/manual trigger when auto review does not start or a manual
  retry is needed.

## `implement`

Interactive `implement-next` policy. These keys control review, semantic checks, and sidecar
subagent usage for the one-story interactive flow. They do not change tracker authority: tracker
state remains the only completion source.

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `review.prePr.enabled` | boolean | `true` | Run a pre-PR implementation review before tracker completion and PR creation. |
| `review.prePr.mode` | `auto` \| `subagent` \| `inline` | `auto` | Preferred pre-PR review mode. See "Pre-PR review modes" below for downgrade and fail-closed behavior. |
| `review.prePr.maxLoops` | integer | `2` | Maximum pre-PR review-fix loops before stopping for user input. |
| `review.prePr.loopMode` | `incremental` \| `full` | `incremental` | Whether follow-up local review loops receive only fix-context deltas or the full review packet again. |
| `review.semanticChecks.enabled` | boolean | `true` | Require semantic checks for spec, plan, tests, tracker hygiene, and repo instructions. |
| `subagents.enabled` | boolean | `true` | Allow bounded sidecar subagents for analysis/review. |
| `subagents.maxParallel` | integer | `2` | Maximum concurrent sidecar subagents during interactive implementation. |
| `subagents.allowWorkers` | boolean | `false` | Permit worker subagents to write files; workers still require disjoint write scopes. |

### Pre-PR review modes

`review.prePr.mode` controls the local review before tracker completion and PR creation:

- `inline`: always review in the current session.
- `auto`: attempt a review subagent when `subagents.enabled: true` and the host tool policy already
  permits explicit delegation. If the subagent cannot run, continue with inline review and record
  `pre_pr_review_downgraded`. `pre_pr_review_downgraded` is reported as an analyzer warning.
- `subagent`: require a real spawned review agent result. `subagent` is fail-closed: if explicit
  delegation is missing, the subagent tool is unavailable, or the review agent cannot run, stop
  before PR creation and record `pre_pr_review_blocked`. `pre_pr_review_blocked` is reported as an analyzer blocker.

Recommended invocation text for hosts that require explicit delegation:

```text
You are explicitly authorized to delegate the pre-PR review to a read-only review subagent if configured.
```

Only record subagent review success when a spawned review agent returns a result. Inline review must
not be reported as subagent success.

Local pre-PR review loops are separate from external PR review gates. `review.prePr.maxLoops` bounds
the local review/fix/re-review cycle before PR creation. With the default `review.prePr.loopMode:
incremental`, the first local review receives the full review packet and later loops receive prior
findings, fix summaries, changed diffs since the previous loop, and latest verification evidence.
External PR review fix behavior is controlled by `pr.review.rerequestAfterFix`; when it is `false`,
one external PR review pass plus local fix verification and comment resolution is enough.

## `orchestrator` (optional)

Consulted only when the orchestrator package is installed.

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `driver` | string | `codex-mcp` | Child-session driver. WK4 v1 supports `codex-mcp` only; future drivers may extend this value without changing tracker semantics. |
| `maxParallel` | integer | `2` | Max concurrent child sessions. |
| `stopLaunchingOnBlocked` | boolean | `true` | Stop launching when a child returns incomplete. |
| `childTimeoutMs` | integer | `1800000` | Per-child wall-clock timeout before the run is blocked with a failure record. |
