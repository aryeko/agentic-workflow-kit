## Bottom line

Design the Agent provider as **one driver contract with capability- and ownership-aware ports**, not as “Codex/MCP/CLI-shaped methods.” The core should receive a **run handle** that says:

1. what the driver believes it owns,
2. which abilities are native/emulated/claimed/unproven/absent,
3. what evidence supports those claims,
4. how to read normalized events with cursors,
5. which control operations are structurally available.

That keeps weak providers honest and prevents the usual software tragedy: an abstraction named “neutral” that is secretly just one vendor wearing a fake mustache.

This is based on the uploaded v2 handoff brief, whose key requirement is that ownership, capability evidence, unknown/lost states, normalization failure, non-support, and bounded reconnect become modeled concepts, not explanatory prose.

---

# 1. Provider variability research

### What real runtimes disagree on

| Runtime family                                      | Submission                                                                      | Observation                                                                           | Requests / approvals                                                                                                | Control                                                                        | Resume / durability                                                                                               | Design lesson                                                                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Codex CLI / exec**                                | Interactive or non-interactive prompt; `exec resume` can continue sessions.     | `--json` emits newline-delimited JSON events; final message can be written to a file. | Approval modes exist, but the CLI surface is not a generic structured request-answer API.                           | Documented command reference did not expose a general interrupt contract.      | Local transcripts and sessions can be resumed by ID or “last”; approvals/history are kept on resume.              | Strong local-session behavior, but very CLI/process-shaped. Do not make “session ID” imply ownership. ([OpenAI Developers][1])           |
| **Codex SDK / app-server**                          | Thread/start and turn/start through SDK or JSON-RPC app-server.                 | App-server sends notifications; SDK offers `runStreamed()` structured events.         | Richer client surface can expose events/approvals, depending on app-server version.                                 | App-server is bidirectional, but transport does not equal safe stop semantics. | SDK can resume threads; app-server schemas are version-specific and generated from the installed runtime.         | Good candidate for a strong driver, but the neutral contract must not inherit “thread/turn” as core vocabulary. ([OpenAI Developers][2]) |
| **MCP**                                             | Not an agent-run API; it exposes capabilities through JSON-RPC clients/servers. | stdio and Streamable HTTP differ; streams may not be resumable in draft evolution.    | Elicitation exists for user input; cancellation is optional and may be ignored.                                     | Cancellation is request-scoped and “fire and forget,” not process death.       | Protocol versions and transports are evolving, including draft removal of SSE resumability/redelivery.            | MCP is a source of variability, not the target abstraction. Never equate “request seen” with “answerable.” ([Model Context Protocol][3]) |
| **OpenAI Responses / Assistants-style remote APIs** | Remote response/run creation; background mode supports async polling.           | Poll status or stream response events.                                                | Function calls carry `call_id`; Assistants’ deprecated API has `requires_action` plus submit-tool-outputs.          | Response cancel exists only for background responses.                          | Background response data is stored briefly for polling; state is provider-managed.                                | Strong targeted request-answer model, but only for the provider’s notion of tool/function calls. ([OpenAI Developers][4])                |
| **Claude Code SDK / hooks**                         | SDK sessions, hooks, and permission flow.                                       | Hook inputs include transcript paths and session IDs.                                 | `PermissionRequest` and `PreToolUse` can allow/deny/defer; defer pauses a headless session and resume re-evaluates. | Some hook outputs can interrupt or block, but semantics are specific.          | Deferred tool resume has constraints: single tool call only, missing MCP tool can make deferred tool unavailable. | Excellent example of why “request answer” must be targeted and capability-scoped. ([Claude API Docs][5])                                 |
| **Gemini CLI**                                      | CLI interaction.                                                                | Conversation can be shared/exported.                                                  | No provider-neutral request-answer contract visible from the docs reviewed.                                         | Not treated as proven.                                                         | Manual `/chat resume <tag>` checkpoints exist.                                                                    | Good weak/medium provider example: checkpointing exists, but not necessarily durable event replay. ([Gemini CLI][6])                     |
| **Vercel AI SDK**                                   | App-defined agent loops.                                                        | Framework-level streaming/message state.                                              | Tool approval can be modeled with `needsApproval`; tool calling depends on provider/schema support.                 | App-defined.                                                                   | App-defined.                                                                                                      | Useful pattern source, but it is an application framework, not an external agent runtime. ([AI SDK][7])                                  |

### Evidence classification

I would treat all findings above as **documented** or **schema/documented-surface** evidence, not proven behavior. I did not run these runtimes. The contract should therefore have a way to say “documented native,” “schema-observed,” and “runtime-probed proven,” because pretending docs equal runtime proof is how bugs get MBAs.

---

# 2. Recommended abstraction shape

Use:

```ts
interface AgentDriver {
  describeRuntime(): Promise<RuntimeDescriptor>;

  capabilityReport(): Promise<CapabilityReport>;

  openRun(request: OpenRunRequest): Promise<OpenRunOutcome>;
}
```

`openRun()` returns an `AgentRunHandle`. The handle is not just an ID. It is a **capability-scoped, ownership-scoped control object**:

```ts
type AgentRunHandle =
  | ControlledRunHandle
  | RemoteOwnedRunHandle
  | ObserveOnlyRunHandle;

type ControlledRunHandle = {
  kind: "run_handle";
  providerRunRef: ProviderRunRef;
  ownership: OwnershipOwned;
  capabilities: CapabilityReport;
  observation: ObservationPort;
  control: ControlPort;
};

type RemoteOwnedRunHandle = {
  kind: "run_handle";
  providerRunRef: ProviderRunRef;
  ownership: OwnershipRemoteOwned;
  capabilities: CapabilityReport;
  observation: ObservationPort;
  control: ControlPort | LimitedControlPort;
};

type ObserveOnlyRunHandle = {
  kind: "run_handle";
  providerRunRef: ProviderRunRef;
  ownership: OwnershipObserveOnly;
  capabilities: CapabilityReport;
  observation: ObservationPort;
  control: NoControlPort;
};
```

The important bit: **observe-only handles do not expose `sendMessage`, `answerRequest`, or `requestStop` as callable methods**. They expose `NoControlPort`. The core does not “remember to be careful.” The type forces it. What a novelty.

---

# 3. Core concepts

```ts
type Ownership = OwnershipOwned | OwnershipRemoteOwned | OwnershipObserveOnly;

type OwnershipOwned = {
  mode: "owned";
  verifiedBy: EvidenceRef[];
  verifiedAt: Instant;
};

type OwnershipRemoteOwned = {
  mode: "owned_by_remote_system";
  remoteOwner: string;
  grantedControls: AbilityName[];
  verifiedBy: EvidenceRef[];
  verifiedAt: Instant;
};

type OwnershipObserveOnly = {
  mode: "observe_only";
  reason: string;
  verifiedBy: EvidenceRef[];
  verifiedAt: Instant;
};
```

```ts
type AbilityName =
  | "start_run"
  | "continue_run"
  | "attach_run"
  | "send_message"
  | "surface_requests"
  | "answer_targeted_request"
  | "request_stop"
  | "get_state"
  | "read_bounded_events"
  | "resume_observation"
  | "subscribe_events"
  | "emit_evidence_refs";

type SupportLevel =
  | "native"
  | "driver_emulated"
  | "claimed_by_runtime"
  | "unproven"
  | "absent"
  | "unknown";

type CapabilityClaim = {
  ability: AbilityName;
  support: SupportLevel;
  scope: CapabilityScope;
  basis: CapabilityBasis[];
  constraints?: string[];
  verifiedAt?: Instant;
  staleAfter?: Instant;
};

type CapabilityScope = {
  provider: string;
  runtimeName: string;
  runtimeVersion?: string;
  driverVersion: string;
  transport?: "stdio" | "websocket" | "http" | "api" | "local_process" | "mock";
  configDigest?: string;
};

type CapabilityBasis = {
  kind:
    | "official_docs"
    | "generated_schema"
    | "runtime_probe"
    | "conformance_test"
    | "driver_assertion"
    | "manual_observation";
  evidence: EvidenceRef;
};
```

```ts
type EvidenceRef = {
  ref: string; // opaque storage/artifact reference
  kind:
    | "doc"
    | "schema"
    | "event_log"
    | "transcript"
    | "probe_result"
    | "artifact";
  digest?: string;
  excerptHash?: string;
  sensitivity?: "low" | "unknown" | "sensitive";
};
```

No raw transcripts in the core event log. Only bounded normalized facts plus evidence refs. Civilization survives one more day.

---

# 4. Minimal contract surface

## Driver-level

```ts
interface AgentDriver {
  describeRuntime(): Promise<RuntimeDescriptor>;
  capabilityReport(): Promise<CapabilityReport>;
  openRun(request: OpenRunRequest): Promise<OpenRunOutcome>;
}
```

```ts
type OpenRunRequest =
  | { mode: "start"; work: BoundedWorkSpec; limits: RunLimits }
  | { mode: "continue"; providerRunRef: ProviderRunRef; input?: AgentMessage }
  | {
      mode: "attach";
      providerRunRef: ProviderRunRef;
      intent: "observe" | "control_if_owned";
    };
```

```ts
type OpenRunOutcome =
  | {
      kind: "opened";
      handle: AgentRunHandle;
      effect: EffectKind;
      evidence: EvidenceRef[];
    }
  | OperationUnsupported
  | OperationRejected
  | OperationLostContact
  | OperationFailed;
```

## Observation

```ts
interface ObservationPort {
  getState(): Promise<OperationOutcome<RunStateSnapshot>>;

  readEvents(request: ReadEventsRequest): Promise<OperationOutcome<EventPage>>;

  subscribeEvents?(
    request: SubscribeEventsRequest,
  ): AsyncIterable<AgentEvent | ObservationProblem>;
}
```

```ts
type ReadEventsRequest = {
  after?: ObservationCursor;
  limit: number;
  direction?: "forward";
  includeKinds?: AgentEventKind[];
};

type EventPage = {
  events: AgentEvent[];
  nextCursor?: ObservationCursor;
  completeness:
    | "complete"
    | "partial_gap_detected"
    | "not_available"
    | "unknown";
  replayGuarantee:
    | "no_duplicates_no_loss"
    | "best_effort"
    | "final_only"
    | "none";
};
```

This is the bounded reconnect model: the core re-presents `ObservationCursor`, receives `nextCursor`, and can detect gaps. Providers without history return `not_available` or `final_only`, not “trust me bro.”

## Control

```ts
interface ControlPort {
  sendMessage(
    message: AgentMessage,
  ): Promise<OperationOutcome<DeliveryReceipt>>;

  answerRequest(
    answer: TargetedRequestAnswer,
  ): Promise<OperationOutcome<RequestAnswerReceipt>>;

  requestStop(
    request: StopRequest,
  ): Promise<OperationOutcome<StopRequestReceipt>>;
}

type NoControlPort = {
  kind: "no_control";
  reason: "observe_only" | "capability_absent" | "ownership_unverified";
  evidence: EvidenceRef[];
};
```

Separate methods are intentional:

- `sendMessage` is just input.
- `answerRequest` targets one request.
- `requestStop` asks the provider to stop.
- None of these proves a process tree died. That belongs to Execution Host, not Agent provider.

---

# 5. Operation outcomes

All normal degradation is returned as a value:

```ts
type OperationOutcome<T> =
  | { kind: "ok"; effect: EffectKind; value: T; evidence: EvidenceRef[] }
  | OperationUnsupported
  | OperationRejected
  | OperationNotOwner
  | OperationLostContact
  | OperationInvalidState
  | OperationFailed;

type EffectKind = "native" | "driver_emulated";

type OperationUnsupported = {
  kind: "unsupported";
  ability: AbilityName;
  claim: CapabilityClaim;
  reason: string;
};

type OperationRejected = {
  kind: "rejected_by_runtime";
  ability: AbilityName;
  reason: string;
  evidence: EvidenceRef[];
};

type OperationNotOwner = {
  kind: "not_owner";
  ownership: Ownership;
  attemptedAbility: AbilityName;
};

type OperationLostContact = {
  kind: "lost_contact";
  lastKnownState?: RunStateSnapshot;
  since?: Instant;
  evidence: EvidenceRef[];
};

type OperationInvalidState = {
  kind: "invalid_state";
  currentState?: RunStateSnapshot;
  reason: string;
};

type OperationFailed = {
  kind: "failed";
  category:
    | "driver_bug"
    | "provider_error"
    | "normalization_error"
    | "storage_error";
  message: string;
  evidence: EvidenceRef[];
};
```

Unsupported is not an exception. Rejected is not unsupported. Lost contact is not failed. This is annoyingly precise, which is another way of saying “useful.”

---

# 6. Run state model

```ts
type RunState =
  | "not_started"
  | "starting"
  | "running"
  | "waiting_on_request"
  | "stopping_requested"
  | "completed"
  | "failed"
  | "cancelled"
  | "stopped"
  | "unknown"
  | "contact_lost";

type RunStateSnapshot = {
  state: RunState;
  observedAt: Instant;
  confidence: "proven" | "documented" | "driver_inferred" | "unknown";
  evidence: EvidenceRef[];
  providerState?: {
    name: string;
    value: string;
    evidence: EvidenceRef;
  };
};
```

`unknown` means “driver genuinely cannot classify.”
`contact_lost` means “there was a run, and the driver cannot currently reach the runtime.”
Those are not synonyms for `completed`, unless we’ve decided distributed systems are just vibes now.

---

# 7. Event / message / request model

```ts
type AgentEvent =
  | AgentMessageEvent
  | AgentActivityEvent
  | AgentRequestEvent
  | AgentArtifactEvent
  | AgentStateEvent
  | AgentNormalizationFailedEvent
  | AgentDriverNoticeEvent;

type AgentEventBase = {
  id: string;
  providerRunRef: ProviderRunRef;
  observedAt: Instant;
  cursor?: ObservationCursor;
  evidence: EvidenceRef[];
};
```

```ts
type AgentMessageEvent = AgentEventBase & {
  kind: "message";
  from: "agent" | "runtime" | "user" | "driver";
  message: AgentMessage;
};

type AgentActivityEvent = AgentEventBase & {
  kind: "activity";
  category:
    | "command"
    | "file_change"
    | "tool_invocation"
    | "network"
    | "subagent"
    | "other";
  summary: string;
  normalized?: Record<string, unknown>;
};

type AgentRequestEvent = AgentEventBase & {
  kind: "request";
  request: AgentRequest;
};

type AgentRequest = {
  requestId: string;
  requestKind:
    | "permission"
    | "human_input"
    | "external_result"
    | "credential_needed"
    | "unknown";
  prompt: string;
  requestedAt: Instant;
  responseChannel:
    | { kind: "targeted"; answerAbility: "answer_targeted_request" }
    | { kind: "message_only"; reason: string }
    | { kind: "not_answerable"; reason: string };
  evidence: EvidenceRef[];
};
```

```ts
type TargetedRequestAnswer = {
  requestId: string;
  decision:
    | { kind: "approve"; payload?: JsonValue }
    | { kind: "deny"; reason: string }
    | { kind: "provide_input"; input: AgentMessage }
    | { kind: "cannot_answer"; reason: string };
};
```

```ts
type AgentNormalizationFailedEvent = AgentEventBase & {
  kind: "normalization_failed";
  providerEventKind?: string;
  reason:
    | "unknown_provider_event"
    | "missing_required_field"
    | "ambiguous_mapping"
    | "schema_mismatch"
    | "redaction_required";
  rawEvidence: EvidenceRef;
};
```

This avoids the worst lie: silently dropping provider events because they don’t fit the pretty little enum shrine.

---

# 8. Capability discovery model

The core calls `capabilityReport()` before using the driver and stores the report with the run.

```ts
type CapabilityReport = {
  runtime: RuntimeDescriptor;
  generatedAt: Instant;
  claims: CapabilityClaim[];
};

type RuntimeDescriptor = {
  provider: string;
  runtimeName: string;
  runtimeVersion?: string;
  driverVersion: string;
  transport?: string;
  configDigest?: string;
};
```

Core rule:

```ts
function canUse(report: CapabilityReport, ability: AbilityName): boolean {
  const claim = strongestCurrentClaim(report, ability);

  return (
    (claim?.support === "native" || claim?.support === "driver_emulated") &&
    hasAcceptableBasis(claim)
  );
}
```

Safe default:

- `native` with runtime probe or generated schema: usable.
- `driver_emulated`: usable only when the emulation path is also supported.
- `claimed_by_runtime`: not enough for safety-gated operations.
- `unproven`, `unknown`, `absent`: do not use.
- stale scope/version/config digest: re-discover before use.

This matches the brief’s “discover, don’t infer” principle without turning the SDK into a courtroom drama, though admittedly we are halfway there.

---

# 9. Operation semantics

| Operation           | Purpose                                        | Input                        | Output              | Required guarantees                                             | Degraded / unsupported behavior                                                          |
| ------------------- | ---------------------------------------------- | ---------------------------- | ------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `describeRuntime`   | Identify provider/runtime/driver/config scope. | none                         | `RuntimeDescriptor` | Must not claim behavior. Identity only.                         | If version unknown, report unknown, not fake semver fan fiction.                         |
| `capabilityReport`  | Tell core what is supported and why.           | none                         | `CapabilityReport`  | Every claim has support, scope, basis, evidence.                | Missing proof becomes `claimed_by_runtime`, `unproven`, `unknown`, or `absent`.          |
| `openRun(start)`    | Start bounded work.                            | `BoundedWorkSpec`, limits    | `AgentRunHandle`    | Must classify ownership and expose only valid ports.            | Return `unsupported`, `rejected_by_runtime`, or `lost_contact`.                          |
| `openRun(continue)` | Add a new turn/input to existing provider run. | provider ref, optional input | handle              | Must not imply ownership from ID possession.                    | If ownership unverified, return observe-only or `not_owner`.                             |
| `openRun(attach)`   | Attach to existing run.                        | provider ref, intent         | handle              | Must verify ownership/control before exposing controls.         | Observe-only is a normal success.                                                        |
| `getState`          | Classify provider-visible state.               | handle                       | `RunStateSnapshot`  | Must include `unknown` and `contact_lost`.                      | If provider has no status API, return `unknown`, not “running probably.”                 |
| `readEvents`        | Bounded replay/reconnect.                      | cursor, limit                | page                | Must bound records and report completeness.                     | Final-only providers return `final_only`; no-history providers return `not_available`.   |
| `subscribeEvents`   | Live observation.                              | cursor/start point           | async events        | Must not be the only observation mechanism.                     | Optional. Driver may emulate with polling if reported as emulated.                       |
| `sendMessage`       | Give more input.                               | message                      | delivery receipt    | Must not be treated as approval.                                | Unsupported if no input channel or observe-only.                                         |
| `answerRequest`     | Answer one surfaced request.                   | request ID + answer          | request receipt     | Must target a specific request or return impossible.            | If runtime only supports generic input, return `unsupported`, not “sent message.”        |
| `requestStop`       | Ask provider to stop.                          | stop request                 | receipt             | Must distinguish accepted stop request from actual termination. | If stop unsupported, return `unsupported`; if accepted, still observe state until final. |

---

# 10. Mandatory vs optional

Mandatory for every driver:

```ts
describeRuntime();
capabilityReport();
openRun();
ObservationPort.getState();
ObservationPort.readEvents();
```

But mandatory does **not** mean “always succeeds.” It means “always returns an inspectable value.”

Optional by capability:

```ts
subscribeEvents();
ControlPort.sendMessage();
ControlPort.answerRequest();
ControlPort.requestStop();
```

Observe-only handles must expose:

```ts
control: {
  kind: "no_control";
  reason: "observe_only";
}
```

Not a stub. Not a method that throws. A visible absence. Revolutionary, apparently.

---

# 11. Why this is provider-neutral

This design deliberately rejects provider-shaped vocabulary:

- No core `thread`, `turn`, `run`, `tool_call`, `hook`, `MCP request`, or `function_call` dependency.
- Provider IDs live inside `ProviderRunRef`.
- Tool/function/permission/human-input all normalize to `AgentRequest`.
- Streams are not trusted as the only truth; bounded `readEvents` plus cursors is the durable supervision primitive.
- Stop is provider-level `requestStop`, not process kill.
- Capabilities are scoped and evidence-backed, not inferred from a method existing.
- Ownership is driver-determined, not caller-asserted.
- Normalization failure is an event, not a log line no one will read before production catches fire.

---

# 12. Intentionally left to other domains

Do **not** put these into the Agent driver:

- process spawning and hard kill;
- sandbox/container policy;
- approval policy or adjudication;
- artifact storage implementation;
- transcript redaction rules;
- merge/verification logic;
- orchestration scheduling;
- queue/daemon design;
- credential issuance.

The driver reports what happened and relays decisions it is handed. It does not become the whole product in a trench coat.

---

# 13. Open questions before implementation stories

1. What exact `BoundedWorkSpec` belongs to the SDK core: plain prompt + limits, or a richer task envelope?
2. What is the first acceptable evidence basis for production use: official docs, generated schema, runtime probe, or conformance test?
3. Should `driver_emulated` ever unlock safety-sensitive abilities like request approval, or only observation conveniences?
4. What storage layer mints `EvidenceRef`, and what digest/redaction guarantees does it provide?
5. How should conformance tests simulate `unknown`, `contact_lost`, duplicate events, and cursor gaps?
6. Should `owned_by_remote_system` allow stop/input by default when provider grants it, or require explicit per-ability proof?
7. What is the retention model for provider-visible event cursors?
8. Which providers are first-class targets for v1 conformance: mock, Codex SDK, Codex CLI, maybe Claude Code SDK?

---

# 14. Self-check against the six modeled needs

| Need                                         | Modeled by                                                                                                                                |                                           |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Ownership reported and verified by driver    | `OwnershipOwned`, `OwnershipRemoteOwned`, `OwnershipObserveOnly`, each with `verifiedBy`; `ObserveOnlyRunHandle` exposes `NoControlPort`. |                                           |
| Capability claim carries basis               | `CapabilityClaim.scope`, `CapabilityClaim.basis`, `CapabilityBasis.evidence`, `verifiedAt`, `staleAfter`.                                 |                                           |
| Unknown and lost contact states              | `RunState = "unknown"                                                                                                                     | "contact_lost"`and`OperationLostContact`. |
| Normalization failure event                  | `AgentNormalizationFailedEvent`.                                                                                                          |                                           |
| Non-support/degradation inspectable outcomes | `OperationUnsupported`, `OperationRejected`, `OperationNotOwner`, `OperationLostContact`; no expected non-support exceptions.             |                                           |
| Bounded retrieval and reconnect              | `ObservationPort.readEvents`, `ReadEventsRequest.after`, `ObservationCursor`, `EventPage.completeness`, `replayGuarantee`.                |                                           |

Final recommendation: implement this first against a **strict mock conformance driver**, then Codex SDK/app-server as the first real driver. Do not start with CLI scraping. Starting with CLI scraping is how elegant contracts go to a farm upstate.

[1]: https://developers.openai.com/codex/cli/reference "Command line options – Codex CLI | OpenAI Developers"
[2]: https://developers.openai.com/codex/app-server "App Server – Codex | OpenAI Developers"
[3]: https://modelcontextprotocol.io/specification/2025-06-18/basic/transports "Transports - Model Context Protocol"
[4]: https://developers.openai.com/api/docs/guides/background "Background mode | OpenAI API"
[5]: https://docs.anthropic.com/en/docs/claude-code/hooks?utm_source=chatgpt.com "Hooks reference - Claude Code Docs"
[6]: https://geminicli.com/docs/reference/commands/ "CLI commands | Gemini CLI"
[7]: https://ai-sdk.dev/cookbook/next/human-in-the-loop "Next.js: Human-in-the-Loop with Next.js"

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../README.md) · **← Prev:** [Design Proposal: Provider-Neutral Agent Driver Contract (v2)](./gemini35flash.md) · **Next →:** [roadmap](../roadmap.md)

<!-- /DOCS-NAV -->
