---
title: "Agent Execution - Codex driver mapping"
status: draft
last-reviewed: "2026-06-18"
---

# Codex driver mapping

This file defines the Codex driver obligations for the Agent contract. It uses only facts captured
under `../evidence/` and treats unstable or unprobed behavior as unavailable.

## Versioned evidence

Captured on 2026-06-18 for `codex-cli 0.141.0`:

- `../evidence/2026-06-18-probes/codex-version.txt`
- `../evidence/2026-06-18-probes/codex-help.txt`
- `../evidence/2026-06-18-probes/codex-mcp-server-help.txt`
- `../evidence/2026-06-18-probes/codex-app-server-help.txt`
- `../evidence/2026-06-18-probes/codex-mcp-server-line-json-probe.json`
- `../evidence/2026-06-18-codex-0.141.0-app-server-schema/`

The CLI help proves `mcp-server` and experimental `app-server` surfaces exist. The MCP line-json
probe proves `codex mcp-server` initializes as `codex-mcp-server` version `0.141.0` and exposes
`codex` plus `codex-reply` tools. The app-server generated JSON schema proves method and payload
shapes, including `thread/start`, `thread/resume`, `turn/interrupt`, typed approval requests, MCP
elicitation requests, command execution items with `exitCode`, process exit notifications, and
Guardian review notifications. It does not prove live delivery, persistence, or parentage.

## Phase 0: mcp-server

Phase 0 runs `codex mcp-server` as the provider process spawned by the Execution Host. The observed
MCP server uses newline-delimited JSON-RPC in the local probe. It exposes:

- `codex`: starts a Codex session and returns `threadId` plus final `content`.
- `codex-reply`: continues a session using `threadId` or legacy `conversationId`.

Mapping:

- `codex` result with `threadId` becomes `linked(providerSessionId=threadId)` only after a real
  start probe confirms the session belongs to the host-owned worker process.
- `codex-reply` can be used for owned-session continuation only after `canResumeOwned` is proven by
  a real start/resume smoke probe.
- MCP `elicitation/create` maps to neutral `mcp-elicitation` approval requests with answer actions
  `accept`, `decline`, and `cancel`. Current evidence includes the app-server wrapper schema
  `mcpServer/elicitation/request`, but no live Phase 0 approval relay probe. Therefore
  `canRelayApproval` and `canPersistApprovalAnswerChannel` remain negative for Phase 0 until a
  Codex MCP session is forced to emit and accept an elicitation answer.

Phase 0 is suitable only for manual, supervised runs whose required capabilities are positively
attested for the exact version. It is not the default for autonomous approval relay.

## Phase 1: app-server

Phase 1 uses `codex app-server --stdio` or an equivalent app-server endpoint spawned by the
Execution Host. App-server is experimental in `codex --help`; the driver must require a per-version
schema probe and a live smoke probe before any Phase 1 capability is positive.

Schema-positive mappings:

- `thread/start` starts or creates a thread.
- `thread/resume` resumes by `threadId`; path/history variants are marked unstable in the schema and
  are not used for the v1 contract.
- `turn/start` starts a turn; `turn/steer` can add steering; `turn/interrupt` interrupts a running
  turn by `threadId` and `turnId`.
- `item/commandExecution/requestApproval`, `item/fileChange/requestApproval`, and
  `item/permissions/requestApproval` are typed approval request methods.
- `mcpServer/elicitation/request` and `item/tool/requestUserInput` are structured user-input
  request methods.
- `item/completed` and `turn/completed` include command execution thread items with `command`,
  `cwd`, `status`, `source`, `exitCode`, and `aggregatedOutput`.

Phase 1 must fail closed unless live probes also prove:

- app-server events for the running thread are received in order;
- approval request ids can be answered on the same connection;
- a pending approval can survive park/resume, or is explicitly live-only;
- command execution items correspond to processes in the Execution Host's owned containment scope;
- command output is redacted and persisted as an `outputRef`.

## Approval decision mapping

The Agent contract receives a recorded `ScopedGrant` from Approval & Escalation and maps it to the
narrowest provider response available.

| Neutral grant | App-server typed response | Legacy / MCP response | Notes |
|---|---|---|---|
| `command-once` | `decision: "accept"` | `decision: "approved"` | One provider request only. |
| `command-session` | `decision: "acceptForSession"` | `decision: "approved_for_session"` | Requires recorded session-scoped grant. |
| `command-policy-amendment` | `{acceptWithExecpolicyAmendment:{...}}` | `{approved_execpolicy_amendment:{...}}` | Driver-local amendment only; does not write kit policy. |
| `network-permission` allow/deny | `{applyNetworkPolicyAmendment:{network_policy_amendment:{action,host}}}` | `{network_policy_amendment:{...}}` | Does not issue credentials; fnd-04 egress rules still apply. |
| `file-change-once` | file decision `"accept"` | patch decision `"approved"` | File paths must match the request. |
| `file-change-session` | file decision `"acceptForSession"` | patch decision `"approved_for_session"` | Requires recorded session grant. |
| `mcp-elicitation-content` | elicitation `action: "accept"` + content | same action family | Content is recorded input, then relayed. |
| `tool-user-input-content` | `answers` object | not Phase 0 | Experimental; schema-only until live-probed. |
| `deny-continue` | `"decline"` | `"denied"` or elicitation `"decline"` | Worker may continue without the denied action. |
| `deny-interrupt` | `"cancel"` + optional `turn/interrupt` | `"abort"` or elicitation `"cancel"` | Used when policy requires stopping the current turn. |
| `deny-park` | no provider grant; park before answer or interrupt | `timed_out` is treated as no answer | The Control plane stores pending state and notifies the Operator. |

`item/permissions/requestApproval` returns a `GrantedPermissionProfile` with `fileSystem`, `network`,
`scope: "turn" | "session"`, and optional `strictAutoReview`. There is no explicit denial response
in the captured schema. The driver may only answer a permission request when the neutral grant maps
to a strictly bounded profile. If the decision is deny and a live probe has not proven that an empty
profile means denial, the driver must park or interrupt rather than return a broad profile.

Answer-channel persistence is not inferred from JSON-RPC request ids. A channel is persistent only
when a probe proves the provider can rehydrate the pending request after disconnect/resume and accept
the answer. `thread/increment_elicitation` and `thread/decrement_elicitation` can pause timeout
accounting, but they are not proof that the original answer channel persists.

## Tool exit capture

Codex command execution remains a worker action. The Agent driver only observes provider events:

1. Normalize a completed command item with `source: "agent"`, `command`, `cwd`, `status`, and
   non-null `exitCode`.
2. Send `aggregatedOutput` or stream fragments to `AgentOutputSink.putToolOutput` with the redaction
   set id.
3. Emit `ToolObserved{command, exitCode, outputRef}` with the returned digest and `outputRef`.
4. If `exitCode` is null, output capture is missing, or redaction fails, emit a degraded event and no
   `ToolObserved`.

`command/exec` and `process/spawn` app-server APIs expose exit-code-bearing process results, but
runner-owned verify must still use Execution Host `runCommand`. The Agent driver must not call
app-server process APIs to perform runner verification.

## Guardian decision

Guardian is integrated as observed evidence, not as an approval authority in v1. The generated schema
marks `GuardianApprovalReview` and related risk/user-authorization fields as unstable. The driver may
emit `guardian-review` events containing action type, target id, status, risk level, and rationale
refs, but Capability & Safety must treat them as advisory unless `emitsGuardianReview` is freshly
attested against a stable version.

The `thread/approve_guardian_denied_action` method exists in the generated schema. It accepts a
serialized Guardian assessment event and returns an empty response. Because the event shape is opaque
and the review payload is unstable, the driver must not use this method for automated bypass. A
future design can promote it only after a probe proves the event schema, target binding, audit
semantics, and failure behavior.

## Process parentage with prov-04

The default app-server launch shape for v1 is Execution Host spawning the provider process under
containment. A connection to a pre-existing daemon, remote-control daemon, or app-server proxy is
`observe-only` unless it can prove the worker thread and all worker command executions are inside the
host-owned process tree or an equivalent remote ownership proof.

`preservesHostProcessParentage` requires a joint prov-01/prov-04 probe:

- start the worker through Execution Host;
- trigger an Agent command;
- observe Codex command item `processId` or equivalent process evidence;
- prove that evidence belongs to the host-owned `containmentRef`;
- terminate through Execution Host and prove the command process is gone.

Until that probe is positive, Guardian process actions and command observations do not unlock
kill-dependent unattended run, auto-recovery, or liveness decisions.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Agent Execution](./README.md) · **← Prev:** [Agent Execution - capabilities and conformance](./capabilities-and-conformance.md) · **Next →:** [Agent Execution - mock driver](./mock-driver.md)

<!-- /DOCS-NAV -->
