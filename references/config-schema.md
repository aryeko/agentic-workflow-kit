# agentic-workflow-kit config (`.workflow/config.yaml`)

The single source of truth for how agentic-workflow-kit behaves in a repo. Every field is
optional with the default shown; `workflow-init` writes a fully-populated file. The
machine-readable mirror is `config.schema.json` (validated in CI).

## Config schema versioning

Current config schema version: `0.6.0`.
Minimum supported config schema version: `0.6.0`.

New configs should use `version: "0.6.0"`. Existing legacy configs with `version: 1` remain readable
during the transition window and are classified as upgradeable to `0.6.0`. Versions below the
minimum supported schema version are blocked until upgraded. Versions above the current schema
version are blocked until the runtime is upgraded.

Use these commands to inspect and upgrade config versions:

```bash
agentic-workflow-kit config status --json
agentic-workflow-kit config upgrade --dry-run --json
agentic-workflow-kit config upgrade --yes --json
```

Config upgrades never rewrite `.workflow/config.yaml` without `--yes` or an explicit MCP upgrade
confirmation.

## Top level

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `version` | semver string \| legacy const `1` | `0.6.0` | Config schema version. Use `"0.6.0"` for new configs; legacy `1` is readable and upgradeable during the transition window. |

## `paths`

Where work lives.

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `tracksDir` | string | `docs/tracks` | Trackers at `<tracksDir>/<name>/README.md`. |
| `specsDir` | string | `docs/specs` | Per-story specs. |
| `plansDir` | string | `docs/plans` | Implementation plans. |
| `archiveDir` | string | `docs/tracks/archive` | Finished trackers. |
| `prdsDir` | string | `docs/prds` | PRD directories at `<prdsDir>/<slug>/` (written by `define-product`). |

All `paths` values must be repo-relative paths. Absolute paths and `..` path segments are rejected.

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

## `childSession`

Neutral child-session launch defaults used by the configured story driver. The Codex driver is the
only shipped V1 driver, but this namespace is host-neutral so future drivers do not need a new
top-level config block.

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `speed` | `derive` \| `fast` \| `standard` | `derive` | Child-session speed policy. `derive` sends no Codex service-tier override and preserves the user's global Codex setting; `fast` requests Codex Fast mode; `standard` explicitly clears inherited Fast mode for the child session. |
| `model` | string | unset | Optional model override for launched child sessions. |
| `approvalPolicy` | `never` \| `on-failure` \| `on-request` \| `untrusted` | unset | Optional child-session approval policy. |
| `sandbox` | `danger-full-access` \| `read-only` \| `workspace-write` | unset | Optional child-session filesystem sandbox. |
| `config` | object | unset | Driver-specific raw config passed through to the child-session launcher. |

When `speed` is `fast` or `standard`, do not also set raw `config.service_tier`; validation rejects
that ambiguous combination. Existing raw `config.service_tier` pass-through remains accepted when
`speed` is unset or `derive`.

`codex.childSession` remains accepted as a compatibility alias for existing configs. When both
`childSession` and `codex.childSession` are present, values merge per field with `childSession`
winning for shared fields. Nested `config` values also merge per key with neutral values winning.
Resolved config exposes the same child-session object at both the neutral field and the Codex alias.

## `codex.childSession`

Compatibility alias for `childSession`. Prefer `childSession` for new configs.

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `speed` | `derive` \| `fast` \| `standard` | `derive` | Compatibility alias for `childSession.speed`. |
| `model` | string | unset | Optional model override for launched child sessions. |
| `approvalPolicy` | `never` \| `on-failure` \| `on-request` \| `untrusted` | unset | Optional child-session approval policy. |
| `sandbox` | `danger-full-access` \| `read-only` \| `workspace-write` | unset | Optional child-session filesystem sandbox. |
| `config` | object | unset | Driver-specific raw config passed through to the child-session launcher. |

## `pr` — PR + merge policy (the headline knob)

The headline block that differs between presets. `workflow-init` defaults new and unknown repos to
the conservative `push-only` preset; auto-merge presets are explicit opt-in choices.

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
| `review.prePr.mode` | `auto` \| `subagent` \| `inline` \| `orchestrator` | `auto` | Preferred pre-PR review mode. See "Pre-PR review modes" below for downgrade and fail-closed behavior. |
| `review.prePr.maxLoops` | integer | `2` | Maximum local pre-PR review fix batches before stopping for user input. |
| `review.prePr.loopMode` | `incremental` \| `full` | `incremental` | Whether follow-up local review loops receive only fix-context deltas or the full review packet again. |
| `review.prePr.downgradeTo` | `none` \| `subagent` \| `inline` | `none` | Fallback for `mode: orchestrator` when no supervising orchestrator is available to deliver a verdict. `none` fails closed (`pre_pr_review_blocked`); `subagent`/`inline` downgrade to in-session review. Ignored for non-orchestrator modes. |
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
- `orchestrator`: hand the review to the supervising orchestrator session instead of self-reviewing.
  The child stops at the pre-PR checkpoint, writes a review-request packet, and ends its turn with an
  `awaiting_review` result (a turn-boundary yield, not a blocking pause). The orchestrator reviews the
  diff and replies a `PASS`/`BLOCK` verdict via `workflow_child_reply`; the child resumes the same Codex
  thread to apply findings and re-verify (looping up to `maxLoops`) or open the PR on `PASS`. Gated to
  the `codex-mcp` driver. `orchestrator` is fail-closed: when no orchestrator delivers a verdict within
  `orchestrator.childReviewWaitTimeoutMs`, the child blocks with `pre_pr_review_blocked` unless
  `review.prePr.downgradeTo` is set to `subagent` or `inline`. The external Codex PR review (`pr.review`)
  is unchanged and remains the independent final gate.

Recommended invocation text for hosts that require explicit delegation:

```text
You are explicitly authorized to delegate the pre-PR review to a read-only review subagent if configured.
```

Only record subagent review success when a spawned review agent returns a result. Inline review must
not be reported as subagent success.

Local pre-PR review loops are separate from external PR review gates. `review.prePr.maxLoops` is the
maximum number of local review fix batches before stopping or escalating; it is not the number of
review agent invocations. With the default `review.prePr.loopMode: incremental`, the first local
review receives the full review packet and later loops receive prior findings, fix summaries,
changed diffs since the previous loop, and latest verification evidence.
`review.prePr.loopMode` controls the shape of review context, not whether a host can reuse the same
reviewer thread. When `loopMode: incremental`, runtimes should reuse the same review subagent/thread
for follow-up loops when supported. If host tooling cannot continue the previous reviewer, spawning
a new read-only review subagent with the incremental packet is acceptable and should not be recorded
as a downgrade. Journal events should identify whether continuity used `reused-agent`,
`new-agent-incremental-context`, or `full-context`.
External PR review fix behavior is controlled by `pr.review.rerequestAfterFix`; when it is `false`,
one external PR review pass plus local fix verification and comment resolution is enough.

Analyzer outcomes distinguish review execution from review results:

- `pre_pr_review_blocked`: the configured review step could not run because of tooling, auth,
  policy, or missing context. It is reported as an analyzer blocker.
- `pre_pr_review_completed` with `verdict: "BLOCK"` or `pre_pr_review_findings`: the review ran
  and returned findings. It is reported as a findings result, not an execution blocker.
- `pre_pr_review_completed` with `verdict: "PASS"` or legacy `pre_pr_review_passed`: the local
  review gate passed.

Review agents must treat product docs, architecture docs, the tracker row, story brief, detailed
spec, and implementation plan as the scope boundary. For telemetry and observability stories, they
can require instrumentation of existing interactions or internal state transitions, but they should
not request new visible controls unless those docs explicitly require the UI. Out-of-scope visible
UI additions should be flagged as review findings.

## `agents`

Named profiles and task bindings for host-neutral agent execution policy. Existing configs may omit
this block; the runtime fills safe built-in defaults for current task types.

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `profiles` | object |  | Named agent profiles. Each profile can set `driver` (`codex-mcp` or `inline`), `model`, `reasoning`, `approvalPolicy`, `sandbox`, `prompt.template`, `prompt.variables`, `structuredOutput.schema`, `structuredOutput.required`, `budget`, and host-specific settings. |
| `bindings.implementStory` | string | `storyImplementer` | Profile name used for story implementation runs. |
| `bindings.prePrReview` | string | `prePrReviewer` | Profile name used for local pre-PR review. |
| `bindings.planTrack` | string | `planner` | Profile name used for delivery-track planning. |
| `bindings.analyzeRun` | string | `analyzer` | Profile name used for run analysis. |
| `bindings.recoverRun` | string | `recovery` | Profile name used for recovery decisions. |
| `bindings.migrateTracker` | string | `planner` | Profile name used for tracker migration/import work. |

Default profiles:

- `storyImplementer`: `codex-mcp`, medium reasoning, `approvalPolicy: never`,
  `sandbox: workspace-write`, `prompt.template: built-in/story-implementer`,
  `structuredOutput.schema: built-in/child-run-result`, and a wall-clock budget of `7200000` ms
  with `checkpoint-stop`.
- `prePrReviewer`: `codex-mcp`, medium reasoning, `prompt.template: built-in/pre-pr-reviewer`, and
  `structuredOutput.schema: built-in/review-result`.
- `planner`, `analyzer`, and `recovery`: `inline` profiles with built-in prompt and
  structured-output schema names.

Budget dimensions are `wallMs`, `tokens`, `toolCalls`, and `failedToolCalls`. Each
dimension has `limit` (`number | null`), `warnAtPercent` (`1..100 | null`), and `action`
(`warn` | `stop-new-launches` | `checkpoint-stop` | `abort`). Wall-time, tool-call, and
failed-tool-call dimensions can enforce runtime controls when telemetry is available. The token
budget is accepted for forward-compatible policy configuration; the current resolved config marks
the token dimension unenforceable for live control when host telemetry is unavailable.

Every binding must reference an existing profile. `loadResolvedConfig` exposes the source profiles,
task bindings, and effective task profiles so `config.resolved.json` artifacts include the selected
prompt/template, structured-output schema, host policy, and budget policy.

## `orchestrator` (optional)

Consulted only when the orchestrator package is installed.

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `driver` | string | `codex-mcp` | Child-session driver. WK4 v1 supports `codex-mcp` only; future drivers may extend this value without changing tracker semantics. |
| `maxParallel` | integer | `2` | Max concurrent child sessions. |
| `stopLaunchingOnBlocked` | boolean | `true` | Stop launching when a child returns incomplete. |
| `watch.enabled` | boolean | `false` | Default for `run-story` and `run-eligible` event streaming, equivalent to passing `--watch`. Use `--no-watch` to disable this configured default for one CLI invocation. |
| `watch.wait` | boolean | `false` | Default for `watch-run` polling, equivalent to passing `--wait`. Use `--no-wait` or MCP `wait: false` to disable this configured default for one invocation. |
| `watch.intervalMs` | integer | `300000` | Poll interval for `watch-run` when wait mode is enabled. CLI/MCP `intervalMs` overrides this. |
| `watch.timeoutMs` | integer | `300000` | Maximum wait time for `watch-run` when wait mode is enabled. CLI/MCP `timeoutMs` overrides this. |
| `childTimeoutMs` | integer | `1800000` | Compatibility alias for `childNoProgressTimeoutMs`. Existing configs can keep using it. |
| `childNoProgressTimeoutMs` | integer | `1800000` | Per-child no-progress timeout. Child session linkage, Codex `codex/event`, MCP `notifications/progress`, or observed child progress events reset this timer. Parent supervisor polls do not. |
| `childStartupTimeoutMs` | integer | `60000` | Per-child startup acknowledgement timeout. A child must link a session or report progress within this window before it is treated as started. |
| `childMaxRuntimeMs` | integer | `7200000` | Per-child wall-clock maximum runtime. The wall-clock maximum still bounds total child runtime even when progress resets the no-progress timeout. |
| `childReviewWaitTimeoutMs` | integer | `1800000` | Maximum time a child may sit in `awaiting_review` (pre-PR `mode: orchestrator`) before the review-wait timeout escalates with block + notify. While awaiting review a child is exempt from `childNoProgressTimeoutMs` and `childMaxRuntimeMs`; this timeout bounds the wait instead, and never kills the child as `supervision_lost`. |

Use `childStartupTimeoutMs` to fail empty child startup shells quickly when no session id, session
log, Codex `codex/event` notification, MCP `notifications/progress`, heartbeat, result, or worktree
activity appears. After startup acknowledgement, use `childNoProgressTimeoutMs` to detect silent or
supervision-lost children. Observed child progress resets the no-progress timeout, but parent
`child-supervisor-poll` events only show parent loop liveness and never extend either timeout. Full
PR/review/merge stories commonly need a larger wall-clock maximum than the old 30 minute
`childTimeoutMs` default because healthy progress can include implementation, verification, PR
creation, review wait, fix batches, merge, and cleanup.
