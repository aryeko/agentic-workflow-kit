# Bundled MCP Plugin Runtime Design

## Goal

Make `agentic-workflow-kit` plugin installs include the autonomous runtime surface for both Codex and Claude Code, while keeping the CLI as the standalone human, CI, and debugging interface.

## Problem

The current plugin bundle ships skills, references, presets, and examples. The `workflow-autopilot` skill describes autonomous dispatch, but it delegates to an external `agentic-workflow-kit` CLI. That creates a product gap: installing the plugin makes the autopilot skill visible, but does not guarantee the runtime command exists in the target repo or user's `PATH`.

The documentation also has current-state drift:

- `README.md` describes `0.1.0` as published and live.
- `AGENTS.md`, `CONTRIBUTING.md`, and `docs/getting-started.md` still describe a pre-publish or local-only state.
- Local plugin testing language still says "pre-publish testing" even though it is now a development smoke path.

## Non-Goals

- Do not replace the CLI. It remains the best surface for humans, CI, package smokes, and fallback.
- Do not require consumer repos such as Pathway to add `@agentic-workflow-kit/orchestrator` just to use plugin autopilot.
- Do not implement a Claude child-session driver in this change. The first MCP bundle may continue to use the existing `codex-mcp` child driver. A later release can add `orchestrator.driver: claude-agent-sdk`.
- Do not restructure the whole package into multiple publishable packages unless the MCP work proves it is necessary.

## Architecture

The runtime should be split into shared command handlers plus thin adapters:

```text
packages/orchestrator/src/commands/*
  shared command handlers for tracks, stories, runs, and analysis

packages/orchestrator/src/cli.ts
  CLI adapter: parses argv, calls shared handlers, formats terminal output

packages/orchestrator/src/mcp/*
  MCP adapter: defines tools, validates tool input, calls shared handlers, returns structured output

mcp/server.mjs
  bundled plugin artifact generated from the MCP adapter

skills/workflow-autopilot/SKILL.md
  instructions that prefer the bundled MCP runtime and use CLI only as dev/fallback
```

The shared command handlers should own the behavior. CLI and MCP adapters should not shell out to each other.

## Plugin Layout

Root plugin layout for Claude Code:

```text
.claude-plugin/plugin.json
.mcp.json
mcp/server.mjs
skills/
references/
presets/
examples/
```

Materialized Codex fixture layout:

```text
plugins/agentic-workflow-kit/.codex-plugin/plugin.json
plugins/agentic-workflow-kit/.mcp.json
plugins/agentic-workflow-kit/mcp/server.mjs
plugins/agentic-workflow-kit/skills/
plugins/agentic-workflow-kit/references/
plugins/agentic-workflow-kit/presets/
plugins/agentic-workflow-kit/examples/
```

The Codex fixture must remain materialized, not symlink-only, because prior install-cache validation failed when local plugin sources did not produce a real installed cache.

## MCP Configuration

Claude Code should use plugin path variables so the server can run from the installed plugin cache while operating on the current project:

```json
{
  "mcpServers": {
    "agentic-workflow-kit": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/mcp/server.mjs"],
      "cwd": "${CLAUDE_PROJECT_DIR}"
    }
  }
}
```

Codex should use the plugin-relative pattern already used by installed Codex plugins:

```json
{
  "mcpServers": {
    "agentic-workflow-kit": {
      "cwd": ".",
      "command": "node",
      "args": ["./mcp/server.mjs"]
    }
  }
}
```

The source tree can keep one root `.mcp.json` if it validates for Claude. The Codex fixture can materialize a surface-specific `.mcp.json` if needed. Do not force identical config if the clients expect different path semantics.

## MCP Tool Surface

The first MCP server should expose these tools:

| Tool | Purpose |
| --- | --- |
| `list_tracks` | Discover configured tracker directories and active tracks. |
| `list_stories` | Parse stories for a selected track. |
| `list_eligible` | Return stories whose status, owner, and dependencies make them dispatchable. |
| `run_eligible` | Dry-run or launch eligible stories for one track. |
| `run_story` | Dry-run or launch a specific story. |
| `watch_run` | Read the current run snapshot from a run artifact directory. |
| `analyze_run` | Analyze a completed run and child artifacts. |
| `check_codex_mcp` | Validate the existing Codex child MCP server schema. |

All tools should accept an optional `cwd` or equivalent project directory. Tool input schemas should be explicit and minimal. Tools should return structured JSON for automation and a short text summary for transcript readability.

`run_eligible` and `run_story` must preserve existing safety rules:

- Dry-run is the default unless the caller explicitly requests launch.
- The tracker row remains the only completion authority.
- Child prose, token metrics, or MCP success never mark a story complete.
- Configured PR, review, CI, merge, and cleanup policy still comes from `.workflow/config.yaml`.

## CLI Surface

The CLI stays public:

```bash
agentic-workflow-kit list-tracks
agentic-workflow-kit list-stories --track <track-id>
agentic-workflow-kit list-eligible --track <track-id>
agentic-workflow-kit run-eligible --dry-run --track <track-id>
agentic-workflow-kit run-story <story-id> --track <track-id>
agentic-workflow-kit watch-run .codex/agentic-workflow-kit/runs/<run-id>
agentic-workflow-kit analyze-run .codex/agentic-workflow-kit/runs/<run-id>
agentic-workflow-kit mcp check
```

The CLI and MCP server should share handler code, but the CLI must preserve existing output and argument behavior unless a test-backed change is intentional.

## Workflow-Autopilot Skill Behavior

Update `workflow-autopilot` to prefer MCP:

1. Load `.workflow/config.yaml`, config schema docs, tracker contract, and repo instructions.
2. Use bundled MCP tools for list, dry-run, launch, watch, and analyze when available.
3. Use the CLI only when the user explicitly asks for shell commands, when running local development in this repo, or when MCP tools are unavailable and the CLI exists.
4. State the current driver limitation when relevant: this release bundles the runtime, but autonomous child execution still uses the configured `codex-mcp` driver.

## Documentation Requirements

After MCP is wired, update every canonical doc that mentions install, runtime, or smoke behavior:

- `README.md`
- `AGENTS.md`
- `CONTRIBUTING.md`
- `docs/README.md`
- `docs/architecture.md`
- `docs/getting-started.md`
- `docs/test-plan/README.md`
- `docs/test-plan/common-phases.md`
- `docs/test-plan/claude-plugin.md`
- `docs/test-plan/codex-plugin.md`

Canonical wording:

- Plugin install includes skills plus the bundled MCP runtime.
- CLI is optional for standalone use, development, CI, and fallback.
- Consumer repos need `.workflow/config.yaml` and trackers, not copied plugin source.
- `@agentic-workflow-kit/orchestrator` remains published for CLI users.
- Initial bundled autopilot still uses the existing `codex-mcp` child driver.

## Release Policy

Use one changeset for the bundled MCP feature, not one changeset per phase.

- Stale docs cleanup: no changeset.
- Internal handler extraction with no behavior change: no changeset.
- MCP server, plugin bundling, skill behavior, and docs for the new runtime: one changeset in the feature PR.

Release type: minor for `@agentic-workflow-kit/orchestrator`.

Expected version movement:

```text
0.1.0 -> 0.2.0
```

Plugin manifest versions should move with the release:

- `.claude-plugin/plugin.json`
- `.codex-plugin/plugin.json`
- `plugins/agentic-workflow-kit/.codex-plugin/plugin.json`
- marketplace fixture metadata that pins the plugin version

Release only after the complete verification set passes.

Do not run `pnpm version-packages` in the feature PR unless the PR is explicitly being used as the release PR. The normal flow is:

1. Feature PR includes implementation, docs, and one `.changeset/*.md`.
2. Merge the feature PR.
3. A later release PR runs `pnpm version-packages`, updates versions and changelogs, then publishes.

## Branch and PR Strategy

This work should be implemented in one branch and one PR because the code, plugin manifests, bundled runtime, skills, tests, and docs need to stay coherent. Keep it reviewable with multiple focused commits rather than splitting tightly coupled runtime changes across several PRs.

Recommended commit order:

1. `docs: plan bundled mcp plugin runtime`
2. `docs: align published plugin status`
3. `refactor: share orchestrator command handlers`
4. `feat: expose orchestrator as mcp server`
5. `build: bundle plugin mcp runtime`
6. `feat: bundle codex plugin mcp server`
7. `feat: bundle claude plugin mcp server`
8. `docs: prefer mcp runtime for autopilot skill`
9. `chore: add bundled mcp runtime changeset`
10. `docs: document bundled mcp plugin runtime`

Use checkpoints after handler extraction, after MCP server implementation, after plugin wiring, and after the canonical docs pass. If a checkpoint exposes a fundamental design problem, stop and split the work before forcing the branch forward.

## Verification

Required local gates:

```bash
pnpm check
pnpm build
pnpm pack:dry-run
pnpm smoke:codex-plugin
claude plugin validate .
```

Additional smoke expectations:

- Codex temporary `CODEX_HOME` install includes `.mcp.json` and `mcp/server.mjs` in the plugin cache.
- Claude `--plugin-dir .` or plugin validation sees the MCP server.
- MCP `list_eligible` parses `examples/example-tracker`.
- Dry-run works without installing `@agentic-workflow-kit/orchestrator` in the target repo.
- CLI still works after removing `packages/orchestrator/dist` and rebuilding.

## Risks

- Claude and Codex may differ in `.mcp.json` path handling. Mitigation: keep generated MCP server code shared, but allow surface-specific config files.
- Bundling can accidentally omit runtime dependencies. Mitigation: run the bundled server directly from a temporary directory and verify tool listing.
- MCP tool names may become too broad or unstable. Mitigation: keep a small first tool set and add tools only when they map to existing CLI behavior.
- The Claude plugin may appear fully autonomous while still using Codex children. Mitigation: document the current driver limitation clearly and reserve Claude child dispatch for a later driver release.

## Open Follow-Up

After this release, design `orchestrator.driver: claude-agent-sdk` as a separate spec. That should cover SDK authentication, child session isolation, permission policy, output normalization, and parity with Codex child metrics.
