# LangChain.js

## What it is

LangChain.js is the TypeScript/JavaScript member of the LangChain open-source stack. The current LangChain profile lists LangChain.js as a core OSS library for reusable LLM application components and integrations, alongside LangGraph.js for graph-based agents and Deep Agents.js for higher-level agent patterns ([LangChain profile README](https://github.com/langchain-ai/.github/blob/main/profile/README.md)). The project README describes LangChain as a framework for building LLM-powered applications by composing interoperable components and third-party integrations ([langchainjs README](https://github.com/langchain-ai/langchainjs)).

Current docs position LangChain.js primarily around `createAgent`: a configurable agent harness composed from a model, tools, prompt, and middleware ([LangChain overview](https://docs.langchain.com/oss/javascript/langchain/overview)). For lower-level deterministic or agentic workflow orchestration, the docs point users to LangGraph.js; for batteries-included agent features, they point to Deep Agents ([LangChain overview](https://docs.langchain.com/oss/javascript/langchain/overview)).

## Core capabilities

- Agent harness: `createAgent` builds a model loop with tools, prompts, middleware, state, streaming, and optional persistence ([overview](https://docs.langchain.com/oss/javascript/langchain/overview), [agents](https://docs.langchain.com/oss/javascript/langchain/agents)).
- Standard model interface: chat models can be initialized directly or used inside agents, with provider packages behind a common interface ([models](https://docs.langchain.com/oss/javascript/langchain/models)).
- Tool calling: tools are typed callable functions, commonly schema-defined with Zod, that models may invoke during agent execution ([tools](https://docs.langchain.com/oss/javascript/langchain/tools)).
- Middleware: customization hooks for guardrails, retries/fallbacks, summarization, human review, call limits, context editing, filesystem, and subagents ([agents](https://docs.langchain.com/oss/javascript/langchain/agents), [prebuilt middleware](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in)).
- Streaming and event streaming: progress, token, tool-call, subgraph, and custom-update streams are supported; current docs recommend event streaming for new applications ([streaming](https://docs.langchain.com/oss/javascript/langchain/streaming)).
- Retrieval/RAG and integrations: the integration catalog covers chat models, embeddings, tools/toolkits, document loaders, vector stores, retrievers, key-value stores, and related backends ([integrations overview](https://docs.langchain.com/oss/javascript/integrations/providers/overview)).
- Observability and evals: LangSmith tracing is built in for agents, and AgentEvals supports deterministic trajectory matching and LLM-as-judge evaluation ([observability](https://docs.langchain.com/oss/javascript/langchain/observability), [agent evals](https://docs.langchain.com/oss/javascript/langchain/test/evals)).

## How it works architecturally

LangChain.js is a composable framework layered over provider packages and LangGraph runtime primitives. The top-level `langchain` package exports the agent harness and common APIs, while provider-specific packages such as `@langchain/openai`, `@langchain/anthropic`, `@langchain/google-genai`, and `@langchain/aws` implement the standard model interface ([models](https://docs.langchain.com/oss/javascript/langchain/models), [integrations overview](https://docs.langchain.com/oss/javascript/integrations/providers/overview)).

The current agent architecture is explicitly LangGraph-backed: the docs state that LangChain agents are built on LangGraph to inherit durable execution, persistence, human-in-the-loop support, and related runtime features ([overview](https://docs.langchain.com/oss/javascript/langchain/overview)). The runtime exposed to tools and middleware includes invocation context, a long-term memory store, a stream writer, execution info such as thread/run/attempt identity, and server metadata when running on LangGraph Server ([runtime](https://docs.langchain.com/oss/javascript/langchain/runtime)).

The repository itself is a pnpm/Turbo monorepo with workspaces for `libs/*`, `libs/providers/*`, `examples`, and `internal/*`; the root package is private, and the published `langchain` package currently declares Node `>=20`, depends on `@langchain/langgraph`, `@langchain/langgraph-checkpoint`, `langsmith`, and `zod`, and is published as an ESM package with CJS exports ([root package.json](https://raw.githubusercontent.com/langchain-ai/langchainjs/main/package.json), [pnpm workspace](https://raw.githubusercontent.com/langchain-ai/langchainjs/main/pnpm-workspace.yaml), [langchain package.json](https://raw.githubusercontent.com/langchain-ai/langchainjs/main/libs/langchain/package.json)).

## Main abstractions / APIs

- `createAgent({ model, tools, middleware, checkpointer, store, contextSchema, ... })`: the main harness for agent applications ([overview](https://docs.langchain.com/oss/javascript/langchain/overview), [agents](https://docs.langchain.com/oss/javascript/langchain/agents)).
- `initChatModel(...)` and provider model classes: provider-swappable model construction and direct model invocation ([models](https://docs.langchain.com/oss/javascript/langchain/models)).
- `tool(fn, { name, description, schema })`: schema-described callable tools for model-driven action ([tools](https://docs.langchain.com/oss/javascript/langchain/tools)).
- `createMiddleware(...)` and prebuilt middleware: hooks before/after model calls and tool calls; prebuilt options cover common production concerns ([agents](https://docs.langchain.com/oss/javascript/langchain/agents), [prebuilt middleware](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in)).
- `thread_id` plus `checkpointer`: scopes checkpointed short-term conversation state ([agents](https://docs.langchain.com/oss/javascript/langchain/agents), [short-term memory](https://docs.langchain.com/oss/javascript/langchain/short-term-memory)).
- `context`: immutable per-run data passed at invocation time to tools and middleware ([tools](https://docs.langchain.com/oss/javascript/langchain/tools), [runtime](https://docs.langchain.com/oss/javascript/langchain/runtime)).
- `BaseStore` / store implementations: long-term memory across sessions, accessed from runtime/tools ([tools](https://docs.langchain.com/oss/javascript/langchain/tools), [runtime](https://docs.langchain.com/oss/javascript/langchain/runtime)).
- `stream`, `streamEvents`: streaming APIs for progress, messages, tool calls, and custom updates ([streaming](https://docs.langchain.com/oss/javascript/langchain/streaming)).
- `humanInTheLoopMiddleware`: configurable pauses for sensitive tool calls, with approve/edit/reject/respond decisions ([human-in-the-loop](https://docs.langchain.com/oss/javascript/langchain/human-in-the-loop)).
- `MultiServerMCPClient` from `@langchain/mcp-adapters`: loads MCP server tools for LangChain agents ([MCP docs](https://docs.langchain.com/oss/javascript/langchain/mcp)).

## Operational model

Operationally, LangChain.js applications run inside the developer's JavaScript runtime rather than a mandatory hosted control plane. The README lists supported environments including Node.js 20/22/24, Cloudflare Workers, Vercel/Next.js browser/serverless/edge functions, Supabase Edge Functions, Browser, Deno, and Bun ([README](https://github.com/langchain-ai/langchainjs)).

Agents are invoked with input state and optional configuration. A `thread_id` scopes checkpointed conversation history, while `context` carries per-run data such as user/session IDs, dependency handles, API keys, or feature flags ([agents](https://docs.langchain.com/oss/javascript/langchain/agents), [runtime](https://docs.langchain.com/oss/javascript/langchain/runtime)). Model clients expose retry/timeout/max-token style parameters, including automatic retry on network, rate-limit, and server errors while avoiding retry on client errors such as 401/404 ([models](https://docs.langchain.com/oss/javascript/langchain/models)).

LangSmith is optional but deeply integrated for tracing, debugging, evaluation, and hosted deployment. Enabling tracing is environment-variable driven (`LANGSMITH_TRACING`, `LANGSMITH_API_KEY`, optionally `LANGSMITH_PROJECT`) and requires no extra code for normal agent traces ([observability](https://docs.langchain.com/oss/javascript/langchain/observability)).

## Persistence / state / checkpointing model

Short-term memory is thread-level agent state. LangChain agents store conversation state in the graph state and persist it through a checkpointer so a thread can resume; state is read at the start of each step and updated when the agent is invoked or completes a step such as a tool call ([short-term memory](https://docs.langchain.com/oss/javascript/langchain/short-term-memory)). Local examples use `MemorySaver`; production docs recommend a database-backed checkpointer and point to SQLite, Postgres, and Azure Cosmos DB options ([short-term memory](https://docs.langchain.com/oss/javascript/langchain/short-term-memory)).

Long-term memory uses a `BaseStore` namespace/key model for data that survives across conversations and sessions, distinct from short-term graph state ([tools](https://docs.langchain.com/oss/javascript/langchain/tools), [runtime](https://docs.langchain.com/oss/javascript/langchain/runtime)). Human-in-the-loop pauses rely on LangGraph persistence so execution can halt and resume after a human decision ([human-in-the-loop](https://docs.langchain.com/oss/javascript/langchain/human-in-the-loop)).

For kit-vnext, the important distinction is that LangChain persistence is application-agent state, not a substitute for kit-vnext's append-only event log. It can help a worker remember a conversation or tool context, but it should not become the source of truth for run state, evidence gates, or merge decisions.

## Observability / evaluation / debugging support

LangSmith tracing records agent execution from input to response, including tool calls, model interactions, and decision points; LangChain agents automatically support this tracing when configured ([observability](https://docs.langchain.com/oss/javascript/langchain/observability)). Traces can be scoped to projects, selectively attached with callbacks, and annotated with metadata/tags ([observability](https://docs.langchain.com/oss/javascript/langchain/observability)).

The docs also describe AgentEvals for trajectory-level evaluation. It supports deterministic trajectory matching when expected tool calls are known, and LLM-as-judge evaluation for qualitative behavior ([agent evals](https://docs.langchain.com/oss/javascript/langchain/test/evals)). Streaming and event streaming provide live feedback for agent progress, tokens, tool calls, subgraphs, and custom events ([streaming](https://docs.langchain.com/oss/javascript/langchain/streaming)).

These tools are useful for debugging worker behavior and comparing models/providers. They do not replace kit-vnext's requirement for externally verifiable evidence: CI status, review-thread state, exact head SHA, command output digests, and capability attestations need to remain first-class kit-vnext events.

## Provider / model / tool integration model

LangChain.js uses standalone provider packages for versioning, dependency management, and testing. The integration catalog lists popular packages for Anthropic, OpenAI, Google, AWS, Microsoft/Azure, Groq, Mistral, Ollama, vector stores such as PGVector/Pinecone/Qdrant/Redis/Weaviate, and tool providers such as Tavily and Exa ([integrations overview](https://docs.langchain.com/oss/javascript/integrations/providers/overview)). Provider packages implement a common model interface, and model names are generally passed through to provider APIs so new model names can work without a LangChain framework update ([models](https://docs.langchain.com/oss/javascript/langchain/models)).

Tools are ordinary functions wrapped with names, descriptions, and schemas; the model decides when to call them. Tool context can include immutable invocation context, long-term memory store access, stream writer access, execution info, and server metadata ([tools](https://docs.langchain.com/oss/javascript/langchain/tools), [runtime](https://docs.langchain.com/oss/javascript/langchain/runtime)). MCP support is via `@langchain/mcp-adapters`; the documented `MultiServerMCPClient` is stateless by default, creating a fresh MCP client session per tool invocation and cleaning it up afterward ([MCP docs](https://docs.langchain.com/oss/javascript/langchain/mcp)).

## Maturity and ecosystem notes

LangChain.js appears mature and active: the GitHub page shows roughly 17.8k stars, 3.2k forks, 7,985 commits, 970 releases, and a latest visible package release dated June 18, 2026 ([GitHub repo](https://github.com/langchain-ai/langchainjs)). The published core package in `main` is `langchain` version `1.4.3`, with Node `>=20` and dependencies on LangGraph, LangGraph checkpointing, LangSmith, and Zod ([langchain package.json](https://raw.githubusercontent.com/langchain-ai/langchainjs/main/libs/langchain/package.json)).

The ecosystem is broad but fast-moving. The docs and repo reference LangChain, LangGraph, Deep Agents, LangSmith, MCP adapters, AgentEvals, provider packages, and hosted LangSmith deployment surfaces. That breadth is useful for experimentation and integration coverage, but it also means adoption needs strict dependency boundaries and version pinning.

## What looks relevant to kit-vnext

- Agent-provider inspiration: LangChain's model/provider abstraction is close in spirit to kit-vnext's provider-seam rule. The useful part is the provider-package pattern, not the specific agent loop.
- Worker harness experiments: `createAgent`, tools, middleware, streaming, and LangSmith traces could be useful inside a future experimental AgentProvider driver, where LangChain is one worker implementation behind kit-vnext's Agent seam.
- Tool/schema conventions: Zod/Standard Schema-style tool definitions, structured output, and model profiles may inform adapter conformance tests for worker protocols and structured tool-exit observation.
- Human review patterns: `humanInTheLoopMiddleware` maps conceptually to approval gating, especially the explicit approve/edit/reject/respond decision types. kit-vnext would still need its own approval authority and event log.
- MCP compatibility: `@langchain/mcp-adapters` may be useful when evaluating MCP tool interop, especially because it documents stateless per-call sessions by default.
- Observability research: LangSmith traces and AgentEvals are strong references for worker behavior inspection, trajectory comparison, and model/provider debugging. They could complement, not replace, kit-vnext's deterministic evidence gates.
- Middleware catalog: call limits, retries/fallbacks, summarization, guardrails, PII detection, filesystem, and subagent middleware are useful examples of bounded cross-cutting behavior that kit-vnext could either forbid, attest, or isolate behind contracts.

## What looks irrelevant or risky for kit-vnext

- Not a control-plane substitute: LangChain's agent harness is model-driven; kit-vnext's core is explicitly deterministic, host-neutral, and evidence-gated. Putting LangChain in the control plane would violate the architecture's "plain code, no LLM orchestrator" direction.
- Persistence mismatch: LangChain checkpointing and stores are agent/application memory. kit-vnext's source of truth is an append-only run event log with deterministic projections; conflating the two would weaken recovery and auditability.
- Boundary leakage risk: LangChain tools can perform arbitrary side effects unless wrapped by a stricter execution host and approval policy. kit-vnext must keep Forge credentials, process containment, workspace writes, and work-source status writes behind its own seams.
- Provider churn: the ecosystem is active and broad; adopting it in core packages would add dependency churn, transitive security surface, and runtime variability. It belongs in optional drivers or experiments.
- LangSmith dependency risk: LangSmith is useful but commercial/external. kit-vnext should not make proprietary tracing or hosted execution a required gate unless explicitly designed as an optional provider.
- Autonomy ambiguity: Deep Agents/subagents/filesystem middleware overlap with kit-vnext concerns such as worker/runner isolation, supervision, and worktree ownership. Those features should be disabled or tightly attested unless the driver contract proves safe behavior.
- Current-source caveat: I did not find a primary-source guarantee that LangChain.js exposes all low-level events kit-vnext would need for `ToolObserved`, approval relay, resume ownership, or exact process supervision. Those capabilities would need direct probes before any AgentProvider design relied on them.

## Primary sources

- [LangChain organization profile README](https://github.com/langchain-ai/.github/blob/main/profile/README.md)
- [LangChain.js GitHub repository and README](https://github.com/langchain-ai/langchainjs)
- [LangChain JavaScript overview](https://docs.langchain.com/oss/javascript/langchain/overview)
- [LangChain JavaScript agents](https://docs.langchain.com/oss/javascript/langchain/agents)
- [LangChain JavaScript models](https://docs.langchain.com/oss/javascript/langchain/models)
- [LangChain JavaScript tools](https://docs.langchain.com/oss/javascript/langchain/tools)
- [LangChain JavaScript short-term memory](https://docs.langchain.com/oss/javascript/langchain/short-term-memory)
- [LangChain JavaScript runtime](https://docs.langchain.com/oss/javascript/langchain/runtime)
- [LangChain JavaScript streaming](https://docs.langchain.com/oss/javascript/langchain/streaming)
- [LangChain JavaScript human-in-the-loop](https://docs.langchain.com/oss/javascript/langchain/human-in-the-loop)
- [LangChain JavaScript MCP](https://docs.langchain.com/oss/javascript/langchain/mcp)
- [LangChain JavaScript integrations overview](https://docs.langchain.com/oss/javascript/integrations/providers/overview)
- [LangChain JavaScript observability](https://docs.langchain.com/oss/javascript/langchain/observability)
- [LangChain JavaScript AgentEvals](https://docs.langchain.com/oss/javascript/langchain/test/evals)
- [langchainjs root package.json](https://raw.githubusercontent.com/langchain-ai/langchainjs/main/package.json)
- [langchainjs pnpm workspace](https://raw.githubusercontent.com/langchain-ai/langchainjs/main/pnpm-workspace.yaml)
- [published langchain package.json](https://raw.githubusercontent.com/langchain-ai/langchainjs/main/libs/langchain/package.json)

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../README.md) · **← Prev:** [Deep Agents](./deep-agents.md) · **Next →:** [LangChain](./langchain.md)

<!-- /DOCS-NAV -->
