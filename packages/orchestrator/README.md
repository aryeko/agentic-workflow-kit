# @agentic-workflow-kit/orchestrator

Autonomous tracker-driven orchestration for
[agentic-workflow-kit](https://github.com/aryeko/agentic-workflow-kit).

This package provides the runtime used by the agentic-workflow-kit plugin:

- `agentic-workflow-kit` - a standalone CLI for local development, CI, and troubleshooting.
- `agentic-workflow-kit-mcp` - the stdio MCP server used by Claude Code and Codex plugin installs.

It reads the same `.workflow/config.yaml` and markdown tracker contract as the plugin skills, so
interactive and autonomous workflows share one source of truth.

## Install

```bash
pnpm add -D @agentic-workflow-kit/orchestrator
```

You can also run the CLI without adding it to a project:

```bash
npx -y --package @agentic-workflow-kit/orchestrator agentic-workflow-kit --help
```

## Requirements

- Node.js 24 or newer.
- A repository initialized with agentic-workflow-kit, including `.workflow/config.yaml`.
- Markdown trackers under the configured tracks directory.

Use the full plugin when you want the authoring skills that create the PRD, technical solution, and
tracker. Use this package directly when you want the runtime from a terminal, CI job, or MCP host.

## CLI

```bash
agentic-workflow-kit --help
agentic-workflow-kit project inspect --cwd . --json
agentic-workflow-kit run preview --cwd . --track product-foundation --mode eligible --json
agentic-workflow-kit run preview --cwd . --track product-foundation --story WK001 --json
agentic-workflow-kit list-tracks --cwd .
agentic-workflow-kit list-stories --cwd . --track product-foundation
agentic-workflow-kit list-eligible --cwd . --track product-foundation
agentic-workflow-kit run-story WK001 --cwd . --dry-run
agentic-workflow-kit run-eligible --cwd . --track product-foundation --dry-run
agentic-workflow-kit watch-run .workflow/runs/<run-id>
agentic-workflow-kit analyze-run .workflow/runs/<run-id>
agentic-workflow-kit mcp check --cwd .
```

`run-story` and `run-eligible` should be dry-run first. Non-dry-run execution can launch child Codex
MCP sessions, create branches or worktrees, edit files, run verification commands, and update
tracker rows according to `.workflow/config.yaml`.

`project inspect` and `run preview` are the product API facade commands. They emit the shared
WorkflowKit result envelope with `ok`, `operation`, `apiVersion`, `project`, `result`, `artifacts`,
`warnings`, and `next` fields. `run preview` delegates to the existing dry-run runtime path, so it
uses the same story and track selection behavior as `run-story --dry-run` and
`run-eligible --dry-run` while exposing product nouns for future CLI/MCP parity.

## MCP Server

Plugin installs start the MCP server with an exact package version:

```bash
npx -y --package @agentic-workflow-kit/orchestrator@<exact-version> agentic-workflow-kit-mcp
```

Available MCP tools:

- `workflow_project_inspect`
- `workflow_run_preview`
- `list_tracks`
- `list_stories`
- `list_eligible`
- `run_story`
- `run_eligible`
- `watch_run`
- `analyze_run`
- `check_codex_mcp`

The MCP tools operate on the target repository. If the MCP session is not already running from a
workflow repo, pass `cwd` as the target repo root in tool input.

The `workflow_*` tools are the product-named facade. The legacy tools remain available for
0.5.13-compatible plugin workflows and existing automation.

## Workflow Contract

The orchestrator does not invent workflow policy. It reads:

- `.workflow/config.yaml` for paths, status buckets, verification commands, git/worktree strategy,
  and PR/merge policy.
- Markdown trackers for story state, dependencies, ownership, and completion.

Tracker state is authoritative. A child session saying it is done is not enough; completion comes
from the tracker row moving into a configured complete status.

## Common Usage

Check what can run:

```bash
agentic-workflow-kit list-eligible --cwd . --json
```

Preview one story:

```bash
agentic-workflow-kit run-story WK001 --cwd . --dry-run --json
```

Launch after explicit approval:

```bash
agentic-workflow-kit run-story WK001 --cwd .
```

Inspect a run:

```bash
agentic-workflow-kit watch-run .workflow/runs/<run-id> --json
agentic-workflow-kit watch-run .workflow/runs/<run-id> --wait --interval-ms 300000 --timeout-ms 300000 --json
agentic-workflow-kit analyze-run .workflow/runs/<run-id> --json
```

`watch-run` reads `orchestrator.watch` defaults from the run's `config.resolved.json`; CLI flags
override those defaults for one invocation. Use `--no-wait` or MCP `wait: false` to disable a
configured wait default for a single watch call.

## Troubleshooting

- If the MCP server cannot start from a plugin install, check package resolution first: exact version,
  `npx`, npm cache, and network access.
- If a command cannot find workflow state, pass `--cwd /path/to/repo` or verify `.workflow/config.yaml`
  exists.
- If no stories are eligible, inspect tracker status, dependencies, owner locks, and the configured
  `statuses.eligible` values.
- If a run is unclear, use `watch-run` for current state and `analyze-run` after it completes or
  blocks.

## Documentation

- [Repository README](https://github.com/aryeko/agentic-workflow-kit#readme)
- [Architecture](https://github.com/aryeko/agentic-workflow-kit/blob/main/docs/architecture.md)
- [Getting started](https://github.com/aryeko/agentic-workflow-kit/blob/main/docs/getting-started.md)
- [Config schema](https://github.com/aryeko/agentic-workflow-kit/blob/main/references/config-schema.md)
- [Tracker contract](https://github.com/aryeko/agentic-workflow-kit/blob/main/references/tracker-contract.md)

## License

MIT
