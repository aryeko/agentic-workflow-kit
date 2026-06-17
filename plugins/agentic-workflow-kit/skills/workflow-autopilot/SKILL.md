---
name: workflow-autopilot
description: Use when the user asks to discover tracks, dry-run eligible tracker stories, run autonomous multi-session workflow dispatch, watch orchestrator events, or analyze agentic-workflow-kit orchestrator runs. Reads .workflow/config.yaml plus references/tracker-contract.md and prefers the plugin-provided MCP runtime, with the CLI as a fallback. Do not use for writing PRDs, creating trackers, or implementing one story interactively.
argument-hint: "<command> [options]"
arguments: command
disable-model-invocation: true
user-invocable: true
---

# Workflow Autopilot

Operation requested: $ARGUMENTS

Use the plugin-provided MCP runtime to inspect and dispatch eligible tracker stories into child Codex
sessions. Use the CLI fallback when MCP tools are unavailable or you are developing the
agentic-workflow-kit repo itself.

## Load first

Read:

- `.workflow/config.yaml`
- `references/config-schema.md`
- `references/tracker-contract.md`
- `AGENTS.md` or equivalent repo instructions

If `.workflow/config.yaml` is missing, stop and tell the user to run `/workflow-init`.
Before any non-dry-run dispatch, check config compatibility with `workflow_config_status` when MCP
is available, or `agentic-workflow-kit config status --json` via CLI fallback. Warn and ask before
upgrading legacy supported configs. Stop on unsupported old, unsupported new, invalid, or missing
config versions until the user upgrades the config or runtime.

## Hard rules

- Dry-run before launching children unless the user explicitly asked to run immediately.
- The tracker row status is the only completion authority.
- A child result, successful MCP call, local check, token metric, or prose summary never proves a
  story is done.
- WK4 v1 supports only `orchestrator.driver: codex-mcp`.
- Do not mix eligible stories from multiple tracks. Pass `--track <track-id>` when required.
- Preserve the repo's local-only, push, PR, review, merge, and cleanup rules. The child workflow
  owns implementation policy.
- When `pr.review.wait: bot` and `pr.review.bot: codex`, child sessions must treat Codex review as
  reaction/comment based: eyes means started or pending, thumbs-up means clear/no findings, and PR
  review comments or PR comments are findings. Do not require a native GitHub approval or
  request-changes review from Codex.

## Preferred MCP tools

When the plugin-provided `agentic-workflow-kit` MCP server is connected, prefer these tools:

- `workflow_project_inspect`
- `workflow_runtime_info`
- `workflow_config_status`
- `workflow_config_upgrade`
- `workflow_run_preview`
- `workflow_run_status`
- `workflow_run_stream`
- `workflow_run_subscribe`
- `workflow_run_subscription_poll`
- `workflow_run_unsubscribe`
- `workflow_run_inspect`
- `workflow_run_report`
- `workflow_run_export`
- `workflow_run_control`
- `workflow_child_reply`
- `workflow_child_interrupt`
- `workflow_driver_check`
- `list_tracks`
- `list_stories`
- `list_eligible`
- `run_eligible` with dry-run first
- `run_story`
- `watch_run`
- `watch_run_start`
- `watch_run_poll`
- `watch_run_stop`
- `analyze_run`
- `codex_reply`
- `codex_interrupt`
- `check_codex_mcp`

If the `agentic-workflow-kit` MCP tools are not present in this session, use the CLI fallback below.
Use tool results as operational evidence only. They do not replace tracker status, repo tests,
review policy, or merge policy. `analyze_run` also accepts compatible interactive
`implement-next` journals when `state.json` contains `command: "implement-next"` and an
`interactive` child record with `storyId` and `sessionId`.
For non-dry-run MCP dispatch, treat the `run_eligible` response as a launch receipt once it returns
`runId`/`artifactDir` and active children. Continue supervision with `watch_run_start` and
`watch_run_poll`; use `watch_run` for an immediate snapshot and `analyze_run` after completion,
blockage, or suspected stale state.
For sparse supervision, prefer cursor-based `watch_run_start` / `watch_run_poll` or `watch_run` with
`wait: true`, `intervalMs`, and `timeoutMs` rather than frequent manual polling. Release
nonblocking watch ids with `watch_run_stop`.
Non-dry-run MCP calls can launch unsupervised child sessions; `sandbox: danger-full-access` with
`approvalPolicy: never` grants those children full local disk access without interactive approval.

## Supervision discipline

- Keep human updates sparse and meaningful: report launch, blockage, recovery, merge, and final
  verification changes rather than every poll.
- Before editing branches, tracker rows, or application code for a blocked run, inspect the run with
  `watch_run` and `analyze_run`, then verify the relevant child artifact, PR check log, or served
  deployment response.
- Treat CI and deploy-smoke failures as evidence to classify first. If a protected preview,
  missing bypass secret, or external service condition explains the failure, record that as recovery
  context instead of changing app code.
- Do not diagnose git author metadata, app regressions, or deploy regressions from parent prose
  alone. Use child session logs, PR metadata, check logs, tracker snapshots, and run artifacts.

## Orchestrator pre-PR review

When `implement.review.prePr.mode: orchestrator`, the implementing child does not self-review or open
its PR at the pre-PR checkpoint. Instead it writes a review-request packet and ends its turn in child
status `awaiting_review`, surfaced as a `pre_pr_review_requested` event / launch status. The plugin
provides this yield/resume mechanism; the orchestrator owns the review judgement.

When `watch_run` / `watch_run_poll` shows a child in `awaiting_review`:

- Read the review packet (`children/<id>.review-request.json`, or the `packetPath` from the child's
  `prePrReview` marker) plus the diff, spec, plan, and tracker row.
- Perform an independent review against acceptance criteria, spec/plan compliance, and scope.
- Reply via `workflow_child_reply` with a structured `verdict`:
  `{ decision: 'PASS' | 'BLOCK', findings?, summary?, loop? }`. Friendly aliases are normalized
  (approve/lgtm -> `PASS`; request-changes/changes/reject -> `BLOCK`). The reply deposits the verdict
  (`children/<id>.verdict.json` + a `pre_pr_review_verdict` journal event); the orchestrator, not the
  reply tool, owns the resume turn that nudges the child forward.
- `PASS` lets the child open the PR. `BLOCK` sends findings for the child to fix and re-yield, bounded
  by `implement.review.prePr.maxLoops` (counted orchestrator-side).

You may review multiple awaiting children concurrently (up to `orchestrator.maxParallel`); v1 holds
the concurrency slot during review. `awaiting_review` is exempt from the child no-progress and max
runtime timeouts and is instead bounded by `orchestrator.childReviewWaitTimeoutMs` (default 30 min).
This is fail-closed: if no verdict arrives in time the child blocks with `pre_pr_review_blocked`
(reason `pre_pr_review_timeout`) unless `implement.review.prePr.downgradeTo` is `subagent` or `inline`,
in which case the child resumes to self-review (journaling `pre_pr_review_downgraded`). This mode is
gated to the `codex-mcp` driver in v1; the external Codex PR review (`pr.review`) remains the
independent final gate.

## CLI fallback

Installed package usage when the plugin-provided MCP runtime is not available:

```bash
agentic-workflow-kit list-tracks
agentic-workflow-kit --version
agentic-workflow-kit version --json
agentic-workflow-kit config status --json
agentic-workflow-kit config upgrade --dry-run --json
agentic-workflow-kit config upgrade --yes --json
agentic-workflow-kit list-stories --track <track-id>
agentic-workflow-kit list-eligible --track <track-id>
agentic-workflow-kit run-eligible --dry-run --track <track-id>
agentic-workflow-kit run-eligible --track <track-id> --max-parallel=2 --watch
agentic-workflow-kit run-story <story-id> --track <track-id>
agentic-workflow-kit run status .codex/agentic-workflow-kit/runs/<run-id> --json
agentic-workflow-kit run stream .codex/agentic-workflow-kit/runs/<run-id> --format ndjson
agentic-workflow-kit run subscribe <run-id> --topics run,story,child,error --json
agentic-workflow-kit run subscription-poll .codex/agentic-workflow-kit/runs/<run-id> <subscription-id> --json
agentic-workflow-kit run unsubscribe .codex/agentic-workflow-kit/runs/<run-id> <subscription-id> --json
agentic-workflow-kit run inspect .codex/agentic-workflow-kit/runs/<run-id> --json
agentic-workflow-kit run report .codex/agentic-workflow-kit/runs/<run-id>
agentic-workflow-kit run export .codex/agentic-workflow-kit/runs/<run-id>
agentic-workflow-kit abort-run .codex/agentic-workflow-kit/runs/<run-id> --reason "<reason>"
agentic-workflow-kit watch-run .codex/agentic-workflow-kit/runs/<run-id>
agentic-workflow-kit watch-run .codex/agentic-workflow-kit/runs/<run-id> --wait --interval-ms 300000 --timeout-ms 1800000
agentic-workflow-kit analyze-run .codex/agentic-workflow-kit/runs/<run-id>
agentic-workflow-kit mcp check
```

Local development in the agentic-workflow-kit repo:

```bash
pnpm agentic-workflow-kit -- <command>
```

## Artifact semantics

Artifacts are under `.codex/agentic-workflow-kit/runs/<run-id>/`.

- `events.ndjson` is the live parent event stream.
- `subscriptions/<subscription-id>.json` and `subscriptions/<subscription-id>.wake` support detached
  run-event subscriptions for hosts that watch a wake file and later poll by cursor.
- `state.json` records run status, active children, completed children, returned tracker status,
  blocked reason, and parent timing metrics.
- `metrics.live.json` records live parent metrics and best-effort child metrics.
- `children/<story-id>.json` records normalized child output.
- `children/<story-id>.launch.json` records parent-owned startup and launch metadata:
  story id, launch id, expected branch/worktree path, child cwd, base SHA, prompt hash, and known
  child session/log identifiers. Startup begins as `requested`, becomes `launched` only after a
  child session links or reports progress, and becomes `startup_failed` when the startup
  acknowledgement timeout expires without child evidence. For Codex MCP children, `codex/event`
  notifications are first-class child evidence and standard MCP `notifications/progress` remains
  supported. It distinguishes `lastSupervisorPollAt` from `lastObservedChildProgressAt` and
  `progressSource`; parent polls are not child progress.
- `children/<story-id>.raw.json` records raw driver output when available.
- `children/<story-id>.metrics.json` records best-effort child tool, token, and subagent metrics
  when available.

Child tool/token/subagent metrics are best-effort observability. They help with tracking cost,
time, and behavior, but they never drive scheduling or completion.
`children/<story-id>.json` may include structured child evidence such as final status, tracker path,
PR URL/number, merge commit, branch deletion, verification commands, review loops, PR review
findings, and downgrade notes. This helps analysis, but completion still comes from tracker/git
authority.

Interactive `implement-next` journals use the same run directory and state/config/event semantics
where practical. They may omit orchestrator child files; in that case `analyze-run` treats
`state.json` field `interactive` as the single analyzed child. A run with launch metadata but no
settled child result is startup-stale only after the startup acknowledgement timeout expires with no
session, heartbeat, result, or worktree activity; after acknowledgement, it is supervision-lost only
after real child progress evidence is stale. Parent supervisor polls alone do not prove the child is
active. Under worktree strategy, the parent prepares the story worktree before launch and passes that
path as the child cwd.
