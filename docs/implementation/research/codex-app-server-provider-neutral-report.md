---
title: "Codex app-server provider-neutral assessment"
status: draft
last-reviewed: "2026-06-21"
provider-surface: "codex app-server"
codex-version: "codex-cli 0.141.0"
---

# Codex app-server provider-neutral assessment

## Scope

This report evaluates `codex app-server` against
[`docs/implementation/agent-provider-requirements.md`](../agent-provider-requirements.md) and the
Agent Execution design in
[`docs/design/30-domain-reference/providers/agent-execution/README.md`](../../design/30-domain-reference/providers/agent-execution/README.md)
and
[`contracts-and-conformance.md`](../../design/30-domain-reference/providers/agent-execution/contracts-and-conformance.md).

It is a fresh second-pass assessment. It does not use prior reports under
`docs/implementation/research/`.

Brief contrast only: `codex app-server` is the JSON-RPC rich-client surface for authentication,
conversation history, approvals, and streamed agent events. It is stronger than a final-result CLI
surface for observation and request relay, and much broader than the MCP tool surface, but it is not
an Execution Host and does not prove process containment, parentage, hard kill, merge safety, or
verification.

## Evidence used

- Official OpenAI Codex manual fetched by
  `/Users/aryekogan/.codex/skills/.system/openai-docs/scripts/fetch-codex-manual.mjs`.
  Returned manual:
  `/var/folders/h_/mbzpc88j3w18hmcdd0j5x53h0000gn/T/openai-docs-cache/codex-manual.md`.
  Relevant source pages in the manual:
  [`/codex/app-server.md`](https://developers.openai.com/codex/app-server.md),
  [`/codex/agent-approvals-security.md`](https://developers.openai.com/codex/agent-approvals-security.md),
  [`/codex/config-advanced.md`](https://developers.openai.com/codex/config-advanced.md), and
  [`/codex/permissions.md`](https://developers.openai.com/codex/permissions.md).
- Local CLI evidence:
  `codex --version`, `codex app-server --help`,
  `codex app-server generate-json-schema --help`, and
  `codex app-server generate-json-schema --out /tmp/codex-app-schema-0.141.0`.
- Local generated schema evidence:
  `docs/design/30-domain-reference/providers/agent-execution/evidence/2026-06-18-codex-0.141.0-app-server-schema/codex_app_server_protocol.schemas.json`.
- Existing local evidence index:
  `docs/design/30-domain-reference/providers/agent-execution/evidence/2026-06-18-evidence-index.md`.

No model-calling or repo-mutating live app-server probes were run.

## Version and platform

- Local Codex: `codex-cli 0.141.0`.
- Local platform: macOS Darwin 25.5.0 arm64.
- App-server help marks the surface as experimental.
- Official manual states app-server supports JSON-RPC 2.0 over stdio, WebSocket, Unix socket, and
  `off`; the WebSocket transport is experimental and unsupported.
- Schema generation is version-specific. The local generated schema and the pinned repo schema are
  both for Codex 0.141.0.

## Overall verdict

`codex app-server` is the best current Codex surface for a provider-neutral Agent driver. It has
documented JSON-RPC thread/turn lifecycle APIs, stable-looking identifiers, streamed notifications,
typed approval and input requests, typed request answers, transcript/history reads, interrupt and
steer methods, model/permission/capability listing, and schema generation.

The main caveat is evidence strength. Documentation and schema evidence prove the shape, but not
live behavior under parent restart, human-latency approval parking, process containment, command
parentage, or missed-event replay. For kit-vnext, app-server should be treated as L4 for live,
owned, connected sessions after smoke probes, and only partial L5 until reconnect/resume and request
durability probes pass.

## Functional requirement matrix

| Requirement | Supported? | Capability level | How app-server supports it | Caveats | Required probes |
|---|---:|---:|---|---|---|
| AGP-FR-01 Configure | Yes | L1 | `thread/start` and `turn/start` accept `model`, `modelProvider`, `cwd`, `approvalPolicy`, `approvalsReviewer`, `sandbox`/`sandboxPolicy`, `permissions`, `runtimeWorkspaceRoots`, `serviceTier`, and metadata. Responses return effective `model`, `modelProvider`, `cwd`, `approvalPolicy`, `approvalsReviewer`, `sandbox`, `activePermissionProfile`, `instructionSources`, and `runtimeWorkspaceRoots`. | Effective config is per app-server schema, not a kit-normalized `AgentStartRequest`. Some fields are experimental or sticky across thread/turns. | Start a no-op/local-only thread in an isolated fixture and assert requested vs response config, including permission profile and project config effects. |
| AGP-FR-02 Submit work | Yes | L1 | New conversation: `thread/start`; existing conversation: `turn/start`; in-flight steering: `turn/steer`; continuation: `thread/resume`; fork: `thread/fork`. | `turn/start` is model-calling; not probed here. | Smoke `thread/start` plus bounded `turn/start` in a disposable repo with approvals constrained. |
| AGP-FR-03 Identify | Yes | L2 | JSON-RPC request `id`; `Thread.id`; `Thread.sessionId`; `Turn.id`; `ThreadItem.id`; request ids for server requests; approval-specific `approvalId` for some command approval callbacks; `reviewId` for auto-review. | No explicit kit `runId`; correlation metadata must be carried by wrapper metadata and event storage. | Verify identifiers remain stable across `thread/read`, `thread/turns/list`, reconnect, and resume. |
| AGP-FR-04 Ownership | Partial | L1 | Threads started by a kit-owned app-server client can be treated as kit-owned by wrapper policy. Schema exposes `Thread.source`, `Thread.sessionId`, `Thread.path`, `Thread.parentThreadId`, and `Thread.agentRole`/`agentNickname`. | No explicit provider field says "owned by this controller." `thread/resume` can load existing local threads, so ownership must be proven externally. | Create owned thread with correlation metadata, resume it, and prove the wrapper rejects unrecognized thread ids as observe-only or unsupported. |
| AGP-FR-05 Observe | Yes | L1-L2 | Live stream notifications include `thread/status/changed`, `turn/started`, `turn/completed`, `item/started`, `item/completed`, `item/agentMessage/delta`, tool deltas, request-resolved, warnings, and errors. Snapshot/history APIs include `thread/read`, `thread/turns/list`, and `thread/turns/items/list`. | Live stream is connection-scoped; history is durable only for materialized thread content. Raw streamed deltas may need redaction before event-log storage. | Smoke live notifications and compare them to subsequent transcript reads. |
| AGP-FR-06 Wait | Partial | L1 | A client can block on the transport stream for notifications and can page history with cursors. Thread active flags expose waiting states. | No explicit filtered `wait(afterCursor, condition)` method was found. Waiting is client-side stream consumption plus polling/listing. | Build wrapper wait primitive and prove it distinguishes worker progress from observer reconnect or polling activity. |
| AGP-FR-07 Order and reconnect | Partial | L1/L5-partial | Notifications include timestamps on many lifecycle events (`startedAtMs`, `completedAtMs`). History listing has opaque cursors and reverse cursors for turns/items. | No global event sequence id or documented missed-live-event replay cursor. Ordering across notification classes must be reconstructed from ids/timestamps/history. | Drop a connection during a bounded turn, reconnect, then prove no terminal/request/tool state is lost or duplicated after `thread/resume` plus history listing. |
| AGP-FR-08 Classify state | Yes | L2 | `ThreadStatus`: `notLoaded`, `idle`, `systemError`, `active` with flags. `ThreadActiveFlag`: `waitingOnApproval`, `waitingOnUserInput`. `TurnStatus`: `inProgress`, `completed`, `failed`, `interrupted`. `CommandExecutionStatus`: `inProgress`, `completed`, `failed`, `declined`. | `lost` and `unknown` are wrapper classifications from stream loss, missing history, or ambiguous errors. Waiting is thread-level flag plus outstanding server request state. | Exercise completed, failed, interrupted, waiting-on-approval, waiting-on-user-input, and connection-lost cases. |
| AGP-FR-09 Surface requests | Yes | L2 | Server requests include `item/commandExecution/requestApproval`, `item/fileChange/requestApproval`, `item/permissions/requestApproval`, `mcpServer/elicitation/request`, `item/tool/requestUserInput`, `item/tool/call`, auth refresh, attestation, legacy approvals. | Dynamic tool and tool-user-input are experimental. Some request params are nullable or unstable. | Trigger each supported request type in an isolated fixture and verify normalized request records. |
| AGP-FR-10 Answer requests | Yes | L3 | JSON-RPC server requests are answered by client responses. Command decisions include `accept`, `acceptForSession`, execpolicy/network amendments, `decline`, `cancel`. File changes support `accept`, `acceptForSession`, `decline`, `cancel`. Permissions return granted profile plus scope. MCP elicitation returns `accept`/`decline`/`cancel` plus content. Tool user input returns answer map. | Answer delivery has schema evidence only here. Need live proof for each request type, especially cancellation semantics. | Live approval-answer matrix covering accept, decline, cancel, session grant, permission scope, MCP form/url elicitation, and tool input. |
| AGP-FR-11 Request durability | Partial/unknown | L3 live, L5 unknown | Outstanding requests have JSON-RPC request ids; `serverRequest/resolved` notification reports request resolution by `requestId` and `threadId`; thread status flags show waiting. | JSON-RPC request/response channels are naturally connection-scoped. No evidence here proves a server request can be answered after parent disconnect, app-server restart, or long human latency. | Disconnect while approval is pending; reconnect with `thread/resume`; attempt answer; record whether original request is still answerable, expired, or must park. |
| AGP-FR-12 Control | Partial | L4 | `turn/interrupt` cancels an active turn; `turn/steer` appends user input to active turn; `thread/unsubscribe` stops observation; archive/delete/rollback/compact are thread controls. | `turn/interrupt` is protocol control, not hard process kill. `turn/steer` requires `expectedTurnId` and may fail for modes that cannot accept steering. | Interrupt a running bounded turn and verify terminal `interrupted`; steer an in-flight turn; unsubscribe without altering worker state. |
| AGP-FR-13 Process-control boundary | Partial | L4 for protocol, not host | App-server clearly has protocol controls (`turn/interrupt`) and also unrelated process/client utility APIs (`command/exec`, `process/spawn`, `process/kill`). CommandExecution items expose worker command metadata and optional process ids. | The Agent provider must not treat app-server process APIs as the Execution Host. `process/spawn` explicitly runs without a Codex sandbox on the app-server host; it is out of scope for Agent provider containment. Worker command parentage is unproven. | Joint prov-01/prov-04 parentage probe: start app-server under host containment, trigger worker command, prove process tree, interrupt behavior, and host kill behavior separately. |
| AGP-FR-14 Reconnect | Partial | L5-partial | `thread/resume` can rejoin a running thread by `threadId`; for running threads, `path` is a consistency check. `thread/read` and list APIs can recover snapshots/history. | Reconnect of observation is documented/schema-shaped, but missed-event recovery and request-channel continuity are unproven. | Kill/restart observer during active turn, then resume and compare event/history state. |
| AGP-FR-15 Resume or continue | Yes/partial | L5-partial | `thread/resume` resumes by `threadId`, history, or path; non-running precedence is documented in schema. `turn/start` can continue a resumed thread. `thread/fork` branches history. | Resume does not prove kit ownership. History/path fields are marked unstable for some cases. | Resume an owned completed thread and continue with a follow-up turn; attempt resume of non-owned local thread and ensure wrapper blocks it. |
| AGP-FR-16 Tool activity visibility | Yes | L2-L3 | Thread items include `commandExecution`, `fileChange`, `mcpToolCall`, `dynamicToolCall`, `webSearch`, subagent activity, etc. Command execution exposes `command`, `cwd`, `commandActions`, `status`, nullable `exitCode`, `durationMs`, `aggregatedOutput`, `processId`, and output deltas. MCP/dynamic tools expose arguments, status, duration, result/error. | `exitCode` is nullable until completion or when unavailable. `aggregatedOutput` may contain sensitive data. Process parentage is not proven by `processId`. | Trigger command success/failure, declined command, MCP tool success/failure, file change, and verify emitted item lifecycle and final transcript shape. |
| AGP-FR-17 Artifacts and evidence | Partial | L2 | Durable references can be built from thread id, turn id, item id, transcript pages, schema files, generated schema version, help output, and OTel/log events. | App-server returns raw payloads; kit still needs an `AgentOutputSink` to store redacted `outputRef`s instead of embedding raw transcripts/output in event log. | Implement artifact adapter that stores redacted thread/turn/item snapshots and command output with digest references. |
| AGP-FR-18 Data handling | Partial | L1 | Official docs describe sandbox/approval controls, permission profiles, shell environment filtering, network restrictions, and OTel options including redacted user prompts by default. App-server exposes auth/config surfaces and raw output/transcript fields. | No provider guarantee that command output, transcripts, paths, or tool args are redacted before app-server delivery. Wrapper must redact and avoid secret dumps. | Secret-canary probe for command output, transcript, OTel, request params, and stored artifacts; verify redaction set behavior. |
| AGP-FR-19 Error model | Partial | L2 | JSON-RPC errors have `code`, `message`, and `data`. Manual documents WebSocket overload error `-32001` with message `"Server overloaded; retry later."` Turn `error` notification has `TurnError` plus `willRetry`. Turn objects include `error` when status is `failed`. | Needs normalized mapping into launch failed, stream lost, request channel lost, input rejected, resume failed, unsupported control, ambiguous terminal, provider unavailable. | Negative probes for pre-initialize request, duplicate initialize, invalid experimental call without opt-in, bad thread id, bad turn id, overload if feasible, and stream drop. |
| AGP-FR-20 Capability discovery | Partial | L1-L2 | `generate-json-schema` exposes version-specific protocol shape. Runtime APIs include `model/list`, `modelProvider/capabilities/read`, `permissionProfile/list`, `experimentalFeature/list`, and config reads. `initialize.capabilities.experimentalApi` gates experimental methods/fields. | No single provider-native attestation for Agent capabilities such as durable request answers, resume-owned, structured tool exit, or host parentage. | Build `probeCapabilities` from schema hash, help/version, runtime lists, and live smoke/persistence probes. |
| AGP-FR-21 Conformance evidence | Partial | L1 now, L4/L5 after probes | Schema and help are repeatable. Repo evidence already records Codex 0.141.0 schema generation and limitations. | Current evidence is not enough for unattended/recovery flows. Positive claims beyond shape need live smoke, persistence, ownership, parentage, and negative evidence. | Add a conformance suite with schema hash check, handshake, thread/turn smoke, request matrix, interrupt, reconnect/resume, history cursor, redaction, and parentage probes. |

## JSON-RPC lifecycle model

App-server uses JSON-RPC 2.0 messages but omits the `"jsonrpc": "2.0"` header on the wire.
Requests have `method`, `params`, and `id`; responses echo `id`; notifications omit `id`.

Handshake:

```json
{ "method": "initialize", "id": 0, "params": { "clientInfo": { "name": "kit_vnext", "title": "kit-vnext", "version": "0.1.0" } } }
{ "method": "initialized", "params": {} }
```

Experimental opt-in:

```json
{
  "method": "initialize",
  "id": 1,
  "params": {
    "clientInfo": { "name": "kit_vnext", "title": "kit-vnext", "version": "0.1.0" },
    "capabilities": { "experimentalApi": true }
  }
}
```

Start a configured thread:

```json
{
  "method": "thread/start",
  "id": 10,
  "params": {
    "model": "gpt-5.4",
    "modelProvider": "openai",
    "cwd": "/absolute/worktree",
    "approvalPolicy": "on-request",
    "approvalsReviewer": "user",
    "permissions": ":workspace",
    "runtimeWorkspaceRoots": ["/absolute/worktree"],
    "config": { "model_reasoning_effort": "high" }
  }
}
```

The response shape includes the effective `model`, `modelProvider`, `cwd`, `approvalPolicy`,
`approvalsReviewer`, `sandbox`, `activePermissionProfile`, `instructionSources`,
`runtimeWorkspaceRoots`, and `thread`.

Start a turn:

```json
{
  "method": "turn/start",
  "id": 11,
  "params": {
    "threadId": "thr_...",
    "input": [{ "type": "text", "text": "Implement this bounded task." }],
    "cwd": "/absolute/worktree",
    "approvalPolicy": "on-request",
    "responsesapiClientMetadata": { "kitRunId": "run_123", "operationId": "op_456" }
  }
}
```

Steer an active turn:

```json
{
  "method": "turn/steer",
  "id": 12,
  "params": {
    "threadId": "thr_...",
    "expectedTurnId": "turn_...",
    "input": [{ "type": "text", "text": "Narrow the change to docs only." }]
  }
}
```

Interrupt:

```json
{ "method": "turn/interrupt", "id": 13, "params": { "threadId": "thr_...", "turnId": "turn_..." } }
```

Resume:

```json
{
  "method": "thread/resume",
  "id": 20,
  "params": {
    "threadId": "thr_...",
    "cwd": "/absolute/worktree",
    "initialTurnsPage": { "limit": 20 }
  }
}
```

History reads:

```json
{ "method": "thread/read", "id": 30, "params": { "threadId": "thr_...", "includeTurns": true } }
{ "method": "thread/turns/list", "id": 31, "params": { "threadId": "thr_...", "limit": 50, "cursor": null } }
{ "method": "thread/turns/items/list", "id": 32, "params": { "threadId": "thr_...", "turnId": "turn_...", "limit": 100 } }
```

## Streaming notifications and state

Core server notifications for the Agent provider:

- `thread/started`, `thread/status/changed`, `thread/closed`, `thread/tokenUsage/updated`
- `turn/started`, `turn/completed`, `turn/diff/updated`, `turn/plan/updated`
- `item/started`, `item/completed`, `item/agentMessage/delta`, `item/plan/delta`
- `item/commandExecution/outputDelta`, `item/commandExecution/terminalInteraction`
- `item/fileChange/outputDelta`, `item/fileChange/patchUpdated`
- `item/mcpToolCall/progress`
- `item/autoApprovalReview/started`, `item/autoApprovalReview/completed`
- `serverRequest/resolved`
- `error`, `warning`, `guardianWarning`, `deprecationNotice`, `configWarning`

State fields:

- `ThreadStatus`: `notLoaded`, `idle`, `systemError`, or `active`.
- `ThreadActiveFlag`: `waitingOnApproval`, `waitingOnUserInput`.
- `TurnStatus`: `inProgress`, `completed`, `failed`, `interrupted`.
- `CommandExecutionStatus`: `inProgress`, `completed`, `failed`, `declined`.
- `McpToolCallStatus`: `inProgress`, `completed`, `failed`.

Provider-neutral mapping:

| Neutral state | App-server evidence |
|---|---|
| `running` | Thread `active`; turn `inProgress`; item lifecycle or deltas. |
| `waiting for input` | Thread `activeFlags` contains `waitingOnApproval` or `waitingOnUserInput`; outstanding server request id. |
| `completed` | `turn/completed` with `Turn.status = completed`. |
| `failed` | `turn/completed` with `failed`, `error` notification, or thread `systemError`. |
| `cancelled/interrupted` | `turn/completed` with `interrupted`, often after `turn/interrupt` or cancel decision. |
| `lost` | Wrapper classification after stream loss and failed resume/read. |
| `unknown` | Wrapper classification when terminal status is absent or inconsistent. |

## Request and answer model

App-server surfaces worker requests as server-initiated JSON-RPC requests. The client responds to
the same request `id`, and app-server later emits `serverRequest/resolved` with `requestId` and
`threadId`.

### Command approval

Request method: `item/commandExecution/requestApproval`.

Important params: `threadId`, `turnId`, `itemId`, `approvalId`, `command`, `cwd`,
`additionalPermissions`, `availableDecisions`, `proposedExecpolicyAmendment`,
`proposedNetworkPolicyAmendments`, `networkApprovalContext`, `reason`, `startedAtMs`.

Response:

```json
{ "id": 100, "result": { "decision": "accept" } }
```

Supported decision shapes include `accept`, `acceptForSession`,
`{ "acceptWithExecpolicyAmendment": { "execpolicy_amendment": ["..."] } }`,
`{ "applyNetworkPolicyAmendment": { "network_policy_amendment": { "...": "..." } } }`,
`decline`, and `cancel`.

### File-change approval

Request method: `item/fileChange/requestApproval`.

Important params: `threadId`, `turnId`, `itemId`, nullable `grantRoot`, `reason`, `startedAtMs`.

Response decisions: `accept`, `acceptForSession`, `decline`, `cancel`.

### Permission approval

Request method: `item/permissions/requestApproval`.

Important params: `threadId`, `turnId`, `itemId`, `cwd`, `environmentId`, `permissions`, `reason`,
`startedAtMs`.

Response includes a granted permission profile and optional scope:

```json
{
  "id": 102,
  "result": {
    "permissions": { "fileSystem": null, "network": null },
    "scope": "turn",
    "strictAutoReview": null
  }
}
```

### MCP elicitation

Request method: `mcpServer/elicitation/request`.

Important params: `serverName`, `threadId`, nullable `turnId`, plus either form mode with
`requestedSchema` or URL mode with `elicitationId` and `url`.

Response:

```json
{ "id": 103, "result": { "action": "accept", "content": { "field": "value" } } }
```

`action` supports `accept`, `decline`, and `cancel`.

### Tool user input

Request method: `item/tool/requestUserInput` and marked experimental.

Important params: `threadId`, `turnId`, `itemId`, `questions`, optional `autoResolutionMs`.

Response maps question ids to answers:

```json
{ "id": 104, "result": { "answers": { "question_id": { "text": "answer" } } } }
```

### Dynamic client tool call

Request method: `item/tool/call`.

This is a bidirectional extension point for client-owned tools. It is useful for rich clients but
should not be treated as proof that the Agent provider owns arbitrary tool execution safely. Tool
implementation, credential routing, and side-effect policy still need separate ownership and
conformance evidence.

## Reconnect, resume, and request durability

`thread/resume` is the key reconnect primitive. Its schema says:

- a client can resume by `threadId`, in-memory `history`, or `path`;
- for running threads, `threadId` rejoins the active thread and a non-empty `path` is a consistency
  check;
- for non-running threads, `history` and `path` can take precedence over `threadId`;
- `initialTurnsPage` can bootstrap recent turns without a second request.

That is enough to design an L5-capable adapter, but not enough to claim L5. The missing proof is
whether outstanding server requests remain answerable after the original transport disconnects,
after app-server restart, and after human latency. Until those probes pass, the correct behavior is:

- record the request and its `requestId`;
- mark `answerChannel.persistable = false` unless a persistence probe proves otherwise;
- on parent restart, `thread/resume` and read history;
- if the original request cannot be answered, park or relaunch instead of fabricating delivery.

## Process-control boundary

The app-server schema includes `command/exec`, `command/exec/terminate`, `process/spawn`, and
`process/kill`. These are not Agent provider guarantees for kit-vnext.

Reasons:

- `process/spawn` is documented in schema as spawning a standalone process without a Codex sandbox
  on the app-server host.
- `command/exec` is a standalone command API outside thread/turn agent work.
- `turn/interrupt` is a protocol-level cancellation request for an active turn; it does not prove
  the worker process tree is gone.
- `CommandExecutionThreadItem.processId` is useful evidence, but not parentage proof.

Provider-normalized rule: app-server can expose protocol control and worker command observations.
The Execution Host must still own spawning, containment, hard termination, and process-parentage
attestation.

## Tool activity and evidence model

Thread items provide usable tool evidence:

- `commandExecution`: `command`, `cwd`, `commandActions`, `status`, nullable `exitCode`,
  `durationMs`, `aggregatedOutput`, `processId`, `source`.
- `fileChange`: file changes and patch application status.
- `mcpToolCall`: server, tool, arguments, status, result/error, duration, plugin/resource data.
- `dynamicToolCall`: tool, namespace, arguments, status, content items, success, duration.
- Additional items include web search, image view/generation, subagent activity, sleep, reasoning,
  and plan/message items.

For kit-vnext, raw `aggregatedOutput`, output deltas, tool args, paths, and transcript text should
not be copied into the event log by default. Store them as redacted artifact records and emit
references (`outputRef`, digest, item id, thread id, turn id, schema hash) in normalized Agent
events.

## Data handling

Official Codex docs describe the broader safety controls that affect app-server-backed runs:

- approval policy and sandbox/permission profiles control when actions are allowed or require user
  approval;
- network access is off by default in local workspace-write style configurations unless enabled;
- permission profiles can scope filesystem/network access and deny sensitive files;
- shell environment policy can filter subprocess environment variables;
- OTel events can record run/tool data, with user prompt content redacted unless explicitly enabled.

These controls do not remove the need for kit-side data handling. App-server can expose raw
transcripts, command output, tool arguments, file paths, and auth/config surfaces. The adapter must
redact before artifact storage, never log tokens, and avoid storing large raw payloads in the event
log.

## Error model

App-server exposes:

- JSON-RPC request errors: `{ "id": ..., "error": { "code": number, "message": string, "data": ... } }`;
- stream `error` notifications with `threadId`, `turnId`, `TurnError`, and `willRetry`;
- turn-level `error` when a turn has status `failed`;
- thread `systemError`;
- documented WebSocket overload error code `-32001` and retry guidance.

Recommended normalized mapping:

| Normalized error | App-server signals |
|---|---|
| `launch failed` | app-server process spawn/listen failure, failed `initialize`, failed `thread/start`. |
| `provider unavailable` | transport connection refused, health/readiness failure, app-server exit. |
| `input rejected` | JSON-RPC error for invalid params, pre-initialize request, missing experimental opt-in, stale `expectedTurnId`. |
| `stream lost` | connection close before terminal; no successful resume/read. |
| `request channel lost` | outstanding server request cannot be answered after disconnect or resume. |
| `resume failed` | `thread/resume` JSON-RPC error, `notLoaded`, path consistency failure. |
| `control unsupported` | JSON-RPC error for unavailable/invalid `turn/interrupt` or `turn/steer`. |
| `terminal ambiguous` | no `turn/completed`, conflicting history, or only raw transport close. |

## Capability discovery and conformance

Available discovery inputs:

- `codex --version`
- `codex app-server --help`
- `codex app-server generate-json-schema --experimental --out <dir>`
- `initialize` response platform fields
- `model/list`
- `modelProvider/capabilities/read`
- `permissionProfile/list`
- `experimentalFeature/list`
- `config/read`
- generated schema hash and method list

Those inputs should produce a `CapabilityAttestation` only for shape and local availability. Stronger
capabilities require probes:

| Capability claim | Minimum evidence before positive attestation |
|---|---|
| `canRelayApproval` | Live command/file/permission/MCP/tool-input request emitted and answered. |
| `canPersistApprovalAnswerChannel` | Pending request answered after disconnect/reconnect and after human-latency delay. |
| `canResumeOwned` | Owned thread resumed by id; non-owned ids rejected by wrapper; follow-up turn succeeds. |
| `emitsStructuredToolExit` | Command success and failure produce final item with non-null `exitCode` and durable output artifact. |
| `emitsGuardianReview` | Auto-review start/completion observed with stable review ids, status, risk, and target mapping. |
| `preservesHostProcessParentage` | Worker command process tree proven under prov-04 containment; app-server protocol control separated from host kill. |

## Capability levels by functional area

| Functional area | Level | Rationale |
|---|---:|---|
| Submit and final result | L0/L1 | Thread/turn APIs and terminal turn status exist. |
| Live observation | L1 | Rich notifications and transcript APIs exist. |
| State/request awareness | L2 | Thread flags, server request methods, and typed request params exist. |
| Bidirectional request answers | L3 | Typed JSON-RPC responses exist; live matrix still required. |
| Live control | L4 partial | `turn/interrupt`, `turn/steer`, and `thread/unsubscribe` exist; process kill is not included. |
| Durable reconnect/resume | L5 partial | `thread/resume` and history cursors exist; pending request durability is unknown. |
| Tool activity visibility | L2/L3 | Structured items and output deltas exist; exit code may be nullable and output needs artifact handling. |
| Evidence/observability | L2 | Thread/turn/item ids and OTel/schema/help evidence exist; kit artifact adapter still needed. |
| Data handling | L1 partial | Codex has permissions, sandbox, env, and telemetry controls; redaction/storage remains kit responsibility. |
| Error normalization | L2 partial | JSON-RPC and turn errors exist; normalized provider error taxonomy needs wrapper/probes. |
| Capability discovery | L1/L2 | Schema/help/runtime list APIs exist; no native Agent-provider attestation. |

## Required probe plan

Do not unlock unattended or recovery behavior from schema evidence alone. Required probes:

1. Handshake and schema hash: start app-server over stdio, run `initialize`/`initialized`, verify
   version and method schema hash.
2. Config echo: `thread/start` with model/cwd/permissions/approval metadata, assert effective
   response fields.
3. Bounded turn smoke: `turn/start` in an isolated disposable worktree with a harmless prompt,
   observe `turn/started`, item events, and `turn/completed`.
4. Request matrix: trigger command approval, file-change approval, permission approval, MCP
   elicitation, tool user input, and dynamic tool call; answer accept/decline/cancel where
   supported.
5. Waiting-state classification: while a request is pending, verify `thread/status/changed` active
   flags and outstanding request tracking.
6. Interrupt and steer: verify `turn/interrupt` produces interrupted terminal state and does not
   claim process kill; verify `turn/steer` precondition behavior.
7. Reconnect during active turn: disconnect observer, reconnect, `thread/resume`, page history, and
   compare missed events.
8. Request durability: disconnect while approval is pending; reconnect after delay; prove whether
   the request can still be answered.
9. Resume completed thread: resume owned completed thread, continue with another bounded turn, and
   prove non-owned thread ids are not accepted by the wrapper.
10. Tool exit evidence: command success/failure with output capture, non-null final exit codes, and
    redacted output artifacts.
11. Data redaction: seed a harmless secret canary in env/output/transcript and verify event log and
    artifact redaction.
12. Error negatives: invalid params, missing initialization, missing experimental opt-in,
    stale `expectedTurnId`, bad thread id, stream drop, and app-server unavailable.
13. Parentage: app-server launched by prov-04, worker command observed, process tree and host hard
    kill verified independently.

## Conclusion

Use `codex app-server` as the primary Codex Agent provider candidate for Phase 1. Its schema and
manual map well to the provider-neutral requirements, especially configure, submit, identify,
observe, classify, surface/answer live requests, steer/interrupt, transcript reads, and structured
tool observations.

Do not treat it as a durable autonomous runner yet. The adapter must fail closed for ownership,
request persistence, missed-event recovery, process parentage, hard termination, redaction, and
normalized error semantics until the required probes produce positive evidence for the exact Codex
version, platform, config, and ownership mode.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [implementation contract](../README.md) · **← Prev:** [Codex app-server Agent provider research](./codex-app-server-agent-provider-report.md) · **Next →:** [Codex CLI agent provider research report](./codex-cli-agent-provider-report.md)

<!-- /DOCS-NAV -->
