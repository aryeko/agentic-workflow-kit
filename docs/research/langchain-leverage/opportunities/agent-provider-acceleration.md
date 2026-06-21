# AgentProvider acceleration

## Opportunity summary

LangChain.js, Deep Agents.js, Deep Agents, and Agent Protocol can reduce some
AgentProvider implementation work, but only if kit-vnext treats them as adapter
inputs and conformance-fixture sources. None should become the control plane, event
log, approval authority, completion authority, worker process owner, or source of
capability truth.

Score line: code avoided: medium; product gain: medium; seam fit: medium-high;
invariant risk: medium if adapter-only, high if imported into core; dependency
risk: medium-high; timing: after `seam-agent-contract-mock`; use type: adapter
spike plus copied conformance patterns, not SDK/core dependency.

The best leverage is source-level mapping work around event streams, tool-call
observations, HITL/approval interrupts, schema/capability discovery, and negative
fixtures. The least safe leverage is adopting LangGraph/LangChain checkpointing,
thread state, stores, or LangSmith traces as kit-vnext run authority. kit-vnext's
append-only event log, `CapabilityAttestation` gates, and AD-12 worker/runner
isolation stay load-bearing.

## Candidate projects

| Project | Candidate role | Current fit |
|---|---|---|
| LangChain.js | Optional TypeScript worker harness or model/tool integration wrapper behind `AgentProvider`. | Useful for `createAgent`, tool schemas, model providers, streaming, middleware, and HITL decisions. Too broad and model-driven for core. |
| Deep Agents.js | Stronger TypeScript worker-harness research target than raw LangChain.js. | Useful for built-in filesystem/subagent/todo/memory/HITL middleware and typed v3 stream projections. Stream API is marked experimental, so avoid hard dependency. |
| Deep Agents | Python reference implementation and richer fixture source. | Useful for mature docs around subagents, permissions, backends, checkpoints, and HITL failure cases. Less direct for TypeScript package reuse. |
| Agent Protocol | External compatibility protocol for agent servers. | Useful for run/thread/schema/streaming taxonomy and possible `provider-agent-protocol` adapter. Early public maturity and thread-state model make it unsafe as kit-vnext core state. |

## What to leverage

- LangChain.js `createAgent` and middleware composition for a later
  `provider-langchain-js` research adapter. It can reduce model/tool plumbing and
  expose standard LangChain tools, provider models, custom stream writers, and
  `humanInTheLoopMiddleware` interrupts.
- Deep Agents.js `createDeepAgent` for a richer worker-harness spike. Source
  shows an opinionated deterministic middleware order over LangChain `createAgent`:
  todo list, filesystem, subagents, summarization, tool-call patching, optional
  async subagents, custom middleware, cache, memory, skills, permissions, and HITL
  interrupts.
- Deep Agents.js v3 `streamEvents` projections as a source-level mapping target.
  Its type surface exposes `run.messages`, `run.toolCalls`, `run.subagents`,
  `run.middleware`, `run.values`, `run.output`, `run.subgraphs`, and extension
  projections. Map only stable, observed facts into kit-vnext `AgentEvent`.
- LangChain/Deep Agents HITL decision taxonomy. Current docs use
  `interruptOn` and decisions such as `approve`, `edit`, `reject`, and `respond`.
  These can inform mapping to kit-vnext `ApprovalKind`, `ScopedGrantKind`, and
  `ApprovalAnswerResult`, but kit-vnext must still own the recorded decision event
  and scoped grant.
- Agent Protocol introspection endpoints. `GET /agents/{agent_id}` and
  `GET /agents/{agent_id}/schemas` can seed `probeCapabilities`, while run and
  stream endpoints can seed `startWorker`, `observe`, `answerApproval`, and
  `resumeOwned` adapter probes.
- Agent Protocol streaming taxonomy. Its channels split messages, tools,
  lifecycle, input, values, updates, checkpoints, tasks, and custom events. The
  `tools` channel explicitly models `tool-started`, `tool-output-delta`,
  `tool-finished`, and `tool-error`; `input.requested` / `input.respond` covers
  HITL interrupts. This is good fixture material for event mapping.
- Conformance and adversarial fixtures. Copy scenarios, not runtime ownership:
  missing tool exit, ambiguous terminal state, checkpoint-only progress, dropped
  approval, non-persisted answer channel, subagent final-only summaries, custom
  tool permission bypass, local shell/file backend risk, lost stream replay, and
  schema-only capability claims.

## Why it helps kit-vnext

The AgentProvider contract is small but hard to validate because the difficult
parts are not type declarations. The hard parts are proving provider linkage,
approval answer delivery, durable answer channels, resume ownership, structured
tool exits, redacted output refs, terminal classification, Guardian-like review
signals, and host parentage.

These projects help by providing real upstream event shapes and failure modes that
can make the first Agent mock and conformance suite less artificial:

- Event mapping: Deep Agents.js and Agent Protocol provide concrete stream
  structures for tool calls, subagents, lifecycle, messages, custom progress, and
  HITL input.
- Approval/HITL: LangChain.js and Deep Agents expose interrupt configuration and
  decision vocabulary that can be translated into kit-vnext approval requests and
  scoped grants.
- Tool events: Agent Protocol has explicit tool lifecycle events; Deep Agents.js
  v3 streams expose tool-call streams with input, output, and status. Both can
  exercise the `ToolObserved` requirement that command, exit code, redacted
  `outputRef`, and digest must be present or degrade.
- Streaming: upstream stream APIs can reduce UI/debug and adapter plumbing for
  progress observation, while kit-vnext still commits normalized events to its own
  log.
- Model/tool integration: LangChain.js provider packages and tool schemas can
  reduce experimental model and tool setup inside a provider package.
- Conformance fixtures: Agent Protocol and Deep Agents failure modes are useful
  negative tests for `CapabilityAttestation` gates and fail-closed behavior.

This helps most in `seam-agent-contract-mock`, `prov-01` production-readiness
spikes, and `core-02` capability tests. It should not change the foundation ->
seam ports and mocks -> core spine -> real drivers ordering in the implementation
DAG.

## Direct reuse vs adapter vs copied pattern

| Surface | Recommended use | Rationale |
|---|---|---|
| LangChain.js package | Adapter only, in optional provider package. | Reduces model/tool/HITL plumbing, but model-driven agent loop cannot own kit-vnext control flow. |
| Deep Agents.js package | Adapter spike only, in optional provider package. | Best JS harness candidate, but combines planning, filesystem, subagents, permissions, memory, and HITL. Keep behind `AgentProvider` and `ExecutionHostProvider`. |
| Deep Agents Python | Copied pattern and fixture source. | Richer docs and examples, but Python runtime is not a direct TS SDK acceleration path. |
| Agent Protocol OpenAPI / streaming types | Adapter plus copied fixture pattern. | Useful compatibility boundary and typed stream taxonomy. Do not replace kit-vnext run/thread/event model. |
| HITL decision vocabulary | Copied pattern, mapped to kit grants. | `approve` / `edit` / `reject` / `respond` is useful input vocabulary, but kit decisions must be recorded as event-log decisions and scoped grants. |
| Checkpointers, stores, thread state | Do not reuse as authority. | These are worker or protocol state. kit-vnext run truth remains event-log replay and artifact refs. |
| LangSmith traces / AgentEvals | Optional diagnostics later. | Useful for worker debugging, not gate evidence or completion authority. |

## Source-level fit notes

`AgentProvider.probeCapabilities(scope)`:

- Agent Protocol has direct discovery material through agent metadata,
  capabilities, and JSON schemas. This is good schema evidence, but schema-only
  evidence cannot prove liveness, approval persistence, resume, parentage, or
  answer delivery.
- LangChain.js and Deep Agents.js can expose configured tools, middleware, model
  identity, checkpointer/store presence, permissions, and stream capabilities. An
  adapter can turn those into probe inputs, but positive attestations still need
  live-smoke or adversarial evidence.
- Deep Agents.js source parameters include `model`, `tools`, `middleware`,
  `subagents`, `responseFormat`, `contextSchema`, `checkpointer`, `store`,
  `backend`, `interruptOn`, `memory`, `skills`, `permissions`, and
  `streamTransformers`. Those are useful for driver scope and freshness keys.

`AgentProvider.startWorker(request)`:

- LangChain.js and Deep Agents.js do not naturally start a kit-vnext worker on
  their own. The worker process still has to be created by `ExecutionHostProvider`
  and passed as `hostWorker`.
- A LangChain/Deep Agents adapter can start an agent invocation inside that host
  context and return an `AgentSession` only after it has a stable provider
  session id, thread id, run id, or equivalent linkage.
- Agent Protocol maps more naturally to background run creation, but its run id
  and thread id are provider ids, not kit-vnext run ids. The adapter must create
  a kit `AgentSession` that records provider ids without making the provider
  thread authoritative.

`AgentProvider.observe(session)`:

- Deep Agents.js v3 `streamEvents` is the strongest source-level fit for
  `observe`: it exposes typed projections for messages, tool calls, subagents,
  middleware, values, output, subgraphs, and custom extensions.
- Agent Protocol also fits observation well through thread streams. Its `tools`,
  `lifecycle`, `messages`, and `input` channels map cleanly to `tool-observed`,
  `terminal` / `degraded`, `progress`, and `approval-requested` candidates.
- The adapter must ignore or degrade checkpoint-only progress. State snapshots,
  checkpoint ids, and replay sequence numbers are useful correlation evidence,
  but not kit-vnext liveness or completion truth by themselves.

`AgentProvider.answerApproval(session, answer)`:

- LangChain.js and Deep Agents.js HITL middleware supplies a conceptual mapping
  from tool interrupts to approval decisions. A checkpointer is required in the
  docs for durable HITL pause/resume, which aligns with kit-vnext's separate
  `canPersistApprovalAnswerChannel` capability.
- Agent Protocol's `input.respond` can carry a response correlated by
  `interruptId`. This is a good adapter target for `ApprovalAnswerChannel`, but
  persistence must be probed by disconnect/reconnect and resume tests.
- The kit adapter must not pass arbitrary upstream `edit` payloads through as
  authority. It must normalize them into a recorded `ScopedGrant` with
  `decisionEventId`, allowed scope, and evidence refs.

`AgentProvider.resumeOwned(request)`:

- LangChain.js / Deep Agents.js resume depends on LangGraph checkpointing,
  stable `thread_id`, and durable checkpointers. That may support owned resume,
  but only after live proof that the resumed session is the same ownership scope
  and can still answer pending approvals.
- Agent Protocol has stronger conceptual mapping because threads and runs are
  first-class and streams support replay/reconnect. Public docs still leave some
  concurrent run and replay details on the roadmap, so resume must be a probed
  capability, not assumed.

`AgentProvider.stopObserving(session)`:

- Agent Protocol has clearer stream subscription lifecycles over SSE/WebSocket.
  LangChain.js and Deep Agents.js can stop local async iteration or abort with a
  signal, but clean provider release evidence needs adapter-specific proof.
- Stopping observation is not killing work. Kill remains `ExecutionHostProvider`
  territory.

Tool observations and output refs:

- Agent Protocol tool lifecycle events correlate `toolCallId` to message tool
  call ids, but the protocol does not guarantee a POSIX-like process exit code.
  Missing exit code must become `structured-tool-exit-missing` unless the
  concrete adapter can prove a command exit status.
- Deep Agents.js tool streams expose tool-call input, output, and status, but
  status is not necessarily command `exitCode`. Shell or filesystem tools need
  an adapter-specific mapping through the Execution Host and redacted
  `AgentOutputSink`.
- LangChain tool output is not runner-owned verification evidence. Runner verify
  continues through `ExecutionHostProvider.runCommand`, not worker tool streams.

Worker/runner isolation:

- LangChain and Deep Agents tools can execute arbitrary side effects if given
  powerful tools or backends. Therefore any adapter must run with worker-safe
  credentials only, no Forge credentials, and no push/PR/check/merge authority.
- Filesystem and shell backends must be restricted by `ExecutionHostProvider`,
  fnd-04 scoped injection, redaction, egress policy, and capability gates.

## Required kit-vnext stories

1. `seam-agent-contract-mock`: implement the SDK `AgentProvider` interface, mock
   Agent provider, and conformance harness first. Include LangChain/Deep
   Agents/Agent Protocol inspired replay fixtures, but no upstream runtime
   dependency.
2. `agent-event-mapping-fixtures`: add normalized fixture samples for provider
   streams: LangChain tool calls, Deep Agents.js v3 tool/subagent streams, Agent
   Protocol messages/tools/lifecycle/input/checkpoint streams, and malformed or
   missing fields.
3. `agent-approval-hitl-fixtures`: test mapping of `approve`, `edit`, `reject`,
   and `respond` style decisions into kit-vnext `ScopedGrant` variants, including
   deny-continue, deny-interrupt, deny-park, non-persisted channels, and answer
   delivery failure.
4. `agent-capability-probe-contract`: define probes that distinguish schema
   evidence from live evidence for `canRelayApproval`,
   `canPersistApprovalAnswerChannel`, `canResumeOwned`,
   `emitsStructuredToolExit`, `emitsGuardianReview`, and
   `preservesHostProcessParentage`.
5. `provider-langchain-js-spike`: optional later adapter spike after the mock
   conformance suite exists. Scope it to `AgentProvider` observation, HITL relay,
   model/tool setup, and fail-closed gaps.
6. `provider-deepagents-js-spike`: optional later adapter spike focused on
   `createDeepAgent`, v3 `streamEvents`, subagent streams, filesystem/backend
   restrictions, permissions, and HITL interrupts.
7. `provider-agent-protocol-spike`: optional later compatibility adapter that
   maps agent schemas, background runs, thread streams, tool events, lifecycle,
   and input interrupts to kit-native `AgentEvent` and attestations.
8. `execution-host-parentage-probes`: paired prov-01/prov-04 probes for any
   upstream harness that executes commands, proving worker command parentage,
   redacted output refs, egress behavior, and kill boundaries.

## Risks and constraints

- Event-log authority risk: upstream checkpoints, thread state, LangGraph stores,
  LangSmith traces, or Agent Protocol store items must not become kit-vnext run
  truth. They can be observed inputs and artifact refs only.
- Attestation risk: upstream `capabilities`, schemas, configured middleware, or
  docs are discovery hints. Positive kit capabilities require recorded probe
  evidence with driver version, platform, freshness key, scope, expiry, and
  evidence refs.
- Worker/runner isolation risk: LangChain/Deep Agents tool ecosystems can blur
  agent work with host execution and external actions. The adapter must not carry
  Forge credentials or runner-owned verify, push, PR, review, check, or merge
  authority.
- Structured tool exit risk: provider tool lifecycle status is not the same as a
  command exit code. `ToolObserved.exitCode` must be real or the event degrades.
- HITL persistence risk: HITL pause support does not prove durable answer
  channels. Persistence needs disconnect, human-latency, resume, and answer
  probes.
- Stream stability risk: Deep Agents.js v3 stream projections are explicitly
  experimental in source comments. Use them for a spike and fixtures; do not
  freeze kit-vnext contracts around them.
- Protocol maturity risk: Agent Protocol is useful but early. The OpenAPI spec is
  version `0.1.6`, generated streaming bindings are not transport clients, and
  roadmap items still cover stream-mode detail, event replay parameters, vector
  search, and concurrent thread behavior.
- Dependency risk: LangChain.js and Deep Agents.js bring broad transitive
  surfaces: LangGraph, checkpointing, LangSmith integrations, model provider
  packages, Zod, filesystem/glob/YAML helpers, and optional hosted surfaces. Keep
  them out of `packages/sdk` and core packages.
- Timing risk: the readiness matrix currently has package implementation,
  conformance/integration, and runtime production attestation as `no` for
  `prov-01`. Adding live provider dependencies before the mock seam exists would
  slow the core-first path.

## Recommended verdict

Proceed, but only as post-seam acceleration:

- Use LangChain.js and Deep Agents.js as optional adapter spikes after
  `seam-agent-contract-mock`, not as SDK/core dependencies.
- Use Deep Agents Python and Deep Agents.js heavily for copied conformance
  scenarios around subagents, filesystem context, permissions, HITL, resume, and
  stream ambiguity.
- Use Agent Protocol as the best external compatibility adapter candidate and as
  a concrete stream taxonomy for fixtures.
- Do not change the current design closure. The current SDK-owned
  `AgentProvider`, event-log authority, `CapabilityAttestation`, and
  worker/runner isolation rules are exactly the boundaries needed to harvest
  useful upstream code without importing upstream authority.

Short answer: these projects can reduce implementation work for model/tool
integration, streaming observation, HITL vocabulary, event mapping, and
conformance fixtures. They cannot safely reduce the work of defining kit-vnext
authority, event-log semantics, capability gates, approval policy, host
containment, runner verification, or worker/runner isolation. The useful path is
adapter and fixture leverage, not direct core reuse.

## Sources

- `docs/design/20-sdk-and-packaging/provider-ports.md`
- `docs/design/30-domain-reference/providers/agent-execution/README.md`
- `docs/design/30-domain-reference/providers/agent-execution/contracts-and-conformance.md`
- `docs/design/30-domain-reference/providers/agent-execution/capabilities-and-conformance.md`
- `docs/implementation/domain-dag.md`
- `docs/implementation/readiness-matrix.md`
- `design-closure/outputs/langchain-review/README.md`
- `design-closure/outputs/langchain-review/UNIFIED-REPORT.md`
- `design-closure/outputs/langchain-review/project-reports/langchain-js.md`
- `design-closure/outputs/langchain-review/adoption-reports/langchain-js-adoption.md`
- `design-closure/outputs/langchain-review/project-reports/deep-agents-js.md`
- `design-closure/outputs/langchain-review/adoption-reports/deep-agents-js-adoption.md`
- `design-closure/outputs/langchain-review/project-reports/deep-agents.md`
- `design-closure/outputs/langchain-review/adoption-reports/deep-agents-adoption.md`
- `design-closure/outputs/langchain-review/project-reports/agent-protocol.md`
- `design-closure/outputs/langchain-review/adoption-reports/agent-protocol-adoption.md`
- LangChain.js docs via Context7: `/websites/langchain_oss_javascript`,
  queried for `createAgent`, streaming, tools, and human-in-the-loop middleware.
- Deep Agents.js docs/source via Context7: `/langchain-ai/deepagentsjs`,
  queried for `createDeepAgent`, backends, permissions, HITL, and event
  streaming.
- Agent Protocol docs/source via Context7: `/langchain-ai/agent-protocol`,
  queried for runs, threads, agents, schemas, streaming, and interrupts.
- LangChain.js `createAgent` source:
  https://raw.githubusercontent.com/langchain-ai/langchainjs/main/libs/langchain/src/agents/index.ts
- Deep Agents.js `createDeepAgent` source:
  https://raw.githubusercontent.com/langchain-ai/deepagentsjs/main/libs/deepagents/src/agent.ts
- Deep Agents.js type surface:
  https://raw.githubusercontent.com/langchain-ai/deepagentsjs/main/libs/deepagents/src/types.ts
- Agent Protocol README:
  https://github.com/langchain-ai/agent-protocol
- Agent Protocol OpenAPI:
  https://raw.githubusercontent.com/langchain-ai/agent-protocol/main/openapi.json
- Agent Protocol streaming README:
  https://raw.githubusercontent.com/langchain-ai/agent-protocol/main/streaming/README.md

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../README.md) · **← Prev:** [LangChain leverage report for kit-vnext](../LEVERAGE-REPORT.md) · **Next →:** [Coding-agent operations](./coding-agent-operations.md)

<!-- /DOCS-NAV -->
