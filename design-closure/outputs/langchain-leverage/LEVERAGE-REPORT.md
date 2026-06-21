# LangChain leverage report for kit-vnext

## TLDR

kit-vnext can learn a lot from LangChain ecosystem projects, but the highest-value path is not a
single direct dependency. The best implementation savings come from turning mature upstream patterns
into kit-native fixtures, story criteria, and later provider-side adapter spikes.

Immediate leverage should be pattern and fixture adoption:

1. MCP adapter mechanics for tool discovery, session lifecycle, content preservation, and failure
   semantics.
2. LangGraph durable-execution concepts for interrupt/resume, stale state, replay, and recovery
   fixtures.
3. LangSmith observability and eval vocabulary for `core-07` reports and local eval datasets.
4. Open SWE and Deep Agents Code operations patterns for later provider-driver stories.
5. LangChain.js, Deep Agents.js, and Agent Protocol as `AgentProvider` adapter spikes after the
   agent seam mock exists.

Do not use any LangChain ecosystem project as kit-vnext's core runtime, event log, source of
capability truth, approval authority, verifier, Forge actor, or merge gate.

## Ranked opportunity table

| Rank | Opportunity | Main projects | Code avoided | Product gain | Seam fit | Risk | Timing | Use type | Verdict |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | [Tool and MCP adapter patterns](opportunities/tool-mcp-adapters.md) | MCP Adapters, LangChain.js MCP | Medium-high | Medium | High | Medium if copied, high if core dependency | After provider ports/mocks | Copied pattern now, provider adapter later | Best near-term leverage |
| 2 | [Durable execution and tests](opportunities/durable-execution-tests.md) | LangGraph, LangGraph.js | Medium | Medium-high | High for tests/docs | Low if copied, high if runtime adoption | Frontiers 1-5 stories | Copied test fixtures | Best immediate test leverage |
| 3 | [Observability and evals](opportunities/observability-evals.md) | LangSmith, Open SWE | Medium | High | Medium-high | Medium adapter-only, high if authoritative | After `core-07` story contract | Copied pattern first, optional exporter later | Strong product-quality leverage |
| 4 | [Coding-agent operations](opportunities/coding-agent-operations.md) | Open SWE, Deep Agents Code | Medium | High | Medium-high | Low if fixtures, high if runtime adoption | After SDK/testkit/core gates | Fixture pack and provider-driver spikes | Strong later driver leverage |
| 5 | [AgentProvider acceleration](opportunities/agent-provider-acceleration.md) | LangChain.js, Deep Agents.js, Deep Agents, Agent Protocol | Medium | Medium | Medium-high | Medium adapter-only, high if core dependency | After `seam-agent-contract-mock` | Adapter spike and conformance fixtures | Promising, but gated by seam maturity |

## Best immediate learning opportunities

- Use MCP Adapters to avoid cold-start design for multi-server tool discovery, session scope,
  structured/multimodal content preservation, tool-error versus transport-error separation, and
  interceptor/request override patterns.
- Use LangGraph/LangGraph.js concepts to name and test durable execution hazards: interrupt/resume,
  duplicate resume, stale checkpoint, replay cursor drift, retry ordering, time-travel, and recovery
  replay safety.
- Use LangSmith concepts to shape `core-07` output: traces, datasets, experiment runs, feedback,
  annotation queues, automation rules, OpenTelemetry export, and bulk export as non-authoritative
  report/eval patterns.
- Use Open SWE and Deep Agents Code to seed realistic coding-agent operational fixtures: queued
  follow-up, review finding persistence, CI monitor fallback, sandbox reuse, headless timeout,
  approval-channel loss, remote sandbox failure, and threat-model negative probes.

## Best later dependency or adapter opportunities

- `provider-langchain-js` spike: validate whether LangChain.js can sit behind `AgentProvider` for
  model/tool setup, streaming observation, HITL relay, and tool-call mapping.
- `provider-deepagents-js` spike: validate whether Deep Agents.js can satisfy `AgentProvider`
  observation and approval behavior while keeping filesystem, permissions, memory, and backend state
  inside the provider boundary.
- `provider-agent-protocol` spike: validate Agent Protocol as an external compatibility adapter for
  agents/runs/threads/streams, with kit-vnext still owning events, attestations, and completion.
- Optional LangSmith exporter: export kit-native analysis artifacts after `AnalysisRecorded` /
  `AnalysisFailed` and local eval fixtures exist.
- Optional MCP provider bridge: wrap MCP SDK or `@langchain/mcp-adapters` inside a provider package,
  never inside SDK/core.

## No-go areas

- Do not adopt LangGraph or LangGraph.js as kit-vnext's runtime, persistence layer, recovery engine,
  liveness authority, or checkpoint store.
- Do not let LangSmith become authoritative for run state, gate evidence, task status, completion,
  merge, approval, recovery, or metric truth.
- Do not put LangChain tool, middleware, `StructuredTool`, `ToolMessage`, LangGraph `Command`, or
  Agent Protocol run/thread/store types in SDK/core public contracts.
- Do not use upstream capability metadata, schemas, middleware configuration, or docs as positive
  `CapabilityAttestation` evidence. They are discovery hints only.
- Do not give LangChain/Deep Agents/Open SWE worker tools runner powers such as verify, push, PR,
  checks, reviews, or merge.

## Implementation roadmap

Do now as design/test input:

- Add an MCP-inspired fixture backlog for tool discovery, session lifecycle, content preservation,
  interceptor behavior, and transport/tool failure separation.
- Add durable-execution fixture names and acceptance criteria to core/testkit story drafting:
  stale cursor, duplicate resume, checkpoint-only progress, replay fork, lost approval answer, and
  retry after partial side effect.
- Add LangSmith-inspired `core-07` story criteria for report artifacts, eval datasets, feedback
  imports, honest metric states, and optional OTel export boundaries.

Spike after SDK/testkit:

- Build `AgentProvider` stream and approval mapping fixture packs using LangChain.js, Deep Agents.js,
  Deep Agents, and Agent Protocol sample events.
- Build coding-agent operations fixture packs from Open SWE and Deep Agents Code for Agent, Host,
  Forge, Work Source, completion, recovery, and analysis stories.

Spike after provider drivers:

- Evaluate optional `provider-langchain-js`, `provider-deepagents-js`, `provider-agent-protocol`,
  LangSmith exporter, and MCP bridge packages against the kit-vnext conformance suite.
- Keep every integration optional, provider-local, and fail-closed when it cannot produce kit-native
  events, artifacts, attestations, and evidence refs.

## Final recommendation

Use the LangChain ecosystem as a leverage library, not as a control-plane replacement.

The highest-confidence implementation savings are fixtures, story criteria, and copied adapter
patterns. Direct package reuse should wait until the corresponding kit-vnext seam exists and can
reject nonconforming providers. This lets kit-vnext benefit from widely adopted OSS without giving up
the invariants that make the product valuable: deterministic control, replayable evidence, scoped
authority, and explicit provider attestations.

## Appendix: opportunity reports

- [AgentProvider acceleration](opportunities/agent-provider-acceleration.md)
- [Durable execution and tests](opportunities/durable-execution-tests.md)
- [Observability and evals](opportunities/observability-evals.md)
- [Coding-agent operations](opportunities/coding-agent-operations.md)
- [Tool and MCP adapter patterns](opportunities/tool-mcp-adapters.md)
