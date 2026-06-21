# Deep Agents.js

## What it is

Deep Agents.js is LangChain's TypeScript/JavaScript "batteries-included agent harness" for long-running agents that plan, use a virtual filesystem, delegate to subagents, and run on LangGraph. The LangChain organization profile lists Deep Agents.js alongside LangChain.js and LangGraph.js as an OSS core library for "agents that can plan, use subagents, and leverage file systems for complex tasks" ([LangChain profile README](https://github.com/langchain-ai/.github/blob/main/profile/README.md)). The project README describes it as an opinionated, ready-to-run harness rather than a bare framework: users can call `createDeepAgent()` immediately, then customize tools, model, and prompt ([repo README](https://github.com/langchain-ai/deepagentsjs/blob/main/libs/deepagents/README.md)).

## Core capabilities

Confirmed built-ins are planning with `write_todos`, filesystem tools (`ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`), subagent delegation via `task`, smart default prompts/middleware, and context-management workflows ([repo README](https://github.com/langchain-ai/deepagentsjs/blob/main/libs/deepagents/README.md); [tools docs](https://docs.langchain.com/oss/javascript/deepagents/tools)). The overview expands that into four capability groups: execution environment, context management, delegation, and steering, including tools/MCP, virtual filesystems, permissions, optional sandbox execution, streaming, skills, memory, summarization/offloading, prompt caching, subagents, todos, and human-in-the-loop interrupts ([overview docs](https://docs.langchain.com/oss/javascript/deepagents/overview)).

## How it works architecturally

Architecturally it is a LangChain agent plus a deterministic Deep Agents middleware stack. The TypeScript source shows `createDeepAgent()` calling LangChain `createAgent()` with built-in middleware for todos, filesystem, subagents, summarization, provider tool-call patching, optional async subagents, custom middleware, Anthropic prompt caching, memory, and HITL interrupts, then returning a compiled LangGraph-backed agent with metadata and a high recursion limit ([agent.ts](https://github.com/langchain-ai/deepagentsjs/blob/main/libs/deepagents/src/agent.ts)). The README explicitly says `createDeepAgent` returns a compiled LangGraph graph, so LangGraph streaming, Studio, checkpointers, and other runtime features are inherited rather than reimplemented ([repo README](https://github.com/langchain-ai/deepagentsjs/blob/main/libs/deepagents/README.md)).

## Main abstractions / APIs

The primary API is `createDeepAgent(params)`. Important parameters confirmed in source include `model`, `tools`, `systemPrompt`, `stateSchema`, `middleware`, `subagents`, `responseFormat`, `contextSchema`, `checkpointer`, `store`, `backend`, `interruptOn`, `name`, `memory`, `skills`, `permissions`, and `streamTransformers` ([types.ts](https://github.com/langchain-ai/deepagentsjs/blob/main/libs/deepagents/src/types.ts)). Public exports include middleware constructors, `StateBackend`, `StoreBackend`, `FilesystemBackend`, `CompositeBackend`, `ContextHubBackend`, `LocalShellBackend`, `LangSmithSandbox`, permissions types, harness profiles, skill loaders, stream types, and `createSubAgent` ([index.ts](https://github.com/langchain-ai/deepagentsjs/blob/main/libs/deepagents/src/index.ts)). The npm package exposes environment-specific entrypoints: `deepagents`, `deepagents/browser`, and `deepagents/node` ([package.json](https://github.com/langchain-ai/deepagentsjs/blob/main/libs/deepagents/package.json); [repo README](https://github.com/langchain-ai/deepagentsjs/blob/main/libs/deepagents/README.md)).

## Operational model

The runtime is a coordinator-worker agent pattern. The main agent plans and invokes tools; delegated `task` calls spin up isolated subagent runs that return a final result, while event streaming exposes coordinator and subagent activity separately ([subagent section in overview](https://docs.langchain.com/oss/javascript/deepagents/overview); [event streaming docs](https://docs.langchain.com/oss/javascript/deepagents/event-streaming)). In production, LangChain expects each invocation to carry a stable `thread_id` for checkpointed conversation state plus per-run `context` for user/session data; LangSmith/LangGraph deployments can provide runs, threads, store, checkpointer, auth, webhooks, cron, MCP/A2A exposure, and tracing ([going to production](https://docs.langchain.com/oss/javascript/deepagents/going-to-production)).

## Persistence / state / checkpointing model

Persistence is layered. The default `StateBackend` stores virtual filesystem files in LangGraph agent state for the current thread and can persist across turns when a checkpointer is used; `StoreBackend` writes to a LangGraph `BaseStore` for cross-thread durable storage; `FilesystemBackend` writes real local files; `CompositeBackend` routes path prefixes to different backends; `ContextHubBackend` stores files in a LangSmith Context Hub repo ([backends docs](https://docs.langchain.com/oss/javascript/deepagents/backends)). LangGraph checkpointing persists state at each step, supports resume after failures or HITL pauses, and enables time travel/replay; LangSmith deployments configure a persistent checkpointer automatically ([going to production](https://docs.langchain.com/oss/javascript/deepagents/going-to-production)). Memory uses `AGENTS.md` files loaded into the backend and can be updated over interactions ([overview docs](https://docs.langchain.com/oss/javascript/deepagents/overview)).

## Observability / evaluation / debugging support

The official path is LangSmith: the overview points to LangSmith for tracing, debugging, and evaluation, and the production guide says LangSmith Cloud deployments automatically send traces to a deployment-named project and recommends LangSmith Engine for monitoring and issue detection ([overview docs](https://docs.langchain.com/oss/javascript/deepagents/overview); [going to production](https://docs.langchain.com/oss/javascript/deepagents/going-to-production)). Deep Agents also exposes a v3 event stream with typed projections for messages, tool calls, subagents, values, output, middleware, subgraphs, and custom stream-transformer extensions; this is useful for debugging and UI progress surfaces ([types.ts](https://github.com/langchain-ai/deepagentsjs/blob/main/libs/deepagents/src/types.ts); [event streaming docs](https://docs.langchain.com/oss/javascript/deepagents/event-streaming)). Model docs reference a Deep Agents eval suite, but those results should be treated as coarse capability signals, not proof of fitness for kit-vnext workflows ([models docs](https://docs.langchain.com/oss/javascript/deepagents/models)).

## Provider / model / tool integration model

Deep Agents.js is provider-agnostic at the chat-model layer: docs say it works with any LangChain chat model that supports tool calling, using `provider:model` strings or configured model instances ([models docs](https://docs.langchain.com/oss/javascript/deepagents/models)). Custom tools are standard LangChain tools or compatible callables; MCP tools can be loaded with `@langchain/mcp-adapters` and passed directly to `createDeepAgent()` ([tools docs](https://docs.langchain.com/oss/javascript/deepagents/tools)). Tool-name collisions with built-in tools are rejected by `createDeepAgent()`, and harness profiles can alter prompts, tool descriptions, excluded tools, excluded middleware, and the default general-purpose subagent ([agent.ts](https://github.com/langchain-ai/deepagentsjs/blob/main/libs/deepagents/src/agent.ts)).

## Maturity and ecosystem notes

The package is MIT-licensed, TypeScript, and published as `deepagents`; current repo package metadata shows version `1.10.5` with dependencies on `@langchain/core`, `@langchain/langgraph`, `@langchain/langgraph-sdk`, `langchain`, `zod`, and supporting filesystem/glob/yaml libraries ([package.json](https://github.com/langchain-ai/deepagentsjs/blob/main/libs/deepagents/package.json)). The GitHub page showed 523 commits, roughly 1.4k stars, 216 forks, 10 issues, 21 PRs, and 96 releases at research time; the latest GitHub release visible was `deepagents-acp@0.1.15` on 2026-06-18, whose notes update `deepagents@1.10.5` ([repo page](https://github.com/langchain-ai/deepagentsjs); [latest release API](https://api.github.com/repos/langchain-ai/deepagentsjs/releases/latest)). Some docs pages contain occasional Python-style names such as `create_deep_agent` in prose/snippets, so TypeScript adoption should verify exact API names against the package source and reference docs.

## What looks relevant to kit-vnext

The most relevant ideas are the explicit coordinator/subagent model, typed streaming projections for delegated work, backend abstraction for filesystem-like working memory, configurable permissions, HITL interrupts on sensitive tools, and separation of thread-scoped scratch state from cross-thread store-backed memory. The architecture is also useful as a contrast: Deep Agents.js intentionally embeds an LLM-driven coordinator, while kit-vnext's current invariants require a deterministic control plane and rented bounded workers. That makes Deep Agents.js more relevant as a potential worker harness, research baseline, or UI/streaming reference than as a direct replacement for kit-vnext's core orchestration.

## What looks irrelevant or risky for kit-vnext

The README states a "trust the LLM" model: the agent can do anything its tools allow, and boundaries must be enforced at the tool/sandbox layer ([repo README](https://github.com/langchain-ai/deepagentsjs/blob/main/libs/deepagents/README.md)). That conflicts with kit-vnext if used inside the control plane rather than behind a strict Agent/Execution Host seam. `FilesystemBackend` and especially `LocalShellBackend` are risky for shared or production contexts because the docs warn about secret exposure, irreversible filesystem changes, and unrestricted host shell execution ([backends docs](https://docs.langchain.com/oss/javascript/deepagents/backends)). Its strongest production story is tied to LangGraph/LangSmith infrastructure, stores, checkpointers, tracing, and deployments, which may be too opinionated if kit-vnext wants provider neutrality across host, forge, and work-source seams.

## Primary sources

- [LangChain organization profile README](https://github.com/langchain-ai/.github/blob/main/profile/README.md)
- [Deep Agents.js repository](https://github.com/langchain-ai/deepagentsjs)
- [Deep Agents.js README](https://github.com/langchain-ai/deepagentsjs/blob/main/libs/deepagents/README.md)
- [Deep Agents.js package metadata](https://github.com/langchain-ai/deepagentsjs/blob/main/libs/deepagents/package.json)
- [Deep Agents.js `createDeepAgent` source](https://github.com/langchain-ai/deepagentsjs/blob/main/libs/deepagents/src/agent.ts)
- [Deep Agents.js public exports](https://github.com/langchain-ai/deepagentsjs/blob/main/libs/deepagents/src/index.ts)
- [Deep Agents.js types](https://github.com/langchain-ai/deepagentsjs/blob/main/libs/deepagents/src/types.ts)
- [LangChain Deep Agents overview](https://docs.langchain.com/oss/javascript/deepagents/overview)
- [LangChain Deep Agents tools](https://docs.langchain.com/oss/javascript/deepagents/tools)
- [LangChain Deep Agents models](https://docs.langchain.com/oss/javascript/deepagents/models)
- [LangChain Deep Agents backends](https://docs.langchain.com/oss/javascript/deepagents/backends)
- [LangChain Deep Agents human-in-the-loop](https://docs.langchain.com/oss/javascript/deepagents/human-in-the-loop)
- [LangChain Deep Agents event streaming](https://docs.langchain.com/oss/javascript/deepagents/event-streaming)
- [LangChain Deep Agents production guide](https://docs.langchain.com/oss/javascript/deepagents/going-to-production)
- [Deep Agents.js latest release API](https://api.github.com/repos/langchain-ai/deepagentsjs/releases/latest)

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../README.md) · **← Prev:** [Deep Agents Code](./deep-agents-code.md) · **Next →:** [Deep Agents](./deep-agents.md)

<!-- /DOCS-NAV -->
