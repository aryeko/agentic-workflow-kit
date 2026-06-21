# R3 - Approval and Permission Relay

## Executive Recommendation

Build a workflow-kit-owned `ApprovalRelay` as a durable state machine, not as a long-lived interactive prompt:
catch protocol approval requests, normalize and persist them before deciding, answer immediately when policy
or bounded auto-review can decide, and otherwise close the live request cleanly, park the run in
`awaiting-approval`, then resume through a fresh owned turn with a scoped grant. Use `codex app-server`
typed approvals as the target protocol, ship MCP `elicitation/create` support as the Phase 0 bridge, and
treat wrapper/operator flows as degraded recovery paths rather than the primary relay. Confidence: medium-high.

## Sources Checked

- `docs/autopilot-durability-codex-research/README.md`, checked 2026-06-18. Charter, R3 question, and
  required report format.
- `docs/autopilot-durability/README.md`, checked 2026-06-18. Incident context and draft design goals.
- `docs/autopilot-durability/postmortems/2026-06-18-autopilot-unified-issues.md`, checked 2026-06-18.
  Theme B approval/escalation failure, Theme C override shadowing, Theme D uncontrollable child, and Theme G
  state divergence.
- `docs/autopilot-durability/design/00-overview.md`, checked 2026-06-18. Draft spine: bidirectional channel,
  capability gates, pending approval invariant, and event-sourced state.
- `docs/autopilot-durability/design/01-execution-substrate-and-provisioning.md`, checked 2026-06-18. Draft D1
  approval relay and park/resume model to validate.
- `docs/autopilot-durability/design/02-lifecycle-and-control-plane.md`, checked 2026-06-18. Draft D2
  process ownership and protocol channel constraints.
- `docs/autopilot-durability/design/notes/codex-runtime-findings.md`, checked 2026-06-18. Local Codex 0.139.0
  findings for approval request shapes and current kit gaps.
- `docs/autopilot-durability-codex-research/research-reports/R1-codex-runtime-control.md`, checked 2026-06-18. R1
  conclusion that MCP v1 plus elicitation can fix the current hang, app-server is the target typed surface,
  `codex exec --json` is telemetry-only for approvals, and Desktop/App/human sessions are observe-only.
- `docs/autopilot-durability-codex-research/research-reports/R2-process-ownership-termination.md`, checked
  2026-06-18. R2 process-group/session-tree ownership and terminal-path kill constraints.
- `docs/autopilot-durability-codex-research/research-reports/R5-event-sourced-run-state.md`, checked 2026-06-18. R5
  single-writer event store, fenced epochs, projections, and terminal invariants.
- OpenAI Codex manual, fetched 2026-06-18 with
  `node ~/.codex/skills/.system/openai-docs/scripts/fetch-codex-manual.mjs`; local cache reported current.
  Relevant pages: [Agent approvals & security](https://developers.openai.com/codex/agent-approvals-security),
  [Sandbox](https://developers.openai.com/codex/concepts/sandboxing),
  [Auto-review](https://developers.openai.com/codex/concepts/sandboxing/auto-review),
  [Permissions](https://developers.openai.com/codex/permissions),
  [Codex App Server](https://developers.openai.com/codex/app-server), and
  [Non-interactive mode](https://developers.openai.com/codex/noninteractive).
- OpenAI Developer Docs MCP fetches, checked 2026-06-18:
  [app-server approvals](https://developers.openai.com/codex/app-server#approvals),
  [command execution approvals](https://developers.openai.com/codex/app-server#command-execution-approvals),
  [agent approvals automatic review](https://developers.openai.com/codex/agent-approvals-security#automatic-approval-reviews),
  and [auto-review](https://developers.openai.com/codex/concepts/sandboxing/auto-review).
- Local Codex CLI, checked 2026-06-18: `codex-cli 0.139.0`; `codex app-server --help` marks app-server
  experimental; `codex features list` reports `tool_call_mcp_elicitation` stable/enabled,
  `guardian_approval` stable/enabled, `network_proxy` experimental/disabled, `remote_control` removed/false,
  and `tui_app_server` removed/true.
- MCP 2025-06-18 elicitation spec,
  <https://modelcontextprotocol.io/specification/2025-06-18/client/elicitation>, checked 2026-06-18.
  Defines client-declared elicitation capability and server-initiated `elicitation/create` requests.
- MCP 2025-06-18 transports spec,
  <https://modelcontextprotocol.io/specification/2025-06-18/basic/transports>, checked 2026-06-18. Provides
  bidirectional JSON-RPC transport context for stdio/streamable HTTP MCP.
- Temporal human-in-the-loop workflow guide,
  <https://docs.temporal.io/ai-cookbook/human-in-the-loop-python>, checked 2026-06-18. Durable workflow
  pattern for pausing on human decisions via persisted workflow state and signals.
- GitHub Actions environments and deployment protection rules,
  <https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments>,
  checked 2026-06-18. Standard CI approval/wait-timer pattern with explicit pending states.
- OpenAI Codex GitHub Action security guidance in the Codex manual, checked 2026-06-18. CI pattern that
  separates untrusted Codex execution from later privileged PR creation and recommends least privilege.

## Findings

Facts from primary/current sources:

- Codex approvals are a runtime boundary, not only prompt text. OpenAI docs distinguish sandbox mode, which
  technically constrains command execution, from approval policy, which determines when Codex pauses before
  crossing that boundary.
- `approval_policy = "never"` means Codex does not stop for approval prompts. OpenAI auto-review docs also
  state there is nothing to review under `never`. Therefore a workflow that needs runtime escalation cannot
  rely on `never` and still expect child approval requests.
- The lower-risk local automation posture in OpenAI docs is `workspace-write` with `on-request`, optionally
  with `approvals_reviewer = "user"` or `auto_review`; full access is `danger-full-access` with `never` and
  should be reserved for controlled environments.
- OpenAI app-server approvals are server-initiated JSON-RPC requests. The app-server docs say command and
  file changes may require approval; requests include `threadId` and `turnId`; the client responds with a
  decision; `serverRequest/resolved` confirms the pending request was answered or cleared; and the item
  completes as `completed`, `failed`, or `declined`.
- App-server command approval requests include `itemId`, `threadId`, `turnId`, optional `reason`, optional
  `command`, optional `cwd`, optional `proposedExecpolicyAmendment`, optional `networkApprovalContext`, and
  optional `availableDecisions`. When `networkApprovalContext` is present, OpenAI docs say clients should
  render it as a managed network prompt and should not rely on the command string as a meaningful preview.
- App-server supports scoped decision types such as `accept`, `acceptForSession`, `decline`, `cancel`, and
  exec-policy amendments. R1's local generated schema inspection also found network-policy amendment and
  permission-grant scope types for Codex 0.139.0.
- MCP elicitation is a client capability. The MCP spec says clients that support elicitation must declare
  the capability, and servers request user input with `elicitation/create`, receiving an `accept`,
  `decline`, or `cancel` action. The spec also warns clients to validate responses and to avoid using
  elicitation for sensitive information.
- Current workflow-kit code and runtime findings indicate the kit listens for Codex `codex/event`
  notifications but does not handle/advertise MCP elicitation in the Codex MCP runner. In the incidents, a
  child escalation request therefore had no live approver and the tool call hung into `supervision_lost`.
- R1 found `codex exec --json` emits outbound JSONL telemetry but has no documented inbound approval
  response channel. It is not a primary approval relay surface.
- R1 found `codex app-server` is the best current typed approval/control surface but is still experimental
  in the local CLI. It must be version-pinned and capability-probed.
- R2 found a parked or timed-out child must remain owned and killable by the runner. A design that waits
  indefinitely on a live approval request without bounded termination would violate the process-ownership
  safety floor.
- R5 found pending approval state must be authored in `events.ndjson`, fenced by writer epochs and projected
  into derived state. Snapshot files or in-memory variables cannot be the approval authority.
- Temporal's human-in-the-loop pattern stores workflow state durably and resumes via external signals; it
  does not depend on an open process prompt lasting for human latency. GitHub deployment environments use
  explicit pending/waiting states and protection rules before privileged deployment proceeds. These reinforce
  the same pattern: the approval is a durable state transition, not a socket lifetime.

Interpretation for workflow-kit:

- The hard boundary is between short-lived protocol decisions and long-lived human latency. Protocol-native
  approval requests are suitable for immediate policy decisions and fast user responses, but the kit should
  never require an MCP/app-server request to remain open for minutes or hours.
- `awaiting-approval` should be a first-class lifecycle state derived from the event log, with a pending
  request projection. The operator decision should be a command against that pending request, not an edit to
  `state.json`, `launch.json`, or a child prompt transcript.
- Approval grants must be scoped to the narrowest viable boundary: exact command, exact destination
  host/protocol/port, turn, or session. Broad `danger-full-access` should not be expressible as a normal
  relay grant.
- Denial is a control decision, not an ordinary command failure. The child must not be encouraged to retry
  the same risky action through indirect workarounds. Denied requests need a clear audit record and a circuit
  breaker for repeated denials.

## Options

### Option A - Protocol-native app-server approval as the primary driver

The runner uses `codex app-server` as the child driver. It handles
`item/commandExecution/requestApproval`, `item/fileChange/requestApproval`,
`item/permissions/requestApproval`, and `mcpServer/elicitation/request` on the same live JSON-RPC transport
that carries thread/turn progress and control.

Enables:

- Typed request fields with thread, turn, and item identity.
- Explicit network approval context with host/protocol and grouped prompts.
- Scoped decisions, including one-shot, session, exec-policy amendment, and network-policy amendment paths
  where the local schema supports them.
- Direct integration with the app-server progress/control model from R1.

Cannot do:

- It cannot remove the need for OS process ownership and hard termination; `turn/interrupt` is graceful
  control, not a kill guarantee.
- It cannot be assumed stable across Codex versions. The local CLI marks app-server experimental and
  generated schema is version-specific.
- It should not be the only vNext path until capability probes prove the required approval decisions exist.

### Option B - MCP elicitation bridge for current `codex mcp-server`

The existing MCP driver advertises the MCP `elicitation` client capability, registers an
`elicitation/create` request handler on the live transport, normalizes Codex approval fields into the
workflow-kit approval envelope, and responds with accepted/declined/cancelled decisions.

Enables:

- Minimal disruption to the current driver.
- Fixes the current class of hangs where approval requests are dropped.
- Uses the standard MCP request/response mechanism and the already installed stable
  `tool_call_mcp_elicitation` feature.
- Provides a Phase 0 path while app-server remains experimental.

Cannot do:

- It has less typed context than app-server and may need Codex-specific field extraction such as
  `codex_command`, `codex_cwd`, and `codex_reason`.
- The MCP response vocabulary is narrower than app-server's native approval types. Some scoped grants may
  require Codex-specific response payloads or may be unavailable in some versions.
- It does not provide a protocol-native live interrupt path. R2 process termination still carries the safety
  floor.

### Option C - Wrapper-level approval around `codex exec` or process stderr/stdout

The kit launches a child with precomputed permissions, watches output for phrases like "approval required",
or kills/relaunches with broader flags after an external approval.

Enables:

- Works with simple CLI automation surfaces.
- Keeps process ownership straightforward.
- Can support preflight checks before launch, such as "this story will need package registry network".

Cannot do:

- It cannot catch real runtime approval requests at the protocol boundary. `codex exec --json` has no
  documented inbound approval response channel.
- It is brittle because it depends on output text, terminal timing, or child self-report.
- It cannot safely resume a specific in-flight command. At best it can stop, persist, and relaunch with
  changed configuration.
- It should not unlock unattended runs, auto-merge, or approval auto-grants.

### Option D - Operator-mediated/manual approval outside the runner

The human uses Codex Desktop/App/TUI, `codex resume`, shell commands, or manual artifact edits to approve,
deny, recover, or finish the work.

Enables:

- Human recovery remains possible when all protocol paths are unavailable.
- Works with existing Codex UI surfaces that are good at displaying prompts and diffs.
- Useful as a last-resort operational escape hatch.

Cannot do:

- It is not kit-owned. The runner cannot prove hard kill, session continuity, or exact scoped grant delivery.
- It recreates the incident pattern where useful work ships only through out-of-band recovery.
- It cannot satisfy autonomous capability gates unless the kit later observes and verifies the outcome
  independently.

## Recommendation

Adopt a host-neutral `ApprovalRelay` contract with app-server as the target implementation, MCP elicitation
as the Phase 0 implementation, and wrapper/operator paths explicitly degraded.

The relay should treat every request as this lifecycle:

1. **Capture.** The driver must handle every approval-capable protocol request on the live child transport.
   App-server handlers cover command, file-change, permissions, and MCP-tool approvals. MCP v1 handles
   `elicitation/create`. A driver that cannot capture approval requests must report
   `approvalRelay: unavailable` before launch.
2. **Normalize.** Convert protocol-specific payloads into:

   ```json
   {
     "requestId": "approval-...",
     "runId": "run-...",
     "storyId": "AWK123",
     "surface": "codex-app-server|codex-mcp",
     "protocolRequestId": "...",
     "threadId": "...",
     "turnId": "...",
     "itemId": "...",
     "kind": "network|exec|file-change|permissions|mcp-tool|unknown",
     "command": ["pnpm", "install", "--frozen-lockfile"],
     "cwd": "/abs/worktree",
     "reason": "...",
     "network": { "host": "registry.npmjs.org", "protocol": "https", "port": 443 },
     "requestedScopes": ["once", "host", "turn", "session"],
     "redactions": []
   }
   ```

   The normalized record must avoid secrets. Store command arguments only after configured redaction for
   tokens, env files, auth headers, and URLs with credentials.
3. **Persist before deciding.** Append `approval-requested` and, if not immediately resolved,
   `approval-pending` events before returning any decision. The pending projection is derived from R5's
   event log, not from the child process or a snapshot file.
4. **Classify.** Compute deterministic fields: `riskTier`, `matchedPolicyRule`, `scopeNeeded`,
   `expiryAt`, `dedupeKey`, and `decisionDeadlineAt`.
5. **Decide through a fixed ladder.**

   ```text
   forbidden policy match -> deny
   allowlist policy match -> grant by policy with narrow scope
   mode=auto and tier <= autoMaxRiskTier -> orchestrator/auto-review decision
   otherwise -> park for human
   ```

   High-risk categories should always require a human or deny: secret access, credential probing,
   broad egress, writes outside the worktree, destructive commands, persistent security weakening,
   unrestricted `danger-full-access`, Docker/socket access, and arbitrary lifecycle scripts unless a repo
   explicitly accepts that risk.
6. **Answer the live request only within a short protocol window.** If the decision is ready inside the
   window, answer the protocol request with the narrowest supported grant or denial. If not, answer with
   the least-surprising safe close for the surface: app-server `decline`/`cancel`, MCP `decline`/`cancel`,
   or Codex-specific `timed_out` where supported. Then park the run. Do not leave JSON-RPC unresolved.
7. **Park.** `awaiting-approval` means no further child side effects are allowed for that request. Depending
   on driver capability, the runner either keeps the owned child idle for a bounded period or terminates it
   through R2's process-group ladder after the clean protocol close. The event log records the child
   disposition: `live-pending`, `cleanly-declined`, `terminated`, `dead`, or `unknown`.
8. **Human decision.** The operator resolves the pending request through a supported command/tool such as
   `resolve_approval`, choosing `grant`, `deny`, `cancel`, or `expire`, plus rationale. The tool writes an
   `approval-resolved` event with actor identity, decision source, and scope. It must not execute the
   child's command itself.
9. **Resume.** If the request was granted after the live request closed, resume through a fresh kit-owned
   turn/session with the grant preloaded as narrowly as the runtime supports: exact command approval, host
   network policy amendment, turn/session permission grant, or a repo-level temporary policy overlay. The
   child re-attempts the step. If the runtime cannot preload the grant, the run remains
   `operator-required`; the parent still must not perform the child's work.
10. **Outcome.** Append `approval-applied`, `approval-denied`, `approval-expired`, `approval-resume-started`,
    and `approval-outcome` events as the request progresses. An approval is complete only when the runtime
    confirms the item completed/declined or the resumed child emits structured evidence that the blocked step
    passed or stopped.
11. **Audit.** Every automated or human decision records `by`, rationale, policy rule, risk tier, scope,
    target, expiry, request hash, redaction summary, and evidence references. The audit answer should be able
    to say "who allowed `pnpm install` to reach `registry.npmjs.org`, for how long, and why".

Recommended initial event types:

```text
approval-requested
approval-normalized
approval-classified
approval-pending
approval-decision-recorded
approval-live-response-sent
approval-parked
approval-resolved
approval-resume-started
approval-outcome
approval-expired
approval-denial-circuit-opened
```

Recommended default policy:

- `approval.mode = assisted`.
- Standard dependency install is policy-grantable only when it uses the repo-declared package manager, respects
  the lockfile (`pnpm install --frozen-lockfile`, `npm ci`, equivalent), targets declared registry hosts, and
  does not request secret access, local/private network access, Docker/Unix sockets, or broad egress.
- Dependency lifecycle scripts are separate from registry network access. Treat lifecycle-script escalation as
  medium by default and require explicit repo policy to auto-grant.
- Off-policy public network access is medium unless the command, destination, or data sensitivity makes it high.
- Local/private network, Unix sockets, credentials, writes outside the worktree, destructive commands, or
  `danger-full-access` are high.
- `unattended-run` is allowed only if every approval path is policy-covered or auto-decidable within configured
  risk bounds; otherwise the run parks.

Required failure behavior:

- **Process dies while parked.** If `approval-requested` was durably committed, the request remains pending
  and recoverable. Mark child disposition `dead` or `unknown`, verify containment per R2, and let a later human
  decision resume a new owned turn from the linked session/worktree. If the process died before the request was
  committed, there is no approval to resolve; classify the run as child failure and use recovery logic.
- **Operator never answers.** Each pending request has `expiryAt`. On expiry, append `approval-expired`, answer
  any still-live protocol request with cancel/decline, terminate or stop the child if still waiting, and mark the
  story blocked with a precise approval timeout reason. The run may be manually resumed later by creating a new
  request/decision, but no autonomous grant is inferred from silence.
- **Underlying runtime cannot keep a request alive.** Close it cleanly, persist `approval-parked`, and resume
  later through a fresh owned turn with a preloaded grant. If the runtime cannot preload scoped grants either,
  degrade to `operator-required` and do not do the action in the parent.
- **Denial.** Return `decline`/`denied`, emit the rationale to the child if the surface supports it, and instruct
  the child to find a materially safer alternative or stop. Repeated denials for the same dedupe key open a
  circuit breaker and block the story.
- **Grant expires before use.** The resumed turn must re-request approval. Expired grants are not silently
  renewed.
- **State corruption or writer conflict.** If the event projection is incoherent, block approval decisions and
  require operator repair. Do not approve from stale snapshot state.

## Tradeoffs and Risks

- Human-latency decoupling is safer but less seamless. Closing and resuming a request can add one extra child
  turn compared with holding a live prompt open. The reliability gain is worth it because it survives process
  death, parent restart, and hours-long operator delay.
- MCP v1 can fix the immediate hang but is a weaker fit than app-server. It should be treated as a compatibility
  implementation behind the same relay contract, not as the final protocol shape.
- App-server has the best semantics but is experimental in the local CLI. Capability probes and version-pinned
  generated schemas are mandatory before enabling app-server-only behavior.
- Auto/orchestrator decisions can reduce approval fatigue but create security risk if the classifier is too broad.
  Keep the classifier deterministic, require policy evidence, fail closed, and force high-risk requests to a human.
- Scoped grants require runtime-specific mapping. If Codex cannot apply a desired host/command grant on a given
  version, the kit must choose a narrower feasible grant, park, or fail closed. It must not silently upgrade to
  full access.
- Audit records can leak secrets if command payloads are stored naively. Redaction and optional hash-only storage
  are part of the approval contract, not a reporting afterthought.
- Process termination while parked can waste work. However, a bounded owned-process lifecycle is safer than
  retaining an uncontrolled child that may continue side effects after the run appears parked.
- Operator UX needs to be explicit. A human should see exact target, requested scope, expiry, risk tier, policy
  match, and what will happen on approval or denial. Otherwise approval prompts become rubber stamps.

## Fallback and Degraded Modes

- App-server unavailable or probe fails: use MCP `elicitation/create` if available; advertise
  `approvalRelay: mcp-elicitation`, `interrupt: degraded`, and keep R2 kill as the safety floor.
- MCP elicitation unavailable: fail closed before launching any child expected to need approvals. Allow only
  pre-provisioned runs where `approvalPolicy: never` is intentional and all required access is already granted
  through sandbox/profile policy.
- Driver selected is `codex exec --json`: allow only no-approval workflows or preflight-approved,
  pre-provisioned permissions. If an approval is encountered, terminate and park as `approvalRelay: unavailable`.
- Runtime supports live approval but not scoped grant preloading on resume: immediate policy decisions may run
  live; human-latency requests park as `operator-required` unless a safe runtime-specific resume mechanism exists.
- Event store cannot acquire writer lease or projection is corrupt: do not decide approvals. Surface the lease or
  corruption evidence and require recovery first.
- Request classification is unknown: treat as high risk and human-required. Unknown must not auto-grant.
- Human approves a grant broader than runtime can enforce: reject the decision or require an explicit
  high-risk override that disables unattended/auto-merge capabilities for the run.
- Operator-mediated manual recovery occurs outside the relay: import the result only as observed evidence.
  The kit may verify branch/PR/test state, but the manual approval cannot satisfy `approval-audited` or
  `child-owned` guarantees retroactively.

## Validation Spikes

- MCP elicitation happy path: run `codex mcp-server` with an elicitation-capable client, trigger a blocked
  network command under `on-request`, persist `approval-requested`, return a scoped approval, and prove the child
  continues without hanging.
- MCP no-handler regression: run the same scenario without the handler and assert it reproduces the known
  dropped-request/hang path, so the root cause is locked.
- App-server command approval matrix: trigger command/network/file approvals and answer `accept`, scoped accept,
  `decline`, and `cancel`; verify `serverRequest/resolved` and item terminal statuses match the event log.
- Human-latency park test: trigger approval, persist pending request, close the live protocol request after the
  short decision window, wait beyond normal transport timeouts, approve through `resolve_approval`, and prove the
  resumed owned turn succeeds with a preloaded host/command grant.
- Process death while parked: kill the child after `approval-pending` is durable but before human decision.
  Verify the pending projection survives, R2 cleanup runs, and approval resumes through a new owned process.
- Operator never answers: let `expiryAt` pass. Verify `approval-expired`, protocol cancel/decline if live,
  process termination if needed, and story blocked with a precise timeout reason.
- Denial/circuit breaker: deny the same dedupe key repeatedly. Verify the child is not allowed to loop on
  equivalent escalations and the story stops with denial evidence.
- Redaction fixture: trigger requests containing env var names, URLs with credentials, auth headers, and token-like
  strings. Verify persisted events redact or hash sensitive fields while preserving enough audit value.
- Scope degradation fixture: request a host-level grant on a runtime that only supports command-level approval.
  Verify the relay chooses command-level or parks; it must not broaden to full access.
- Projection/restart property test: replay approval events through R5 projections across parent restarts, stale
  writer attempts, terminal events, and late protocol callbacks. The pending/decided/outcome state must remain
  coherent and monotonic.
- Policy table tests: mode x tier x policy-rule x runtime-capability matrix should deterministically produce
  grant, deny, park, expire, or degraded outcome.

## Open Questions

- What exact minimum Codex CLI version should be required for app-server approval relay, and which generated
  schema fields are mandatory versus optional?
- Should vNext ship app-server first for new installs and keep MCP only as a compatibility driver, or ship MCP
  Phase 0 first because it is closer to current code?
- What is the default live-request decision window before the kit closes and parks: 30 seconds, 60 seconds, or
  configurable by repo policy?
- Should human approvals be allowed after `expiryAt` as a new decision that revalidates policy, or should expiry
  always require launching a new request?
- What actor identity model should be recorded for local human decisions: OS user, Codex thread id, GitHub user,
  or explicit operator name?
- Should workflow-kit expose Codex's built-in `approvals_reviewer = "auto_review"` directly, implement its own
  deterministic risk ladder, or allow both with clear precedence? Recommendation here is deterministic ladder
  first, Codex auto-review as optional additional evidence.
- How should approved grants be represented in `.workflow/config.yaml`: permanent policy entries, run-scoped
  temporary overlays, or both?
- Can app-server reliably preload a network-policy amendment on a resumed turn across supported versions, or does
  that require a workflow-kit-side permission profile/rules overlay?
- Should standard dependency install auto-grants include postinstall scripts for repos that already trust their
  lockfile, or keep lifecycle scripts separately escalated by default?
- What audit retention and redaction policy should apply to approval events that include command previews or
  destination hosts?

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../../README.md) · **← Prev:** [R2 - Child Execution Ownership and Termination](./R2-process-ownership-termination.md) · **Next →:** [R4 - Sandbox, Dependency Install, and Supply Chain](./R4-sandbox-dependency-supply-chain.md)

<!-- /DOCS-NAV -->
