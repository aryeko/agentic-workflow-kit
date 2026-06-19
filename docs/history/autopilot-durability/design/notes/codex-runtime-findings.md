---
title: Codex runtime findings — controllability & approval protocol
status: evidence
last-reviewed: 2026-06-18
part-of: autopilot-durability
supports: [00-overview.md, 01-execution-substrate-and-provisioning.md, 02-lifecycle-and-control-plane.md]
---

# Codex runtime findings — controllability & approval protocol

Committed evidence behind the control plane ([D2](../02-lifecycle-and-control-plane.md)) and the approval
relay ([D1](../01-execution-substrate-and-provisioning.md)). Two **read-only** investigations of the
installed Codex runtime on 2026-06-18 — no live session was started. Runtime: **codex-cli 0.139.0**
(`/opt/homebrew/bin/codex`). Findings are **version-sensitive** — re-verify per Codex upgrade (the incidents
ran 0.139.0 / 0.140.0-alpha). Path shorthand `…/` = `packages/orchestrator/src/`.

## A. Controllability — can the kit observe / interrupt / kill a live child?

Confirmed in current kit code (v0.7.0):

- Runtime-timeout paths only `reject()`; no `SIGTERM`/`SIGKILL`/`process.kill`
  (`…/runner/ChildSupervisor.ts:118-135`); `settleSupervisionLost` (`:376-390`) journals but never terminates.
- No `ChildProcess` handle is retained — the child is spawned via the MCP SDK `StdioClientTransport`, which
  owns the process privately (`…/drivers/codex-mcp/CodexMcpStoryRunner.ts:262-299`).
- Interrupt/reply spawn a **new** `codex mcp-server` that cannot reach the live session
  (`…/drivers/codex-mcp/control.ts:137-191`); the kit's own code already routes around the reply tool.

Controllability by runtime mode:

| Mode | Observe | Interrupt | Kill |
|---|---|---|---|
| `codex mcp-server` (today) | yes (notifications) | best-effort / unreliable | only via SDK `transport.close()` (SIGTERM→SIGKILL, ~4s) on the spawned process |
| `codex exec --json` | yes (JSONL) | no | yes — if the kit owns the pid |
| `codex app-server` (v2, stdio) | yes (typed) | protocol-native (verify verb per version) | yes (owned) + daemon `stop` |
| `codex resume <id>` | reconstruct-only | n/a | n/a (disk session, not a live process) |
| desktop app | no (from CLI) | no | **no — uncontrollable** |

The SDK transport exposes a pid; `close()` escalates stdin-end → SIGTERM → SIGKILL on the process it
spawned. So **kill is achievable today, but only for a process the kit owns.**

**Conclusion:** reliable kill is a property of **process ownership**, not of any Codex feature. Own the pid
and make the timeout paths terminate. Graceful interrupt is best-effort (or via the experimental
`app-server`). The `remote_control` feature flag is `removed` in 0.139.0 even though the
`app-server`/`remote-control` subcommands remain — treat the daemon path as experimental and version-pinned.

## B. Approval protocol — how does a child request approval, and how is it answered?

- Approvals are **server→client JSON-RPC requests** (they require a response), **not** notifications:
  - **v1** (`codex mcp-server`, today): an MCP **`elicitation/create`** request (fields `codex_command`,
    `codex_cwd`, `codex_reason`).
  - **v2** (`codex app-server`): typed `item/commandExecution/requestApproval` /
    `item/permissions/requestApproval` / `mcpServer/elicitation/request`, carrying
    `networkApprovalContext {host, protocol}`, `command`, `cwd`, `reason`.
- **The stall (root cause):** the kit registers only a `fallbackNotificationHandler` and advertises **no
  elicitation capability** (`…/drivers/codex-mcp/CodexMcpStoryRunner.ts`), so an approval request is
  **dropped → `callTool` hangs → `supervision_lost`**. Under the default `approvalPolicy: never`
  (`…/config/schema.ts:138`) **no request is raised at all** → the network op is silently sandbox-denied.
- **Granularity (key):** a grant can be **per-command** (`accept`/`approved` — only that exec runs escalated;
  the rest of the session stays `workspace-write`/no-network), **per-host**
  (`network_policy_amendment {host, action: "allow"}`, e.g. `registry.npmjs.org`), or **session**
  (`approved_for_session` / `PermissionGrantScope: session`). Network is **not** all-or-nothing.
- **Decision values:** v1 `ReviewDecision` = `approved | approved_for_session | network_policy_amendment |
  denied | timed_out | abort`; v2 `CommandExecutionApprovalDecision` = `accept | acceptForSession |
  applyNetworkPolicyAmendment | decline | cancel`.
- **`codex exec` cannot answer approvals** — `--json` is telemetry with no inbound channel. The runtime that
  is **both owned/killable and relay-capable is `codex app-server` (v2).**

**Conclusion:** the relay must (a) **handle the approval request** (register an `elicitation/create` handler
+ capability in v1, or adopt v2 `app-server`), (b) classify risk + match policy, (c) return a **scoped**
decision (prefer per-command / per-host), (d) **time-box** its own decision. Feasible in v1 (with the
handler), first-class in v2, impossible in `codex exec`.

## Method & caveats

Read-only: `--help`, `codex app-server generate-ts` / `generate-json-schema`, binary string inspection, MCP
SDK source, and kit source. No Codex session was started. All `app-server` / `remote-control` / `exec-server`
surfaces are experimental and version-churny — pin the Codex version and re-probe the schema on upgrade.
