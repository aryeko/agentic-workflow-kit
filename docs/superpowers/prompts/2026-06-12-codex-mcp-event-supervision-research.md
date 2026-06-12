# Codex MCP Event Supervision Research And Robust Design Prompt

You are working in `/Users/aryekogan/repos/workflow-kit`.

Your task is to deeply understand Codex MCP behavior, verify it with live tests against the installed local Codex CLI, and design a robust `agentic-workflow-kit` solution for child startup, progress, liveness, timeout, and worktree isolation. Do not jump straight to implementation. First reproduce and explain the real protocol behavior.

## Current Context

The live installed Codex CLI reported during investigation:

```text
codex-cli 0.139.0
```

The Pathway consumer repo is `/Users/aryekogan/repos/pathway`. Its workflow config uses `orchestrator.driver: codex-mcp`, `git.strategy: worktree`, and does not persist `childStartupTimeoutMs`, so the default is 60000 ms unless temporarily overridden.

In a Pathway `run_eligible` retry with temporary `childStartupTimeoutMs: 180000`, the orchestrator selected `DLD03`, launched a Codex MCP child, and then marked the run blocked with `child-startup-timeout`. The parent artifacts were:

```text
/Users/aryekogan/repos/pathway/.codex/agentic-workflow-kit/runs/2026-06-12T18-18-34-526Z/state.json
/Users/aryekogan/repos/pathway/.codex/agentic-workflow-kit/runs/2026-06-12T18-18-34-526Z/children/DLD03.launch.json
/Users/aryekogan/repos/pathway/.codex/agentic-workflow-kit/runs/2026-06-12T18-18-34-526Z/events.ndjson
```

Those artifacts showed:

- `status: blocked`
- `blockedReason: child-startup-timeout`
- `sessionId: null`
- `lastObservedChildProgressAt: null`
- `lastHeartbeatAt: null`
- only launch/request/failure events, no child progress or session link

However, a real Codex MCP child session existed and was working:

```text
/Users/aryekogan/.codex/sessions/2026/06/12/rollout-2026-06-12T21-18-35-019ebd0e-aaa5-7460-b715-4974ea7e0d79.jsonl
```

That session had:

- `source: "mcp"`
- `cwd: "/Users/aryekogan/repos/pathway"`
- `session_meta.payload.id: "019ebd0e-aaa5-7460-b715-4974ea7e0d79"`
- active DLD03 work before the parent abort

It was interrupted by the parent startup timeout. This means the orchestrator failed to link or observe a live child.

## Important Source Findings

The current `workflow-kit` source still assumes MCP progress is the primary startup/liveness signal.

Inspect these files first:

```text
packages/orchestrator/src/drivers/codex-mcp/CodexMcpStoryRunner.ts
packages/orchestrator/src/drivers/codex-mcp/toolInput.ts
packages/orchestrator/src/drivers/StoryRunner.ts
packages/orchestrator/src/runner/WorkflowRunner.ts
packages/orchestrator/src/analysis/runAnalyzer.ts
packages/orchestrator/src/runner/DuplicateLaunchGuard.ts
packages/orchestrator/tests/codex-mcp-runner.test.ts
packages/orchestrator/tests/runner.test.ts
references/config-schema.md
docs/architecture.md
plugins/agentic-workflow-kit/skills/workflow-autopilot/SKILL.md
```

Key current behavior:

- `CodexMcpStoryRunner.runStory()` calls `client.callTool({ name: "codex" }, ..., { onprogress, resetTimeoutOnProgress: true })`.
- `onprogress` is treated as child progress and may extract `threadId` or `sessionId`.
- Final tool output is validated through `structuredContent.threadId`.
- `WorkflowRunner.executeChild()` treats `session-linked` or `progress` as startup acknowledgement.
- If no such acknowledgement arrives before `childStartupTimeoutMs`, it aborts the child and records `startup_failed`.
- Parent supervisor polls update `lastSupervisorPollAt`, but intentionally do not count as child progress.
- `runAnalyzer` and `DuplicateLaunchGuard` already know about external evidence such as expected worktree activity and session/log evidence, but runtime startup handling does not use equivalent evidence.

There is a separate isolation issue:

- `toolInput.ts` passes Codex `cwd` as `config.codex.childSession.cwdAbs`, normally the root checkout.
- The prompt tells the child to create or enter the expected worktree.
- In the real DLD03 child session, `apply_patch` applied changes to the root checkout because `apply_patch` in that child session had no `workdir` parameter. The child noticed and started moving edits to the worktree before being aborted.
- A robust design should strongly consider parent-created worktrees and passing Codex `cwd` as the story worktree path.

## Official And Upstream Findings To Verify

Official Codex docs describe Codex MCP as exposing two tools:

- `codex`
- `codex-reply`

The reliable final identifier is `structuredContent.threadId` from the `tools/call` response. The docs do not present normal MCP `notifications/progress` as the Codex liveness contract.

OpenAI Codex source currently shows a more specific behavior:

- `codex-rs/mcp-server/src/codex_tool_runner.rs` calls `send_event_as_notification()` for session and thread events.
- `codex-rs/mcp-server/src/outgoing_message.rs` hardcodes those notifications as method `"codex/event"`.
- The notification params include `_meta.requestId` and `_meta.threadId`.
- `SessionConfigured` is emitted early and contains the thread id.
- The runner still returns final `CallToolResult` with `structuredContent.threadId`.

Relevant upstream source URLs:

```text
https://github.com/openai/codex/blob/main/codex-rs/mcp-server/src/codex_tool_runner.rs
https://github.com/openai/codex/blob/main/codex-rs/mcp-server/src/outgoing_message.rs
https://github.com/openai/codex/blob/main/codex-rs/mcp-server/src/message_processor.rs
```

The Model Context Protocol TypeScript SDK uses a different progress mechanism:

- `onprogress` maps to standard MCP `notifications/progress`.
- The SDK registers a progress handler only for `notifications/progress`.
- The SDK injects a numeric `_meta.progressToken` into outgoing requests when `onprogress` is set.
- Custom notifications like `"codex/event"` go through normal notification handling or fallback notification handling, not the SDK `onprogress` callback.

Relevant upstream SDK source/doc URLs:

```text
https://github.com/modelcontextprotocol/typescript-sdk/blob/main/packages/core/src/shared/protocol.ts
https://github.com/modelcontextprotocol/typescript-sdk/blob/main/packages/client/src/client/client.ts
https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/client.md
https://modelcontextprotocol.io/specification/2025-03-26/basic/utilities/progress
```

## Live Probe Already Run

A live Node probe was run from a temp directory with `@modelcontextprotocol/sdk`, against local `codex mcp-server`, using `fallbackNotificationHandler` and `onprogress` together.

Successful probe shape:

```js
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "codex-mcp-progress-probe", version: "0.0.0" });
let customEvents = 0;
let progressEvents = 0;
const eventTypes = new Map();

client.fallbackNotificationHandler = async (raw) => {
  if (raw?.method !== "codex/event") return;
  customEvents++;
  const type = raw?.params?.msg?.type ?? "unknown";
  eventTypes.set(type, (eventTypes.get(type) ?? 0) + 1);
  console.log("CUSTOM_EVENT", customEvents, type, JSON.stringify(raw?.params?._meta ?? {}));
};

const transport = new StdioClientTransport({
  command: "codex",
  args: ["mcp-server"],
  cwd: "/Users/aryekogan/repos/workflow-kit",
});

await client.connect(transport);
const tools = await client.listTools();
console.log("TOOLS", tools.tools.map((t) => t.name).join(","));

const result = await client.callTool(
  {
    name: "codex",
    arguments: {
      prompt: "Reply with exactly: MCP_PROGRESS_PROBE_DONE. Do not inspect files or run commands.",
      cwd: "/Users/aryekogan/repos/workflow-kit",
      "approval-policy": "never",
      sandbox: "read-only",
    },
  },
  undefined,
  {
    timeout: 120000,
    maxTotalTimeout: 120000,
    resetTimeoutOnProgress: true,
    onprogress: (p) => {
      progressEvents++;
      console.log("SDK_PROGRESS", progressEvents, JSON.stringify(p));
    },
  },
);

console.log("RESULT_STRUCTURED", JSON.stringify(result.structuredContent ?? null));
console.log("COUNTS", JSON.stringify({ progressEvents, customEvents, eventTypes: Object.fromEntries(eventTypes) }));
await client.close();
```

Observed successful output summary:

```text
TOOLS codex,codex-reply
CUSTOM_EVENT 1 session_configured {"requestId":2,"threadId":"019ebd78-ecbc-7ca3-93e5-a754cc2a8124"}
...
RESULT_STRUCTURED {"threadId":"019ebd78-ecbc-7ca3-93e5-a754cc2a8124","content":"MCP_PROGRESS_PROBE_DONE"}
COUNTS {"progressEvents":0,"customEvents":41,"eventTypes":{"session_configured":1,"mcp_startup_update":16,"task_started":1,"mcp_startup_complete":1,"warning":1,"raw_response_item":5,"item_started":3,"item_completed":3,"user_message":1,"agent_message_content_delta":6,"agent_message":1,"token_count":1,"task_complete":1}}
```

This is the most important finding so far:

```text
Codex MCP emits progress-like liveness as custom codex/event notifications.
The TypeScript SDK onprogress callback sees zero events because Codex does not emit standard notifications/progress.
```

An earlier probe with `config: { model_reasoning_effort: "minimal" }` also emitted many `codex/event` notifications but ended with a model/tool config error. Do not use that config in the final probe.

## Working Hypothesis

The WorkflowKit bug is not that Codex MCP emits no liveness events. It emits the wrong kind of event for the current WorkflowKit code path.

The robust solution is likely:

- Add first-class handling for Codex custom `"codex/event"` notifications in `CodexMcpStoryRunner`.
- On `msg.type === "session_configured"`, extract `_meta.threadId` or `msg.thread_id` and emit `session-linked` immediately.
- Treat selected `codex/event` notifications as observed child progress/liveness, with a useful `progressSource` such as `codex-event`.
- Keep SDK `onprogress` support only for generic MCP compatibility, not as the Codex-specific path.
- Update `ChildProgressSource` and docs to distinguish `mcp-progress` from `codex-event`.
- Add tests proving no `onprogress` is needed when `codex/event` notifications arrive.
- Consider polling or fallback evidence only as secondary recovery, not as the primary protocol path.

Also design the worktree isolation fix:

- Parent should create or ensure the branch/worktree before launching the child.
- Codex `cwd` should be the expected story worktree path for worktree strategy.
- The child prompt should no longer require the child to create the worktree in normal worktree mode.
- Root checkout writes from child tools should become structurally impossible in the common case.

## Required Research And Verification

Perform this in order:

1. Re-read the local source files listed above.
2. Fetch or inspect current official Codex docs for Codex MCP and current upstream OpenAI Codex MCP source.
3. Inspect the currently installed `@modelcontextprotocol/sdk` package version used by this repo or by the plugin build. Do not rely only on current upstream `main`.
4. Re-run the live probe against local `codex mcp-server`. Capture:
   - `tools/list` output
   - whether SDK `onprogress` fires
   - whether `fallbackNotificationHandler` receives `codex/event`
   - first `session_configured` payload shape
   - final `structuredContent.threadId`
5. Write a second probe or test harness that simulates a long-running Codex task enough to confirm `codex/event` events continue before final result. Keep it safe and read-only.
6. Compare local installed Codex behavior with upstream source and docs. Explicitly call out any drift.
7. Design the code changes, test changes, and docs changes.

Do not start implementation until you have a design that addresses both:

- protocol liveness: `codex/event` versus `notifications/progress`
- filesystem isolation: parent-created worktree and Codex `cwd`

## Expected Design Deliverable

Produce a concise but complete design note with:

- Problem statement
- Evidence from Pathway DLD03 failure
- Evidence from live Codex MCP probes
- Exact event contract observed for `codex/event`
- What is documented, what is source-derived, and what is empirically verified
- Runtime state-machine changes in `WorkflowRunner`
- Driver changes in `CodexMcpStoryRunner`
- Worktree/cwd strategy changes in `toolInput.ts` and launch preparation
- Required type/schema changes
- Recovery and analyzer alignment
- Test plan with unit, integration/fake-client, and optional live smoke coverage
- Backward compatibility and migration notes for existing run artifacts
- Updated docs/skills/references surfaces

## Likely Code Targets

Start with:

```text
packages/orchestrator/src/drivers/StoryRunner.ts
packages/orchestrator/src/drivers/codex-mcp/CodexMcpStoryRunner.ts
packages/orchestrator/src/drivers/codex-mcp/toolInput.ts
packages/orchestrator/src/runner/WorkflowRunner.ts
packages/orchestrator/src/types.ts
packages/orchestrator/src/analysis/runAnalyzer.ts
packages/orchestrator/src/runner/DuplicateLaunchGuard.ts
packages/orchestrator/tests/codex-mcp-runner.test.ts
packages/orchestrator/tests/runner.test.ts
packages/orchestrator/tests/tool-input.test.ts
packages/orchestrator/tests/analysis.test.ts
references/config-schema.md
docs/architecture.md
docs/getting-started.md
plugins/agentic-workflow-kit/skills/workflow-autopilot/SKILL.md
plugins/agentic-workflow-kit/references/config-schema.md
```

Expect mirrored plugin files and generated bundle/fixture freshness checks to matter in this repo.

## Non-Goals

- Do not paper over the issue by only increasing `childStartupTimeoutMs`.
- Do not treat parent supervisor polls as child progress.
- Do not rely on `onprogress` as the Codex MCP path unless a live probe proves Codex has changed to emit standard `notifications/progress`.
- Do not leave the child in the root checkout for worktree strategy unless the design explicitly proves root-checkout writes cannot happen.
- Do not make broad unrelated refactors.

## Verification Expectations

Before claiming a fix is ready, expect at minimum:

```text
pnpm check
pnpm build
pnpm pack:dry-run
pnpm smoke:codex-plugin
```

Depending on current branch scripts and changed surfaces, also run any plugin bundle freshness checks and relevant live smoke probes. If any command is unavailable on the current branch, report the exact replacement used.

