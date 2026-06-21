# LangGraph.js

## What it is

LangGraph.js is LangChain's TypeScript/JavaScript library for building stateful, long-running agent workflows as graphs. LangChain's org profile lists LangGraph.js as one of its core OSS libraries for building LLM agents as graphs, alongside LangChain.js and Deep Agents.js ([LangChain profile README](https://github.com/langchain-ai/.github/blob/main/profile/README.md)). The LangGraph.js repository describes it as a low-level orchestration framework for controllable agents, with durable execution, long-term memory, and human-in-the-loop support ([repo README](https://github.com/langchain-ai/langgraphjs)).

It is not a general CI/PR control plane. The official docs frame LangGraph as an agent orchestration runtime for durable execution, streaming, human-in-the-loop, and persistence, while model/tool integrations live mostly in LangChain and tracing/evaluation/deployment in LangSmith ([overview](https://docs.langchain.com/oss/javascript/langgraph/overview)).

## Core capabilities

- Graph-based agent/workflow composition with explicit state, nodes, and edges ([Graph API overview](https://docs.langchain.com/oss/javascript/langgraph/graph-api)).
- Durable execution and resumability via checkpointing, including recovery from failures and long-running workflows ([overview](https://docs.langchain.com/oss/javascript/langgraph/overview), [checkpointers](https://docs.langchain.com/oss/javascript/langgraph/checkpointers)).
- Human-in-the-loop pauses using `interrupt()` and resume via `Command({ resume })` ([interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts)).
- Short-term thread memory and long-term stores ([persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence)).
- Streaming of state updates, full values, LLM tokens, custom data, tool lifecycle events, and debug events ([streaming](https://docs.langchain.com/oss/javascript/langgraph/streaming)).
- Retry and timeout policies for graph nodes, plus Functional API task retries/timeouts ([fault tolerance](https://docs.langchain.com/oss/javascript/langgraph/fault-tolerance)).
- LangSmith-backed tracing, debugging, evaluation, Studio, and deployment hooks where teams choose the LangSmith stack ([overview](https://docs.langchain.com/oss/javascript/langgraph/overview)).

## How it works architecturally

The Graph API models execution as state plus functions. A `StateGraph` has shared state, nodes that compute updates or side effects, and edges that determine the next node. LangGraph uses a Pregel-inspired message-passing runtime with discrete "super-steps"; parallel nodes run in the same super-step, inactive nodes halt, and the graph terminates when no nodes are active and no messages are in transit ([Graph API overview](https://docs.langchain.com/oss/javascript/langgraph/graph-api)).

State is schema-driven. `StateSchema` can use standard schemas such as Zod, `ReducedValue` reducers, `MessagesValue` for chat-message lists, and `UntrackedValue` for transient state excluded from checkpoints ([Graph API overview](https://docs.langchain.com/oss/javascript/langgraph/graph-api)). Compilation validates graph structure and attaches runtime options such as checkpointers and breakpoints before the graph can be invoked.

The Functional API exposes the same runtime through `entrypoint` and `task` rather than an explicit graph. It is meant for existing code that uses normal `if` / loop / function-call control flow, while still adding persistence, memory, human-in-the-loop, and streaming ([Functional API overview](https://docs.langchain.com/oss/javascript/langgraph/functional-api)).

## Main abstractions / APIs

- `StateGraph`: main declarative graph builder for nodes, normal edges, conditional edges, `START`, and `END` ([Graph API overview](https://docs.langchain.com/oss/javascript/langgraph/graph-api)).
- `StateSchema`, `ReducedValue`, `MessagesValue`, `UntrackedValue`: state channels, reducers, message-list handling, and transient state ([Graph API overview](https://docs.langchain.com/oss/javascript/langgraph/graph-api)).
- `GraphNode` and `ConditionalEdgeRouter`: typed node and routing functions ([quickstart](https://docs.langchain.com/oss/javascript/langgraph/quickstart)).
- `Command`: primitive for updating state, routing with `goto`, returning to parent graphs, and resuming interrupts ([Graph API overview](https://docs.langchain.com/oss/javascript/langgraph/graph-api)).
- `interrupt`: dynamic human-in-the-loop pause point that persists graph state and returns control to the caller until resumed ([interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts)).
- `entrypoint` and `task`: Functional API wrappers for resumable workflows and checkpointed units of work ([Functional API overview](https://docs.langchain.com/oss/javascript/langgraph/functional-api)).
- `MemorySaver`, `MemoryStore`, and external saver/store packages: persistence adapters for checkpoints and long-term store data ([persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence)).
- `ToolNode`: a prebuilt node for tool execution, including parallel tool execution, error handling, and state injection ([workflows and agents](https://docs.langchain.com/oss/javascript/langgraph/workflows-agents)).

## Operational model

LangGraph can run as an embedded library or behind LangGraph/LangSmith deployment infrastructure. In embedded use, application code compiles a graph and calls `invoke`, `stream`, or `streamEvents`. A `thread_id` in config identifies a persistent execution thread when checkpointing is enabled ([persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence), [interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts)).

Operationally, durable workflows require discipline around replay. The Functional API docs state that resume does not continue from the same source line; execution replays from a checkpoint boundary, restoring completed task/subgraph results. Side effects and nondeterministic work should be put in tasks and designed idempotently, because unfinished tasks may run again after failure or resume ([Functional API overview](https://docs.langchain.com/oss/javascript/langgraph/functional-api)).

Fault handling is per-node/per-task. Graph nodes can declare retry policies and timeouts; failed attempts can be retried according to exception/backoff rules, and timeout failures clear buffered writes before retry/error handling ([fault tolerance](https://docs.langchain.com/oss/javascript/langgraph/fault-tolerance)).

## Persistence / state / checkpointing model

LangGraph splits persistence into checkpointers and stores. Checkpointers persist thread-scoped graph state snapshots for conversation continuity, human-in-the-loop, time travel, and fault tolerance. Stores persist application-defined key-value data across threads for longer-term memory ([persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence)).

Checkpoints are saved by super-step and organized by `thread_id`. The API supports inspecting current state, state history, replaying from a prior `checkpoint_id`, and `updateState()` to create a new checkpoint with edited values rather than mutating the original checkpoint ([checkpointers](https://docs.langchain.com/oss/javascript/langgraph/checkpointers)).

This is close in spirit to event-sourced recovery, but it is not the same as kit-vnext's append-only run event log. LangGraph checkpoints are runtime state snapshots for graph execution; kit-vnext requires run activity to be an authored event log and projections to be derived from that log.

## Observability / evaluation / debugging support

LangGraph exposes runtime streams for state updates, full values, LLM token chunks, custom data, tool lifecycle events, checkpoints/tasks, and debug output ([streaming](https://docs.langchain.com/oss/javascript/langgraph/streaming)). Graph API visualization is supported, while the Functional API docs note that it does not support visualization because its graph is dynamically generated at runtime ([Functional API overview](https://docs.langchain.com/oss/javascript/langgraph/functional-api)).

The official docs repeatedly route observability, evaluation, tracing, Studio debugging, and deployment monitoring to LangSmith. The overview says LangSmith handles tracing, evaluation, prompts, and deployment across frameworks, while LangSmith Engine can inspect LangGraph traces and propose fixes ([overview](https://docs.langchain.com/oss/javascript/langgraph/overview)). This is useful if adopting LangSmith, but it is an external platform dependency rather than a neutral local evidence model.

## Provider / model / tool integration model

LangGraph does not require LangChain, but the docs commonly use LangChain components for models and tools ([overview](https://docs.langchain.com/oss/javascript/langgraph/overview)). The quickstart shows `@langchain/anthropic`, `@langchain/core/tools`, model `bindTools`, `MessagesValue`, and a loop where the model node emits tool calls and a tool node executes them ([quickstart](https://docs.langchain.com/oss/javascript/langgraph/quickstart)).

LangChain's model docs describe tool calling as schemas plus executable functions, bound to models with `bindTools`; when not using an agent, application code must execute requested tools and feed results back to the model ([LangChain models](https://docs.langchain.com/oss/javascript/langchain/models)). LangGraph can implement that loop manually or through prebuilt pieces like `ToolNode` ([workflows and agents](https://docs.langchain.com/oss/javascript/langgraph/workflows-agents)).

For kit-vnext, this integration model is too model/tool-centric to substitute for the four provider seams. LangGraph can orchestrate an agent loop, but it does not natively encode kit-vnext concepts such as Forge credential isolation, Work Source authority, Execution Host containment, or capability attestation.

## Maturity and ecosystem notes

The project appears active and mature enough to evaluate seriously: the GitHub repo shows thousands of commits, TypeScript as the dominant language, MIT license, and hundreds of releases/tags ([repo](https://github.com/langchain-ai/langgraphjs)). Recent releases in June 2026 include `@langchain/langgraph@1.4.4`, `@langchain/langgraph-sdk@1.9.23`, and checkpoint package fixes, including concurrency and replay determinism fixes ([GitHub releases](https://github.com/langchain-ai/langgraphjs/releases)).

The same release notes also show that the runtime is still evolving in areas kit-vnext cares about: concurrent invocation isolation, cross-runtime serialization of `Overwrite`, deterministic replay of concurrent delta-channel writes, and Redis checkpoint reconstruction fixes all changed recently ([GitHub releases](https://github.com/langchain-ai/langgraphjs/releases)). Those are healthy maintenance signals, but they are also adoption risk for a control plane that needs stable, auditable semantics.

## What looks relevant to kit-vnext

- The explicit graph model is useful as prior art for representing bounded worker flows, approval pauses, recovery branches, and retry/timeout behavior without hiding control flow in prompts.
- Checkpoint inspection, replay, state history, and `updateState()` are relevant patterns for resumability and operator intervention, especially around paused or failed long-running tasks ([checkpointers](https://docs.langchain.com/oss/javascript/langgraph/checkpointers)).
- `interrupt()` plus durable resume is directly relevant to parked human approvals, though kit-vnext would need its own event authority and policy gates around it ([interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts)).
- Streaming modes and debug/task/tool events are relevant as a comparison point for supervision and liveness signals ([streaming](https://docs.langchain.com/oss/javascript/langgraph/streaming)).
- The Functional API's warnings about replay, idempotency, and side effects align with kit-vnext's deterministic replay requirement and are worth mining for operator guidance and test cases ([Functional API overview](https://docs.langchain.com/oss/javascript/langgraph/functional-api)).

## What looks irrelevant or risky for kit-vnext

- LangGraph is an agent orchestration runtime; kit-vnext is a deterministic control plane with hard seams for Agent, Execution Host, Forge, and Work Source. Using LangGraph as the core orchestrator would blur those boundaries unless heavily wrapped.
- LangGraph checkpoint state is not a substitute for kit-vnext's append-only event log. It records resumable runtime state, not necessarily the full evidence trail needed for gates, replay, audit, and two-authority separation.
- LangSmith observability/evaluation/deployment is useful but platform-coupled. kit-vnext should not make required evidence gates depend on LangSmith unless the design explicitly adds it behind a provider seam.
- Tool/model integration is optimized for LLM applications, not for runner-owned verification, PR/review state, merge queues, credential scoping, or work-source status authority.
- Replay semantics create side-effect risk. LangGraph's own docs require idempotent task design and warn that resume replays from checkpoint boundaries rather than source lines ([Functional API overview](https://docs.langchain.com/oss/javascript/langgraph/functional-api)).
- Recent release notes include fixes for concurrent invocation leakage and checkpoint replay determinism. That does not disqualify the project, but it argues against adopting it as kit-vnext's control-plane substrate without conformance probes pinned to exact package versions ([GitHub releases](https://github.com/langchain-ai/langgraphjs/releases)).

## Primary sources

- [LangChain GitHub profile README](https://github.com/langchain-ai/.github/blob/main/profile/README.md)
- [LangGraph.js GitHub repository](https://github.com/langchain-ai/langgraphjs)
- [LangGraph.js releases](https://github.com/langchain-ai/langgraphjs/releases)
- [LangGraph overview](https://docs.langchain.com/oss/javascript/langgraph/overview)
- [Graph API overview](https://docs.langchain.com/oss/javascript/langgraph/graph-api)
- [Functional API overview](https://docs.langchain.com/oss/javascript/langgraph/functional-api)
- [Persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence)
- [Checkpointers](https://docs.langchain.com/oss/javascript/langgraph/checkpointers)
- [Interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts)
- [Streaming](https://docs.langchain.com/oss/javascript/langgraph/streaming)
- [Fault tolerance](https://docs.langchain.com/oss/javascript/langgraph/fault-tolerance)
- [Workflows and agents](https://docs.langchain.com/oss/javascript/langgraph/workflows-agents)
- [LangChain models and tool calling](https://docs.langchain.com/oss/javascript/langchain/models)

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../README.md) · **← Prev:** [LangChain](./langchain.md) · **Next →:** [LangGraph](./langgraph.md)

<!-- /DOCS-NAV -->
