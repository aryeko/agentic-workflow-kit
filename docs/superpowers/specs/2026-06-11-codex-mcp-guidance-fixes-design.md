# Codex MCP Guidance Fixes Design

## Context

OpenAI's current Codex MCP guidance describes two relevant contracts:

- Codex MCP servers may provide a server-wide `instructions` field during initialization. Codex reads it alongside tool descriptions, and the first 512 characters should stand alone.
- Codex plugins should point to bundled MCP configuration from `.codex-plugin/plugin.json` with `mcpServers`, and plugin-bundled MCP configuration may be a direct server map or a wrapped `mcp_servers` object.

The current repo has a working MCP runtime, but the Codex packaging and server metadata do not fully express those contracts:

- `.codex-plugin/plugin.json` does not include `mcpServers`.
- `plugins/agentic-workflow-kit/.mcp.json` uses `mcpServers`, which is not the current documented plugin-bundled shape.
- `packages/orchestrator/src/mcp/server.ts` creates `McpServer` without server-level `instructions`.
- Tests assert the existing fixture shape, so they do not catch drift from the current guidance.
- Docs mention the bundled MCP runtime but do not explain the Codex manifest pointer, documented fixture shape, or server instructions.

## Goals

- Make the Codex plugin manifest explicitly point to its bundled MCP config.
- Use a Codex fixture `.mcp.json` shape that matches current OpenAI plugin guidance.
- Add concise MCP server instructions for cross-tool workflow and launch safety.
- Update tests to fail on the old packaging shape and pass on the new one.
- Update durable docs and smoke guidance so contributors understand the contract.
- Add a changeset because plugin packaging and MCP initialization behavior change for published consumers.

## Non-Goals

- Do not change the Claude Code root `.mcp.json` shape. It still uses Claude plugin path variables and is covered separately.
- Do not change tool names or handler behavior.
- Do not add new MCP tools.
- Do not keep this transient spec or plan in the final PR diff; durable content belongs in canonical docs.

## Design

### Codex plugin manifest

Add:

```json
"mcpServers": "./.mcp.json"
```

to both `.codex-plugin/plugin.json` and `plugins/agentic-workflow-kit/.codex-plugin/plugin.json`.

### Codex fixture MCP config

Change `plugins/agentic-workflow-kit/.mcp.json` to the current documented wrapped shape:

```json
{
  "mcp_servers": {
    "agentic-workflow-kit": {
      "command": "node",
      "args": ["./mcp/server.mjs"],
      "cwd": "."
    }
  }
}
```

The root `.mcp.json` remains unchanged for Claude Code.

### MCP server instructions

Add a short exported `SERVER_INSTRUCTIONS` constant in `packages/orchestrator/src/mcp/server.ts` and pass it as the second `McpServer` constructor argument:

```ts
export const SERVER_INSTRUCTIONS =
  'Use agentic-workflow-kit for tracker-driven repo delivery. Prefer list_tracks/list_stories/list_eligible before dispatch. run_story and run_eligible default to dry-run; set dryRun=false only after explicit user approval. Tracker state is authoritative for completion. Use watch_run and analyze_run to inspect launched runs.';

const server = new McpServer(
  {
    name: 'agentic-workflow-kit',
    version: '0.1.0',
  },
  {
    instructions: SERVER_INSTRUCTIONS,
  },
);
```

This places cross-tool workflow guidance at the server level while keeping specific tool descriptions on each tool.

### Tests

Update or add tests in:

- `test/plugin-manifest.test.ts`
- `test/plugin-runtime-bundle.test.ts`

The tests should assert:

- `.codex-plugin/plugin.json` and fixture plugin manifest include `mcpServers: './.mcp.json'`.
- `plugins/agentic-workflow-kit/.mcp.json` uses `mcp_servers.agentic-workflow-kit`.
- `mcp/server.mjs` contains the server instructions text after regeneration.

### Docs

Update:

- `README.md`: local plugin testing describes the Codex manifest pointer and documented fixture shape.
- `docs/architecture.md`: where-things-live and bundled MCP runtime mention server instructions and Codex fixture wiring.
- `docs/test-plan/codex-plugin.md`: smoke checks validate manifest pointer, `.mcp.json`, bundled server, and that the bundled runtime is preferred.

### Verification

Run focused checks first:

```bash
pnpm exec vitest run test/plugin-manifest.test.ts test/plugin-runtime-bundle.test.ts
pnpm build:plugin-mcp
git diff --exit-code mcp/ plugins/agentic-workflow-kit/mcp/
```

Then run full gates:

```bash
pnpm check
pnpm build
pnpm pack:dry-run
pnpm smoke:codex-plugin
```

If `claude plugin validate .` is available, run it as an additional plugin packaging check.
