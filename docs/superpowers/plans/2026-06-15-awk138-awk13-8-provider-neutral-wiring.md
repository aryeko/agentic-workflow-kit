# AWK138 implementation plan

## Scope

Implement the provider-neutral wiring completion described by
`docs/superpowers/specs/2026-06-15-awk138-awk13-8-provider-neutral-wiring-design.md`.

## Steps

1. Add focused failing tests for the new contract shape:
   - alias MCP tools `codex_reply` and `codex_interrupt` route through the same configured child-control helper as the neutral `workflow_child_*` tools;
   - driver registry exposes supported drivers, creates the configured story runner, and preserves the `.codex/agentic-workflow-kit` artifact root;
   - config resolution keeps `childSession` and `codex.childSession` compatible.
2. Add `packages/orchestrator/src/drivers/registry.ts`:
   - keep the Codex runner instantiation in one driver-owned factory map;
   - export `SUPPORTED_DRIVERS`, `createStoryRunner`, `artifactRootDirForDriver`, and session-log discovery helpers;
   - keep any Codex-specific test hook in the registry boundary rather than in command handlers.
3. Move direct Codex control transport into `packages/orchestrator/src/drivers/codex-mcp/control.ts`:
   - retain target resolution, tool candidate selection, and control journaling;
   - make `mcp/codexControl.ts` a compatibility export surface;
   - update `CodexMcpStoryRunner.controlChild()` and `abort()` to call the driver-local implementation.
4. Update neutral call sites:
   - `commands/handlers.ts`: use the registry in `mcpCheckHandler()` and `runWorkflowHandler()`;
   - `commands/handlerRuntimeUtils.ts`: use registry helpers for session-root discovery and run-control runner creation;
   - `mcp/toolHelpers.ts`: use registry-created runner in `controlConfiguredChild()`;
   - `mcp/tools.ts`: route `codex_reply` and `codex_interrupt` through `controlConfiguredChild()`.
5. Update `config/configLoader.ts`:
   - import supported driver validation and artifact-root derivation from the registry;
   - derive `artifacts.rootDir`, `rootDirAbs`, and `runsDirAbs` from one root constant;
   - preserve `childSession` and `codex.childSession`.
6. Run focused verification:
   - `pnpm --dir packages/orchestrator test -- --runInBand codex-mcp-runner`
   - `pnpm test -- --runInBand test/mcp-codex-control.test.ts`
   - `pnpm --dir packages/orchestrator test -- --runInBand config-loader`
7. Run `pnpm check`.
8. Run the configured pre-PR review with a read-only review subagent. Fix any blocking findings, rerun verification, and re-review within the configured loop limit.
9. Re-read the AWK138 tracker row, mark it `done`, commit, push, open the PR, update the PR column, wait for configured CI and Codex review, then squash-merge if all gates pass.

## Risk controls

- Do not rename public MCP tools, CLI commands, config keys, or artifact directories.
- Do not add a second driver in this story.
- Do not remove `ResolvedWorkflowConfig.codex`; only preserve it as a compatibility alias.
- Keep direct `CodexMcpStoryRunner` imports outside tests and `drivers/registry.ts` out of production command/MCP surfaces.
