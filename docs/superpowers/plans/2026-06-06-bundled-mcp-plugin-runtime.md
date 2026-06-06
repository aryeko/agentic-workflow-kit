# Bundled MCP Plugin Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a plugin-bundled MCP runtime for both Codex and Claude Code, keep the CLI as the standalone interface, and update canonical docs to current published standards.

**Architecture:** Extract shared orchestrator command handlers, call them from both the existing CLI and a new MCP server adapter, bundle the MCP server into plugin install artifacts, and update plugin skills/docs to prefer MCP for autopilot. Codex and Claude use the same bundled server code with surface-specific plugin config where path semantics differ.

**Tech Stack:** TypeScript, Node ESM, MCP TypeScript SDK, commander, esbuild, pnpm, Vitest, Claude Code plugin validation, Codex plugin smoke.

---

## Execution Policy

Implement this as one branch and one PR. Keep the PR readable with focused commits in this order:

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

Include one feature changeset in the PR. Do not run `pnpm version-packages` in this feature PR unless the human explicitly changes the scope to a release PR.

Review checkpoints:

- after shared handler extraction,
- after MCP server implementation,
- after Codex and Claude plugin wiring,
- after canonical docs and final verification.

After implementation and verification, spawn a fresh review agent with this spec and plan and ask it to verify quality, correctness, and spec compliance. Fix valid findings before opening the PR.

## Task 1: Clean Stale Published-State Docs

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `CONTRIBUTING.md`
- Modify: `docs/getting-started.md`
- Modify: `test/docs-current-state.test.ts`

- [ ] **Step 1: Add failing stale-doc assertions**

Add assertions to `test/docs-current-state.test.ts` that fail on these phrases:

```ts
expect(readFileSync('AGENTS.md', 'utf8')).not.toContain('not yet published');
expect(readFileSync('CONTRIBUTING.md', 'utf8')).not.toContain('not yet published');
expect(readFileSync('docs/getting-started.md', 'utf8')).not.toContain('Install commands are planned');
expect(readFileSync('README.md', 'utf8')).not.toContain('pre-publish testing');
```

- [ ] **Step 2: Run focused test and confirm failure**

Run:

```bash
pnpm exec vitest run test/docs-current-state.test.ts
```

Expected: failure proving the stale phrases still exist.

- [ ] **Step 3: Update docs to the current state**

Update stale wording to say:

- `agentic-workflow-kit` is published as `0.1.0`.
- Local plugin testing is a development validation path.
- The bundled runtime work is planned in this spec/plan, not present until implemented.

- [ ] **Step 4: Run focused test and full check**

Run:

```bash
pnpm exec vitest run test/docs-current-state.test.ts
pnpm check
```

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add README.md AGENTS.md CONTRIBUTING.md docs/getting-started.md test/docs-current-state.test.ts
git commit -m "docs: align published plugin status"
```

## Task 2: Extract Shared Command Handlers

**Files:**
- Create: `packages/orchestrator/src/commands/handlers.ts`
- Modify: `packages/orchestrator/src/cli.ts`
- Test: `packages/orchestrator/tests/cli.test.ts`
- Test: new or existing focused handler tests under `packages/orchestrator/tests/`

- [ ] **Step 1: Identify behavior currently owned by CLI**

Read `packages/orchestrator/src/cli.ts` and list the branches for:

- `help`
- `analyze-run`
- `watch-run`
- `mcp-check`
- `list-tracks`
- `list-stories`
- `list-eligible`
- `run-story`
- `run-eligible`

- [ ] **Step 2: Add handler tests before extraction**

Create tests that call the future handler API against temp fixtures. Cover at minimum:

- list tracks returns the expected track id.
- list eligible returns only dependency-ready stories.
- analyze run returns existing summary shape for a fixture or temp artifact.

- [ ] **Step 3: Extract handlers**

Create `packages/orchestrator/src/commands/handlers.ts` exporting typed functions similar to:

```ts
export interface CommandHandlerOptions {
  cwd: string;
  stdout?: NodeJS.WritableStream;
  createCodexMcpClient?: CodexMcpStoryRunnerOptions['createClient'];
}

export async function listTracksHandler(overrides: CliOverrides, options: CommandHandlerOptions): Promise<unknown> {
  const config = await loadResolvedConfig(overrides, options.cwd);
  const tracks = await discoverTracks(config, overrides);
  return { tracks };
}
```

Keep exact names flexible, but preserve typed inputs and outputs.

- [ ] **Step 4: Rewire CLI to handlers**

Update `packages/orchestrator/src/cli.ts` so parsing stays in the CLI and behavior moves to handlers. Preserve existing output format.

- [ ] **Step 5: Run focused and package tests**

Run:

```bash
pnpm --filter @agentic-workflow-kit/orchestrator test
pnpm check
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add packages/orchestrator/src/commands/handlers.ts packages/orchestrator/src/cli.ts packages/orchestrator/tests
git commit -m "refactor: share orchestrator command handlers"
```

## Task 3: Add MCP Server Adapter

**Files:**
- Create: `packages/orchestrator/src/mcp/server.ts`
- Create: `packages/orchestrator/src/mcp/tools.ts`
- Modify: `packages/orchestrator/package.json`
- Test: `packages/orchestrator/tests/mcp-server.test.ts`

- [ ] **Step 1: Add failing MCP tool registration test**

Test that the server exposes these tool names:

```text
list_tracks
list_stories
list_eligible
run_eligible
run_story
watch_run
analyze_run
check_codex_mcp
```

- [ ] **Step 2: Define MCP tool schemas**

Create `packages/orchestrator/src/mcp/tools.ts` with explicit schemas for:

- `cwd?: string`
- `track?: string`
- `storyId?: string`
- `dryRun?: boolean`
- `maxParallel?: number`
- `runPath?: string`
- `json?: boolean`

Default run tools to dry-run unless `dryRun === false` is explicitly provided and the command semantics allow launching.

- [ ] **Step 3: Implement server entrypoint**

Create `packages/orchestrator/src/mcp/server.ts` using the MCP SDK stdio server APIs. Each tool should call the shared handlers from Task 2 and return:

- structured JSON content for machine use
- concise text content for transcript readability

- [ ] **Step 4: Add package script**

Add a package script such as:

```json
"mcp:dev": "tsx --tsconfig tsconfig.typecheck.json src/mcp/server.ts"
```

Keep the published CLI bin unchanged.

- [ ] **Step 5: Run focused tests**

Run:

```bash
pnpm --filter @agentic-workflow-kit/orchestrator test -- packages/orchestrator/tests/mcp-server.test.ts
pnpm --filter @agentic-workflow-kit/orchestrator test
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add packages/orchestrator/src/mcp packages/orchestrator/package.json packages/orchestrator/tests/mcp-server.test.ts
git commit -m "feat: expose orchestrator as mcp server"
```

## Task 4: Bundle MCP Server for Plugin Installs

**Files:**
- Create: `scripts/build-plugin-mcp.mjs`
- Modify: `package.json`
- Create generated artifact: `mcp/server.mjs`
- Test: `test/plugin-runtime-bundle.test.ts`

- [ ] **Step 1: Add failing bundle existence test**

Create `test/plugin-runtime-bundle.test.ts` asserting:

```ts
expect(existsSync('mcp/server.mjs')).toBe(true);
expect(readFileSync('mcp/server.mjs', 'utf8')).toContain('agentic-workflow-kit');
```

Also assert the bundled server can run a help or tool-list smoke if the MCP SDK makes that cheap and deterministic.

- [ ] **Step 2: Add bundling script**

Create `scripts/build-plugin-mcp.mjs` that runs esbuild over `packages/orchestrator/src/mcp/server.ts` and writes `mcp/server.mjs`. Use Node ESM and fail loudly on build errors.

- [ ] **Step 3: Wire root scripts**

Update root `package.json`:

```json
"build:plugin-mcp": "node scripts/build-plugin-mcp.mjs",
"build": "pnpm --filter @agentic-workflow-kit/orchestrator build && pnpm build:plugin-mcp"
```

Keep existing `pnpm check` behavior compatible with clean clones.

- [ ] **Step 4: Run bundle tests**

Run:

```bash
pnpm build:plugin-mcp
pnpm exec vitest run test/plugin-runtime-bundle.test.ts
pnpm check
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-plugin-mcp.mjs package.json mcp/server.mjs test/plugin-runtime-bundle.test.ts
git commit -m "build: bundle plugin mcp runtime"
```

## Task 5: Wire Codex Plugin MCP Runtime

**Files:**
- Create or modify: `.mcp.json`
- Create: `plugins/agentic-workflow-kit/.mcp.json`
- Create: `plugins/agentic-workflow-kit/mcp/server.mjs`
- Modify: `test/plugin-manifest.test.ts`
- Modify: `test/codex-plugin-smoke.vitest.ts`

- [ ] **Step 1: Extend fixture sync tests**

Update `test/plugin-manifest.test.ts` so the materialized Codex fixture includes:

- `.mcp.json`
- `mcp/server.mjs`

Keep existing materialized-file and byte-sync expectations for shared plugin content.

- [ ] **Step 2: Add Codex fixture MCP config**

Create `plugins/agentic-workflow-kit/.mcp.json`:

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

- [ ] **Step 3: Copy bundled server into fixture**

Materialize `plugins/agentic-workflow-kit/mcp/server.mjs` from `mcp/server.mjs`.

- [ ] **Step 4: Extend Codex smoke**

Update `test/codex-plugin-smoke.vitest.ts` to assert the installed plugin cache contains:

- `.mcp.json`
- `mcp/server.mjs`

Do not require the default `pnpm check` gate to have a live Codex CLI. Keep live install validation inside `pnpm smoke:codex-plugin`.

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm exec vitest run test/plugin-manifest.test.ts
pnpm smoke:codex-plugin
pnpm check
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add .mcp.json plugins/agentic-workflow-kit/.mcp.json plugins/agentic-workflow-kit/mcp/server.mjs test/plugin-manifest.test.ts test/codex-plugin-smoke.vitest.ts
git commit -m "feat: bundle codex plugin mcp server"
```

## Task 6: Wire Claude Plugin MCP Runtime

**Files:**
- Modify or create: `.mcp.json`
- Modify: `.claude-plugin/plugin.json`
- Modify: `docs/test-plan/claude-plugin.md`
- Test: `test/plugin-manifest.test.ts` or new Claude plugin manifest test

- [ ] **Step 1: Add Claude plugin MCP assertions**

Add tests that assert the root plugin includes:

- `.claude-plugin/plugin.json`
- `.mcp.json`
- `mcp/server.mjs`

- [ ] **Step 2: Add Claude MCP config**

Use Claude path variables in root `.mcp.json` if this file is Claude-specific:

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

If Codex and Claude cannot share root `.mcp.json`, keep root `.mcp.json` Claude-oriented and materialize the Codex-specific copy only under `plugins/agentic-workflow-kit/.mcp.json`.

- [ ] **Step 3: Validate Claude plugin locally**

Run:

```bash
claude plugin validate .
```

Expected: pass. If Claude is unavailable in the execution environment, record the exact reason and leave the command as manual verification.

- [ ] **Step 4: Commit**

```bash
git add .mcp.json .claude-plugin/plugin.json docs/test-plan/claude-plugin.md test/plugin-manifest.test.ts
git commit -m "feat: bundle claude plugin mcp server"
```

## Task 7: Update Workflow-Autopilot Skill

**Files:**
- Modify: `skills/workflow-autopilot/SKILL.md`
- Modify: `plugins/agentic-workflow-kit/skills/workflow-autopilot/SKILL.md`
- Test: `test/skill-authoring.test.ts`
- Test: `test/plugin-manifest.test.ts`

- [ ] **Step 1: Add expectations for MCP-first language**

Update tests to assert `workflow-autopilot` mentions:

- bundled MCP runtime
- CLI fallback
- dry-run before launch
- current `codex-mcp` driver limitation

- [ ] **Step 2: Update source skill**

Revise `skills/workflow-autopilot/SKILL.md` so the command section starts with MCP tools and moves CLI commands into a fallback/development section.

- [ ] **Step 3: Sync materialized fixture skill**

Copy the updated skill into `plugins/agentic-workflow-kit/skills/workflow-autopilot/SKILL.md` or run the repo's fixture materialization flow if one exists by then.

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm exec vitest run test/skill-authoring.test.ts test/plugin-manifest.test.ts
pnpm check
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add skills/workflow-autopilot/SKILL.md plugins/agentic-workflow-kit/skills/workflow-autopilot/SKILL.md test/skill-authoring.test.ts test/plugin-manifest.test.ts
git commit -m "docs: prefer mcp runtime for autopilot skill"
```

## Task 8: Add Feature Changeset

**Files:**
- Create: `.changeset/<generated-name>.md`

- [ ] **Step 1: Create one changeset**

Run:

```bash
pnpm changeset
```

Select a minor bump for:

```text
@agentic-workflow-kit/orchestrator
```

Use summary:

```text
Add a bundled MCP runtime for plugin installs, exposing orchestrator operations as MCP tools while preserving the standalone CLI.
```

- [ ] **Step 2: Commit**

```bash
git add .changeset
git commit -m "chore: add bundled mcp runtime changeset"
```

## Task 9: Canonical Docs Pass

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `CONTRIBUTING.md`
- Modify: `docs/README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/getting-started.md`
- Modify: `docs/test-plan/README.md`
- Modify: `docs/test-plan/common-phases.md`
- Modify: `docs/test-plan/claude-plugin.md`
- Modify: `docs/test-plan/codex-plugin.md`
- Modify: `test/docs-current-state.test.ts`

- [ ] **Step 1: Add doc guardrails**

Extend `test/docs-current-state.test.ts` to assert canonical wording:

- plugin install includes bundled MCP runtime
- CLI remains optional standalone/dev/CI interface
- local plugin smoke is not the default `pnpm check` gate
- first bundled autopilot still uses the existing `codex-mcp` child driver

- [ ] **Step 2: Update README**

Update install and architecture sections so the public story is:

- Install plugin for skills plus MCP runtime.
- Install `@agentic-workflow-kit/orchestrator` only for standalone CLI usage.
- Use `.workflow/config.yaml` and trackers in consumer repos.

- [ ] **Step 3: Update architecture docs**

Update diagrams and text to show:

```text
skills -> MCP tools -> orchestrator handlers -> Codex child driver
CLI ----^
```

- [ ] **Step 4: Update smoke docs**

Separate:

- local package checks
- Codex plugin install smoke
- Claude plugin validation
- MCP tool smoke
- live dispatch smoke

- [ ] **Step 5: Run docs and full checks**

Run:

```bash
pnpm exec vitest run test/docs-current-state.test.ts
pnpm check
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add README.md AGENTS.md CONTRIBUTING.md docs test/docs-current-state.test.ts
git commit -m "docs: document bundled mcp plugin runtime"
```

## Task 10: Future Release Version Prep

**Files:**
- Modify after `pnpm changeset version`: package manifests and plugin metadata
- Modify: `.claude-plugin/plugin.json`
- Modify: `.codex-plugin/plugin.json`
- Modify: `plugins/agentic-workflow-kit/.codex-plugin/plugin.json`
- Modify: `.claude-plugin/marketplace.json`

- [ ] **Step 1: Version packages in the release PR only**

Do not run this in the feature PR. Run only when ready to cut a release after the feature PR has merged:

```bash
pnpm version-packages
```

Expected:

```text
@agentic-workflow-kit/orchestrator: 0.1.0 -> 0.2.0
```

- [ ] **Step 2: Align plugin manifest versions**

Set plugin metadata versions to the released plugin version:

- `.claude-plugin/plugin.json`
- `.codex-plugin/plugin.json`
- `plugins/agentic-workflow-kit/.codex-plugin/plugin.json`
- `.claude-plugin/marketplace.json`

- [ ] **Step 3: Run final verification**

Run:

```bash
pnpm check
pnpm build
pnpm pack:dry-run
pnpm smoke:codex-plugin
claude plugin validate .
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add package.json packages/orchestrator/package.json pnpm-lock.yaml CHANGELOG.md .claude-plugin .codex-plugin plugins/agentic-workflow-kit
git commit -m "chore: version bundled mcp runtime release"
```

## Task 11: Future Release

**Files:**
- No source edits expected.

- [ ] **Step 1: Confirm clean tree**

Run:

```bash
git status --short
```

Expected: no output.

- [ ] **Step 2: Publish package after explicit release approval**

Run only after explicit release approval and after the release PR has landed:

```bash
pnpm release
```

Expected: npm publishes the changeset-selected package version.

- [ ] **Step 3: Tag or push according to repo policy**

Follow the repo's release policy for pushing commits and tags. Do not publish or push without explicit approval if the active instruction says local-only.

## Self-Review

- Spec coverage: stale docs, shared handlers, MCP server, Codex plugin, Claude plugin, skill behavior, changeset, docs, versioning, and release are covered.
- Placeholder scan: no task uses placeholder language; deferred Claude child driver is explicitly out of scope.
- Type consistency: tool names are stable across spec and plan.
- Scope check: Claude child-session driver is intentionally split into a later spec so this plan remains bounded.
