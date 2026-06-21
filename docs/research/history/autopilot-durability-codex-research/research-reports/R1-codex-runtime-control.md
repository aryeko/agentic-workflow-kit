# R1 - Codex Runtime Control

## Executive Recommendation

Adopt a hybrid driver path: ship a safe `codex mcp-server` v1 driver first, but only after the kit owns the
stdio child process and implements MCP elicitation; target `codex app-server` as the higher-fidelity v2
driver behind version/capability probes. Confidence: medium-high for the control model, medium for
app-server maturity because the surface is documented but still marked experimental in the local CLI.

## Sources Checked

- `docs/autopilot-durability-codex-research/README.md`, checked 2026-06-18; charter and required report
  format.
- `docs/autopilot-durability/README.md`, checked 2026-06-18; incident context and design constraints.
- `docs/autopilot-durability/postmortems/2026-06-18-autopilot-unified-issues.md`, checked 2026-06-18;
  failure themes A-K, especially B/D/E/F.
- `docs/autopilot-durability/design/00-overview.md` and `design/02-lifecycle-and-control-plane.md`,
  checked 2026-06-18; current draft design to validate, not authority for external Codex capabilities.
- `docs/autopilot-durability/design/notes/codex-runtime-findings.md`, checked 2026-06-18; prior local
  read-only findings for Codex 0.139.0.
- OpenAI Codex manual, fetched 2026-06-18 with
  `node ~/.codex/skills/.system/openai-docs/scripts/fetch-codex-manual.mjs`; primary Codex docs for
  app-server, non-interactive mode, approvals, sandboxing, MCP, SDK, auth, and remote connections.
- OpenAI Codex app-server docs/source README, <https://github.com/openai/codex/tree/main/codex-rs/app-server>,
  checked 2026-06-18; primary app-server protocol/lifecycle reference.
- OpenAI Codex approvals/security docs, <https://developers.openai.com/codex/agent-approvals-security>,
  checked 2026-06-18; primary approval, sandbox, and network policy reference.
- MCP 2025-06-18 elicitation spec, <https://modelcontextprotocol.io/specification/2025-06-18/client/elicitation>,
  checked 2026-06-18; primary source for `elicitation/create`.
- MCP 2025-06-18 transports spec, <https://modelcontextprotocol.io/specification/2025-06-18/basic/transports>,
  checked 2026-06-18; stdio and bidirectional transport semantics.
- Local `codex-cli 0.139.0` (`/opt/homebrew/bin/codex`) help output, checked 2026-06-18; installed command
  surface for `mcp-server`, `exec`, `resume`, `app-server`, `remote-control`, `features`, and `doctor`.
- Local `codex app-server generate-ts --experimental`, checked 2026-06-18; version-specific protocol
  schema for this installed CLI. Key generated types inspected: `ClientRequest`, `ServerRequest`,
  `TurnInterruptParams`, `CommandExecutionRequestApprovalParams`,
  `PermissionsRequestApprovalParams`, `ThreadStartParams`, `ThreadResumeParams`, and `Thread`.
- Local `codex features list`, checked 2026-06-18; installed feature flags. `tool_call_mcp_elicitation`
  is stable/enabled; `remote_control` is removed/false; `tui_app_server` is removed/true.
- Local `codex doctor --json`, checked 2026-06-18; installation/auth/state/app-server status. App-server
  daemon was not running; local auth and state paths were inspectable.
- `@modelcontextprotocol/sdk@1.29.0` local installed source under `node_modules/.pnpm/...`, checked
  2026-06-18; `StdioClientTransport` exposes `pid` and `close()` ends stdin then sends SIGTERM/SIGKILL
  to the spawned process.
- Workflow-kit source under `packages/orchestrator/src/drivers/codex-mcp/` and `runner/ChildSupervisor.ts`,
  checked 2026-06-18; current MCP driver behavior, event parsing, resume, and control implementation.

## Findings

Facts from primary/current sources:

- `codex mcp-server` is a documented local stdio MCP server command in the installed CLI. MCP stdio means
  the client launches the server as a subprocess and exchanges newline-delimited JSON-RPC over stdin/stdout.
- MCP elicitation is a client capability. The spec requires clients that support it to declare the
  `elicitation` capability, and servers send `elicitation/create` requests that require a response with
  `accept`, `decline`, or `cancel`.
- Codex approvals are not just prose prompts. OpenAI docs state Codex asks before actions such as network
  access or leaving the sandbox under interactive approval policies; app/MCP side effects can also elicit
  approval.
- The local MCP SDK transport exposes the spawned process `pid`. Its `close()` sequence ends stdin, waits,
  sends SIGTERM, waits, then sends SIGKILL to that process. This is immediate-process kill, not a proven
  process-group/descendant cleanup guarantee.
- Workflow-kit's current Codex MCP runner starts `codex mcp-server` through `StdioClientTransport`, listens
  for `codex/event` through `fallbackNotificationHandler`, and also uses MCP progress callbacks. It does
  not visibly register an `elicitation/create` request handler or advertise elicitation in the shown driver
  construction.
- Workflow-kit's current `workflow_child_interrupt`/`codex_interrupt` path starts a new `codex mcp-server`
  process and looks for control tools there. That is not the same transport/process as the live child call,
  so it should not be treated as a supported live interrupt channel.
- `codex exec --json` is documented for non-interactive automation and emits JSONL events such as
  `thread.started`, `turn.started`, `item.*`, and terminal turn events. The docs describe output streaming,
  not an inbound approval/control channel.
- `codex exec resume <SESSION_ID>` and top-level `codex resume <SESSION_ID>` are installed CLI surfaces.
  Docs describe non-interactive resume for continuing a previous run, and local help shows resume can target
  a UUID/session name and set sandbox/approval flags.
- `codex app-server` is documented as a JSON-RPC integration surface for authentication, conversation
  history, approvals, and streamed agent events. Docs say to use `thread/start` or `thread/resume`, then
  `turn/start`, stream notifications, and finish normally or after `turn/interrupt`.
- The local app-server generated protocol for Codex 0.139.0 includes client requests
  `thread/start`, `thread/resume`, `turn/start`, `turn/steer`, and `turn/interrupt`.
  `TurnInterruptParams` requires `{threadId, turnId}`.
- The same generated protocol includes server-to-client approval requests:
  `item/commandExecution/requestApproval`, `item/permissions/requestApproval`,
  `item/fileChange/requestApproval`, and `mcpServer/elicitation/request`.
- `CommandExecutionRequestApprovalParams` includes `threadId`, `turnId`, `itemId`, `startedAtMs`,
  optional `approvalId`, `reason`, `networkApprovalContext`, `command`, `cwd`, additional permissions, and
  available decisions. Its response is a `CommandExecutionApprovalDecision`.
- `CommandExecutionApprovalDecision` includes `accept`, `acceptForSession`,
  `acceptWithExecpolicyAmendment`, `applyNetworkPolicyAmendment`, `decline`, and `cancel`.
- `PermissionsRequestApprovalResponse` supports scoped grants with `PermissionGrantScope = "turn" |
  "session"`.
- App-server thread records expose both `id` and `sessionId`; `thread.path` is marked unstable and only
  populated on some read/resume/fork paths. `thread/loaded/list` reports thread ids loaded in memory.
- App-server also exposes lower-level `command/exec/terminate` and `process/kill`, but those terminate
  app-server-spawned command/process sessions, not necessarily the Codex agent turn itself. Agent-turn
  cancellation is `turn/interrupt`.
- Local CLI marks `app-server`, `remote-control`, and `exec-server` commands experimental. Local
  `features list` reports `remote_control` as removed/false, even though `remote-control` commands remain.
- OpenAI remote connections docs describe a user-facing Codex App host flow where a phone/other app can
  send prompts, approvals, and follow-ups to connected hosts. The setup starts from the Codex App and uses
  host projects/threads/credentials. This is not documented as a stable kit-owned local orchestration API.

Interpretation and inferences:

- A live child can be interrupted through a supported API only on app-server-style surfaces where the kit
  owns or is connected to the active app-server thread/turn and has `threadId` + `turnId`; the supported
  method is `turn/interrupt`.
- A live child cannot be reliably interrupted through the current workflow-kit MCP control tools, because
  they spawn a separate MCP server and do not hold the live request's transport.
- Approval requests can be relayed without hanging the child if the selected surface has a real
  request/response channel and the kit answers it. App-server has explicit approval server requests.
  MCP v1 can do this through `elicitation/create` if the client declares/handles elicitation. `codex exec`
  cannot do this because `--json` is outbound telemetry only.
- `codex resume` can be kit-owned only as a new kit-spawned process/turn. It cannot safely "take ownership"
  of a human-started TUI/Desktop/App process that is already running. Prefer app-server `thread/resume` or
  `codex exec resume` for automation over top-level interactive `codex resume`.
- Observe-only should include Codex Desktop/App sessions not spawned by the kit, human-run `codex resume`
  recoveries, historical session logs without a live process handle, and any session id discovered without
  the live transport/process/turn control identifiers.

## Options

### Option A - Keep `codex mcp-server` v1, fix ownership and elicitation

What it enables:

- Minimal disruption to the current workflow-kit driver.
- MCP stdio process can be kit-spawned and at least immediate-process killable through the transport/pid.
- Approval relay is feasible if the client advertises MCP elicitation and registers `elicitation/create`
  handling.
- Existing `codex/event` parsing can continue to provide session id/log-path/progress hints.

What it cannot do:

- It does not provide a documented Codex live `turn/interrupt` API on the existing MCP tool call.
- Transport `close()` kills only the immediate MCP server process unless the kit adds process-group/session
  ownership and descendant reaping.
- It cannot use a separately spawned MCP server for live reply/interrupt and call that supported control.

### Option B - Use `codex app-server` as the primary driver

What it enables:

- First-class thread/turn lifecycle: `thread/start`, `thread/resume`, `turn/start`, `turn/steer`,
  `turn/interrupt`.
- Typed streamed events for turn/item lifecycle, diffs, command output, tool progress, and token usage.
- Typed approval requests and scoped approval decisions, including command, permissions, file-change, and
  MCP elicitation flows.
- A clearer mapping for session IDs, loaded threads, and active turn control.

What it cannot do:

- The local CLI marks app-server as experimental; protocol fields are version-specific and must be
  generated/probed per installed Codex version.
- `turn/interrupt` is graceful cancellation, not a kill guarantee. The kit must still own and terminate the
  app-server process/process group when deadlines or abort paths require hard stop.
- Remote-control daemon commands are not a stable requirement here; local feature flags currently mark
  `remote_control` removed/false.

### Option C - Use `codex exec --json` / `codex exec resume` as the primary driver

What it enables:

- Simple kit-owned subprocess model with JSONL telemetry and easy process termination.
- Documented automation/CI usage, structured final output, session IDs, and resume for multi-stage flows.
- Good fallback for jobs where approvals are disabled by policy (`-a never`) and permissions are
  pre-provisioned.

What it cannot do:

- No inbound approval response channel is documented for `--json`; approval prompts cannot be relayed
  durably.
- No protocol-native live `turn/interrupt`; hard stop is OS process termination.
- Less suitable for unattended autopilot if escalations are expected.

### Option D - Treat Codex App/Desktop/remote connections as the child runtime

What it enables:

- Human-friendly remote approvals, follow-ups, and review via the Codex App ecosystem.
- Good manual recovery and operator inspection.

What it cannot do:

- Not a kit-owned local process. The kit cannot assume hard kill, process-tree cleanup, or durable
  API-level control over an already-running desktop/app session.
- Not appropriate as the autonomous autopilot execution substrate. Treat as observe-only/manual recovery.

## Recommendation

Use a phased hybrid:

1. Phase 0, ship-safe: keep `codex mcp-server` v1 but change the driver contract around it. The kit must
   retain the live transport/process handle, expose the transport pid, own the process group, register and
   advertise MCP elicitation, and report capabilities as `approval: mcp-elicitation`, `interrupt:
   unsupported-or-best-effort`, `kill: owned-process-group`.
2. Phase 1, target driver: add `codex app-server` as a version-pinned/probed driver. Use `thread/start` or
   `thread/resume`, `turn/start`, streamed notifications, server approval requests, and `turn/interrupt`.
   Still retain OS process ownership and hard kill as the safety floor.
3. Keep `codex exec --json` as a degraded automation driver only for pre-provisioned, no-approval runs.
4. Mark Desktop/App/human-resumed sessions observe-only unless the kit itself spawned the active process or
   controls the app-server connection for that thread/turn.

Reasoning:

- Autopilot needs two different guarantees: protocol control and OS termination. App-server is the best
  current protocol fit, but process ownership is still required for guaranteed stop. MCP v1 is enough to
  remove the current approval hang if elicitation is implemented, and it is closer to the existing code.
- The current MCP "control" tools must be demoted: a new helper process is not a supported control channel
  to a live child.
- `codex resume` is useful as a continuation primitive, but it must be kit-spawned to be kit-owned. A
  session ID alone is not ownership.

## Tradeoffs and Risks

- App-server maturity: it is documented and source-backed, but the installed CLI labels it experimental and
  generated schema is version-specific. This adds compatibility work and requires startup probes.
- MCP v1 control limits: approval relay is standard via elicitation, but graceful live interrupt is not.
  Runs must surface `interrupt: unsupported` honestly and rely on hard process-group termination for safety.
- Process-tree risk: SDK `close()` kills the immediate child process; it does not prove descendants are
  gone. Workflow-kit needs process-group/session ownership and descendant validation, which belongs with R2.
- Approval UX risk: if policy/human decisions are slow, the child remains parked. The kit must persist
  pending approvals and time out with a clear denied/cancelled decision instead of leaving JSON-RPC
  requests unresolved.
- Version skew: `codex features list`, app-server generated schema, and `codex --version` must be captured
  in run artifacts. Capabilities cannot be assumed across CLI upgrades.
- Security risk: docs support scoped network policy and granular approval modes, but broad `danger-full-access`
  or session-wide grants would recreate the unsafe bypass. Prefer per-command, per-host, or turn-scoped
  grants.
- Logs/state risk: app-server `thread.path` is marked unstable in the generated schema. Treat paths/logs as
  evidence artifacts, not control handles.

## Fallback and Degraded Modes

- No app-server or app-server probe fails: use MCP v1 with elicitation and owned process kill; advertise
  degraded interrupt.
- MCP elicitation unavailable or not accepted by the Codex MCP server: fail closed before launching an
  approval-requiring child; only allow runs with pre-provisioned permissions and `approvalPolicy: never`.
- Approval request received but no policy/human answer before timeout: return `decline`/`cancel`/`timed_out`
  according to surface semantics, persist the decision, stop the story as blocked, and terminate or park
  according to configured recovery policy.
- Session id exists but no owned pid/live transport exists: observe-only. The kit may read logs/events and
  tell an operator how to resume, but it must not claim interrupt/kill or enable auto-merge.
- `codex exec --json` selected: require preflight that no approval relay is needed. On timeout/abort, kill
  the process group and mark approval/control as unavailable.
- Remote/Desktop/App session: observe-only/manual recovery. Never use it to satisfy `child killable` or
  `auto-recover` capability gates.

## Validation Spikes

- MCP elicitation spike: run `codex mcp-server` through `@modelcontextprotocol/sdk@1.29.0`, register
  `elicitation/create`, advertise `elicitation`, trigger a network/sandbox approval under `on-request`, and
  prove the child resumes after a scoped response.
- MCP hang regression: run the same approval-triggering task without the handler and assert it reaches the
  known hanging/supervision-lost path, to lock the root cause.
- App-server control spike: start `codex app-server --listen stdio://`, initialize with experimental API,
  start a thread/turn, capture `threadId` and `turnId`, call `turn/interrupt`, and assert a
  `turn/completed` status of interrupted.
- App-server approval spike: trigger command/network approval, answer
  `item/commandExecution/requestApproval` with `accept`, `applyNetworkPolicyAmendment`, `decline`, and
  `cancel` in separate runs; verify command outcome and `serverRequest/resolved` behavior.
- Resume ownership spike: compare kit-spawned `codex exec resume <id> --json` or app-server
  `thread/resume` with a human-run `codex resume`; record which gives the kit a pid/live connection and
  which is observe-only.
- Process ownership spike: spawn the child as a process group/session leader and run a command that creates
  descendants; on timeout, prove no descendant survives. Do not rely on SDK `close()` alone.
- Capability-probe spike: at driver startup, record `codex --version`, `codex features list`, `codex
  app-server generate-ts --experimental` method presence, and MCP elicitation support; fail closed when
  required capabilities are absent.

## Open Questions

- Should Phase 1 use app-server directly or through the published Codex SDK once the SDK exposes enough
  approval/interrupt hooks for workflow-kit's needs?
- What is the minimum supported Codex CLI version for the vNext driver contract?
- Should the kit support both app-server and MCP indefinitely, or migrate MCP v1 to maintenance once
  app-server proves stable?
- What exact approval timeout semantics should map to `decline` vs `cancel` vs a Codex-specific timeout
  decision on each surface?
- How should workflow-kit persist app-server `threadId`, `sessionId`, `turnId`, and unstable `thread.path`
  without treating any unstable path as a control handle?
- Does `codex mcp-server` in current and target versions always map sandbox/network approvals to
  `elicitation/create`, or are there versions where approval is surfaced differently?

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../../README.md) · **← Prev:** [Observability and migration recommendations](../post-research-design-recommendations/06-observability-migration.md) · **Next →:** [R2 - Child Execution Ownership and Termination](./R2-process-ownership-termination.md)

<!-- /DOCS-NAV -->
