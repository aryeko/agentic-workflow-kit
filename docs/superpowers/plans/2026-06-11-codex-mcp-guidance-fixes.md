# Codex MCP Guidance Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the Codex plugin MCP packaging and server metadata with current OpenAI Codex MCP guidance.

**Architecture:** Keep the existing orchestrator MCP runtime and tool handlers. Add server-wide instructions at the MCP adapter boundary, update Codex-only plugin metadata and fixture wiring, regenerate the bundled server artifact, and document the durable plugin contract.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, Codex plugin metadata JSON, Vitest, pnpm, Changesets.

---

## File Structure

- Modify: `.codex-plugin/plugin.json`
  - Add the Codex plugin `mcpServers` pointer.
- Modify: `plugins/agentic-workflow-kit/.codex-plugin/plugin.json`
  - Mirror the manifest pointer in the materialized fixture.
- Modify: `plugins/agentic-workflow-kit/.mcp.json`
  - Use documented `mcp_servers` wrapper for the Codex fixture.
- Modify: `packages/orchestrator/src/mcp/server.ts`
  - Add and pass server-wide MCP instructions.
- Generated: `mcp/server.mjs`
  - Regenerated from `packages/orchestrator/src/mcp/server.ts`.
- Generated: `plugins/agentic-workflow-kit/mcp/server.mjs`
  - Regenerated fixture bundle, byte-synced with `mcp/server.mjs`.
- Modify: `test/plugin-manifest.test.ts`
  - Assert current documented Codex plugin MCP manifest/config shape.
- Modify: `test/plugin-runtime-bundle.test.ts`
  - Assert bundled server includes instructions.
- Modify: `README.md`
  - Document Codex manifest-to-MCP fixture wiring.
- Modify: `docs/architecture.md`
  - Document server instructions and Codex fixture wiring.
- Modify: `docs/test-plan/codex-plugin.md`
  - Document smoke checks for manifest pointer and fixture config.
- Create: `.changeset/<slug>.md`
  - Patch changeset for plugin MCP packaging and server instructions.
- Delete in final commit: this spec and plan file.

## Task 1: Add Red Tests for Codex Plugin MCP Packaging

**Files:**
- Modify: `test/plugin-manifest.test.ts`

- [ ] **Step 1: Write failing manifest tests**

Add expectations to the existing Codex manifest tests:

```ts
expect(m.mcpServers).toBe('./.mcp.json');
```

and update the fixture MCP expectation to:

```ts
expect(mcp.mcp_servers?.['agentic-workflow-kit']).toEqual({
  command: 'node',
  args: ['./mcp/server.mjs'],
  cwd: '.',
});
expect(mcp.mcpServers).toBeUndefined();
```

- [ ] **Step 2: Run focused test and confirm red**

Run:

```bash
pnpm exec vitest run test/plugin-manifest.test.ts
```

Expected: FAIL because `.codex-plugin/plugin.json` has no `mcpServers` field and the fixture still uses `mcpServers`.

## Task 2: Add Red Test for Server Instructions in Bundle

**Files:**
- Modify: `test/plugin-runtime-bundle.test.ts`

- [ ] **Step 1: Write failing bundle test**

Add a test that imports the source constant and checks the generated bundle:

```ts
import { SERVER_INSTRUCTIONS } from '../packages/orchestrator/src/mcp/server.js';

it('bundles server-wide MCP instructions for Codex tool selection', () => {
  const bundle = readFileSync('mcp/server.mjs', 'utf8');
  expect(SERVER_INSTRUCTIONS).toContain('Use agentic-workflow-kit for tracker-driven repo delivery.');
  expect(SERVER_INSTRUCTIONS.length).toBeLessThanOrEqual(512);
  expect(bundle).toContain('Use agentic-workflow-kit for tracker-driven repo delivery.');
  expect(bundle).toContain('instructions: SERVER_INSTRUCTIONS');
});
```

- [ ] **Step 2: Run focused test and confirm red**

Run:

```bash
pnpm exec vitest run test/plugin-runtime-bundle.test.ts
```

Expected: FAIL because `SERVER_INSTRUCTIONS` is not exported yet.

## Task 3: Implement Manifest and Fixture MCP Config

**Files:**
- Modify: `.codex-plugin/plugin.json`
- Modify: `plugins/agentic-workflow-kit/.codex-plugin/plugin.json`
- Modify: `plugins/agentic-workflow-kit/.mcp.json`

- [ ] **Step 1: Add manifest pointer**

Add this field after `skills` in both Codex plugin manifests:

```json
"mcpServers": "./.mcp.json",
```

- [ ] **Step 2: Update fixture MCP shape**

Replace the fixture `.mcp.json` body with:

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

- [ ] **Step 3: Run manifest focused test**

Run:

```bash
pnpm exec vitest run test/plugin-manifest.test.ts
```

Expected: PASS.

## Task 4: Implement Server Instructions and Regenerate Bundle

**Files:**
- Modify: `packages/orchestrator/src/mcp/server.ts`
- Modify: `mcp/server.mjs`
- Modify: `plugins/agentic-workflow-kit/mcp/server.mjs`

- [ ] **Step 1: Add source instructions**

Add:

```ts
export const SERVER_INSTRUCTIONS =
  'Use agentic-workflow-kit for tracker-driven repo delivery. Prefer list_tracks/list_stories/list_eligible before dispatch. run_story and run_eligible default to dry-run; set dryRun=false only after explicit user approval. Tracker state is authoritative for completion. Use watch_run and analyze_run to inspect launched runs.';
```

Pass `{ instructions: SERVER_INSTRUCTIONS }` to `new McpServer(...)`.

- [ ] **Step 2: Regenerate bundle**

Run:

```bash
pnpm build:plugin-mcp
```

- [ ] **Step 3: Run runtime focused test**

Run:

```bash
pnpm exec vitest run test/plugin-runtime-bundle.test.ts
```

Expected: PASS.

## Task 5: Update Durable Docs and Add Changeset

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/test-plan/codex-plugin.md`
- Create: `.changeset/<slug>.md`

- [ ] **Step 1: Update docs**

Document:

- Codex plugin manifest has `mcpServers: './.mcp.json'`.
- The fixture `.mcp.json` uses the documented `mcp_servers` wrapper.
- The MCP server provides concise server instructions for cross-tool workflow guidance.

- [ ] **Step 2: Add changeset**

Create a patch changeset:

```md
---
"agentic-workflow-kit": patch
"@agentic-workflow-kit/orchestrator": patch
---

Align Codex plugin MCP packaging with current Codex plugin guidance and add server-wide MCP instructions for workflow-tool selection and launch safety.
```

## Task 6: Final Verification and Cleanup

**Files:**
- Delete: `docs/superpowers/specs/2026-06-11-codex-mcp-guidance-fixes-design.md`
- Delete: `docs/superpowers/plans/2026-06-11-codex-mcp-guidance-fixes.md`

- [ ] **Step 1: Verify generated bundle sync**

Run:

```bash
pnpm build:plugin-mcp
git diff --exit-code mcp/ plugins/agentic-workflow-kit/mcp/
```

Expected: no diff after regeneration.

- [ ] **Step 2: Run required and publish checks**

Run:

```bash
pnpm check
pnpm build
pnpm pack:dry-run
pnpm smoke:codex-plugin
```

If available, also run:

```bash
claude plugin validate .
```

- [ ] **Step 3: Delete transient working artifacts**

Delete this spec and plan after their durable content has been folded into canonical docs.

- [ ] **Step 4: Commit, push, and open PR**

Use explicit staging. Suggested commits:

```bash
git add docs/superpowers/specs/2026-06-11-codex-mcp-guidance-fixes-design.md docs/superpowers/plans/2026-06-11-codex-mcp-guidance-fixes.md
git commit -m "docs: plan codex mcp guidance fixes"

git add .codex-plugin/plugin.json plugins/agentic-workflow-kit/.codex-plugin/plugin.json plugins/agentic-workflow-kit/.mcp.json packages/orchestrator/src/mcp/server.ts mcp/server.mjs plugins/agentic-workflow-kit/mcp/server.mjs test/plugin-manifest.test.ts test/plugin-runtime-bundle.test.ts README.md docs/architecture.md docs/test-plan/codex-plugin.md .changeset/<slug>.md
git commit -m "fix: align codex mcp plugin packaging"

git add -u docs/superpowers
git commit -m "docs: fold codex mcp plan into canonical docs"
```

Then push and open a PR to `main`.
