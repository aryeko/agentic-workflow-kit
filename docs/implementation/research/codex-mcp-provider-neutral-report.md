---
title: Codex MCP server provider-neutral capability report
status: draft
last-reviewed: "2026-06-21"
---

# Codex MCP server provider-neutral capability report

## Scope

This is a fresh second-pass assessment of `codex mcp-server` against
[`agent-provider-requirements.md`](../agent-provider-requirements.md). It evaluates Codex as an MCP
server over stdio, not `codex exec` and not `codex app-server` except for brief contrast where the
official manual shows that app-server owns richer thread/turn/event primitives.

No model-calling or repo-mutating live probes were run. Evidence is limited to official OpenAI Codex
manual content, the official MCP specification, local CLI help/version, and bounded MCP
`initialize`/`tools/list` probes.

## Executive assessment

`codex mcp-server` is currently a proven **L0 final-result runner** for the installed local surface:
an MCP client can start a Codex conversation with the `codex` tool and can submit a later prompt with
`codex-reply`. It exposes a stable `threadId` in the tool result schema, and the local server
advertises only the MCP `tools` capability.

The surface is **not yet a provider-neutral Agent provider strong enough for unattended recovery or
approval flows**. It does not advertise native snapshots, event streams, transcript reads, cursors,
filtered waits, structured tool activity, terminal state taxonomy, durable request channels, or
protocol-level interrupt/steer controls. MCP-level cancellation and stdio shutdown exist at the
protocol/transport layer, but they do not prove Codex worker termination, terminal classification, or
request durability. Treat any stronger behavior as unavailable until live `tools/call` probes prove it
for this exact Codex version, protocol version, platform, and ownership mode.

Overall proven level: **L0**. Potential but unproven levels: **L2/L3** for live MCP elicitation during
tool calls if Codex emits `elicitation/create` and accepts client answers; **not L4/L5** without
separate interrupt, reconnect, resume, request-persistence, and process-parentage evidence.

## Evidence base

| Evidence | Result |
|---|---|
| OpenAI Codex manual helper | `node /Users/aryekogan/.codex/skills/.system/openai-docs/scripts/fetch-codex-manual.mjs` returned a current manual at `/var/folders/h_/mbzpc88j3w18hmcdd0j5x53h0000gn/T/openai-docs-cache/codex-manual.md`. |
| Local version | `codex --version` -> `codex-cli 0.141.0`. |
| Local help | `codex mcp-server --help` -> "Start Codex as an MCP server (stdio)" with config override, strict config, and feature enable/disable flags. |
| MCP initialize probe | `initialize` with protocol `2025-06-18` returned server `codex-mcp-server` version `0.141.0`, user agent `Codex Desktop/0.141.0 (Mac OS 26.5.1; arm64)`, and capabilities `{ "tools": { "listChanged": true } }`. |
| MCP current-version initialize probe | `initialize` with protocol `2025-11-25` also returned `2025-11-25` and the same server capabilities. |
| MCP tools-list probe | `tools/list` returned exactly `codex` and `codex-reply`, each with `threadId` and `content` in output schema. |

Important local/manual drift: the current OpenAI manual says `tools/list` exposes two tools and
describes their purpose, but the locally observed `codex` input schema differs in details from the
manual. The local schema includes `approval-policy` value `on-failure`, `compact-prompt`, and
`developer-instructions`; it did not list `profile` or `include-plan-tool`. Implementation must use the
local tool schema for the exact installed version, not the prose table alone.

## Provider surface summary

| Field | Assessment |
|---|---|
| Provider surface | `codex mcp-server`, stdio MCP server consumed by an external MCP client. |
| Version and platform | `codex-cli 0.141.0`; probe server info reported `Codex Desktop/0.141.0 (Mac OS 26.5.1; arm64)`. |
| Configuration model | Tool arguments configure a run: `prompt`, `cwd`, `model`, `sandbox`, `approval-policy`, `base-instructions`, `developer-instructions`, `compact-prompt`, and arbitrary `config` overrides. Server process also accepts `-c/--config`, `--strict-config`, `--enable`, and `--disable`. Effective config is not reported after launch except for the request payload and final thread id/content. |
| Submission model | `tools/call` on `codex` starts a conversation. `tools/call` on `codex-reply` continues a conversation by `threadId` or deprecated `conversationId`. |
| Identity model | `threadId` is the only provider identity surfaced by the tool output schema. No turn id, tool call id, approval id, request id, or command observation id is advertised by `tools/list`. |
| Ownership model | Unknown from MCP alone. If the Execution Host spawns `codex mcp-server`, kit owns the MCP server process, but not necessarily every worker command or resumable conversation. Ownership requires a live start/parentage probe. |
| Observation model | Final MCP tool result only is proven. No snapshot, transcript read, event stream, polling endpoint, cursor, or filtered wait is advertised. |
| State model | In-flight MCP request exists while `tools/call` is pending; terminal tool result/error is visible when the call returns. Provider-specific run states such as running, waiting, interrupted, lost, or cancelled are not normalized by the MCP tools. |
| Request model | Potentially MCP `elicitation/create` if Codex emits approval/user-input requests during `tools/call`; the manual says approval prompts include `threadId` in their params payload. This is not proven by `tools/list`. |
| Control model | MCP cancellation notification and stdio shutdown are protocol/transport mechanisms. No Codex-native interrupt, steer, or stop-observing tool is advertised. |
| Resume/reconnect model | `codex-reply` can continue a prior conversation by `threadId` after a result is known. Reconnecting an observer to an active run or pending request is not advertised. |
| Tool activity model | No structured command/tool activity is advertised through the MCP server. Final `content` may summarize work, but that is not structured evidence. |
| Artifact/data model | Tool result returns `structuredContent.threadId`, `structuredContent.content`, and legacy text `content`. No artifact refs, transcript refs, redaction refs, or output digests are advertised. |
| Error model | MCP protocol errors and tool results with `isError` are possible by MCP schema, but normalized Agent failure reasons are wrapper-owned. |
| Capability discovery | `initialize` plus `tools/list` prove only MCP server identity, protocol version, server `tools` capability, tool names, and schemas. |
| Conformance status | Schema/tool-list/local-help evidence only. No live Codex `tools/call`, approval relay, request persistence, structured tool-exit, reconnect, or parentage evidence was collected in this run. |

## Requirement-by-requirement assessment

| Requirement | Supported? | Level | How / evidence | Caveats and required probes |
|---|---:|---:|---|---|
| AGP-FR-01 Configure | Partial | L0 | `codex` tool accepts requested config fields; server process accepts config overrides and feature flags. | Effective config is not reported after launch. Probe `tools/call` with harmless config and inspect whether final result or any notification reports effective model, cwd, sandbox, and approval posture. |
| AGP-FR-02 Submit work | Yes | L0 | `codex` starts a conversation; `codex-reply` continues by `threadId`. | Starting work requires `tools/call`, which was intentionally not run here. Live smoke must prove bounded prompt submission and terminal result. |
| AGP-FR-03 Identify | Partial | L0 | Tool output schema requires `threadId`; manual says use `structuredContent.threadId`. | No turn, request, approval, tool, or command ids are advertised. Live elicitation/tool probes may expose transient MCP request ids, but those are not durable Agent ids. |
| AGP-FR-04 Ownership | Unknown | L0 | A host can own the `codex mcp-server` process it spawns. | MCP schema does not state whether the resulting Codex thread is kit-owned, remote-owned, or observe-only. Requires host-parentage and session ownership probes. |
| AGP-FR-05 Observe | Partial | L0 | MCP client observes final `tools/call` result and protocol errors. | No provider-native stream, transcript, snapshot, polling, or subscription is advertised. Required probe: call a non-mutating prompt with a progress token and inspect notifications. |
| AGP-FR-06 Wait | Partial | L0 | Waiting for the `tools/call` response is supported by ordinary MCP request/response. | No selected-condition wait exists for request, progress, terminal state, or cursor. Wrapper timeouts are not provider semantics. |
| AGP-FR-07 Order and reconnect | No | L0 | No ordered event stream or cursor is advertised by `initialize`/`tools/list`. | MCP JSON-RPC request ids order client requests, not Codex run events. Need app-server-like event stream or a transcript/cursor API for stronger claims. |
| AGP-FR-08 Classify state | Partial | L0 | MCP response success/error can distinguish terminal tool-call success from protocol/tool error. | Does not classify running, waiting, cancelled/interrupted, provider-lost, or unknown Codex states. Live cancellation/error probes are required for mapping. |
| AGP-FR-09 Surface requests | Unknown / partial | L2 unproven | MCP spec supports server-to-client `elicitation/create`; manual says approval prompts include `threadId`. | `tools/list` does not prove Codex will emit elicitation for exec/patch/permission cases, nor which request kinds map. Required probe must force approval in a safe sandbox and capture request params. |
| AGP-FR-10 Answer requests | Unknown / partial | L3 unproven | MCP elicitation answers support accept/decline/cancel shapes in the spec. | No live Codex request was emitted or answered. Need allow and deny probes for each request kind. |
| AGP-FR-11 Request durability | No evidence | L0 | None in local schema or manual for MCP server. | Treat as live-only/unsupported until a pending request survives client disconnect, human latency, and resumed observation. |
| AGP-FR-12 Control | Partial / unproven | L0 | MCP has `notifications/cancelled`; stdio shutdown can close or terminate the server process. | No Codex-native interrupt, steer, continue, or stop-observing tool is advertised. Cancellation is not proof of graceful Codex turn interruption. |
| AGP-FR-13 Protocol vs process control | Yes, by boundary | L0 | MCP cancellation and stdio shutdown are protocol/transport actions; process containment belongs to Execution Host per the Agent design. | Must not infer worker command termination from MCP cancellation. Parentage/kill proof belongs to prov-04. |
| AGP-FR-14 Reconnect | No | L0 | No active-session observer reconnect API is advertised. | Starting a new MCP connection and calling `codex-reply` is continuation, not observer reconnect to an active run. |
| AGP-FR-15 Resume or continue | Partial | L0 | `codex-reply` continues by `threadId` or `conversationId`. | This is not proven to resume an active/pending owned run, preserve approvals, or reattach observation. Live post-result continuation and pending-run continuation probes are required. |
| AGP-FR-16 Tool activity visibility | No | L0 | `tools/list` output schema only returns `threadId` and final `content`. | No command, cwd, status, exit code, output ref, or tool request id is exposed. Do not use final prose as tool evidence. |
| AGP-FR-17 Artifacts and evidence | Partial | L0 | Final MCP response can be retained as evidence with request/response transcript and `threadId`. | No provider artifact refs, config refs, transcript refs, output refs, or digests. Wrapper must store and redact its own evidence. |
| AGP-FR-18 Data handling | Partial / unknown | L0 | Tool result surfaces final content directly to the MCP client; request fields include workspace/config inputs. | No MCP-server-specific redaction or artifact-routing guarantee was observed. Secrets can appear in final content unless wrapper redacts and bounds storage. |
| AGP-FR-19 Error model | Partial | L0 | MCP distinguishes protocol errors from tool results; local tool schemas include normal result shape. | No normalized launch failed, stream lost, request channel lost, resume failed, control unsupported, or terminal ambiguous taxonomy. Wrapper must normalize. |
| AGP-FR-20 Capability discovery | Partial | L0 | `initialize` reports server identity/protocol/capabilities; `tools/list` reports exact tool schemas. | Discovery proves surface shape only, not live delivery, progress, approvals, parentage, or persistence. |
| AGP-FR-21 Conformance evidence | Partial | L0 | Local help/version and bounded initialize/tools-list probes are repeatable. | Positive L1-L5 claims require live smoke, approval, cancellation, reconnect, resume, structured tool-exit, data redaction, and parentage probes. |

## MCP protocol findings relevant to Codex MCP

- MCP initialization negotiates protocol version and capabilities before operation. The local Codex MCP
  server accepted both `2025-06-18` and `2025-11-25` initialize requests, but in both cases advertised
  only the server `tools` capability.
- MCP `tools/list` is the right shape discovery primitive. It proves `codex` and `codex-reply` exist,
  their input schema, and their output schema. It does not prove any live runtime behavior.
- MCP progress is request-scoped through `_meta.progressToken` and `notifications/progress`; the spec
  says the receiver is not obligated to provide progress notifications. Codex MCP did not advertise a
  progress-specific capability in the local initialize result.
- MCP cancellation is `notifications/cancelled` for a previously issued request. It is protocol
  cancellation, not a guarantee that the Codex turn ended, that worker commands stopped, or that the
  process tree is gone.
- MCP elicitation can let a server ask the client for non-sensitive user input or confirmation. The
  local probe declared client `elicitation` support, but no tool call was run, so no Codex
  `elicitation/create` behavior is proven.

## Example MCP messages

Bounded initialize request used for local discovery:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-11-25",
    "capabilities": {
      "elicitation": {},
      "tasks": {}
    },
    "clientInfo": {
      "name": "workflow-kit-research",
      "title": "workflow-kit research probe",
      "version": "0.0.0"
    }
  }
}
```

Abbreviated local initialize response:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-11-25",
    "capabilities": {
      "tools": {
        "listChanged": true
      }
    },
    "serverInfo": {
      "name": "codex-mcp-server",
      "title": "Codex",
      "version": "0.141.0"
    }
  }
}
```

Abbreviated `tools/list` result:

```json
{
  "tools": [
    {
      "name": "codex",
      "description": "Run a Codex session. Accepts configuration parameters matching the Codex Config struct.",
      "inputSchema": {
        "required": ["prompt"],
        "properties": {
          "prompt": { "type": "string" },
          "cwd": { "type": "string" },
          "model": { "type": "string" },
          "sandbox": { "enum": ["read-only", "workspace-write", "danger-full-access"] },
          "approval-policy": { "enum": ["untrusted", "on-failure", "on-request", "never"] },
          "config": { "type": "object", "additionalProperties": true }
        }
      },
      "outputSchema": {
        "required": ["threadId", "content"]
      }
    },
    {
      "name": "codex-reply",
      "description": "Continue a Codex conversation by providing the thread id and prompt.",
      "inputSchema": {
        "required": ["prompt"],
        "properties": {
          "prompt": { "type": "string" },
          "threadId": { "type": "string" },
          "conversationId": { "type": "string" }
        }
      },
      "outputSchema": {
        "required": ["threadId", "content"]
      }
    }
  ]
}
```

Potential elicitation response shape to test in a future live probe:

```json
{
  "jsonrpc": "2.0",
  "id": "request-id-from-server",
  "result": {
    "action": "decline"
  }
}
```

## Capability levels by functional area

| Functional area | Level | Rationale |
|---|---:|---|
| Submit and final result | L0 | Tool schemas prove start/continue and final `threadId`/`content` result shape. |
| Live observation | L0 | No stream, snapshot, transcript, cursor, or polling surface is advertised. |
| Request surfacing | L2 unproven | MCP elicitation exists in the protocol and Codex manual references approval prompt params, but no live request was observed. |
| Request answering | L3 unproven | MCP elicitation answer shapes exist, but no Codex request answer delivery was probed. |
| Protocol control | L0, L4 unproven | MCP cancellation exists, but Codex turn interruption semantics are unproven and no Codex-native control tool is advertised. |
| Reconnect/resume durability | L0 | `codex-reply` is continuation by id; active observer reconnect and pending request durability are absent/unproven. |
| Structured tool evidence | L0 | No command/cwd/status/exit-code/output-ref activity is surfaced by `codex mcp-server`. |
| Data/artifact handling | L0 | Wrapper can retain request/response evidence; provider does not advertise artifact refs or redaction. |
| Capability discovery/conformance | L0 | Initialize and tool-list probes are repeatable but prove only shape. |

## Brief contrast with app-server

The official Codex manual describes `codex app-server` as the richer JSON-RPC surface used by rich
clients. It has thread and turn APIs, notifications such as item start/completion and agent-message
deltas, `turn/interrupt`, `thread/resume`, and generated per-version schemas. That contrast matters:
features that provider-neutral Agent Execution wants, such as streamed item events, turn status, typed
approvals, and interrupt, are documented on app-server rather than on `codex mcp-server`. This report
does not evaluate app-server capability claims; it uses the contrast only to avoid attributing
app-server capabilities to MCP server.

## Required probes before stronger claims

1. **L0 live smoke:** call `codex` with a harmless, non-mutating prompt in a disposable worktree and
   prove final result, `threadId`, requested config, terminal error behavior, and wrapper evidence
   capture.
2. **Continuation smoke:** call `codex-reply` against the returned `threadId` and prove whether the
   same conversation is continued after the initial tool call completes.
3. **Progress probe:** call `codex` with `_meta.progressToken` and record whether
   `notifications/progress`, logging, or any Codex-specific notifications arrive.
4. **Request-surfacing probe:** force each safe request type under restrictive config: command approval,
   patch/file approval, permission request, MCP elicitation, and user input if available. Capture
   provider request ids and params.
5. **Request-answer probe:** answer each surfaced request with accept/decline/cancel variants and prove
   provider acceptance, final behavior, and error behavior.
6. **Request durability probe:** park a pending request, disconnect the MCP client, reconnect or restart,
   then test whether the pending request can still be answered or must be parked/relaunched.
7. **Cancellation probe:** send `notifications/cancelled` for an in-flight `tools/call` and independently
   classify Codex terminal behavior, pending process behavior, and whether a final response still
   arrives.
8. **Reconnect probe:** start a long-running safe request, disconnect the observer, and determine whether
   a new MCP client can observe or only continue later by `threadId`.
9. **Structured tool evidence probe:** run a safe command-producing task and determine whether the MCP
   surface emits command, cwd, status, exit code, output, or only final prose.
10. **Parentage probe:** when spawned through Execution Host, prove whether worker command processes are
    within the host-owned containment scope. Until then, process-control and kill-dependent recovery stay
    outside the Codex MCP provider claim.
11. **Data handling probe:** seed a harmless sentinel that looks secret-like and verify what appears in
    final content, protocol logs, wrapper artifacts, and redaction outputs.
12. **Negative conformance probes:** unsupported methods (`resources/list`, `prompts/list`, control-like
    methods), invalid tool inputs, missing thread id for `codex-reply`, and timeout behavior.

## References

- OpenAI Codex manual, fetched 2026-06-21 with the `openai-docs` helper:
  `/var/folders/h_/mbzpc88j3w18hmcdd0j5x53h0000gn/T/openai-docs-cache/codex-manual.md`.
  Relevant sections: CLI command reference lines 4200-4248; MCP configuration lines 7984-8157;
  app-server contrast lines 8450-8614; Codex MCP server guide lines 9313-9370.
- Official MCP specification:
  [Lifecycle 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle),
  [Schema 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/schema),
  and [Transports draft](https://modelcontextprotocol.io/specification/draft/basic/transports).
- Local CLI evidence captured in this run: `codex --version`, `codex mcp-server --help`, bounded
  `initialize` probe, bounded `tools/list` probe.
- Agent provider requirements and design corpus:
  [`agent-provider-requirements.md`](../agent-provider-requirements.md),
  [`README.md`](../../design/30-domain-reference/providers/agent-execution/README.md),
  [`contracts-and-conformance.md`](../../design/30-domain-reference/providers/agent-execution/contracts-and-conformance.md),
  [`capabilities-and-conformance.md`](../../design/30-domain-reference/providers/agent-execution/capabilities-and-conformance.md),
  and [`codex-driver.md`](../../design/30-domain-reference/providers/agent-execution/codex-driver.md).

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [implementation contract](../README.md) · **← Prev:** [Codex MCP Agent provider research report](./codex-mcp-agent-provider-report.md) · **Next →:** [Engineering Policy Index](../../engineering/README.md)

<!-- /DOCS-NAV -->
