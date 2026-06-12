---
title: Codex MCP event supervision and worktree isolation design
status: proposed
owner: arye
last-reviewed: 2026-06-12
related:
  - ../../architecture.md
  - ../../../references/config-schema.md
  - ../../../packages/orchestrator/src/drivers/codex-mcp/CodexMcpStoryRunner.ts
  - ../../../packages/orchestrator/src/drivers/codex-mcp/toolInput.ts
  - ../../../packages/orchestrator/src/drivers/StoryRunner.ts
  - ../../../packages/orchestrator/src/runner/WorkflowRunner.ts
  - ../../../packages/orchestrator/src/runner/DuplicateLaunchGuard.ts
  - ../../../packages/orchestrator/src/analysis/runAnalyzer.ts
---

# Codex MCP Event Supervision And Worktree Isolation Design

## Purpose

Design a robust fix for the `agentic-workflow-kit` Codex MCP child runner so
workflow-autopilot can reliably:

- detect child startup as soon as Codex creates a session;
- keep liveness current while a child is actively working;
- avoid false startup and no-progress timeouts;
- preserve tracker-authoritative completion semantics;
- prevent child edits from landing in the root checkout when the configured git strategy is
  `worktree`;
- leave clear artifacts that operators and `analyze-run` can trust during recovery.

This is a transient implementation design. Its durable content should be folded into canonical docs
when the implementation is complete.

## Executive Summary

The current `codex-mcp` driver treats TypeScript SDK `onprogress` callbacks as the primary startup
and liveness signal. Live Codex CLI `0.139.0` does not emit standard MCP `notifications/progress`
for normal Codex session activity. Instead it emits custom JSON-RPC notifications with method
`codex/event`. Those notifications carry the thread id, rollout path, cwd, command events, token
events, and task completion.

The correct runtime design is to make `codex/event` a first-class Codex-specific supervision source,
while retaining SDK `onprogress` only as generic MCP compatibility. The first `session_configured`
event should link the child session and acknowledge startup immediately. Later correlated
`codex/event` notifications should refresh child liveness and update launch metadata with
`progressSource: "codex-event"`.

The separate isolation bug comes from launching Codex in the root checkout and asking the child to
create or enter its worktree. Codex tools such as `apply_patch` operate relative to the session cwd.
When the session cwd is the root checkout, accidental root writes remain possible even if the prompt
asks the child to use a worktree. The parent should create or verify the expected worktree before
launch, then pass that worktree path as Codex `cwd`.

## Current Context

The consumer failure was observed in Pathway:

- repo: `/Users/aryekogan/repos/pathway`
- workflow config: `orchestrator.driver: codex-mcp`
- git strategy: `worktree`
- default `childStartupTimeoutMs`: `60000`, temporarily overridden to `180000`
- selected story: `DLD03`
- installed Codex CLI: `codex-cli 0.139.0`

The relevant workflow-kit source still has these assumptions:

- `packages/orchestrator/src/drivers/codex-mcp/CodexMcpStoryRunner.ts`
  - builds the tool input with `buildCodexToolInput(...)`;
  - calls `client.callTool({ name: "codex" }, ..., { onprogress, resetTimeoutOnProgress: true })`;
  - treats `onprogress` as a child progress signal and tries to extract a session id from it;
  - learns the final thread id from `structuredContent.threadId`.
- `packages/orchestrator/src/runner/WorkflowRunner.ts`
  - marks startup acknowledged only when the child reports `session-linked` or `progress`;
  - aborts the child with `child-startup-timeout` if no acknowledgement arrives;
  - intentionally keeps parent `child-supervisor-poll` separate from child progress;
  - records `lastObservedChildProgressAt`, `lastHeartbeatAt`, and `progressSource` only for
    acknowledged child activity.
- `packages/orchestrator/src/drivers/codex-mcp/toolInput.ts`
  - passes `cwd: config.codex.childSession.cwdAbs`, normally the root checkout;
  - tells the child in the prompt to create or enter the expected worktree.

## Failure Evidence From Pathway DLD03

Parent artifacts:

```text
/Users/aryekogan/repos/pathway/.codex/agentic-workflow-kit/runs/2026-06-12T18-18-34-526Z/state.json
/Users/aryekogan/repos/pathway/.codex/agentic-workflow-kit/runs/2026-06-12T18-18-34-526Z/children/DLD03.launch.json
/Users/aryekogan/repos/pathway/.codex/agentic-workflow-kit/runs/2026-06-12T18-18-34-526Z/events.ndjson
```

Observed parent state:

- run status: `blocked`
- blocked reason: `child-startup-timeout`
- completed child entry: `DLD03`, `ok: false`, `sessionId: null`
- launch record status: `startup_failed`
- launch record `childCwd`: `/Users/aryekogan/repos/pathway`
- launch record `sessionId`: `null`
- launch record `sessionLogPath`: `null`
- launch record `lastObservedChildProgressAt`: `null`
- launch record `lastHeartbeatAt`: `null`
- event journal contained only:
  - `run-started`
  - `tracker-claimed`
  - `child-launch-requested`
  - `tracker-claim-released`
  - `child-startup-failed`
  - `child-error`
  - `run-blocked`

Actual child session:

```text
/Users/aryekogan/.codex/sessions/2026/06/12/rollout-2026-06-12T21-18-35-019ebd0e-aaa5-7460-b715-4974ea7e0d79.jsonl
```

That session had:

- `source: "mcp"`
- `cwd: "/Users/aryekogan/repos/pathway"`
- `cli_version: "0.139.0"`
- `session_meta.payload.id: "019ebd0e-aaa5-7460-b715-4974ea7e0d79"`
- active DLD03 work before the parent aborted the MCP request

The same child log proves the cwd isolation issue. The child created the expected worktree, then
used `apply_patch`; because the Codex session itself was rooted at `/Users/aryekogan/repos/pathway`,
`apply_patch` wrote to the root checkout. The child noticed and began moving intended edits into
the worktree before the parent timeout interrupted it.

Root cause:

- The child existed and was working.
- The parent did not observe Codex custom notifications.
- The parent treated absence of SDK `onprogress` as absence of child startup.
- The child session cwd made root-checkout writes structurally possible.

## Source And Protocol Evidence

### Official Codex Documentation

The current Codex manual documents that `codex mcp-server` exposes two tools:

- `codex`
- `codex-reply`

It also documents that callers should use the `threadId` from
`structuredContent.threadId` in the `tools/call` response. The docs describe `cwd` as a Codex tool
property and say a relative cwd is resolved against the server process cwd.

The public docs do not document `codex/event` as a stable liveness contract.

Source:

- <https://developers.openai.com/codex/guides/agents-sdk>
- <https://developers.openai.com/codex/mcp>

### OpenAI Codex Source

Current upstream Codex source shows the custom event behavior:

- `codex-rs/mcp-server/src/codex_tool_runner.rs`
  - starts a Codex thread;
  - emits `SessionConfigured` immediately through `send_event_as_notification(...)`;
  - streams subsequent Codex events through the same notification path;
  - returns final `CallToolResult` with `structuredContent.threadId`.
- `codex-rs/mcp-server/src/outgoing_message.rs`
  - serializes those notifications with method `codex/event`;
  - includes `params._meta.requestId`;
  - includes `params._meta.threadId` because multiple threads can share one MCP connection.
- `codex-rs/mcp-server/src/message_processor.rs`
  - exposes `codex` and `codex-reply`;
  - spawns long-running Codex tool calls asynchronously.

Sources:

- <https://github.com/openai/codex/blob/main/codex-rs/mcp-server/src/codex_tool_runner.rs>
- <https://github.com/openai/codex/blob/main/codex-rs/mcp-server/src/outgoing_message.rs>
- <https://github.com/openai/codex/blob/main/codex-rs/mcp-server/src/message_processor.rs>

### MCP TypeScript SDK And MCP Progress

The repo uses `@modelcontextprotocol/sdk` with `^1.29.0`, locked to `1.29.0`.
The installed SDK and current upstream SDK both implement standard progress like this:

- setting request option `onprogress` injects `params._meta.progressToken`;
- only `notifications/progress` invokes the SDK progress handler;
- custom notification methods are routed to the matching notification handler or
  `fallbackNotificationHandler`.

The MCP progress schema also defines standard progress as `notifications/progress` with a
`progressToken`, a numeric `progress` value, optional `total`, and optional `message`.

Sources:

- <https://github.com/modelcontextprotocol/typescript-sdk/blob/main/packages/core/src/shared/protocol.ts>
- <https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/client.md>
- <https://modelcontextprotocol.io/specification/2025-03-26/basic/utilities/progress>

Conclusion:

- `codex/event` is not SDK `onprogress`.
- `resetTimeoutOnProgress: true` only applies to standard progress notifications.
- A Codex-specific driver must handle `codex/event` explicitly.

## Live Validation Before Writing This Design

Two earlier probes established the broad behavior:

- Quick no-tool probe:
  - `tools/list`: `codex,codex-reply`
  - SDK `onprogress`: `0`
  - `codex/event`: `41`
  - first event: `session_configured`
  - final `structuredContent.threadId` matched the event thread id
- Read-only timer probe:
  - SDK `onprogress`: `0`
  - `codex/event`: `53` over about 30 seconds
  - saw `exec_command_begin`, `exec_command_output_delta`, `exec_command_end`, and `task_complete`

Before writing this file, a focused validation probe tested the intended implementation approach:

- no SDK `onprogress` handler was supplied;
- `fallbackNotificationHandler` listened for `codex/event`;
- `session_configured` was treated as the session-link event;
- later `codex/event` messages were treated as liveness;
- the requested Codex `cwd` was set to
  `/Users/aryekogan/repos/workflow-kit/packages/orchestrator`;
- final `structuredContent.threadId` was compared against `_meta.threadId`, `msg.thread_id`, and
  `msg.session_id`.

Validation result:

```json
{
  "ok": true,
  "codexVersion": "codex-cli 0.139.0",
  "sdkVersion": "1.29.0",
  "toolNames": ["codex", "codex-reply"],
  "requestedCwd": "/Users/aryekogan/repos/workflow-kit/packages/orchestrator",
  "sessionCwd": "/Users/aryekogan/repos/workflow-kit/packages/orchestrator",
  "structuredThreadId": "019ebd97-0c8a-7242-a505-adb2c1cf6280",
  "metaThreadId": "019ebd97-0c8a-7242-a505-adb2c1cf6280",
  "msgThreadId": "019ebd97-0c8a-7242-a505-adb2c1cf6280",
  "msgSessionId": "019ebd97-0c8a-7242-a505-adb2c1cf6280",
  "customEvents": 51,
  "eventSpreadMs": 16397,
  "sawExecBegin": true,
  "sawExecEnd": true,
  "sawTaskComplete": true,
  "finalContent": "WK_EVENT_SUPERVISION_VALIDATION_DONE"
}
```

The focused probe also observed:

- `session_configured` at about `1963ms`;
- `mcp_startup_complete` at about `3877ms`;
- `exec_command_begin` at about `12401ms`;
- three `exec_command_output_delta` events for `WK_TICK_1`, `WK_TICK_2`, and `WK_TICK_3`;
- `exec_command_end` at about `16922ms`;
- `task_complete` at about `18360ms`.

This proves the proposed driver can link startup and refresh liveness through `codex/event`
without SDK `onprogress`, and it proves Codex MCP honors the `cwd` argument.

## Requirements

### Functional Requirements

1. The Codex MCP child runner must acknowledge startup when it receives a correlated
   `codex/event` `session_configured` notification.
2. The child runner must extract the child session/thread id from, in order:
   - `params._meta.threadId`;
   - `params.msg.thread_id`;
   - `params.msg.session_id`.
3. The child runner must extract the child session log path from `params.msg.rollout_path` when
   present.
4. The child runner must continue to validate final output through
   `structuredContent.threadId`.
5. The child runner must preserve SDK `onprogress` support for generic MCP compatibility, but it
   must not rely on it for Codex liveness.
6. Workflow runtime must distinguish these progress sources:
   - `codex-event`
   - `mcp-progress`
   - `session-linked`
   - `structured`
7. Workflow runtime must reset startup and no-progress timers only on real child signals:
   - `codex/event` session linkage or liveness;
   - standard MCP progress;
   - final structured output.
8. Parent supervisor polls must remain parent liveness only. They must not reset child startup or
   no-progress timers.
9. Under `git.strategy: worktree`, the parent must create or verify the expected story worktree
   before launching Codex.
10. Under `git.strategy: worktree`, the Codex tool `cwd` must be the prepared story worktree path.
11. The child prompt must assume the worktree is already prepared and require the child to verify
   cwd, git top-level, branch, and base branch before editing.
12. Runtime artifacts must make recovery clear:
   - `children/<story-id>.launch.json` must record `childCwd`, session id, session log path,
     progress source, and observed progress timestamps;
   - `events.ndjson` must include session linkage and bounded progress events;
   - `analyze-run` must report `codex-event` progress accurately.

### Safety Requirements

1. A child startup timeout must not release a tracker claim if any real child acknowledgement
   evidence exists.
2. A duplicate launch must remain blocked while a prior launch has session linkage, heartbeat,
   recent child progress, or recent worktree activity.
3. The parent must not delete or reset an existing expected worktree automatically when there is
   ambiguous evidence.
4. The worktree path must remain repo-local, non-escaping, and derived from configured
   `git.worktreeDir`.
5. Child writable roots under Codex `workspace-write` must allow git operations without broadening
   access beyond the root `.git` and configured worktree directory.
6. Event journaling must not explode artifact size by recording every token delta as a full journal
   event.

### Compatibility Requirements

1. Existing non-Codex MCP drivers or future generic MCP drivers must still be able to use standard
   MCP `notifications/progress`.
2. Existing final-output validation using `structuredContent.threadId` must remain required.
3. Existing config keys and defaults must remain compatible.
4. Existing `childTimeoutMs` compatibility behavior must not regress.
5. Existing analyzer recovery behavior based on worktree activity and session log evidence must
   keep working.

## Proposed Runtime Design

### Event Model

Extend `ChildLifecycleEvent` in `packages/orchestrator/src/drivers/StoryRunner.ts`:

```ts
export type ChildProgressSource = 'codex-event' | 'mcp-progress' | 'session-linked' | 'structured';

export type ChildLifecycleEvent =
  | {
      type: 'session-linked';
      sessionId: string;
      sessionLogPath?: string | null;
      progressSource: ChildProgressSource;
    }
  | {
      type: 'progress';
      message: string;
      progressSource: ChildProgressSource;
      progressToken?: string | number | null;
      eventType?: string | null;
    };
```

Rationale:

- The parent should not infer source from event shape.
- Runtime artifacts should show whether liveness came from `codex-event` or MCP progress.
- Existing `session-linked` remains the strongest startup signal.

### Codex Event Parsing

Add a small parser in the `codex-mcp` driver boundary, not in `WorkflowRunner`.

Responsible file options:

- preferred: `packages/orchestrator/src/drivers/codex-mcp/codexEvents.ts`
- tests: `packages/orchestrator/tests/codex-mcp-events.test.ts`

Parser responsibilities:

- accept unknown notification values;
- return `null` for non-`codex/event` notifications;
- read `params._meta.requestId`;
- read `params._meta.threadId`;
- read `params.msg.type`;
- read `params.msg.thread_id`;
- read `params.msg.session_id`;
- read `params.msg.rollout_path`;
- read `params.msg.cwd`;
- create a human-readable progress message from the event type and selected payload fields;
- avoid throwing on schema drift.

Suggested parsed shape:

```ts
interface CodexEventNotification {
  method: 'codex/event';
  requestId: string | number | null;
  threadId: string | null;
  eventType: string;
  sessionId: string | null;
  sessionLogPath: string | null;
  cwd: string | null;
  raw: Record<string, unknown>;
}
```

Thread id extraction should use:

```ts
threadId = meta.threadId ?? msg.thread_id ?? msg.session_id ?? null
```

### Driver Behavior

Modify `packages/orchestrator/src/drivers/codex-mcp/CodexMcpStoryRunner.ts`.

Current issue:

- `runStory()` passes `onprogress`;
- SDK progress never fires for Codex normal events;
- custom notifications are ignored unless `fallbackNotificationHandler` is installed.

New behavior:

1. Create the client.
2. Chain or install `client.fallbackNotificationHandler`.
3. On `codex/event`:
   - ignore notifications not correlated to the current request when correlation is available;
   - on `session_configured`, report `session-linked` with:
     - `sessionId`: extracted thread/session id;
     - `sessionLogPath`: `rollout_path` if present;
     - `progressSource: "codex-event"`;
   - on selected event types, report `progress` with:
     - `progressSource: "codex-event"`;
     - `eventType`;
     - short message.
4. Continue passing `onprogress`, but report it as `progressSource: "mcp-progress"`.
5. Continue validating final result with `validateCodexToolOutput()`.
6. After final output, call `reportSessionLinked(output.threadId)` only if not already linked.

Event types that should refresh liveness:

- `session_configured`
- `mcp_startup_update`
- `mcp_startup_complete`
- `task_started`
- `item_started`
- `item_completed`
- `exec_command_begin`
- `exec_command_output_delta`
- `exec_command_end`
- `agent_message_content_delta`
- `agent_message`
- `token_count`
- `task_complete`
- `warning`
- unknown `codex/event` types with a valid thread id

Event types that should be journaled individually:

- `session_configured` as `child-session-linked`;
- `mcp_startup_complete` as bounded progress;
- `exec_command_begin`;
- `exec_command_end`;
- `task_complete`;
- warnings, with rate limiting if needed.

High-volume event types should refresh liveness but be sampled or coalesced in the journal:

- `agent_message_content_delta`
- `raw_response_item`
- `exec_command_output_delta`
- `token_count`

Timeout implication:

- The SDK request timeout must not be the active no-progress timeout for Codex events, because
  custom `codex/event` notifications do not reset SDK `resetTimeoutOnProgress`.
- Use `WorkflowRunner` for child no-progress supervision.
- Set SDK `timeout` for the Codex tool call to a value that will not fire before
  `childMaxRuntimeMs`, or set it equal to the wall-clock cap.
- Keep the outer `pTimeout` wall-clock cap.

### WorkflowRunner State Machine

Modify `packages/orchestrator/src/runner/WorkflowRunner.ts`.

Current startup states:

```text
requested -> launched -> settled
requested -> startup_failed
launched -> supervision_lost
```

New event handling:

```text
requested
  on codex-event session_configured:
    status = launched
    sessionId = event.threadId
    sessionLogPath = event.rollout_path
    lastObservedChildProgressAt = now
    lastHeartbeatAt = now
    progressSource = codex-event
    clear startup timeout
    start no-progress timeout
    start supervisor polling

  on mcp-progress:
    status = launched
    lastObservedChildProgressAt = now
    lastHeartbeatAt = now
    progressSource = mcp-progress
    clear startup timeout
    start no-progress timeout
    start supervisor polling

launched
  on codex-event progress:
    lastObservedChildProgressAt = now
    lastHeartbeatAt = now
    progressSource = codex-event
    reset no-progress timeout

  on mcp-progress:
    lastObservedChildProgressAt = now
    lastHeartbeatAt = now
    progressSource = mcp-progress
    reset no-progress timeout

  on child result:
    status = settled
    completion gate evaluates tracker/git authority

requested
  on startup timeout with no child evidence:
    status = startup_failed
    release startup claim

launched
  on no-progress timeout:
    status = supervision_lost
    do not release tracker claim automatically
    write recovery guard evidence
```

Artifact changes:

- `children/<story-id>.launch.json`
  - `progressSource: "codex-event"` when Codex custom events are observed;
  - `sessionId` from `session_configured`;
  - `sessionLogPath` from `rollout_path`;
  - `childCwd` from prepared worktree when worktree strategy is active.
- `events.ndjson`
  - `child-session-linked` records `progressSource`;
  - `child-progress` records `progressSource` and `eventType`;
  - high-volume progress can be rate limited.

### Analyzer And Duplicate Launch Behavior

Modify `packages/orchestrator/src/analysis/runAnalyzer.ts` only as needed to display the new source.

Expected analyzer behavior:

- show `progress.progressSource: "codex-event"`;
- report linked status when `sessionId` or `sessionLogPath` is present;
- treat `codex-event` liveness the same as existing real child progress;
- continue using diagnostic session candidates and worktree activity for legacy or broken runs.

Modify `packages/orchestrator/src/runner/DuplicateLaunchGuard.ts` only if new launch fields require
additional stale checks.

Expected duplicate behavior:

- a launch with `sessionId`, `lastHeartbeatAt`, or `lastObservedChildProgressAt` remains active
  until stale by the no-progress policy;
- a launch with only `requested` and no child evidence can become startup-stale after
  `childStartupTimeoutMs`;
- recent worktree activity continues to block duplicate launch.

## Proposed Worktree And Cwd Design

### Why Prompt-Only Isolation Is Not Enough

Prompt instructions are advisory. Codex tools operate relative to the session state and tool
implementation. In the DLD03 failure, the child correctly created the worktree, but `apply_patch`
still wrote to the original checkout because the Codex session cwd was the root checkout and
`apply_patch` did not accept a workdir argument.

The common path must make root writes structurally unlikely by launching the child directly inside
the prepared story worktree.

### Parent Workspace Preparation

Add an explicit child workspace preparation step before Codex launch.

Responsible file options:

- preferred: `packages/orchestrator/src/runner/ChildWorkspacePreparer.ts`
- tests: `packages/orchestrator/tests/child-workspace-preparer.test.ts`
- integration into: `WorkflowRunner.launchChild()` and `WorkflowRunner.runEligible()`

Preparation input:

- `story`
- `config.workspace.rootAbs`
- `config.git.strategy`
- `config.git.baseBranch`
- `config.git.branchPattern`
- `config.git.worktreeDir`

Preparation output:

```ts
interface PreparedChildWorkspace {
  childCwdAbs: string;
  expectedBranch: string;
  expectedWorktreePath: string | null;
  prepared: boolean;
}
```

For `git.strategy: "branch"`:

- `childCwdAbs = config.codex.childSession.cwdAbs`
- no worktree creation
- existing branch strategy behavior remains unchanged

For `git.strategy: "worktree"`:

1. Render expected branch and expected worktree path.
2. Verify the expected worktree path is under the configured workspace root.
3. Verify the expected worktree path is under the repo-relative `git.worktreeDir`.
4. If the expected worktree exists:
   - verify it is a git worktree;
   - verify its branch is the expected branch;
   - verify it belongs to the same repository;
   - verify it is not the root checkout;
   - return it as prepared.
5. If the path does not exist:
   - create parent directories as needed;
   - run `git worktree add <expectedPath> -b <expectedBranch> <baseBranch>` when the branch does
     not exist;
   - run `git worktree add <expectedPath> <expectedBranch>` only when the expected branch already
     exists and is safe to reuse;
   - block on ambiguous existing branches with commits, dirty state, or unknown ownership.

The tracker claim remains a parent scheduling lock. The story branch should normally start from the
clean configured base branch; it does not need to inherit the parent root checkout's uncommitted
claim edit.

Failure policy:

- If preparation fails after tracker claim, release the startup claim using the same conservative
  claim-release path used for startup failure, because no child session has been launched.
- Record a `child-workspace-prepare-failed` event with the reason.
- Do not remove existing worktrees automatically.

### Launch Record And Prompt Changes

`recordChildLaunch()` should receive `PreparedChildWorkspace` and record:

- `childCwd`: prepared worktree path for worktree strategy;
- `expectedBranch`;
- `expectedWorktreePath`;
- base SHA snapshot taken from a cwd that can inspect the configured base branch;
- prompt hash for the prompt that tells the child the worktree is already prepared.

The prompt in `buildGenericPrompt()` should change for worktree strategy:

Current meaning:

- "Create/use branch/worktree."
- "Before editing, run preflight in two phases, create or enter worktree."

New meaning:

- "The parent has already prepared the expected branch/worktree."
- "You are launched in the expected worktree cwd."
- "Before editing, verify cwd, git top-level, current branch, expected worktree path, and base
  branch."
- "If verification fails, stop and report the blocker instead of editing."

### Codex Tool Input Changes

Current `buildCodexToolInput()` ignores `StoryRunRequest.cwd` and uses
`config.codex.childSession.cwdAbs`.

Change it to accept a launch cwd:

```ts
export function buildCodexToolInput(
  config: ResolvedWorkflowConfig,
  story: WorkflowStory,
  prompt = buildGenericPrompt(story, config),
  cwdAbs = config.codex.childSession.cwdAbs,
): CodexToolInput
```

Then:

- set `input.cwd = cwdAbs`;
- keep child session model, approval policy, sandbox, and config behavior;
- compute writable roots from `config.workspace.rootAbs`, not `cwdAbs`:
  - `<workspaceRoot>/.git`
  - `<workspaceRoot>/<config.git.worktreeDir>`

Rationale:

- Codex should run in the story worktree.
- Git refs and worktree directory remain rooted in the main repository.
- `workspace-write` remains narrowly widened for git operations.

## Implementation Breakdown

This is not the full step-by-step implementation plan. It is the recommended later implementation
shape.

### Task 1: Codex Event Parser

Files:

- create `packages/orchestrator/src/drivers/codex-mcp/codexEvents.ts`
- create `packages/orchestrator/tests/codex-mcp-events.test.ts`

Deliverables:

- parse `codex/event`;
- extract request id, thread id, session id, event type, rollout path, cwd;
- tolerate unknown shapes;
- unit tests for observed `session_configured`, `exec_command_begin`, `task_complete`, and
  malformed notifications.

### Task 2: Driver Lifecycle Integration

Files:

- modify `packages/orchestrator/src/drivers/StoryRunner.ts`
- modify `packages/orchestrator/src/drivers/codex-mcp/CodexMcpStoryRunner.ts`
- modify `packages/orchestrator/tests/codex-mcp-runner.test.ts`

Deliverables:

- install `fallbackNotificationHandler`;
- emit `session-linked` from `session_configured`;
- emit `progress` from custom events with `progressSource: "codex-event"`;
- preserve standard MCP `onprogress` as `progressSource: "mcp-progress"`;
- adjust Codex call timeout so SDK progress absence does not cause false no-progress timeout.

### Task 3: WorkflowRunner State And Artifacts

Files:

- modify `packages/orchestrator/src/runner/WorkflowRunner.ts`
- modify `packages/orchestrator/tests/runner.test.ts`
- possibly modify `packages/orchestrator/src/types.ts`

Deliverables:

- persist `codex-event` source in launch records;
- record session log path from session linkage;
- refresh no-progress timeout from custom event progress;
- keep supervisor polls separate;
- keep tracker claim release conservative.

### Task 4: Parent Worktree Preparation

Files:

- create `packages/orchestrator/src/runner/ChildWorkspacePreparer.ts`
- create `packages/orchestrator/tests/child-workspace-preparer.test.ts`
- modify `packages/orchestrator/src/runner/WorkflowRunner.ts`
- modify relevant git inspector interfaces only if required

Deliverables:

- create or verify expected story worktree before Codex launch;
- block on unsafe existing paths or ambiguous branches;
- record workspace-prepared or workspace-prepare-failed events;
- pass prepared `childCwd` into launch metadata.

### Task 5: Codex Tool Input And Prompt Contract

Files:

- modify `packages/orchestrator/src/drivers/codex-mcp/toolInput.ts`
- modify `packages/orchestrator/tests/codex-mcp-runner.test.ts` or add focused tool input tests

Deliverables:

- pass prepared cwd to Codex;
- keep writable roots tied to workspace root;
- update prompt from child-created worktree to parent-prepared worktree;
- verify prompt text fails closed when cwd/branch checks fail.

### Task 6: Analyzer, Docs, Fixture Sync

Files:

- modify `packages/orchestrator/src/analysis/runAnalyzer.ts`
- modify `references/config-schema.md`
- modify `docs/architecture.md`
- modify `plugins/agentic-workflow-kit/skills/workflow-autopilot/SKILL.md`
- mirror any relevant skill/docs changes into `plugins/agentic-workflow-kit/`

Deliverables:

- analyzer displays `codex-event` progress source;
- docs distinguish `codex-event` from standard MCP progress;
- docs describe parent-created worktree and child cwd behavior;
- plugin fixture remains byte-synced.

## Testing Strategy

### Unit Tests

Required focused tests:

- parser returns `null` for non-`codex/event`;
- parser extracts `_meta.threadId` and `msg.rollout_path` from `session_configured`;
- parser falls back from `_meta.threadId` to `msg.thread_id` and `msg.session_id`;
- driver emits `session-linked` when `fallbackNotificationHandler` receives `session_configured`;
- driver emits `progressSource: "codex-event"` for later events;
- driver still emits `progressSource: "mcp-progress"` for SDK `onprogress`;
- workflow startup is acknowledged by `codex-event` before final tool result;
- workflow no-progress timer resets on `codex-event` progress;
- startup timeout still fails when no custom event, no MCP progress, and no final result arrive;
- worktree preparer creates expected repo-local worktree path;
- worktree preparer blocks on escaping paths;
- worktree preparer blocks when expected path exists but is not the expected branch;
- tool input uses prepared `cwd`;
- writable roots remain workspace-root `.git` and configured worktree directory.

### Integration Probe

Add a script or documented manual command equivalent to the validation run above.

Candidate script:

```text
packages/orchestrator/scripts/probe-codex-mcp-events.mjs
```

Expected behavior:

- starts `codex mcp-server`;
- lists tools and requires `codex,codex-reply`;
- calls `codex` with a read-only prompt;
- does not pass an SDK `onprogress` callback;
- captures `codex/event` via `fallbackNotificationHandler`;
- asserts first session linkage before final result;
- asserts requested cwd appears in `session_configured.msg.cwd`;
- asserts final `structuredContent.threadId` matches event ids;
- asserts multiple custom events arrive over time;
- exits 0 with a compact JSON summary.

The script should be optional for CI unless local Codex CLI availability is guaranteed. It should
be part of manual release validation for changes to the Codex MCP driver.

### Verification Commands

Minimum local verification:

```bash
pnpm exec vitest run packages/orchestrator/tests/codex-mcp-events.test.ts packages/orchestrator/tests/codex-mcp-runner.test.ts packages/orchestrator/tests/runner.test.ts
pnpm check
```

Publish-surface verification, when docs/skills/plugin fixtures change:

```bash
pnpm build
pnpm pack:dry-run
pnpm smoke:codex-plugin
claude plugin validate .
```

If generated MCP bundles or materialized fixtures are touched, also run the repo's actual fixture
freshness check for the current branch.

## Acceptance Criteria

The implementation is acceptable only when all of the following are true.

### Protocol Liveness

- A live Codex MCP child that emits `codex/event` `session_configured` is marked `launched` before
  final tool output.
- Launch metadata records:
  - `sessionId`;
  - `sessionLogPath` when `rollout_path` is present;
  - `progressSource: "codex-event"`;
  - non-null `lastObservedChildProgressAt`;
  - non-null `lastHeartbeatAt`.
- SDK `onprogress` is no longer required for Codex child startup or liveness.
- Standard MCP `notifications/progress` still works and is recorded as `mcp-progress`.
- Final child result still requires `structuredContent.threadId`.
- No-progress timeout is reset by real child `codex/event` liveness.
- Parent `child-supervisor-poll` still does not reset child liveness.

### Worktree Isolation

- Under `git.strategy: worktree`, the parent creates or verifies the expected worktree before
  calling the Codex tool.
- Under `git.strategy: worktree`, Codex `cwd` equals the expected worktree path.
- Launch metadata `childCwd` equals the expected worktree path.
- A live validation probe can show `session_configured.msg.cwd` equals the expected worktree path.
- Child prompt no longer asks the child to create the worktree in the normal worktree path.
- The prompt tells the child to stop if cwd, top-level, branch, or worktree path verification fails.
- Root checkout writes from Codex tools are structurally avoided in the common path because the
  session cwd is the worktree.

### Recovery And Safety

- Startup claim release is skipped when session linkage or child progress evidence exists.
- Duplicate launch detection treats `codex-event` heartbeat/progress as active child evidence.
- Analyzer reports `codex-event` progress source and session linkage clearly.
- Legacy launch-only runs without session/progress/worktree evidence remain classifiable as
  startup-stale.
- Existing recovery evidence from session logs and worktree activity remains supported.

### Documentation And Fixture Hygiene

- `references/config-schema.md` describes Codex custom events separately from standard MCP
  progress.
- `docs/architecture.md` describes parent-created worktrees and Codex child cwd strategy.
- `plugins/agentic-workflow-kit/skills/workflow-autopilot/SKILL.md` describes startup/liveness
  semantics using `codex-event`.
- Materialized plugin fixture changes are synchronized where required.

### Validation

- Focused tests pass.
- `pnpm check` passes.
- Manual live Codex MCP event probe passes on a machine with Codex CLI available.
- If plugin surfaces changed, publish-surface checks pass or any skipped check is explicitly
  justified.

## Risks And Mitigations

### Risk: `codex/event` Is Source-Derived, Not Publicly Documented

Mitigation:

- keep final `structuredContent.threadId` as canonical completion output;
- preserve standard MCP progress support;
- parse custom events defensively;
- do not fail the child solely because a non-critical custom event shape changes;
- document the exact Codex CLI version used for live validation.

### Risk: Event Volume Bloats Journals

Mitigation:

- use all valid custom events for in-memory liveness;
- journal only key lifecycle events and sampled/coalesced progress;
- keep raw full session details in Codex rollout logs, linked by `sessionLogPath`.

### Risk: Parent Worktree Creation Adds Git Failure Modes

Mitigation:

- keep worktree preparation conservative;
- block on ambiguous existing worktrees or branches;
- record precise failure events;
- release tracker claim only when no child session was launched;
- do not delete, reset, or overwrite existing worktrees automatically.

### Risk: Worktree Path Drift Or Escape

Mitigation:

- continue enforcing repo-relative, non-escaping `git.worktreeDir`;
- verify expected worktree path is under workspace root and configured worktree directory;
- reject symlink or path normalization surprises before launch.

## Open Questions For Implementation

1. Should the live Codex MCP event probe be committed as a script under `packages/orchestrator`,
   or kept as a documented manual validation command?
2. Should `WorkflowRunner` own worktree preparation directly, or should it depend on a new
   injectable `ChildWorkspacePreparer` for easier tests?
3. Should existing expected branches without active launch metadata be reusable automatically, or
   should they block pending manual recovery?
4. Should `task_complete` be treated as terminal liveness only, or should it also trigger a final
   artifact update before `structuredContent` returns?
5. Should `session_configured.msg.cwd` be validated against the intended launch cwd at runtime and
   fail fast on mismatch?

Recommended answers:

1. Commit a small probe script if driver behavior remains high risk; otherwise keep it documented
   and run manually during release validation.
2. Use an injectable preparer to keep git side effects testable.
3. Block ambiguous existing branches by default.
4. Treat `task_complete` as liveness, but final settlement still comes from `structuredContent`.
5. Validate cwd mismatch and report a driver error, because it means the isolation guarantee failed.

## Definition Of Done

The later implementation is done when a Pathway-style `run_eligible` launch can start a Codex MCP
child, link the session from `codex/event` before final output, keep progress alive while the child
works, and launch the child inside the expected story worktree so tools default to the isolated
checkout. The run artifacts must be sufficient for an operator to distinguish a live child,
startup-stale orphan, supervision loss, and duplicate launch without reading raw Codex logs first.
