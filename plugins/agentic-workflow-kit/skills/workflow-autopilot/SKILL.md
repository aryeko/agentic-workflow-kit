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

- `list_tracks`
- `list_stories`
- `list_eligible`
- `run_eligible` with dry-run first
- `run_story`
- `watch_run`
- `analyze_run`
- `check_codex_mcp`

If the `agentic-workflow-kit` MCP tools are not present in this session, use the CLI fallback below.
Use tool results as operational evidence only. They do not replace tracker status, repo tests,
review policy, or merge policy. `analyze_run` also accepts compatible interactive
`implement-next` journals when `state.json` contains `command: "implement-next"` and an
`interactive` child record with `storyId` and `sessionId`.
For non-dry-run MCP dispatch, treat the `run_eligible` response as a launch receipt once it returns
`runId`/`artifactDir` and active children. Continue supervision with `watch_run`; use `analyze_run`
after completion, blockage, or suspected stale state.
Non-dry-run MCP calls can launch unsupervised child sessions; `sandbox: danger-full-access` with
`approvalPolicy: never` grants those children full local disk access without interactive approval.

## CLI fallback

Installed package usage when the plugin-provided MCP runtime is not available:

```bash
agentic-workflow-kit list-tracks
agentic-workflow-kit list-stories --track <track-id>
agentic-workflow-kit list-eligible --track <track-id>
agentic-workflow-kit run-eligible --dry-run --track <track-id>
agentic-workflow-kit run-eligible --track <track-id> --max-parallel=2 --watch
agentic-workflow-kit run-story <story-id> --track <track-id>
agentic-workflow-kit watch-run .codex/agentic-workflow-kit/runs/<run-id>
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
