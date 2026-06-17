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
agentic-workflow-kit --version
agentic-workflow-kit version --json
agentic-workflow-kit config status --cwd . --json
agentic-workflow-kit config upgrade --cwd . --dry-run --json
agentic-workflow-kit config upgrade --cwd . --yes --json
agentic-workflow-kit project inspect --cwd . --json
agentic-workflow-kit run preview --cwd . --track product-foundation --mode eligible --json
agentic-workflow-kit run preview --cwd . --track product-foundation --story WK001 --json
agentic-workflow-kit run status .codex/agentic-workflow-kit/runs/<run-id> --json
agentic-workflow-kit run stream .codex/agentic-workflow-kit/runs/<run-id> --format ndjson
agentic-workflow-kit run inspect .codex/agentic-workflow-kit/runs/<run-id> --json
agentic-workflow-kit run report .codex/agentic-workflow-kit/runs/<run-id> --format markdown
agentic-workflow-kit run export .codex/agentic-workflow-kit/runs/<run-id> --include summary --json
agentic-workflow-kit list-tracks --cwd .
agentic-workflow-kit list-stories --cwd . --track product-foundation
agentic-workflow-kit list-eligible --cwd . --track product-foundation
agentic-workflow-kit run-story WK001 --cwd . --dry-run
agentic-workflow-kit run-eligible --cwd . --track product-foundation --dry-run
agentic-workflow-kit watch-run .codex/agentic-workflow-kit/runs/<run-id>
agentic-workflow-kit analyze-run .codex/agentic-workflow-kit/runs/<run-id>
agentic-workflow-kit abort-run .codex/agentic-workflow-kit/runs/<run-id> --reason "Wrong target branch" --json
agentic-workflow-kit mcp check --cwd .
```

`run-story` and `run-eligible` should be dry-run first. Non-dry-run execution can launch child Codex
MCP sessions, create branches or worktrees, edit files, run verification commands, and update
tracker rows according to `.workflow/config.yaml`.

The `project`, `run`, and `tracker` command groups are the product API facade. They emit the shared
WorkflowKit result envelope with `ok`, `operation`, `apiVersion`, `project`, `result`, `artifacts`,
`warnings`, and `next` fields. `run preview` delegates to the existing dry-run runtime path, so it
uses the same story and track selection behavior as `run-story --dry-run` and
`run-eligible --dry-run` while exposing product nouns for CLI/MCP parity. The legacy commands remain
available for current plugin workflows and existing automation.

Use `--version` for a plain package version and `version --json` for package, MCP server, API, and
config-schema version metadata. Use `config status --json` before config-dependent automation to
check the detected schema version, current/minimum supported versions, upgrade availability,
warnings, and next actions. Use `config upgrade --dry-run --json` to preview the migration and
`config upgrade --yes --json` to rewrite `.workflow/config.yaml` after explicit approval.

## MCP Server

Plugin installs start the MCP server with an exact package version:

```bash
npx -y --package @agentic-workflow-kit/orchestrator@<exact-version> agentic-workflow-kit-mcp
```

Available MCP tools:

- `workflow_runtime_info`
- `workflow_config_status`
- `workflow_config_upgrade`
- `workflow_project_inspect`
- `workflow_run_preview`
- `workflow_run_status`
- `workflow_run_stream`
- `workflow_run_inspect`
- `workflow_run_report`
- `workflow_run_export`
- `workflow_run_control`
- `workflow_tracker_validate`
- `workflow_tracker_migrate`
- `list_tracks`
- `list_stories`
- `list_eligible`
- `run_eligible`
- `run_story`
- `watch_run`
- `watch_run_start`
- `watch_run_poll`
- `watch_run_stop`
- `workflow_child_reply`
- `workflow_child_interrupt`
- `analyze_run`
- `workflow_driver_check`
- `codex_reply` / `codex_interrupt` / `check_codex_mcp` compatibility aliases

The MCP tools operate on the target repository. If the MCP session is not already running from a
workflow repo, pass `cwd` as the target repo root in tool input.

The `workflow_*` tools are the product-named facade. The legacy tools remain available for
0.5.13-compatible plugin workflows and existing automation.

`workflow_runtime_info` reports the same package, MCP server, API, and config-schema version
metadata as `agentic-workflow-kit version --json`. `workflow_config_status` reports compatibility
for the target repo config without writing files. `workflow_config_upgrade` previews by default and
requires explicit write confirmation before changing `.workflow/config.yaml`.

## Workflow Contract

The orchestrator does not invent workflow policy. It reads:

- `.workflow/config.yaml` for paths, status buckets, verification commands, git/worktree strategy,
  and PR/merge policy.
- Markdown trackers for story state, dependencies, ownership, and completion.

New workflow configs use semver schema versions such as `version: "0.6.0"`. Legacy `version: 1`
configs remain readable during the transition window and can be upgraded with the config status and
upgrade commands above.

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
agentic-workflow-kit run status .codex/agentic-workflow-kit/runs/<run-id> --json
agentic-workflow-kit run stream .codex/agentic-workflow-kit/runs/<run-id> --format ndjson
agentic-workflow-kit run inspect .codex/agentic-workflow-kit/runs/<run-id> --json
agentic-workflow-kit watch-run .codex/agentic-workflow-kit/runs/<run-id> --json
agentic-workflow-kit watch-run .codex/agentic-workflow-kit/runs/<run-id> --wait --interval-ms 300000 --timeout-ms 300000 --json
agentic-workflow-kit analyze-run .codex/agentic-workflow-kit/runs/<run-id> --json
agentic-workflow-kit run report .codex/agentic-workflow-kit/runs/<run-id> --format markdown
agentic-workflow-kit run export .codex/agentic-workflow-kit/runs/<run-id> --include summary --json
```

`watch-run` reads `orchestrator.watch` defaults from the run's `config.resolved.json`; CLI flags
override those defaults for one invocation. Use `--no-wait` or MCP `wait: false` to disable a
configured wait default for a single watch call.

Abort a running workflow:

```bash
agentic-workflow-kit abort-run .codex/agentic-workflow-kit/runs/<run-id> --reason "Wrong target branch" --json
```

Abort requests are appended to `controls.ndjson`, reflected in `events.ndjson`, and return
`applied`, `requested`, `unsupported`, or `already-terminal` depending on current run and child
session state.

## Policy and artifacts

Runtime policy comes from `.workflow/config.yaml`. In addition to paths, statuses, git strategy, and
PR behavior, configs can define named `agents.profiles` and `agents.bindings` for story
implementation, pre-PR review, planning, analysis, recovery, and tracker migration. Resolved launch
artifacts include the selected profile, prompt template/hash, structured-output intent, and driver
capability downgrades. Codex MCP currently records structured-output enforcement intent in
WorkflowKit evidence rather than sending unsupported host config keys.

Runs write local artifacts under `.codex/agentic-workflow-kit/runs/<runId>/`: compatibility files
(`run.json`, `state.json`, `events.ndjson`, `metrics.live.json`, `children/`) plus normalized
`summary.json`, `rows.json`, `budgets.json`, `transcripts.json`, and optional explicit
`analysis.json` / `report.md`. Export commands create bounded bundles from approved run artifacts,
skip raw child payloads, and do not follow transcript paths by default.

GitHub evidence is structured when available: PR number/URL, checks, Codex reaction/comment review
signal, findings triage, merge method/commit, and branch deletion. Analyzer and completion gates use
that evidence together with tracker state; they do not accept child prose alone as completion.

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
