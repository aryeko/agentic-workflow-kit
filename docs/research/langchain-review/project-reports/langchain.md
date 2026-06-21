# LangChain

## What it is

LangChain is LangChain AI's open-source framework for building agents and LLM-powered applications, positioned inside a broader "agent engineering platform" with LangGraph, Deep Agents, LangSmith, MCP adapters, Agent Protocol, and related tools. The live organization profile describes LangChain and LangChain.js as "reusable components and integrations for building LLM applications," while LangGraph builds agents as graphs and LangSmith provides the commercial platform for production-grade LLM application work ([profile README](https://github.com/langchain-ai/.github/blob/main/profile/README.md)). The LangChain repo README defines it as a framework for chaining interoperable components and third-party integrations for agents and LLM apps ([repo README](https://github.com/langchain-ai/langchain)).

## Core capabilities

Current LangChain v1 centers on `create_agent`, model/tool abstractions, provider integrations, structured output, middleware, streaming, short-term memory, retrieval, long-term memory, and human-in-the-loop flows ([LangChain overview](https://docs.langchain.com/oss/python/langchain/overview), [Agents](https://docs.langchain.com/oss/python/langchain/agents)). The framework can be used directly for a configurable agent harness, while LangGraph is the lower-level orchestration runtime for more explicit workflows and Deep Agents is the higher-level package for planning, subagents, virtual filesystem use, and context compression ([LangChain overview](https://docs.langchain.com/oss/python/langchain/overview), [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview)).

## How it works architecturally

The architecture is layered around "agent = model + harness." The agent loop calls a model, lets it choose tools, executes selected tools, and stops when no more tool calls are needed ([Agents](https://docs.langchain.com/oss/python/langchain/agents)). The harness includes the model, prompt, tools, and middleware that shapes behavior. LangChain v1 agents run on LangGraph under the hood, so compiled agents can inherit LangGraph capabilities such as persistence, streaming, durable execution, and human-in-the-loop pauses ([Runtime](https://docs.langchain.com/oss/python/langchain/runtime), [LangChain v1 release notes](https://docs.langchain.com/oss/python/releases/langchain-v1)). For more complex topologies, the docs describe using the agent as a node or subgraph inside a larger LangGraph `StateGraph` ([Middleware overview](https://docs.langchain.com/oss/python/langchain/middleware/overview)).

## Main abstractions / APIs

The main API is `create_agent(model=..., tools=..., system_prompt=..., middleware=..., response_format=..., context_schema=..., checkpointer=...)` ([Agents](https://docs.langchain.com/oss/python/langchain/agents)). Models use a standard chat model interface with `invoke`, `stream`, and `batch`, and can be initialized by provider/model strings or classes ([Models](https://docs.langchain.com/oss/python/langchain/models)). Tools are callable functions, LangChain tools, or tool dictionaries with schemas that are passed to chat models; the model decides when to request them and the agent loop executes them ([Tools](https://docs.langchain.com/oss/python/langchain/tools)). Structured output is configured through `response_format`, using provider-native structured output where available and tool-calling fallback otherwise ([Structured output](https://docs.langchain.com/oss/python/langchain/structured-output)). Middleware exposes lifecycle hooks such as `before_agent`, `before_model`, `wrap_model_call`, `wrap_tool_call`, `after_model`, and `after_agent` for context engineering, guardrails, retries, routing, and policy enforcement ([LangChain v1 release notes](https://docs.langchain.com/oss/python/releases/langchain-v1)).

## Operational model

LangChain can run as an embedded Python or TypeScript library, with model calls going to provider APIs configured by provider packages and credentials. Runtime context is passed per invocation, not hidden in globals: `context_schema` defines per-run context and `Runtime` exposes context, store, stream writer, execution info, and server info to tools and middleware ([Runtime](https://docs.langchain.com/oss/python/langchain/runtime)). Invocation usually supplies messages plus optional `config.configurable.thread_id`; the docs use `thread_id` to scope conversation history and checkpoints, while `context` carries per-run data for tools and middleware ([Agents](https://docs.langchain.com/oss/python/langchain/agents)). For deployment, the broader stack points to LangSmith Deployment / Agent Server, where server-managed persistence is available, but that is a platform choice rather than required for library use ([Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)).

## Persistence / state / checkpointing model

Persistence comes from LangGraph. It has two complementary systems: checkpointers for short-term, thread-scoped graph state and stores for long-term, cross-thread application-defined data ([Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)). Checkpointers save graph state snapshots at each super-step, organized by thread, enabling human-in-the-loop workflows, time-travel debugging, fault-tolerant execution, and conversational memory ([Checkpointers](https://docs.langchain.com/oss/python/langgraph/checkpointers)). Available checkpointer libraries include in-memory, SQLite, Postgres, and Azure Cosmos DB implementations; Postgres is described as production-oriented and used in LangSmith ([Checkpointers](https://docs.langchain.com/oss/python/langgraph/checkpointers)). Human-in-the-loop middleware requires checkpointing so execution can pause and resume after approval, edit, reject, or respond decisions ([Human-in-the-loop](https://docs.langchain.com/oss/python/langchain/human-in-the-loop)).

## Observability / evaluation / debugging support

LangSmith is the primary observability and evaluation product. The LangGraph docs recommend LangSmith tracing for request tracing, debugging agent behavior, and output evaluation ([LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview)). LangSmith Observability covers individual traces through production metrics, trace filtering/export/sharing/comparison, dashboards, alerts, automations, webhooks, and online evaluations ([LangSmith Observability](https://docs.langchain.com/langsmith/observability)). LangSmith Evaluation supports offline evaluation on curated datasets and online evaluation on production traffic, with human review, code rules, LLM-as-judge, and pairwise evaluators ([LangSmith Evaluation](https://docs.langchain.com/langsmith/evaluation)). LangGraph also exposes streaming modes for graph state, messages, custom data, checkpoints, tasks, and debug output, with docs recommending newer event streaming for new applications ([LangGraph streaming](https://docs.langchain.com/oss/python/langgraph/streaming)).

## Provider / model / tool integration model

LangChain has a large integration surface: the official docs say Python has 1000+ integrations across chat and embedding models, tools and toolkits, document loaders, vector stores, retrievers, and more ([Integrations overview](https://docs.langchain.com/oss/python/integrations/providers/overview)). Many providers ship as dedicated `langchain-<provider>` packages that implement standard interfaces, so applications can swap providers while keeping the same model, embedding, vector-store, or tool-facing code ([Integrations overview](https://docs.langchain.com/oss/python/integrations/providers/overview)). The model docs state that new model names can work immediately because provider packages pass model names through to provider APIs ([Models](https://docs.langchain.com/oss/python/langchain/models)). Tools can be normal Python callables or decorated tools, and model tool calls can be executed manually or by the agent loop ([Tools](https://docs.langchain.com/oss/python/langchain/tools), [Models](https://docs.langchain.com/oss/python/langchain/models)).

## Maturity and ecosystem notes

LangChain is mature and widely adopted by open-source signals: the repository currently shows about 140k stars, 23.2k forks, 16,309 commits, 327 issues, and 90 pull requests in the GitHub UI ([repo](https://github.com/langchain-ai/langchain)). The ecosystem is actively changing: the GitHub releases page showed `langchain==1.3.10` on 2026-06-18 and `langchain-core==1.4.8` marked latest the same day, with recent fixes around provider strategy detection, structured output fallbacks, streaming events, tracing metadata, and dependency updates ([releases](https://github.com/langchain-ai/langchain/releases)). v1 is explicitly a simplified namespace and production-ready agent foundation, with legacy functionality moved to `langchain-classic` ([LangChain v1 release notes](https://docs.langchain.com/oss/python/releases/langchain-v1)). The practical read is: strong ecosystem and velocity, but APIs and package layout continue to move.

## What looks relevant to kit-vnext

The most relevant ideas are architectural patterns, not direct adoption of LangChain as the control plane. LangGraph's explicit state graph, checkpointing, thread IDs, interrupt/resume model, and event/streaming surface map well to kit-vnext concerns around recoverable runs, external evidence, liveness, and human approval. The LangChain runtime/context pattern is also relevant: tools and middleware get explicit per-run context, stores, stream writers, and execution identity, which aligns with keeping dependencies injectable and avoiding hidden global state. Human-in-the-loop middleware is worth studying for policy-shaped approval of side-effecting tools, though kit-vnext already has stricter worker/runner separation and capability attestation requirements. LangSmith's split between traces, datasets, offline evals, online evals, dashboards, and feedback loops is relevant as a reference model for observability and analysis.

## What looks irrelevant or risky for kit-vnext

LangChain's core value is an LLM application and agent harness. kit-vnext's design says the control plane is deterministic plain code with agents rented behind bounded contracts, so adopting LangChain as an orchestrator would blur an important boundary. The broad provider/tool abstraction surface is useful for app builders, but it could add dependency churn, API drift, and implicit behavior around retries, model selection, tool routing, and middleware that conflicts with kit-vnext's "evidence over prose" and fail-closed capability model. LangSmith observability/evaluation is powerful but commercial/platform-coupled; any adoption would need a clean seam and a local/open fallback. The current v1/v1.3 release velocity is a maturity signal and a migration risk at the same time.

## Primary sources

- [LangChain AI organization profile README](https://github.com/langchain-ai/.github/blob/main/profile/README.md)
- [langchain-ai/langchain repository README](https://github.com/langchain-ai/langchain)
- [LangChain overview](https://docs.langchain.com/oss/python/langchain/overview)
- [LangChain agents](https://docs.langchain.com/oss/python/langchain/agents)
- [LangChain models](https://docs.langchain.com/oss/python/langchain/models)
- [LangChain tools](https://docs.langchain.com/oss/python/langchain/tools)
- [LangChain structured output](https://docs.langchain.com/oss/python/langchain/structured-output)
- [LangChain middleware overview](https://docs.langchain.com/oss/python/langchain/middleware/overview)
- [LangChain runtime](https://docs.langchain.com/oss/python/langchain/runtime)
- [LangChain human-in-the-loop](https://docs.langchain.com/oss/python/langchain/human-in-the-loop)
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview)
- [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [LangGraph checkpointers](https://docs.langchain.com/oss/python/langgraph/checkpointers)
- [LangGraph streaming](https://docs.langchain.com/oss/python/langgraph/streaming)
- [LangChain integrations overview](https://docs.langchain.com/oss/python/integrations/providers/overview)
- [LangSmith Observability](https://docs.langchain.com/langsmith/observability)
- [LangSmith Evaluation](https://docs.langchain.com/langsmith/evaluation)
- [LangChain v1 release notes](https://docs.langchain.com/oss/python/releases/langchain-v1)
- [LangChain GitHub releases](https://github.com/langchain-ai/langchain/releases)
