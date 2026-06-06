---
name: workflow-autopilot
description: Use when the user asks to discover tracks, dry-run eligible tracker stories, run autonomous multi-session workflow dispatch, watch orchestrator events, or analyze agentic-workflow-kit orchestrator runs. Reads .workflow/config.yaml plus references/tracker-contract.md and prefers the bundled MCP runtime, with the CLI as a fallback. Do not use for writing PRDs, creating trackers, or implementing one story interactively.
argument-hint: "<command> [options]"
arguments: command
disable-model-invocation: true
user-invocable: true
---

# Workflow Autopilot

Operation requested: $ARGUMENTS

Use the bundled MCP runtime to inspect and dispatch eligible tracker stories into child Codex
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
review policy, or merge policy.
Non-dry-run MCP calls can launch unsupervised child sessions; `sandbox: danger-full-access` with
`approvalPolicy: never` grants those children full local disk access without interactive approval.

## CLI fallback

Installed package usage when the bundled MCP runtime is not available:

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
- `children/<story-id>.raw.json` records raw driver output when available.
- `children/<story-id>.metrics.json` records best-effort child tool, token, and subagent metrics
  when available.

Child tool/token/subagent metrics are best-effort observability. They help with tracking cost,
time, and behavior, but they never drive scheduling or completion.
