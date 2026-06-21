---
title: "Codex MCP Agent provider research report"
status: draft
last-reviewed: "2026-06-21"
---

# Codex MCP Agent provider research report

## 1. Executive verdict for MCP mode

`codex mcp-server` is a real, documented Codex surface, and it is a plausible Phase 0 Agent provider
only when kit-vnext launches it as a kit-owned stdio subprocess through the Execution Host and uses a
real MCP client that supports elicitation, progress, cancellation, stderr capture, timeouts, and hard
process termination.

It is not yet sufficient evidence for unattended autonomy. Current official documentation and local
probes prove availability, stdio framing, tool discovery, and the `codex` / `codex-reply` tool
schemas. They do not prove durable approval relay, approval answer persistence, owned resume, live
interrupt, structured command exit evidence, Guardian review events, or process-parentage preservation.
Those remain fail-closed until live probes prove them for the exact Codex CLI version and platform.

Recommended stance:

| Use case | Verdict |
|---|---|
| Supervised Phase 0 implementation worker with no approval-dependent autonomy | Viable with caveats. |
| Approval-requiring worker via MCP elicitation | Protocol-supported, Codex-MCP-specific behavior unproven. Probe before claim. |
| Long-running live supervision | Partial. MCP progress/cancellation exist, but Codex MCP live progress semantics are not yet attested. |
| Resume / continue | Partial. `codex-reply` continues by `threadId`, but owned resume and pending approval persistence are unproven. |
| Hard stop / kill | Not an MCP guarantee. Must come from Execution Host process-tree ownership. |
| Completion/verification evidence | Not sufficient by itself. MCP returns final content/thread id, not structured per-command exit evidence. |

Do not use a newly spawned `codex mcp-server` as a control channel for an already running Codex
session. That was a known incident failure: the new server has no live transport to the in-flight
tool call and cannot be treated as reply, interrupt, or kill control for that worker.

## 2. Surface and version evidence

### Current official documentation

- OpenAI Codex manual fetched on 2026-06-21 with:

  ```bash
  node /Users/aryekogan/.codex/skills/.system/openai-docs/scripts/fetch-codex-manual.mjs
  ```

  Returned manual:

  - `/var/folders/h_/mbzpc88j3w18hmcdd0j5x53h0000gn/T/openai-docs-cache/codex-manual.md`
  - `/var/folders/h_/mbzpc88j3w18hmcdd0j5x53h0000gn/T/openai-docs-cache/codex-manual.outline.md`

- Official Codex manual pages used:
  - [CLI command reference](https://developers.openai.com/codex/cli/reference)
  - [Use Codex with the Agents SDK](https://developers.openai.com/codex/guides/agents-sdk)
  - [Model Context Protocol](https://developers.openai.com/codex/mcp)
  - [Agent approvals & security](https://developers.openai.com/codex/agent-approvals-security)
  - [Codex App Server](https://developers.openai.com/codex/app-server), only for brief contrast.
  - [Non-interactive mode](https://developers.openai.com/codex/noninteractive), only for brief contrast.

- MCP specification pages used:
  - [MCP transports, 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
  - [MCP elicitation, 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation)
  - [MCP progress, 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/progress)
  - [MCP cancellation, 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/cancellation)
  - [MCP tools, 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)

### Local Codex CLI evidence

Commands run in `/Users/aryekogan/repos/workflow-kit/.worktrees/docs-restructure`:

```bash
codex --version
codex mcp-server --help
codex features list
```

Observed:

- `codex --version` returned `codex-cli 0.141.0`.
- `codex mcp-server --help` says: `Start Codex as an MCP server (stdio)`.
- `codex features list` shows `tool_call_mcp_elicitation` as `stable true` and
  `guardian_approval` as `stable true`. Feature availability is not a live capability proof.

Bounded live probe run:

```bash
node - <<'NODE'
// Spawn codex mcp-server, send initialize, initialized, and tools/list.
// No tools/call request is sent; no model task is started.
NODE
```

Result:

- `initialize` negotiated protocol version `2025-11-25`.
- Server info was `codex-mcp-server`, title `Codex`, version `0.141.0`.
- Server capabilities advertised only `tools.listChanged: true`.
- `tools/list` returned exactly two tools: `codex` and `codex-reply`.
- The probe declared client `elicitation` support, but did not trigger or answer an elicitation.

### Existing repo evidence

Relevant local evidence paths:

- `docs/design/30-domain-reference/providers/agent-execution/evidence/2026-06-18-evidence-index.md`
- `docs/design/30-domain-reference/providers/agent-execution/evidence/2026-06-18-probes/codex-version.txt`
- `docs/design/30-domain-reference/providers/agent-execution/evidence/2026-06-18-probes/codex-mcp-server-help.txt`
- `docs/design/30-domain-reference/providers/agent-execution/evidence/2026-06-18-probes/codex-mcp-server-line-json-probe.json`
- `docs/design/30-domain-reference/providers/agent-execution/evidence/2026-06-18-codex-0.141.0-app-server-schema/`

The 2026-06-18 MCP probe already showed the same core facts: newline-delimited JSON-RPC framing,
`codex-mcp-server` version `0.141.0`, protocol `2025-11-25`, and tools `codex` plus `codex-reply`.

### Brief contrast with non-MCP surfaces

- `codex app-server` is documented as a deeper JSON-RPC integration surface for authentication,
  conversation history, approvals, and streamed agent events. It is also documented/marked as
  experimental and version-specific. This report does not recommend app-server as MCP mode; it uses it
  only as a contrast for typed approval/control fields that MCP mode has not proven.
- `codex exec --json` is documented for non-interactive automation and JSONL output. It is not the
  subject of this report and does not provide a documented inbound approval answer channel.

## 3. Capability matrix

| Capability | Supported? | How in MCP mode | Example request / client behavior | Evidence / reference | Caveats |
|---|---|---|---|---|---|
| `canRelayApproval` | Unknown / not attested | MCP has server-to-client `elicitation/create`, and local Codex has `tool_call_mcp_elicitation` enabled. A kit MCP client would need to advertise `elicitation`, capture the request, persist it, decide, then respond with `accept`, `decline`, or `cancel`. | Client initialization includes `capabilities.elicitation`. On `elicitation/create`, kit normalizes to `AgentApprovalRequested`, records it before answering, and returns an MCP elicitation result. | MCP elicitation spec; `codex features list`; `docs/design/.../codex-driver.md`; R1/R3 old research. | No live Codex MCP approval request was triggered or answered. Do not infer shell approval relay from feature flag or spec alone. |
| `canPersistApprovalAnswerChannel` | No / unknown | No positive evidence that an MCP `elicitation/create` request remains answerable after human latency, client disconnect, parent restart, or owned resume. | If decision is not ready within the live request window, kit should close safely (`decline`/`cancel`), park the run, and resume via a fresh owned turn if a scoped grant can be preloaded. | `docs/implementation/agent-provider-requirements.md`; `docs/design/.../codex-driver.md`; MCP cancellation/transport specs. | JSON-RPC request ids are not durable approval channels. MCP stdio has no stream-resume semantics. |
| `canResumeOwned` | Partial / not attested | `codex-reply` continues a session by `threadId`. This is continuation, not proof that the kit can re-own a previous worker, preserve pending approvals, or link to the same host containment. | `tools/call` with `name: "codex-reply"` and `arguments: { "threadId": "...", "prompt": "Continue..." }`. | Official Agents SDK guide; live `tools/list` probe; `codex-driver.md`. | Requires live smoke for owned resume: start session, stop/restart client, continue by `threadId`, prove host/session linkage and approval behavior. |
| `emitsStructuredToolExit` | No / not attested for MCP mode | MCP `codex` returns final content and `threadId`; official MCP tool result structure supports `structuredContent`, but the Codex MCP tool schema does not promise per-command `command`, `cwd`, `status`, `exitCode`, and redacted output refs. | Client may store final `content` as transcript output, but must not emit `ToolObserved` unless a real event includes non-null exit code and redacted output sink result. | Official Agents SDK guide; MCP tools spec; local `tools/list`; `capabilities-and-conformance.md`. | App-server schema has command execution items with `exitCode`, but that is app-server schema evidence, not MCP mode evidence. |
| `emitsGuardianReview` | No / not attested for MCP mode | Local feature `guardian_approval` is enabled, and app-server schema includes Guardian review notifications. MCP `codex` / `codex-reply` tools do not advertise Guardian review events in their tool output schema. | Treat any Guardian text as advisory transcript content unless a version-pinned MCP event shape is live-probed. | `codex features list`; app-server schema under evidence; `codex-driver.md`. | Do not make Guardian load-bearing in MCP mode without stable target/action/status/risk/rationale fields. |
| `preservesHostProcessParentage` | No / depends on Execution Host | MCP stdio means the client launches `codex mcp-server` as a subprocess. That proves immediate provider-process parentage only if launched by the Execution Host, not that worker command executions are inside the same containment scope. | Execution Host starts the process group, records pid/containmentRef, kills/reaps tree on timeout, and separately proves worker command descendants are gone. | MCP transport spec; `agent-provider-requirements.md`; `codex-driver.md`; R1 old research. | MCP protocol does not expose process-tree proof. Parentage must be a joint Agent/Execution Host probe. |

## 4. Functional requirement coverage against AGP-FR-01..AGP-FR-18

| FR | MCP-mode status | Coverage and required behavior |
|---|---|---|
| AGP-FR-01 | Partial | Version/surface probes are easy: `codex --version`, `codex mcp-server --help`, `initialize`, `tools/list`, and feature flags. Positive capability probes still need live smoke evidence, not just schemas/tool lists. |
| AGP-FR-02 | Partial | A kit-owned MCP provider can be launched by the Execution Host as stdio. A pre-existing server or a newly spawned control helper for another session is observe-only or unrelated. |
| AGP-FR-03 | Partial | `threadId` is returned by `codex` and accepted by `codex-reply`. No MCP turn id or host worker handle is present; kit must add host linkage and ownership class. |
| AGP-FR-04 | Partial | MCP gives final tool responses and optional progress/cancellation mechanics. Normalized events must be built by the kit. Live Codex MCP progress, approval, tool-observed, Guardian, degraded, and terminal event delivery is not fully attested. |
| AGP-FR-05 | Unknown | Standard MCP progress is tied to request `progressToken`; old repo findings mention `codex/event`, but no current official MCP-mode contract distinguishes child progress from parent polling. Probe required. |
| AGP-FR-06 | Partial | The MCP tool call eventually returns, errors, is cancelled, or the host process is lost. Kit can classify those into terminal reasons, but MCP does not provide the full Agent terminal taxonomy itself. |
| AGP-FR-07 | Unknown | MCP elicitation can carry approval/input requests. Current Codex MCP approval request capture is unproven. If observed, kit must normalize and persist before answering. |
| AGP-FR-08 | No / unknown | No evidence that MCP approval answer channels persist across disconnect, human latency, or resume. Default to live-only and park/close safely. |
| AGP-FR-09 | Unknown | MCP elicitation has an answer path, but no Codex MCP live probe proves the answer is accepted and resumes the blocked action. |
| AGP-FR-10 | Partial | `codex-reply` can continue by `threadId`; owned resume requires proof that the kit still owns the process/transport or relaunches an equivalent owned worker under Execution Host. |
| AGP-FR-11 | Partial | An MCP client can close its observation/transport. That is not process termination. Kit must expose `stopObserving` separately from Execution Host kill. |
| AGP-FR-12 | No | MCP `codex` tool results do not attest structured worker command observations with non-null exit code and redacted output reference. |
| AGP-FR-13 | Partial | Kit can store MCP final content/stderr/transcript through an output sink, but this does not satisfy per-tool output capture unless command-level output events are live-probed. |
| AGP-FR-14 | Yes, by kit policy | Missing exit codes, missing linkage, unknown progress, or lost transport should emit degraded events. The provider surface itself does not enforce this. |
| AGP-FR-15 | No | MCP stdio process parentage is available only for the server process. Worker command containment proof is not exposed by MCP and must come from Execution Host probes. |
| AGP-FR-16 | Partial | Guardian can be recorded as advisory when surfaced. MCP mode has no stable Guardian event evidence; do not make it authoritative. |
| AGP-FR-17 | Yes, outside Codex | The mock/simulator can and should reproduce dropped approval, lost linkage, no exit code, and claim-without-evidence. Codex MCP is not required for this. |
| AGP-FR-18 | Partial | Tool-list/version evidence exists. Positive capability evidence for relay persistence, resume ownership, structured tool exit, Guardian, and parentage is absent. |

## 5. Examples

These are implementation examples for a kit-owned MCP client. They are not evidence that the live
Codex model task was run in this report.

### 5.1 Initialize and list tools

Request:

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{"elicitation":{"form":{},"url":{}}},"clientInfo":{"name":"kit-vnext","version":"0.1.0"}}}
```

Notification:

```json
{"jsonrpc":"2.0","method":"notifications/initialized"}
```

Request:

```json
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
```

Observed local response shape:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      { "name": "codex", "inputSchema": { "required": ["prompt"] } },
      { "name": "codex-reply", "inputSchema": { "required": ["prompt"] } }
    ]
  }
}
```

Client behavior:

- Record `driverId=codex`, `driverVersion=0.141.0`, `protocolSurface=codex-mcp-server`,
  `protocolVersion=2025-11-25`, and platform.
- Treat this as tool-list evidence only.
- Do not claim approval relay, resume ownership, or structured tool exits from this probe.

### 5.2 Start via `codex`

Request:

```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "method": "tools/call",
  "params": {
    "name": "codex",
    "arguments": {
      "prompt": "Implement the bounded task described by the operator.",
      "cwd": "/absolute/worktree",
      "sandbox": "workspace-write",
      "approval-policy": "on-request"
    },
    "_meta": { "progressToken": "run-123-turn-1" }
  }
}
```

Official documentation says the response includes `structuredContent.threadId` and `content`.

Client behavior:

- Emit `AgentSessionStarted` when the Execution Host process exists.
- Emit `AgentSessionLinked` only when `threadId` is observed and associated with the host worker
  handle.
- Store final `content` as transcript evidence, not as structured tool-exit evidence.
- If the request hangs, use MCP cancellation as a graceful request only, then Execution Host stop/kill.

### 5.3 Continue via `codex-reply`

Request:

```json
{
  "jsonrpc": "2.0",
  "id": 11,
  "method": "tools/call",
  "params": {
    "name": "codex-reply",
    "arguments": {
      "threadId": "019bbb20-bff6-7130-83aa-bf45ab33250e",
      "prompt": "Continue from the recorded state and report current blockers."
    }
  }
}
```

Client behavior:

- Use only for sessions whose `threadId` was created or linked by a kit-owned launch.
- Treat human-started Desktop/TUI sessions and unrelated MCP servers as observe-only.
- Do not use `codex-reply` as an interrupt or approval answer channel.

### 5.4 Elicitation handling

MCP request from server to client:

```json
{
  "jsonrpc": "2.0",
  "id": "elicit-1",
  "method": "elicitation/create",
  "params": {
    "mode": "form",
    "message": "Codex needs approval to run a networked command.",
    "requestedSchema": {
      "type": "object",
      "properties": {
        "decision": { "type": "string", "enum": ["accept", "decline", "cancel"] }
      },
      "required": ["decision"]
    }
  }
}
```

Possible response:

```json
{
  "jsonrpc": "2.0",
  "id": "elicit-1",
  "result": {
    "action": "decline"
  }
}
```

Client behavior:

1. Validate that the request came over the live transport for the active worker.
2. Normalize it into `AgentApprovalRequested`.
3. Redact sensitive values and append durable approval events before any answer.
4. If policy can decide immediately, answer with the narrowest supported action.
5. If human latency is required, assume live-only unless persistence is proven; close safely, park,
   and resume later only through an owned channel.

Important MCP security rule: form-mode elicitation must not be used for secrets such as passwords,
API keys, access tokens, or payment credentials.

### 5.5 Progress and cancellation semantics

Progress request metadata:

```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "method": "tools/call",
  "params": {
    "name": "codex",
    "arguments": { "prompt": "..." },
    "_meta": { "progressToken": "run-123-turn-1" }
  }
}
```

Progress notification:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/progress",
  "params": {
    "progressToken": "run-123-turn-1",
    "progress": 1,
    "message": "Started Codex task"
  }
}
```

Cancellation notification:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/cancelled",
  "params": {
    "requestId": 10,
    "reason": "Operator requested stop"
  }
}
```

Client behavior:

- Treat MCP progress as optional and request-scoped. Missing progress is not failure by itself.
- Do not count parent polling, reconnects, or status reads as worker progress.
- Treat MCP cancellation as a graceful request. The receiver may ignore it or may have already
  completed the work. It is not a kill guarantee and does not replace Execution Host termination.

### 5.6 Safe stop via Execution Host

Safe stop sequence:

1. Append `AgentStopRequested`.
2. If a `tools/call` request is active, send `notifications/cancelled` for that request id.
3. Stop reading/observing the MCP stream only as observation release, not as a terminal proof.
4. Ask Execution Host to terminate the owned process group.
5. Reap descendants and record containment evidence.
6. Emit terminal:
   - `interrupted` when graceful or host termination is proven;
   - `host-lost` when containment/kill proof is unavailable;
   - `provider-lost` when the MCP transport disappears without host loss.

## 6. Old incident lessons that must be preserved

1. A new MCP server is not a control channel for an old running tool call.
   - The unified incident report states that reply/interrupt spawned a new `codex mcp-server`, which
     had no channel to the live session, so interrupts were recorded as sent but not delivered.
   - Preserve this as a conformance fixture: if a driver attempts control through a different process
     or transport than the active request, it must return `agent-linkage-lost` or
     `agent-resume-unattested`.

2. Session id is not ownership.
   - `threadId` is necessary for `codex-reply`, but it does not prove the kit owns the worker
     process, can answer pending approvals, or can kill descendants.

3. Approval prompts are not durable state.
   - Runtime approvals must be captured, normalized, and persisted before answer. If an approval needs
     human latency and persistence is unproven, close safely and park.

4. Child self-report is not completion evidence.
   - MCP final text can be useful, but completion and merge gates need external verification evidence.

5. Transport close is not hard kill.
   - MCP stdio gives a subprocess boundary, but process-tree kill and descendant proof belong to the
     Execution Host.

6. Structured telemetry must be honest.
   - Missing tool exit, missing output ref, missing Guardian fields, and unstable progress must emit
     degraded events rather than guessed success.

## 7. Risks and fail-closed guidance

| Risk | Fail-closed guidance |
|---|---|
| MCP server exists, but no live approval probe | Disable `canRelayApproval`; launch only no-approval tasks or park on approval. |
| Elicitation request arrives but cannot be durably recorded | Return safe denial/cancel if possible, terminate or park, and mark `approval-event-log-unavailable`. |
| Approval answer needed after disconnect | Treat channel as lost unless persistence was proven; do not synthesize an answer through `codex-reply`. |
| No progress notifications | Do not infer staleness from missing MCP progress alone; use broader liveness timers and host observations. |
| Parent polling looks active | Do not count it as child progress. Progress must be tied to active request, tool item, or provider event. |
| Need to interrupt a running turn | Send MCP cancellation as graceful best effort, then rely on Execution Host hard stop. |
| Need to verify command success | Do not use transcript prose. Require structured exit evidence or runner-owned verification. |
| Guardian text appears | Record as advisory unless stable Guardian review fields are live-attested. |
| A pre-existing Desktop/TUI session id is available | Observe-only unless ownership and containment are proven. |
| CLI version changes | Expire capability attestations and rerun probes for exact version/platform/surface. |

Default capability policy for MCP mode should be:

```text
canRelayApproval = false until live elicitation request+answer probe passes
canPersistApprovalAnswerChannel = false until disconnect/latency/resume probe passes
canResumeOwned = false until owned continuation probe passes
emitsStructuredToolExit = false until command/cwd/status/exitCode/outputRef probe passes
emitsGuardianReview = false until stable Guardian payload probe passes
preservesHostProcessParentage = false until Execution Host parentage probe passes
```

## 8. Open questions and exact probes still needed

### Probe 1: MCP elicitation happy path

Goal: prove or disprove `canRelayApproval`.

Run `codex mcp-server` through a custom MCP client that:

- launches the server as an Execution Host owned process;
- sends `initialize` with `capabilities.elicitation`;
- calls `codex` with `approval-policy: "on-request"` and a harmless task designed to trigger a
  sandbox/network approval;
- records any `elicitation/create` request;
- responds with `decline`, then in a separate run with the narrowest safe accept;
- verifies the Codex task resumes or declines as expected.

Do not run this as part of routine docs generation; it may call models and request network/sandbox
approval.

### Probe 2: Approval persistence

Goal: prove or disprove `canPersistApprovalAnswerChannel`.

Procedure:

- Trigger an elicitation.
- Persist the pending request.
- Disconnect or restart the MCP client.
- Attempt to answer after reconnect or via owned continuation.
- Verify whether the original blocked action accepts the answer.

Expected default: negative until proven.

### Probe 3: Owned continuation via `codex-reply`

Goal: distinguish continuation from owned resume.

Procedure:

- Start a kit-owned session and record host worker handle plus `threadId`.
- End the MCP server process cleanly.
- Start a new kit-owned MCP server and call `codex-reply` with the recorded `threadId`.
- Verify linkage, workspace, approval behavior, and whether pending context survives.

Positive result should still be scoped: it proves continuation, not parentage or approval
persistence, unless those are also tested.

### Probe 4: Live progress classification

Goal: identify which MCP events are real worker progress.

Procedure:

- Send `tools/call` with `_meta.progressToken`.
- Capture `notifications/progress`, any Codex-specific notifications such as `codex/event`, stdout,
  stderr, and final result.
- Compare against parent polling/reconnect activity.

Required output: a mapping from raw events to `AgentProgressObserved`, `tool-observed`, `degraded`,
or ignored observer activity.

### Probe 5: MCP cancellation and hard kill

Goal: prove graceful stop behavior and hard-kill fallback.

Procedure:

- Start a long-running harmless task.
- Send `notifications/cancelled` for the active request id.
- If no terminal response arrives within a short deadline, ask Execution Host to terminate the
  process group.
- Prove no descendant process survives.

Expected result: cancellation is best effort; hard stop depends on Execution Host.

### Probe 6: Structured tool exit

Goal: prove or disprove `emitsStructuredToolExit` for MCP mode.

Procedure:

- Trigger a harmless shell command from Codex.
- Capture all MCP notifications and final output.
- Look for stable command, cwd, terminal status, non-null exit code, and output bytes.
- Store output through `AgentOutputSink` and emit `ToolObserved` only if all required fields exist.

Expected default: negative until proven.

### Probe 7: Guardian review payload

Goal: prove whether MCP mode emits stable Guardian review fields.

Procedure:

- Trigger a harmless action likely to need approval/Guardian review.
- Capture all MCP notifications and final content.
- Require stable target, action, status, risk, and rationale fields.

Expected default: advisory only.

### Probe 8: Parentage and containment

Goal: prove `preservesHostProcessParentage`.

Procedure:

- Start `codex mcp-server` as an Execution Host owned process group.
- Trigger a worker command that spawns a short-lived child.
- Capture provider command/process evidence if available.
- Cross-check against OS process tree/containmentRef.
- Kill through Execution Host and prove no descendants remain.

Expected default: negative until the joint prov-01/prov-04 probe passes.

## Appendix: evidence quick map

| Claim | Evidence |
|---|---|
| `codex mcp-server` is documented | Official Codex CLI reference and Agents SDK guide. |
| `codex mcp-server` is stdio | `codex mcp-server --help`; official CLI reference; MCP stdio transport spec. |
| It exposes `codex` and `codex-reply` | Official Agents SDK guide; live `tools/list`; `2026-06-18-probes/codex-mcp-server-line-json-probe.json`. |
| `threadId` is the continuation handle | Official Agents SDK guide; local `tools/list` output schema. |
| MCP stdio is newline-delimited JSON-RPC and client-launched subprocess | MCP transports spec. |
| MCP elicitation requires client capability and uses `elicitation/create` | MCP elicitation spec. |
| MCP progress is optional and request-token-scoped | MCP progress spec. |
| MCP cancellation is best-effort notification and may be ignored | MCP cancellation spec. |
| Tool `structuredContent` is valid MCP tool result shape | MCP tools spec; official Agents SDK guide. |
| Existing repo evidence is schema/tool-list only for MCP mode | `docs/design/.../evidence/2026-06-18-evidence-index.md`; `capabilities-and-conformance.md`. |
| New-server-as-control-channel failed before | `_old_docs/history/autopilot-durability/postmortems/2026-06-18-autopilot-unified-issues.md`; R1 old research. |

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [implementation contract](../README.md) · **← Prev:** [Codex CLI provider-neutral Agent provider assessment](./codex-cli-provider-neutral-report.md) · **Next →:** [Codex MCP server provider-neutral capability report](./codex-mcp-provider-neutral-report.md)

<!-- /DOCS-NAV -->
