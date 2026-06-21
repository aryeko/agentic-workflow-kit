# LangGraph
## What it is

LangGraph is LangChain's low-level orchestration framework and runtime for building long-running, stateful LLM agents and workflows. The LangChain organization profile describes LangGraph/LangGraph.js as the OSS projects for building LLM agents as graphs, while LangChain remains the broader integration/component layer and LangSmith the commercial observability/evaluation/deployment platform ([LangChain profile README](https://github.com/langchain-ai/.github/blob/main/profile/README.md), [LangGraph repo](https://github.com/langchain-ai/langgraph)). The current docs explicitly say LangGraph is "very low-level" and focused on agent orchestration rather than prompt abstraction or high-level agent architecture ([overview](https://docs.langchain.com/oss/python/langgraph/overview)).

## Core capabilities

Primary capabilities are durable execution, persistence, human-in-the-loop interrupts, event/graph streaming, time travel, memory, subgraphs, and production deployment support through LangSmith/Agent Server surfaces ([overview](https://docs.langchain.com/oss/python/langgraph/overview), [persistence](https://docs.langchain.com/oss/python/langgraph/persistence), [interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts), [event streaming](https://docs.langchain.com/oss/python/langgraph/event-streaming)). It is meant for agent workflows that need explicit control over state and control flow rather than only a standard tool-calling loop.

## How it works architecturally

LangGraph models an application as state plus nodes plus edges. Nodes are functions that read current state and return partial updates; edges select the next node using fixed or conditional transitions. The runtime is inspired by Pregel: execution proceeds in discrete super-steps, nodes become active when they receive messages/state, parallel nodes run in the same super-step, and the graph terminates when all nodes are inactive and no messages are in transit ([Graph API overview](https://docs.langchain.com/oss/python/langgraph/graph-api)).

Graphs are compiled before use. Compilation performs structural checks and attaches runtime features such as checkpointers and breakpoints ([Graph API overview](https://docs.langchain.com/oss/python/langgraph/graph-api)). The event-streaming layer sits above raw Pregel events: raw graph events are routed through transformers into typed projections for messages, state values, subgraphs, interrupts, output, and custom extensions ([event streaming](https://docs.langchain.com/oss/python/langgraph/event-streaming)).

## Main abstractions / APIs

The main Graph API abstraction is `StateGraph`, parameterized by a state schema. State is usually a `TypedDict`, dataclass, or Pydantic model; state keys may define reducers for merging node updates, with default behavior overwriting values ([Graph API overview](https://docs.langchain.com/oss/python/langgraph/graph-api)). Common built-ins include `START`, `END`, `MessagesState`, `add_messages`, `Command`, and `interrupt()`.

LangGraph also offers a Functional API built on the same runtime. It uses `@entrypoint` and `@task` for ordinary Python control flow with checkpointed task results, while the Graph API is more explicit and visualizable. The docs state both APIs share the same underlying runtime and can be used together ([Functional API overview](https://docs.langchain.com/oss/python/langgraph/functional-api)).

## Operational model

Applications can run in-process by invoking or streaming a compiled graph, or can be deployed behind LangGraph/LangSmith server infrastructure. In-process execution exposes `invoke`, `stream`, and `stream_events`; server-backed execution uses Agent Server/LangSmith APIs, with server-managed persistence in that mode ([persistence](https://docs.langchain.com/oss/python/langgraph/persistence), [event streaming](https://docs.langchain.com/oss/python/langgraph/event-streaming)).

Operationally, each durable conversation/run is keyed by a `thread_id` in config. Interrupts and resumes use the same thread pointer to recover saved state; using a new thread ID starts a new execution state ([interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)). Recent releases show active maintenance of runtime details such as nested subgraph checkpoint namespaces, stream abort handling, RemoteGraph streaming, and CLI support ([GitHub releases](https://github.com/langchain-ai/langgraph/releases)).

## Persistence / state / checkpointing model

LangGraph separates short-term thread-scoped persistence from long-term application memory. Checkpointers persist graph state snapshots for a single thread and enable conversation continuity, human-in-the-loop, time travel, and fault tolerance. Stores persist application-defined key-value data across threads for user preferences, facts, and shared knowledge ([persistence](https://docs.langchain.com/oss/python/langgraph/persistence)).

Graph API checkpoints are generated after each super-step; Functional API task results are saved into the checkpoint associated with the entrypoint rather than recomputed on resume ([Functional API overview](https://docs.langchain.com/oss/python/langgraph/functional-api)). Time travel uses checkpoint history to replay from a prior checkpoint or fork from a checkpoint with modified state. The docs warn replay re-executes downstream nodes, including LLM calls, API requests, and interrupts, so side effects need care ([time travel](https://docs.langchain.com/oss/python/langgraph/use-time-travel)).

## Observability / evaluation / debugging support

LangGraph's own debugging surface includes graph visualization, raw stream modes such as `updates`, `values`, `messages`, `checkpoints`, `tasks`, and `debug`, and typed event-stream projections over messages, values, subgraphs, interrupts, final output, and custom extensions ([Graph API overview](https://docs.langchain.com/oss/python/langgraph/graph-api), [streaming](https://docs.langchain.com/oss/python/langgraph/streaming), [event streaming](https://docs.langchain.com/oss/python/langgraph/event-streaming)). The docs repeatedly recommend LangSmith for tracing, debugging agent behavior, evaluating outputs, and monitoring deployments ([overview](https://docs.langchain.com/oss/python/langgraph/overview), [LangSmith tracing quickstart](https://docs.langchain.com/langsmith/observability-quickstart), [LangSmith evaluation](https://docs.langchain.com/langsmith/evaluation)).

## Provider / model / tool integration model

LangGraph itself does not require LangChain, but the official docs commonly use LangChain model and tool components. The overview says LangGraph can be used without LangChain, while LangChain supplies the model/tool abstractions and common agent components around it ([overview](https://docs.langchain.com/oss/python/langgraph/overview)). Nodes are just functions, so provider calls, tools, side effects, and ordinary code live inside nodes; node signatures may receive state, runnable config, and runtime context including store, stream writer, execution info, heartbeat, and control hooks ([Graph API overview](https://docs.langchain.com/oss/python/langgraph/graph-api)). The LangChain profile also lists MCP Adapters as an OSS extension for making MCP tools compatible with LangChain and LangGraph ([LangChain profile README](https://github.com/langchain-ai/.github/blob/main/profile/README.md)).

## Maturity and ecosystem notes

The repository is large and active, with thousands of commits, many open issues/PRs, Python and JS/TS variants, and recent releases. As of the GitHub releases page observed on 2026-06-21, the latest listed Python package release was `langgraph==1.2.6` from 2026-06-18, with recent fixes around subgraph checkpoint namespaces and v3 stream abort handling ([GitHub repo](https://github.com/langchain-ai/langgraph), [GitHub releases](https://github.com/langchain-ai/langgraph/releases)). The ecosystem positioning is broader than a standalone library: Deep Agents is a higher-level harness on top of LangGraph, LangChain provides integrations/agent abstractions, and LangSmith provides tracing, evaluation, deployment, and production monitoring ([overview](https://docs.langchain.com/oss/python/langgraph/overview)).

## What looks relevant to kit-vnext

LangGraph is most relevant as a reference architecture for explicit, resumable, stateful orchestration: graph state, checkpointed execution, interrupt/resume semantics, typed streaming projections, and replay/fork behavior are all directly adjacent to a deterministic control plane. Its separation between low-level runtime, higher-level harnesses, provider integrations, and observability platform maps well to kit-vnext's interest in clear seams rather than an LLM orchestrator.

The most useful concrete ideas are: using thread/run IDs as durable cursors; treating human approval as a first-class interrupt that persists exact state; exposing execution evidence through typed event streams instead of prose; and making replay/fork semantics explicit enough that downstream side effects are visible and testable.

## What looks irrelevant or risky for kit-vnext

LangGraph's core mental model is LLM-agent workflow orchestration, not a forge-backed software delivery control plane with worker/runner isolation, Work Source authority, and an append-only event log. Its checkpoint/state persistence is not the same as kit-vnext's event log as single source of truth; adopting LangGraph's checkpoint model wholesale could blur state snapshots with authoritative events.

The LangSmith deployment/observability story is useful to study but risky as a dependency if kit-vnext needs provider neutrality, local-first operation, or strict control over credentials and forge boundaries. Replay/fork is also hazardous for software delivery unless side effects are idempotent or externally fenced; LangGraph's own docs note that replay re-executes downstream LLM calls, API requests, and interrupts ([time travel](https://docs.langchain.com/oss/python/langgraph/use-time-travel)).

## Primary sources

- [LangChain organization profile README](https://github.com/langchain-ai/.github/blob/main/profile/README.md)
- [langchain-ai/langgraph repository](https://github.com/langchain-ai/langgraph)
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview)
- [Graph API overview](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [Functional API overview](https://docs.langchain.com/oss/python/langgraph/functional-api)
- [Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [Event streaming](https://docs.langchain.com/oss/python/langgraph/event-streaming)
- [Streaming](https://docs.langchain.com/oss/python/langgraph/streaming)
- [Time travel](https://docs.langchain.com/oss/python/langgraph/use-time-travel)
- [LangGraph GitHub releases](https://github.com/langchain-ai/langgraph/releases)
- [LangSmith tracing quickstart](https://docs.langchain.com/langsmith/observability-quickstart)
- [LangSmith evaluation docs](https://docs.langchain.com/langsmith/evaluation)
