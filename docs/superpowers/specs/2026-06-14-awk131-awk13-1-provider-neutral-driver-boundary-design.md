---
title: AWK131 detailed technical story spec
owner: codex-2026-06-14T05-01-48Z
last-reviewed: 2026-06-14
related:
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK131.md
  - ../../prds/agentic-workflow-kit-redesign/README.md
  - ../../prds/agentic-workflow-kit-redesign/release-hardening-design.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution/01-architecture-and-domains.md
---

# AWK131 detailed technical story spec

## Source story brief

`docs/tracks/agentic-workflow-kit-redesign/stories/AWK131.md`.

## Decisions resolved from the story brief

| Question | Decision | Rationale |
| --- | --- | --- |
| What is the minimal driver-contract surface for control/abort/error-classification without over-fitting to Codex? | Extend `StoryRunner` with neutral `controlChild`, `abort`, `classifyError`, `describeCapabilityDowngrades`, and `discoverSessionLogs`. Add a host-neutral prompt renderer consumed by the Codex driver. | These methods cover the current leaks without introducing a second concrete host or changing tracker/runtime concepts. |
| Should neutral control tools fully replace the Codex-named tools or only alias them for V1? | Add neutral aliases and keep existing Codex-named tools indefinitely for V1 compatibility. | Current MCP clients and docs use `codex_reply`, `codex_interrupt`, and `check_codex_mcp`; aliasing avoids a breaking change while proving the neutral boundary. |
| Should the `codex` config namespace be deprecated with a warning or kept indefinitely as an alias? | Introduce `childSession` as the neutral namespace and keep `codex.childSession` as a compatibility alias with no warning in V1. If both are provided, `childSession` wins for shared child-session fields. | The repo is compatibility-first. A warning would create noise for every existing config even though Codex remains the only shipped driver. |

## Exact types/contracts

`packages/orchestrator/src/drivers/StoryRunner.ts`

- Add:

```ts
export type ChildControlKind = 'reply' | 'interrupt';

export interface ChildControlRequest {
  kind: ChildControlKind;
  sessionId?: string;
  runPath?: string;
  storyId?: string;
  message?: string;
  reason?: string;
}

export interface ChildControlResult {
  ok: true;
  tool: string;
  sessionId: string;
  storyId: string | null;
  runPath: string | null;
  rawResult: unknown;
}

export interface DriverErrorClassification {
  supervisionLost: boolean;
  recoverable: boolean;
}
```

- Extend `StoryRunner`:

```ts
controlChild?(request: ChildControlRequest): Promise<ChildControlResult>;
abort?(request: ChildControlRequest): Promise<ChildControlResult>;
classifyError?(error: unknown): DriverErrorClassification;
describeCapabilityDowngrades?(promptMetadata?: StoryPromptMetadata): CapabilityDowngrade[];
discoverSessionLogs?(): Promise<string[]> | string[];
```

`packages/orchestrator/src/config/schema.ts`

- Add neutral optional top-level `childSession` with the same persisted shape as `codex.childSession`.
- Keep `codex.childSession` as optional compatibility input.

`packages/orchestrator/src/types.ts`

- Add `childSession: { childSession: ResolvedChildSessionConfig }` to `ResolvedWorkflowConfig`.
- Keep `codex.childSession` as a resolved alias to the same object so existing tests and callers continue to compile.

MCP/CLI tool names:

- Add `workflow_child_reply` as a neutral alias of `codex_reply`.
- Add `workflow_child_interrupt` as a neutral alias of `codex_interrupt`.
- Add `workflow_driver_check` as a neutral alias of `check_codex_mcp`.
- Existing Codex-named tools remain registered and keep their schemas.

## Exact files/modules

```text
packages/orchestrator/src/drivers/StoryRunner.ts  Add neutral control, abort, error-classification, session-log discovery, and capability-downgrade contracts.
packages/orchestrator/src/drivers/promptRenderer.ts  New host-neutral implementation prompt renderer.
packages/orchestrator/src/drivers/codex-mcp/toolInput.ts  Use the neutral prompt renderer as the default prompt source; keep Codex-specific launch input and tool naming here.
packages/orchestrator/src/drivers/codex-mcp/CodexMcpStoryRunner.ts  Implement driver methods for error classification, control/abort, session-log discovery, and capability downgrades.
packages/orchestrator/src/mcp/codexControl.ts  Rename internal exported helpers to neutral `sendChildReply`/`sendChildInterrupt`; keep Codex exports as aliases.
packages/orchestrator/src/mcp/tools.ts  Register neutral aliases beside existing Codex-named tools.
packages/orchestrator/src/commands/handlers.ts  Use the runner driver control/abort method where available; avoid direct `sendCodexInterrupt` calls.
packages/orchestrator/src/runner/WorkflowRunner.ts  Consume `storyRunner.classifyError` and `storyRunner.describeCapabilityDowngrades` instead of matching Codex strings or locally re-authoring downgrade text.
packages/orchestrator/src/config/schema.ts  Add neutral `childSession` input shape.
packages/orchestrator/src/config/configLoader.ts  Resolve `childSession` and map `codex.childSession` as a compatibility alias.
packages/orchestrator/src/types.ts  Add neutral resolved config field while retaining the Codex alias.
packages/orchestrator/src/analysis/runAnalyzer.ts  Accept session roots from a driver-aware provider, defaulting through the Codex driver implementation instead of hardcoded analyzer-local Codex paths.
packages/orchestrator/src/mcp/server.ts  Mention neutral child-control tools first, with Codex names as compatibility aliases.
references/config-schema.md  Document `childSession` and `codex.childSession` compatibility aliasing.
references/config.schema.json  Regenerate from the Zod schema.
```

## Query/schema/prompt/event/component design

- Prompt rendering:
  - `renderStoryImplementerPrompt(story, policy)` lives in `drivers/promptRenderer.ts`.
  - It emits the current generic implementation instructions without Codex-only phrasing.
  - `buildCodexToolInput` defaults to `renderStoryImplementerPrompt(story, config)` and applies Codex launch-specific fields only in `drivers/codex-mcp/toolInput.ts`.
- Error classification:
  - `CodexMcpStoryRunner.classifyError(error)` returns `{ supervisionLost: true, recoverable: true }` for child timeout and Codex MCP request timeout messages.
  - `WorkflowRunner` falls back to existing neutral timeout tokens only if the driver lacks `classifyError`.
- Capability downgrades:
  - `WorkflowRunner` calls `storyRunner.describeCapabilityDowngrades?.(promptMetadata)` before falling back to an empty list.
  - The Codex implementation returns the current structured-output enforcement warning.
- Control aliases:
  - Neutral and Codex-named MCP tools call the same control functions and journal using neutral event types for the aliases while accepting legacy event types for old calls.
  - `abortActiveChildren` uses an injected `StoryRunner` when the handler has one; otherwise it uses neutral control helper functions.
- Config aliasing:
  - `childSession` is neutral persisted config.
  - `codex.childSession` stays accepted.
  - If both exist, `childSession` wins for model, approval policy, sandbox, and config object.
  - Resolved config exposes the same object at both `resolved.childSession.childSession` and `resolved.codex.childSession`.
- Analyzer session discovery:
  - `defaultSessionRoots()` moves behind an exported driver helper or Codex driver method. The analyzer no longer constructs `.codex/sessions` inline.
  - Explicit CLI/MCP `sessionRoot` options still override defaults.

## Tests

Focused tests first:

```text
packages/orchestrator/tests/tool-input.test.ts
  - prompt rendering is imported from the neutral renderer and contains no Codex tool names or @codex phrasing.
  - Codex tool input still passes model/sandbox/reasoning config unchanged.

packages/orchestrator/tests/codex-mcp-runner.test.ts
  - Codex runner classifies request timeout as supervision lost/recoverable.
  - Codex runner supplies structured-output downgrade evidence through the driver method.

packages/orchestrator/tests/runner.test.ts
  - WorkflowRunner uses driver error classification for supervision-lost handling instead of Codex string matching.

test/mcp-codex-control.test.ts or new test/mcp-child-control.test.ts
  - neutral control helpers journal a neutral event and retain redacted reply hashing.

test/plugin-tool-surface.ts
  - neutral aliases are part of the plugin tool surface and Codex-named tools remain present.

packages/orchestrator/tests/config-loader.test.ts or new config test
  - `childSession` resolves to both neutral and Codex alias fields.
  - `codex.childSession` remains accepted.
  - `childSession` wins when both namespaces are present.

packages/orchestrator/tests/run-analyzer.test.ts
  - session-log discovery default comes from the driver helper and explicit `sessionRoots` still override.
```

Full gate:

```bash
pnpm check
```

## Migration/deploy concerns

- No runtime data migration.
- No on-disk artifact root rename; `.codex/agentic-workflow-kit` remains the stable WorkflowKit runtime directory.
- Existing `.workflow/config.yaml` files with `codex.childSession` continue working.
- Existing MCP clients using `codex_reply`, `codex_interrupt`, and `check_codex_mcp` continue working.
- Public behavior change requires updating generated `references/config.schema.json`, human config docs, MCP surface tests, and any mirrored plugin fixture if the tested fixture expects those surfaces.

## Blocking technical questions

None
