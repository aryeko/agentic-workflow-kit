---
title: AWK138 detailed technical story spec
owner: codex-2026-06-15T19-10-41Z
last-reviewed: 2026-06-15
related:
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK138.md
  - ../../prds/agentic-workflow-kit-redesign/release-hardening-design-2.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution/01-architecture-and-domains.md
---

# AWK138 detailed technical story spec

## Source story brief

`docs/tracks/agentic-workflow-kit-redesign/stories/AWK138.md`

## Decisions resolved from the story brief

| Question | Decision | Rationale |
| --- | --- | --- |
| Registry keyed by `OrchestratorDriver` enum vs factory map — where does it live? | Add `packages/orchestrator/src/drivers/registry.ts` as a driver-owned factory/registry keyed by `OrchestratorDriver`. Command/MCP/config call sites import registry helpers instead of importing `CodexMcpStoryRunner` directly. | Keeps host-specific instantiation under `drivers/`, gives CLI and MCP one registration point, and lets a future driver add one registry entry plus driver code without touching neutral command handlers. |
| Neutral alias name for the `codex` config namespace? | Preserve `ResolvedWorkflowConfig.childSession` as the neutral alias and keep `ResolvedWorkflowConfig.codex.childSession` as a compatibility alias to the same resolved child-session object. | The neutral alias already exists in current config loading. The story should make the alias explicit and test/keep it stable rather than rename public config keys. |
| Artifact root derivation | Export a single neutral default artifact root constant, `.codex/agentic-workflow-kit`, from the driver registry or adjacent driver-owned module, and have config resolution derive `rootDir`, `rootDirAbs`, and `runsDirAbs` from it. | Preserves the on-disk contract while removing repeated hardcoded `.codex/...` construction from neutral config code. A future driver can override through the same registry surface if needed. |

## Exact types/contracts

- `packages/orchestrator/src/drivers/registry.ts`
  - `DEFAULT_ARTIFACT_ROOT_DIR = '.codex/agentic-workflow-kit'`.
  - `SUPPORTED_DRIVERS: ReadonlySet<OrchestratorDriver>` derived from the factory map.
  - `createStoryRunner(config: ResolvedWorkflowConfig, options?: StoryRunnerFactoryOptions): StoryRunner`.
  - `artifactRootDirForDriver(driver: OrchestratorDriver): string`.
  - `discoverSessionLogsForDriver(config: ResolvedWorkflowConfig, options?: StoryRunnerFactoryOptions): string[] | Promise<string[]> | undefined`.
  - `StoryRunnerFactoryOptions` may carry the current Codex test hook `createCodexMcpClient`, but that Codex-specific option remains contained in the driver registry boundary.
- `packages/orchestrator/src/drivers/codex-mcp/control.ts`
  - Owns direct Codex MCP child-control transport, tool-name candidate selection, launch-artifact target resolution, and child-control journaling.
  - Exports `controlChild(request: ChildControlRequest): Promise<ChildControlResult>`, plus compatibility helper exports needed by existing tests.
- `packages/orchestrator/src/mcp/codexControl.ts`
  - No longer owns direct Codex transport logic. It becomes a compatibility export surface for existing import paths, delegating driver-specific helpers from `drivers/codex-mcp/control.ts`.
- `StoryRunner`
  - Existing `controlChild?(request)` and `abort?(request)` remain the contract for child reply/interrupt.
  - `CodexMcpStoryRunner.controlChild()` routes through the driver-local Codex control implementation.
- `ResolvedWorkflowConfig`
  - `childSession` remains the neutral child-session field.
  - `codex.childSession` remains readable for backward compatibility and resolves to the same values.
  - `artifacts.rootDir` remains `.codex/agentic-workflow-kit`.

## Exact files/modules

```text
packages/orchestrator/src/drivers/registry.ts                  Add the driver factory/registry and artifact-root helper.
packages/orchestrator/src/drivers/codex-mcp/control.ts         Move direct Codex child-control transport and journaling behind the Codex driver.
packages/orchestrator/src/drivers/codex-mcp/CodexMcpStoryRunner.ts Use driver-local child-control implementation; no import from mcp/codexControl.
packages/orchestrator/src/mcp/codexControl.ts                  Keep compatibility exports without owning standalone control transport.
packages/orchestrator/src/mcp/tools.ts                         Route `codex_reply`/`codex_interrupt` aliases through `controlConfiguredChild`.
packages/orchestrator/src/mcp/toolHelpers.ts                   Instantiate the configured runner through `createStoryRunner`.
packages/orchestrator/src/commands/handlers.ts                 Instantiate/check the configured runner through the registry.
packages/orchestrator/src/commands/handlerRuntimeUtils.ts      Resolve session roots/control runner through the registry.
packages/orchestrator/src/config/configLoader.ts               Resolve supported drivers/artifact root through the registry; keep childSession/codex alias.
packages/orchestrator/src/types.ts                             Add/adjust comments only if needed to document `codex` as compatibility alias.
test/mcp-codex-control.test.ts                                 Add coverage that Codex alias tools route through the supplied/configured StoryRunner contract.
packages/orchestrator/tests/codex-mcp-runner.test.ts           Cover `CodexMcpStoryRunner.controlChild` using driver-local injected transport or helper seams if practical.
packages/orchestrator/tests/config-loader.test.ts              Cover artifact-root default and `childSession`/`codex.childSession` compatibility alias if no existing test does.
```

## Query/schema/prompt/event/component design

- No database query, schema migration, prompt, route, or UI component changes.
- MCP tools:
  - `workflow_child_reply` and `workflow_child_interrupt` remain the neutral tool names.
  - `workflow_driver_check` remains the neutral driver readiness check.
  - Backward-compatible aliases `codex_reply` and `codex_interrupt` remain registered with the same input/output schemas, but their handlers call `controlConfiguredChild()` so they route through the configured `StoryRunner.controlChild`/`abort` contract.
- Driver registry:
  - `loadResolvedConfig()` validates `orchestrator.driver` using `SUPPORTED_DRIVERS` from the registry.
  - `runWorkflowHandler()`, `mcpCheckHandler()`, `controlConfiguredChild()`, `controlRunnerForRunPath()`, and session-root discovery use `createStoryRunner()` or registry helpers.
- Events:
  - Child reply journaling still records `child-reply-sent` with `messageSha256` only.
  - Child interrupt journaling still records `child-interrupt-sent` with reason and tool.
  - No existing event names or artifact paths change.

## Tests

- Focused package tests:
  - `pnpm --dir packages/orchestrator test -- --runInBand codex-mcp-runner`
  - `pnpm test -- --runInBand test/mcp-codex-control.test.ts`
  - `pnpm --dir packages/orchestrator test -- --runInBand config-loader`
- Required gate:
  - `pnpm check`
- Test assertions:
  - `codex_reply` and `codex_interrupt` alias handlers use the configured runner path rather than directly importing/sending standalone Codex control.
  - `CodexMcpStoryRunner.controlChild()`/`abort()` still send the expected Codex control payloads and journal run-targeted controls without leaking reply message text.
  - All non-test production imports of `CodexMcpStoryRunner` outside `drivers/registry.ts` are removed, except type-only CLI test hook imports when unavoidable.
  - `ResolvedWorkflowConfig.childSession` and `ResolvedWorkflowConfig.codex.childSession` remain compatible and artifact paths remain `.codex/agentic-workflow-kit/runs`.

## Migration/deploy concerns

- No user-facing config keys, MCP tool names, CLI commands, run artifact paths, or result envelopes are renamed.
- Existing `.codex/agentic-workflow-kit/runs/<runId>` artifacts remain readable because the default artifact root string is unchanged.
- Existing Codex configs keep working because `codex.childSession` remains accepted and resolved into the neutral `childSession` alias.
- Rollback is a code-only revert; no persisted data migrations are introduced.

## Blocking technical questions

None
