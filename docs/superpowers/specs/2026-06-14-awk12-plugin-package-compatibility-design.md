---
title: AWK12 detailed technical story spec
owner: codex-2026-06-14T02-16-42Z
last-reviewed: 2026-06-14
related:
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK12.md
  - ../../prds/agentic-workflow-kit-redesign/README.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution.md
  - ../../../AGENTS.md
---

# AWK12 detailed technical story spec

## Source story brief

`docs/tracks/agentic-workflow-kit-redesign/stories/AWK12.md`

## Decisions resolved from the story brief

| Question | Decision | Rationale |
| --- | --- | --- |
| Does this repo contain a materialized `plugins/agentic-workflow-kit/` fixture in this checkout? | Yes. The checkout contains `plugins/agentic-workflow-kit/` with materialized `.codex-plugin/`, `skills/`, `references/`, `presets/`, and `examples/` files. | `test/plugin-manifest.test.ts` already requires the fixture to exist, not be symlinked, mirror source plugin files byte-for-byte, and use the fixture-specific `.codex-plugin/.mcp.json`. AWK12 should preserve and extend this fixture rather than document absence. |
| Should old MCP tools remain visible after new API tools are added? | Yes. Keep legacy tools visible next to the product `workflow_*` tools. | AWK01 explicitly scoped the API facade to coexist with 0.5.13-compatible tools. `ORCHESTRATOR_MCP_TOOLS` currently includes product tools plus `list_tracks`, `list_stories`, `list_eligible`, `run_eligible`, `run_story`, `watch_run*`, `codex_reply`, `codex_interrupt`, `analyze_run`, and `check_codex_mcp`; AWK12 will harden package/plugin smokes around that combined surface. |

## Exact types/contracts

- No public TypeScript runtime contract changes are required for this story unless tests expose drift.
- The package/plugin compatibility contract is the exact MCP tool-name set exported by `packages/orchestrator/src/mcp/tools.ts` as `ORCHESTRATOR_MCP_TOOLS`.
- Product API tools that must be visible through package and plugin smoke:
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
- Legacy compatibility tools that must remain visible:
  - `list_tracks`
  - `list_stories`
  - `list_eligible`
  - `run_eligible`
  - `run_story`
  - `watch_run`
  - `watch_run_start`
  - `watch_run_poll`
  - `watch_run_stop`
  - `codex_reply`
  - `codex_interrupt`
  - `analyze_run`
  - `check_codex_mcp`
- The Codex plugin MCP config contract remains `.codex-plugin/plugin.json` with `mcpServers: "./.codex-plugin/.mcp.json"` pointing to Codex-shaped `mcpServers.agentic-workflow-kit`.
- The Claude plugin MCP config contract remains root `.mcp.json` with `cwd: "${CLAUDE_PROJECT_DIR}"`.
- Package version references must stay exact-version and aligned across root package, orchestrator package, Claude plugin, Codex plugin, marketplace manifests, and the local Codex fixture.

## Exact files/modules

```text
test/plugin-tool-surface.ts                    Add shared smoke-test expectations for product plus legacy MCP tools.
test/publish-readiness.test.ts                 Assert the built package MCP entrypoint exposes the full combined tool surface.
test/codex-plugin-smoke.vitest.ts              Assert the installed Codex plugin package MCP entrypoint exposes the full combined tool surface from a non-plugin cwd.
test/docs-current-state.test.ts                Lock package README compatibility wording and current run artifact path examples.
packages/orchestrator/README.md                Update npm/package-facing CLI and MCP docs for current product status/stream/inspect/report/export/control tools while preserving legacy-tool language.
docs/test-plan/codex-plugin.md                 Note that automated Codex smoke covers installed package MCP startup and full product plus legacy tools.
.codex-plugin/plugin.json                      Refresh Codex-facing plugin description/default prompts for run status, stream, report, and export compatibility.
.claude-plugin/plugin.json                     Refresh Claude-facing plugin description for the package-backed runtime and artifact/report surfaces.
plugins/agentic-workflow-kit/.codex-plugin/*  Mirror `.codex-plugin/` byte-for-byte after any Codex manifest or MCP config edits.
```

No schema, preset, example tracker, runtime handler, or package export changes are planned unless verification reveals drift.

## Query/schema/prompt/event/component design

- Package smoke should start the built `dist/mcp/server.js`, call MCP `tools/list`, and assert the complete combined tool surface is present. This catches package entrypoint drift without needing a plugin install.
- Codex plugin smoke should keep the existing temporary `CODEX_HOME` installation, exact-version package registry, and non-plugin consumer cwd path, then assert the same combined tool surface from the installed `.codex-plugin/.mcp.json` command.
- Documentation should describe the product-named `workflow_*` tools and legacy tools as intentionally coexisting. It must not imply that legacy tools are deprecated or hidden.
- Documentation examples should use the current run artifact root `.codex/agentic-workflow-kit/runs/<run-id>`, not older `.workflow/runs/<run-id>` paths.
- Plugin manifests should remain concise, with no new invocation behavior. `implement-next` and `workflow-autopilot` remain explicit-invocation-only through their skill metadata.

## Tests

- Focused first:
  - `pnpm vitest run test/plugin-manifest.test.ts test/plugin-runtime-bundle.test.ts test/publish-readiness.test.ts test/docs-current-state.test.ts`
  - `pnpm smoke:codex-plugin`
- Package/protocol gates:
  - `pnpm build`
  - `pnpm pack:dry-run`
- Required full gate:
  - `pnpm check`

## Migration/deploy concerns

- No database migration, hosted deploy, or package publication is part of AWK12.
- No changeset is created here; AWK14 owns consolidated release readiness.
- The story updates repo code and tests for a later release while the executing plugin remains pinned outside the branch.
- If npm/codex smoke needs network and fails from package resolution rather than repo code, record the exact failure and stop before marking the story complete.
- Keep the Codex local marketplace fixture materialized and byte-synced with `.codex-plugin/`, `skills/`, `references/`, `presets/`, and `examples/`.

## Blocking technical questions

None
