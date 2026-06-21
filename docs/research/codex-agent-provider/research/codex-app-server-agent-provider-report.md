---
title: kit-vnext - Codex app-server Agent provider research
status: draft
last-reviewed: "2026-06-21"
---

# Codex app-server Agent provider research

This report evaluates `codex app-server` as the Phase 1 Codex Agent provider surface for kit-vnext.
It is written for a researcher with no prior conversation context.

Scope: Codex app-server thread/turn lifecycle, JSON-RPC transport, streaming notifications, typed
approvals, interrupt, resume, schema generation, command/process surfaces, Guardian signals, and
process parentage questions. `codex exec` and `codex mcp-server` are mentioned only where they
clarify why app-server is the better target surface for this provider seam.

## 1. Executive verdict for app-server mode

`codex app-server` is the right Codex surface to target for the kit-vnext Agent provider, but it
must be treated as an experimental, version-probed driver. It exposes the primitives the Agent seam
needs: bidirectional JSON-RPC, `thread/start`, `thread/resume`, `turn/start`, `turn/steer`,
`turn/interrupt`, streamed thread/turn/item notifications, typed approval requests and responses,
command execution items with command/cwd/status/exit-code/output fields, and Guardian review
notifications in the generated schema.

The current evidence is not enough to turn on unattended autonomy. For Codex 0.141.0, local CLI help
and official docs prove the surface exists, and generated JSON Schema proves message shapes. They do
not prove live event ordering, approval answer delivery, approval persistence across disconnect or
human latency, owned resume, redacted output capture, or host process parentage. Those capabilities
must remain disabled until live conformance probes are captured.

Practical recommendation:

- Use app-server as the target Codex provider protocol behind a `codex-cli 0.141.0` freshness key.
- Launch `codex app-server --stdio` through the Execution Host for kit-owned sessions.
- Start with schema and harmless initialization probes only.
- Do not rely on app-server command/process APIs for runner-owned verification; they are app-server
  utility surfaces, not the kit Execution Host.
- Fail closed for approval persistence, owned resume, structured tool exit, Guardian authority, and
  process parentage until dedicated probes prove them.

## 2. Surface and version evidence

Evidence gathered on 2026-06-21 from the requested worktree
`/Users/aryekogan/repos/workflow-kit/.worktrees/docs-restructure`.

| Evidence | Result |
|---|---|
| `pwd && git rev-parse --show-toplevel` | Confirmed this report was written in `/Users/aryekogan/repos/workflow-kit/.worktrees/docs-restructure`, not the main checkout. |
| `codex --version` | `codex-cli 0.141.0`. |
| `codex app-server --help` | Shows app-server as `[experimental]`; supported transports include default `stdio://`, `unix://`, `ws://IP:PORT`, and `off`; WebSocket auth flags are present. |
| `codex app-server generate-json-schema --help` | Requires `--out <DIR>` and supports `--experimental`. |
| `codex app-server generate-json-schema --experimental --out /tmp/codex-app-server-schema-check-2026-06-21-exp` | Generated 329 schema files. Per-file schemas relied on here match the checked-in 0.141.0 evidence; only the aggregate v2 bundle differed. |
| Official Codex manual helper | `node /Users/aryekogan/.codex/skills/.system/openai-docs/scripts/fetch-codex-manual.mjs` returned a current manual at `/var/folders/h_/mbzpc88j3w18hmcdd0j5x53h0000gn/T/openai-docs-cache/codex-manual.md`. |
| Official app-server docs | <https://developers.openai.com/codex/app-server>. The docs describe app-server as the rich-client integration surface for authentication, conversation history, approvals, and streamed agent events. |
| Official approvals/security docs | <https://developers.openai.com/codex/agent-approvals-security>. The docs distinguish sandbox boundaries from approval prompts and describe when Codex asks for approval. |
| Official config reference | <https://developers.openai.com/codex/config-reference>. `approval_policy` and granular approval categories are documented. |
| Official SDK docs | <https://developers.openai.com/codex/sdk>. The Python SDK controls local Codex app-server over JSON-RPC; SDK builds pin a Codex CLI runtime. |
| Local schema evidence | `docs/design/30-domain-reference/providers/agent-execution/evidence/2026-06-18-codex-0.141.0-app-server-schema/`. |
| Design inputs | `docs/implementation/agent-provider-requirements.md` and `docs/design/30-domain-reference/providers/agent-execution/`. |
| Prior historical research | `docs/research/history/autopilot-durability-codex-research/research-reports/R1-codex-runtime-control.md`, `R3-approval-permission-relay.md`, and `R7-recovery-resume-relaunch.md`. These are context, not current proof. |

Official docs facts:

- App-server uses JSON-RPC 2.0 style messages with the `jsonrpc` header omitted on the wire.
- `stdio` transport is newline-delimited JSON; WebSocket uses one JSON-RPC message per text frame;
  Unix socket uses WebSocket over Codex's app-server control socket or a custom Unix socket.
- WebSocket mode is explicitly experimental and unsupported; non-loopback WebSocket listeners
  require explicit auth before exposing them remotely.
- Clients must send `initialize`, then `initialized`, before other requests.
- `capabilities.experimentalApi = true` opts into experimental methods and fields.
- Generated TypeScript and JSON Schema artifacts are version-specific to the Codex binary that
  generated them.

Brief contrast:

- `codex exec --json` is the better CI/non-interactive surface, but it is not the target here because
  this task needs bidirectional approval/control channels.
- `codex mcp-server` can be a Phase 0 bridge for MCP elicitation, but app-server has the richer
  thread/turn/control/approval event model needed by the Agent provider.

## 3. Capability matrix

Capability states below describe app-server mode for local `codex-cli 0.141.0` in this worktree.
"Surface support" means the official docs or schema expose a method/field. "Capability-attested"
means a live conformance probe has proven the kit requirement. Current positive capability
attestations are not available.

| Capability | Supported? | How | Example JSON-RPC shape | Evidence/reference | Caveats |
|---|---:|---|---|---|---|
| `canRelayApproval` | Partial | App-server sends server-initiated approval requests and the client responds with decision payloads. Command, file-change, permissions, MCP elicitation, and tool user-input shapes exist. | Request: `{ "method": "item/commandExecution/requestApproval", "id": 42, "params": { "threadId": "thr_123", "turnId": "turn_456", "itemId": "item_1", "command": "pnpm install", "cwd": "/repo" } }`; response: `{ "id": 42, "result": { "decision": "decline" } }`. | Official app-server approvals docs; schema files `CommandExecutionRequestApprovalParams.json`, `CommandExecutionRequestApprovalResponse.json`, `FileChangeRequestApprovalParams.json`, `PermissionsRequestApprovalParams.json`, `McpServerElicitationRequestParams.json`, `ToolRequestUserInputParams.json`. | Schema/docs do not prove a live Codex turn emits each request or accepts each decision. Must live-probe allow and deny for each claimed approval kind before positive attestation. |
| `canPersistApprovalAnswerChannel` | Unknown / not attested | No current evidence proves a pending approval request can survive client disconnect, parent restart, human latency, or `thread/resume` and still accept the original answer. `serverRequest/resolved` proves resolution on a live request only. | Live-only resolution notification: `{ "method": "serverRequest/resolved", "params": { "threadId": "thr_123", "requestId": 42 } }`. | Official app-server docs for `serverRequest/resolved`; schema `ServerRequestResolvedNotification.json`; design requirement AGP-FR-08. | Do not infer persistence from JSON-RPC request ids, thread persistence, or 30-minute thread unload grace. Treat pending approval channels as live-only until persistence probes prove otherwise. |
| `canResumeOwned` | Partial | `thread/resume` reopens an existing thread by `threadId`; subsequent `turn/start` appends to it. Owned resume requires the kit to launch or re-establish the app-server connection through the Execution Host and prove no prior live worker remains. | `{ "method": "thread/resume", "id": 20, "params": { "threadId": "thr_123", "cwd": "/repo" } }`; then `{ "method": "turn/start", "id": 21, "params": { "threadId": "thr_123", "input": [{ "type": "text", "text": "Continue from the previous evidence." }] } }`. | Official app-server API overview; schema `v2/ThreadResumeParams.json`, `v2/ThreadResumeResponse.json`; prior R7 recovery report. | A thread id is not ownership. Desktop, App, TUI, or human-resumed sessions are observe-only unless kit process/connection ownership is proven. `path` and `history` resume fields are marked unstable and should not be used for v1. |
| `emitsStructuredToolExit` | Partial | `commandExecution` items include `command`, `cwd`, `status`, default `source`, nullable `exitCode`, nullable `aggregatedOutput`, and nullable `processId`. `item/commandExecution/outputDelta` streams output by `itemId`. | Notification: `{ "method": "item/completed", "params": { "threadId": "thr_123", "turnId": "turn_456", "item": { "type": "commandExecution", "id": "item_1", "command": "pnpm test", "cwd": "/repo", "status": "completed", "exitCode": 0, "aggregatedOutput": "..." } } } }`. | Schema `v2/ItemCompletedNotification.json` and `v2/CommandExecutionOutputDeltaNotification.json`; design `codex-driver.md`. | `exitCode` is nullable. Provider emits raw or aggregated output, not kit `outputRef`; the driver must redact and store output through `AgentOutputSink`. Missing exit code or failed redaction must become degraded evidence. |
| `emitsGuardianReview` | Partial / advisory only | Generated schema includes Guardian warning, review-started, review-completed, and `thread/approve_guardian_denied_action` shapes. The review payload itself is marked unstable. | `{ "method": "item/guardianApprovalReview/completed", "params": { "threadId": "thr_123", "turnId": "turn_456", "reviewId": "rev_1", "action": { "type": "command", "command": "...", "cwd": "/repo", "source": "agent" }, "review": { "status": "approved", "riskLevel": "medium", "rationale": "..." }, "decisionSource": "agent" } }`. | Schema `v2/ItemGuardianApprovalReviewStartedNotification.json`, `v2/ItemGuardianApprovalReviewCompletedNotification.json`, `v2/GuardianWarningNotification.json`, `v2/ThreadApproveGuardianDeniedActionParams.json`. | Official app-server docs page does not describe Guardian details. Schema says the review payload is unstable. Treat as observed advisory evidence, not approval authority or auto-bypass. |
| `preservesHostProcessParentage` | Unknown / not attested | `commandExecution.processId` exists when available, and app-server can be launched by the Execution Host, but no evidence proves command process ids belong to the host-owned containment scope. | `commandExecution` item field: `"processId": "proc_..."`. | Schema `v2/ItemCompletedNotification.json`; design `codex-driver.md`; Execution Host boundary in Agent design. | Needs a joint prov-01/prov-04 live probe: launch through Execution Host, trigger a command, map process evidence to containment, hard-kill/reap, and prove descendants are gone. Until then, kill-dependent autonomy stays off. |

Additional functional capabilities:

| Area | Supported? | Notes |
|---|---:|---|
| Live progress | Yes at surface level | `thread/status/changed`, `turn/started`, `turn/completed`, `item/started`, `item/completed`, `item/agentMessage/delta`, plan/reasoning deltas, command output deltas, diff updates, token usage updates. Driver must distinguish child progress from observer activity. |
| Stable session linkage | Partial | Thread objects include `id`, `sessionId`, `cwd`, `source`, `status`, `cliVersion`, and optional unstable `path`. Driver should use `thread.id` as provider session identity and record `sessionId` as session-tree linkage. |
| Terminal classification | Partial | Turn status enum includes `completed`, `interrupted`, `failed`, `inProgress`; command status includes `inProgress`, `completed`, `failed`, `declined`. The driver still must emit exactly one normalized Agent terminal reason. |
| Turn interrupt | Yes at surface level | `turn/interrupt` requires `threadId` and `turnId`; docs state success is `{}` and the turn ends with `status: "interrupted"`. This is graceful cancellation, not process kill. |
| Graceful vs hard kill | Partial | App-server has protocol interrupt plus command/process terminate APIs, but hard kill remains Execution Host responsibility. |
| Approval request/response types | Partial | Typed command, file-change, permissions, MCP elicitation, and tool input request shapes exist. Live kind-by-kind relay probes are still required. |
| Answer persistence | Unknown | No current evidence proves durable approval answer channels across disconnect/restart/resume. |
| Output capture/redaction | Partial | Provider supplies output deltas and aggregated output; kit must capture, redact, digest, and store output refs. |
| Command/process APIs vs runner verify | Supported but out of boundary | `command/exec` runs one command under server sandbox; `process/spawn` is experimental and outside sandbox. Runner-owned verify must use Execution Host `runCommand`, not app-server process APIs. |
| Schema-only vs live-proven evidence | Schema-only for most positive claims | Current app-server evidence supports implementation direction, not autonomy gates. |

## 4. Functional requirement coverage against AGP-FR-01..AGP-FR-18

| Requirement | App-server coverage | Evidence | Driver guidance |
|---|---:|---|---|
| AGP-FR-01 capability probe | Partial | `codex --version`, app-server help, version-specific schema generation. | Implement a probe that records Codex version, platform, app-server surface, experimental flag, schema digest, and evidence refs. Positive capability probes still need live tests. |
| AGP-FR-02 start/attach worker launched by Execution Host | Partial | App-server can run over stdio and be spawned as a process; docs quickstart uses `spawn("codex", ["app-server"])`. | The Execution Host must spawn the app-server process. Driver attaches to the protocol stream; it must not spawn outside host ownership. |
| AGP-FR-03 stable session linkage | Partial | `thread/start` returns `thread`; Thread has `id`, `sessionId`, `cwd`, `source`, `status`, `cliVersion`. | Emit linked after `thread/start` or `thread/resume` returns and after `thread/started` subscription is observed. Record host worker handle id and ownership class. |
| AGP-FR-04 stream normalized worker events | Partial | Official docs and schema expose many notifications. | Map thread/turn/item/delta/approval/error notifications into neutral events. Live event-order probe required. |
| AGP-FR-05 distinguish child progress from observer activity | Partial | `item/*`, `turn/*`, output deltas, and approval requests are child/driver events; `thread/read`, `thread/list`, `thread/loaded/list`, and reconnects are observer activity. | Only child-originated lifecycle/delta/approval/tool events should reset worker progress timers. |
| AGP-FR-06 terminal exactly once | Partial | `turn/completed` carries final turn status; errors precede failed completion. | Driver must collapse provider statuses into one terminal reason: `completed`, `failed`, `interrupted`, `approval-parked`, `provider-lost`, or `host-lost`. |
| AGP-FR-07 capture approval/input requests | Partial | Typed server requests for command/file/permissions/MCP/user input exist. | Normalize and persist before answering. If request kind is unknown, emit degraded/park. |
| AGP-FR-08 report approval answer persistence | Unknown | No persistence evidence. | Report channels as `persistable: false` unless a live persistence probe proves otherwise. |
| AGP-FR-09 accept scoped approval answer/denial | Partial | Response schemas include command/file decisions and permission grant profiles. | Only relay recorded scoped grants that map exactly to provider response shapes. Denial for permissions is not explicit; probe before using an empty profile as denial. |
| AGP-FR-10 owned resume | Partial | `thread/resume` exists. | Positive `canResumeOwned` requires kit-owned process/connection and host/session linkage proof. Human/app sessions remain observe-only. |
| AGP-FR-11 stop observing vs terminate | Partial | `thread/unsubscribe` stops a connection subscription; `turn/interrupt` cancels work; host kill is separate. | Implement `stopObserving` with `thread/unsubscribe`; never treat it as process termination. |
| AGP-FR-12 observe tool execution with exit code and output ref | Partial | Command item has command/cwd/status/nullable exitCode/aggregatedOutput/processId. | Store output through `AgentOutputSink` and require non-null exit code before `ToolObserved`. |
| AGP-FR-13 store output through sink | Partial | Provider supplies raw output only. | Driver must redact and store; event log records only `outputRef` and digest. |
| AGP-FR-14 emit degraded events for missing facts | Supported by design, not provider | Schema allows nullable fields; provider can omit exitCode/output/processId. | Missing exitCode, output, linkage, parentage, or contradictory terminal state becomes degraded. |
| AGP-FR-15 report host containment parentage | Unknown | `processId` exists but no containment proof. | Keep `preservesHostProcessParentage` negative until joint probe proves mapping. |
| AGP-FR-16 Guardian as observed evidence | Partial | Guardian schemas exist but unstable; official app-server docs do not document Guardian details. | Record Guardian as advisory only. Do not use `thread/approve_guardian_denied_action` for automated bypass. |
| AGP-FR-17 mock/simulator | Not provided by app-server | This is kit-owned. | Mock must simulate app-server positive and adversarial cases. |
| AGP-FR-18 conformance evidence per positive capability | Partial | Schema and help evidence exist. | No runtime capability should be positive without live smoke/persistence/parentage evidence. |

## 5. Examples

These examples are protocol sketches, not live transcripts. They omit `"jsonrpc": "2.0"` because
the official app-server docs say that header is omitted on the wire.

### Initialize

```json
{ "method": "initialize", "id": 0, "params": {
  "clientInfo": {
    "name": "kit_vnext_agent_provider",
    "title": "kit-vnext Agent Provider",
    "version": "0.1.0"
  },
  "capabilities": {
    "experimentalApi": true,
    "optOutNotificationMethods": []
  }
} }
```

Expected response and acknowledgement:

```json
{ "id": 0, "result": { "userAgent": "codex-cli/0.141.0", "platformFamily": "unix", "platformOs": "macos" } }
{ "method": "initialized", "params": {} }
```

### Thread start

```json
{ "method": "thread/start", "id": 1, "params": {
  "model": "gpt-5.4",
  "cwd": "/Users/aryekogan/repos/workflow-kit/.worktrees/story-worktree",
  "sandbox": "workspace-write",
  "approvalPolicy": "on-request",
  "approvalsReviewer": "user",
  "threadSource": "appServer"
} }
```

Response/notification shape:

```json
{ "id": 1, "result": {
  "thread": {
    "id": "thr_123",
    "sessionId": "sess_abc",
    "cwd": "/Users/aryekogan/repos/workflow-kit/.worktrees/story-worktree",
    "source": "appServer",
    "status": { "type": "idle" },
    "cliVersion": "0.141.0",
    "path": null
  },
  "approvalPolicy": "on-request",
  "approvalsReviewer": "user",
  "sandbox": { "mode": "workspace-write" }
} }
{ "method": "thread/started", "params": { "thread": { "id": "thr_123", "sessionId": "sess_abc" } } }
```

### Thread resume

```json
{ "method": "thread/resume", "id": 2, "params": {
  "threadId": "thr_123",
  "cwd": "/Users/aryekogan/repos/workflow-kit/.worktrees/story-worktree",
  "approvalPolicy": "on-request",
  "excludeTurns": true
} }
```

Use `thread/read` for stored inspection without resuming or subscribing:

```json
{ "method": "thread/read", "id": 3, "params": { "threadId": "thr_123", "includeTurns": true } }
```

### Turn start

```json
{ "method": "turn/start", "id": 4, "params": {
  "threadId": "thr_123",
  "input": [
    { "type": "text", "text": "Implement the bounded task and stop after local verification." }
  ],
  "cwd": "/Users/aryekogan/repos/workflow-kit/.worktrees/story-worktree",
  "approvalPolicy": "on-request"
} }
```

Response/notification:

```json
{ "id": 4, "result": { "turn": { "id": "turn_456", "status": "inProgress", "items": [] } } }
{ "method": "turn/started", "params": { "threadId": "thr_123", "turn": { "id": "turn_456", "status": "inProgress" } } }
```

### Streaming events

```json
{ "method": "item/started", "params": {
  "threadId": "thr_123",
  "turnId": "turn_456",
  "startedAtMs": 1792500000000,
  "item": { "type": "agentMessage", "id": "item_msg_1", "status": "inProgress" }
} }
{ "method": "item/agentMessage/delta", "params": {
  "threadId": "thr_123",
  "turnId": "turn_456",
  "itemId": "item_msg_1",
  "delta": "I will inspect the relevant files."
} }
{ "method": "item/started", "params": {
  "threadId": "thr_123",
  "turnId": "turn_456",
  "startedAtMs": 1792500001000,
  "item": {
    "type": "commandExecution",
    "id": "item_cmd_1",
    "command": "pnpm check",
    "cwd": "/repo",
    "status": "inProgress",
    "source": "agent"
  }
} }
{ "method": "item/commandExecution/outputDelta", "params": {
  "threadId": "thr_123",
  "turnId": "turn_456",
  "itemId": "item_cmd_1",
  "delta": "base64-or-text-delta-as-defined-by-schema"
} }
{ "method": "item/completed", "params": {
  "threadId": "thr_123",
  "turnId": "turn_456",
  "completedAtMs": 1792500005000,
  "item": {
    "type": "commandExecution",
    "id": "item_cmd_1",
    "command": "pnpm check",
    "cwd": "/repo",
    "status": "completed",
    "source": "agent",
    "exitCode": 0,
    "aggregatedOutput": "..."
  }
} }
```

Driver handling:

- `item/started`, deltas, approval requests, `item/completed`, and `turn/completed` are worker
  progress.
- `thread/read`, `thread/list`, reconnects, and observer polling are not worker progress.
- `aggregatedOutput` or streamed deltas must be written to `AgentOutputSink` after redaction.
- Only emit `ToolObserved` when `status` is terminal and `exitCode` is non-null.

### Approval answer

Command approval request:

```json
{ "method": "item/commandExecution/requestApproval", "id": 100, "params": {
  "threadId": "thr_123",
  "turnId": "turn_456",
  "itemId": "item_cmd_1",
  "startedAtMs": 1792500002000,
  "approvalId": null,
  "reason": "Command requires network access",
  "command": "pnpm install",
  "cwd": "/repo",
  "networkApprovalContext": { "host": "registry.npmjs.org", "protocol": "https", "port": 443 },
  "availableDecisions": ["accept", "decline", "cancel"]
} }
```

Approve once:

```json
{ "id": 100, "result": { "decision": "accept" } }
```

Deny and let the turn continue:

```json
{ "id": 100, "result": { "decision": "decline" } }
```

Deny and interrupt the turn:

```json
{ "id": 100, "result": { "decision": "cancel" } }
```

Network policy amendment, when the normalized scoped grant exactly matches the request:

```json
{ "id": 100, "result": {
  "decision": {
    "applyNetworkPolicyAmendment": {
      "network_policy_amendment": { "action": "allow", "host": "registry.npmjs.org" }
    }
  }
} }
```

Resolution notification:

```json
{ "method": "serverRequest/resolved", "params": { "threadId": "thr_123", "requestId": 100 } }
```

File change approval response:

```json
{ "id": 101, "result": { "decision": "acceptForSession" } }
```

Permissions response:

```json
{ "id": 102, "result": {
  "permissions": {
    "fileSystem": { "read": "workspace", "write": "workspace" },
    "network": { "mode": "off" }
  },
  "scope": "turn",
  "strictAutoReview": true
} }
```

MCP elicitation response:

```json
{ "id": 103, "result": {
  "action": "accept",
  "content": { "choice": "continue" }
} }
```

Tool user-input response:

```json
{ "id": 104, "result": {
  "answers": {
    "approval_choice": { "choice": "Decline" }
  }
} }
```

### Turn interrupt

```json
{ "method": "turn/interrupt", "id": 200, "params": {
  "threadId": "thr_123",
  "turnId": "turn_456"
} }
```

Expected protocol success and terminal notification:

```json
{ "id": 200, "result": {} }
{ "method": "turn/completed", "params": {
  "threadId": "thr_123",
  "turn": { "id": "turn_456", "status": "interrupted", "items": [] }
} }
```

Driver caveat: `turn/interrupt` is a graceful cancellation request. It is not proof that the
app-server process, worker process, shell child, or descendant process tree is dead. Hard kill and
reaping belong to the Execution Host.

### Terminal event handling

Provider terminal signals:

```json
{ "method": "turn/completed", "params": {
  "threadId": "thr_123",
  "turn": { "id": "turn_456", "status": "completed", "items": [] }
} }
```

```json
{ "method": "error", "params": {
  "error": {
    "message": "Response stream disconnected",
    "codexErrorInfo": { "responseStreamDisconnected": { "httpStatusCode": null } }
  }
} }
{ "method": "turn/completed", "params": {
  "threadId": "thr_123",
  "turn": { "id": "turn_456", "status": "failed", "error": { "message": "Response stream disconnected" } }
} }
```

Suggested normalized mapping:

| Provider signal | Agent terminal reason |
|---|---|
| `turn.status == "completed"` and no pending approval | `completed` |
| `turn.status == "failed"` | `failed` |
| `turn.status == "interrupted"` after `turn/interrupt` or denial-cancel | `interrupted` |
| Approval captured but no persistable answer channel and no immediate answer | `approval-parked` |
| App-server stream exits, drops, or contradicts state before terminal | `provider-lost` |
| Execution Host reports owned process lost/killed without clean provider terminal | `host-lost` |

## 6. Process ownership and parentage implications with Execution Host

App-server solves protocol ownership, not process containment by itself.

For kit-vnext, the safe default launch shape is:

1. Execution Host spawns `codex app-server --stdio` in the target worktree containment scope.
2. Agent driver attaches to stdin/stdout JSONL.
3. Driver initializes, starts/resumes a thread, and starts a turn.
4. Driver observes app-server events and emits normalized Agent events.
5. Execution Host remains the only component allowed to hard-kill/reap the app-server process tree
   or run runner-owned verification commands.

Ownership classes:

| Launch shape | Ownership class | Meaning |
|---|---|---|
| Execution Host spawned local app-server with live stdio and containment handle | `owned` | Kit can claim protocol linkage and host process control, subject to probes. |
| Kit controls an equivalent remote execution environment with auditable ownership proof | `owned-remote` | Requires future remote ownership proof; not established here. |
| Pre-existing daemon, Desktop/App thread, human TUI, remote-control session, app-server proxy without containment proof | `observe-only` | Kit may inspect/read/resume only as an operator-assisted workflow; no kill, approval persistence, or auto-recovery claims. |

Important implications:

- `thread.id` and `thread.sessionId` are provider identity, not containment identity.
- `commandExecution.processId` is useful evidence only after it is proven to map to the Execution
  Host containment scope.
- `turn/interrupt` can end a turn as interrupted, but deadlines and abort paths still need the
  Execution Host termination ladder.
- `command/exec`, `command/exec/terminate`, `process/spawn`, and `process/kill` are app-server APIs.
  They do not replace the host's `runCommand`, hard kill, or containment verification.
- `thread/unsubscribe` stops observation/subscription; it does not terminate the worker.
- `thread/archive`, `thread/delete`, and metadata APIs are app-client lifecycle operations and should
  not be used as run-control primitives unless a specific kit story designs that behavior.

Parentage probe required before `preservesHostProcessParentage` can be positive:

1. Spawn app-server through Execution Host with a containment reference.
2. Start a thread/turn that runs a harmless command, for example `printf app-server-parentage-probe`.
3. Capture `item/started`, output delta, and final `item/completed`.
4. Record `commandExecution.processId` if present.
5. Verify the process id or equivalent evidence belongs to the host containment reference.
6. Interrupt or complete the turn.
7. Kill/reap through Execution Host and prove no app-server or descendant command process remains.

## 7. Risks and fail-closed guidance

| Risk | Fail-closed handling |
|---|---|
| App-server is experimental and schema is version-specific. | Gate every positive capability on exact Codex version, platform, protocol surface, experimental flag, schema digest, and live evidence freshness. |
| Docs/schema show approval shapes but live relay is unprobed. | Capture and persist approval requests, but park when relay or answer delivery is not positively attested. |
| Approval answer channel may be live-only. | Treat `persistable: false` by default. Do not wait indefinitely for human latency on an open JSON-RPC request. Park or interrupt according to policy. |
| Permissions approval denial is not a simple explicit decision in the schema. | Do not synthesize broad or empty permissions as denial without a live probe. Prefer park or `turn/interrupt` for deny paths until proven. |
| `exitCode` is nullable. | Missing or null exit code becomes `structured-tool-exit-missing`; do not use it for completion/liveness gates. |
| Output is raw provider data. | Redact and store through `AgentOutputSink`; event log gets only output refs and digests. |
| Guardian review schema is unstable. | Record advisory Guardian evidence only; never auto-approve or bypass based on it. |
| WebSocket listener can be exposed unsafely. | Prefer stdio. If WebSocket is necessary, bind localhost or require auth flags; never expose unauthenticated non-loopback listeners. |
| Thread `path` and some resume fields are unstable. | Use `threadId` for resume and treat paths as evidence only, not control handles. |
| Process parentage is unproven. | Keep kill-dependent unattended runs, auto-recovery, and parentage-gated liveness disabled. |
| App-server command/process APIs look tempting for verification. | Runner-owned verify remains Execution Host-owned. App-server process APIs are not a substitute. |
| Duplicate terminal or provider loss. | Emit exactly one normalized terminal. Contradictions become `agent-terminal-ambiguous` and require recovery classification. |

## 8. Open questions and exact probes still needed

The following probes are required before app-server mode can claim positive Agent capabilities.
All probes should run in an isolated worktree through the Execution Host. Do not run them from a
human Desktop/App/TUI session and do not let them mutate the main checkout.

1. **Initialization and linkage smoke.**
   - Start `codex app-server --stdio`.
   - Send `initialize` with `clientInfo.name = "kit_vnext_agent_provider_probe"` and
     `capabilities.experimentalApi = true`.
   - Send `initialized`.
   - Call `thread/start` with a temp worktree `cwd`.
   - Verify `thread.id`, `thread.sessionId`, `cwd`, `source`, `status`, and `thread/started`.

2. **Live event-order smoke.**
   - Start a harmless turn that asks Codex to run a local no-op or read-only command.
   - Capture `turn/started`, `item/started`, deltas, `item/completed`, and `turn/completed`.
   - Verify ordering, stable `threadId`/`turnId`/`itemId`, and no duplicate terminal.

3. **Structured tool exit probe.**
   - Trigger a deterministic harmless command with known exit code, for example `printf ok`.
   - Verify final `commandExecution` item has `source: "agent"`, command, cwd, terminal status,
     non-null `exitCode`, output, and stable item id.
   - Store output through the kit output sink and verify redaction/digest/ref.

4. **Command approval allow/deny probe.**
   - Configure `approvalPolicy: "on-request"` and sandbox/network settings so a harmless command
     requires approval.
   - Capture `item/commandExecution/requestApproval`.
   - Respond with `accept`, `decline`, and `cancel` in separate runs.
   - Verify `serverRequest/resolved` and final item/turn statuses.

5. **Network approval context probe.**
   - Trigger a harmless blocked network access to a controlled host.
   - Verify `networkApprovalContext` host/protocol/port.
   - Verify `applyNetworkPolicyAmendment` allow and deny behavior.

6. **File-change approval probe.**
   - Configure the sandbox so a proposed write outside allowed roots asks for approval in a temp
     directory.
   - Verify request fields, `accept`, `acceptForSession`, `decline`, and `cancel`.

7. **Permissions approval probe.**
   - Trigger `item/permissions/requestApproval`.
   - Determine exact allowed grant shapes and whether any explicit denial or minimal denied profile is
     accepted. Until this is known, permissions denial must park/interrupt.

8. **MCP elicitation and tool input probe.**
   - Trigger `mcpServer/elicitation/request` and `item/tool/requestUserInput` with harmless test
     prompts.
   - Verify request ids, answer payloads, timeout cleanup, and `serverRequest/resolved`.

9. **Approval persistence probe.**
   - Trigger an approval request and persist the normalized pending request.
   - Disconnect the client or stop observation without answering.
   - Reconnect or `thread/resume`.
   - Attempt the original scoped answer.
   - Record whether the answer is accepted, rejected, or cleared. This decides
     `canPersistApprovalAnswerChannel`.

10. **Owned resume probe.**
    - Complete or park a thread launched by the kit.
    - Terminate the app-server process through Execution Host and prove it is reaped.
    - Start a new app-server process through Execution Host.
    - Call `thread/resume` and then `turn/start`.
    - Verify linkage to the expected run/story/worktree and absence of duplicate live workers.

11. **Interrupt probe.**
    - Start a long-running but harmless turn.
    - Capture `turnId`.
    - Call `turn/interrupt`.
    - Verify `{}` response and `turn/completed` status `interrupted`.
    - Separately verify whether any shell/process descendants remain; if yes, host hard kill is
      required.

12. **Parentage probe.**
    - Run a command item that exposes `processId`.
    - Map `processId` to the Execution Host containment reference.
    - Kill/reap through the host and verify descendant cleanup.
    - This decides `preservesHostProcessParentage`.

13. **Guardian review probe.**
    - With `approvalsReviewer = "auto_review"` or the relevant config, trigger a harmless reviewable
      action.
    - Capture Guardian started/completed notifications.
    - Verify target binding, status, risk, rationale, and failure behavior.
    - Keep Guardian advisory unless the schema becomes stable and policy explicitly promotes it.

14. **Provider-loss and ambiguity probe.**
    - Kill app-server mid-turn through the host.
    - Drop the JSON-RPC stream mid-approval.
    - Inject or simulate duplicate terminal events in the mock.
    - Verify normalized degraded/terminal behavior: `provider-lost`, `host-lost`, or
      `agent-terminal-ambiguous`.

## References

- Official Codex app-server docs: <https://developers.openai.com/codex/app-server>
- Official Codex approvals/security docs: <https://developers.openai.com/codex/agent-approvals-security>
- Official Codex configuration reference: <https://developers.openai.com/codex/config-reference>
- Official Codex SDK docs: <https://developers.openai.com/codex/sdk>
- Codex manual helper command:
  `node /Users/aryekogan/.codex/skills/.system/openai-docs/scripts/fetch-codex-manual.mjs`
- Local CLI evidence commands:
  `codex --version`,
  `codex app-server --help`,
  `codex app-server generate-json-schema --help`,
  `codex app-server generate-json-schema --experimental --out /tmp/codex-app-server-schema-check-2026-06-21-exp`
- Local schema evidence:
  `docs/design/30-domain-reference/providers/agent-execution/evidence/2026-06-18-codex-0.141.0-app-server-schema/`
- Agent provider requirements:
  `docs/implementation/agent-provider-requirements.md`
- Agent Execution design:
  `docs/design/30-domain-reference/providers/agent-execution/README.md`
  `docs/design/30-domain-reference/providers/agent-execution/contracts-and-conformance.md`
  `docs/design/30-domain-reference/providers/agent-execution/capabilities-and-conformance.md`
  `docs/design/30-domain-reference/providers/agent-execution/codex-driver.md`
- Historical context:
  `docs/research/history/autopilot-durability-codex-research/research-reports/R1-codex-runtime-control.md`
  `docs/research/history/autopilot-durability-codex-research/research-reports/R3-approval-permission-relay.md`
  `docs/research/history/autopilot-durability-codex-research/research-reports/R7-recovery-resume-relaunch.md`

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../README.md) · **← Prev:** [Agent provider functional requirements](../agent-provider-requirements.md) · **Next →:** [Codex app-server provider-neutral assessment](./codex-app-server-provider-neutral-report.md)

<!-- /DOCS-NAV -->
