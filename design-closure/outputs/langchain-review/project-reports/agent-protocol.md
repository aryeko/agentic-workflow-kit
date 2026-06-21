# Agent Protocol

## What it is

Agent Protocol is LangChain's framework-agnostic HTTP/API specification for serving LLM agents in production. The upstream profile README lists it as an OSS extension and describes it as "codifying the framework-agnostic APIs that are needed to serve LLM agents in production" ([LangChain GitHub profile](https://github.com/langchain-ai/.github/blob/main/profile/README.md), [Agent Protocol repo](https://github.com/langchain-ai/agent-protocol)). LangGraph Platform implements a superset, but the repo explicitly invites other community implementations ([repo README](https://github.com/langchain-ai/agent-protocol)).

The protocol is not an agent framework. It is a serving contract around three core concepts: runs for executing agents, threads for multi-turn state, and store for long-term memory ([repo README](https://github.com/langchain-ai/agent-protocol#why-agent-protocol)).

## Core capabilities

- Ephemeral one-shot runs: `POST /runs/wait` and `POST /runs/stream` create a temporary thread/run and return or stream output ([OpenAPI spec](https://langchain-ai.github.io/agent-protocol/openapi.json)).
- Persistent multi-turn threads: create/search/get/copy/delete/patch threads, inspect thread history, and maintain current `values` plus optional `messages` ([repo README](https://github.com/langchain-ai/agent-protocol#threads-multi-turn-interactions), [OpenAPI spec](https://langchain-ai.github.io/agent-protocol/openapi.json)).
- Background runs: create, search, get, cancel, delete, wait for, or stream existing runs ([repo README](https://github.com/langchain-ai/agent-protocol#background-runs-atomic-agent-executions)).
- Agent introspection: search agents, get agent metadata/capabilities, and fetch JSON Schemas for input/output/state/config ([repo README](https://github.com/langchain-ai/agent-protocol#agents-introspection), [OpenAPI spec](https://langchain-ai.github.io/agent-protocol/openapi.json)).
- Long-term memory store: CRUD/search items by namespace/key and list namespaces ([repo README](https://github.com/langchain-ai/agent-protocol#store-long-term-memory)).
- Thread-centric streaming: SSE, WebSocket, and command sidecar endpoints for messages, tools, lifecycle, input, values, updates, checkpoints, tasks, and custom channels ([streaming README](https://github.com/langchain-ai/agent-protocol/blob/main/streaming/README.md)).

## How it works architecturally

Architecturally, Agent Protocol defines a service boundary in front of one or more agents. Clients call a standard REST/OpenAPI surface, and the implementation maps those requests to the underlying agent runtime. The main resources are agents, threads, runs, store items, and streaming subscriptions ([OpenAPI docs](https://langchain-ai.github.io/agent-protocol/api.html), [JSON spec](https://langchain-ai.github.io/agent-protocol/openapi.json)).

Threads are the durable routing key for state, checkpoints, run history, and stream routing. Runs are invocations that may update a thread. Store items are cross-thread long-term memories. Streaming is thread-scoped and separates durable thread identity from ephemeral client connections ([streaming README](https://github.com/langchain-ai/agent-protocol/blob/main/streaming/README.md)).

The spec is framework-neutral, but its concepts map closely to LangGraph: state values, checkpoints, interrupts, resumes, namespaces, graph updates, and tool/lifecycle events. The official resources include a LangGraph.js API implementation with in-memory storage and self-hosted async subagent examples in Python and TypeScript ([repo README resources](https://github.com/langchain-ai/agent-protocol#resources)).

## Main abstractions / APIs

- `Agent`: an invocable actor with `agent_id`, name, metadata, and capabilities. Standard capabilities include `ap.io.messages` and `ap.io.streaming`; implementations may add custom reverse-domain capabilities ([OpenAPI spec](https://langchain-ai.github.io/agent-protocol/openapi.json)).
- `AgentSchema`: JSON Schema metadata for agent input, output, state, and config ([OpenAPI spec](https://langchain-ai.github.io/agent-protocol/openapi.json)).
- `Thread`: a persistent container with id, timestamps, metadata, status, optional current state `values`, and optional `messages` ([OpenAPI spec](https://langchain-ai.github.io/agent-protocol/openapi.json)).
- `ThreadState` and `ThreadCheckpoint`: historical state snapshots identified by checkpoint ids; history is exposed via `/threads/{thread_id}/history` ([OpenAPI spec](https://langchain-ai.github.io/agent-protocol/openapi.json)).
- `Run`: an invocation request/record with input, messages, config, metadata, webhook, lifecycle options, and status. Current run statuses are `pending`, `error`, `success`, `timeout`, and `interrupted` ([OpenAPI spec](https://langchain-ai.github.io/agent-protocol/openapi.json)).
- `Store Item`: a namespace/key/value document with timestamps, intended for cross-thread memory ([OpenAPI spec](https://langchain-ai.github.io/agent-protocol/openapi.json)).
- `EventStreamRequest`: channel, namespace, depth, and sequence replay selection for SSE streams ([OpenAPI spec](https://langchain-ai.github.io/agent-protocol/openapi.json)).

## Operational model

The operational model supports both synchronous and asynchronous execution:

- `POST /runs/wait` blocks until a new ephemeral run finishes.
- `POST /runs/stream` creates an ephemeral run and streams output.
- `POST /runs` starts a background run and returns immediately.
- `GET /runs/{run_id}/wait` waits for an existing run.
- `GET /runs/{run_id}/stream` joins future output for an existing run.
- `POST /runs/{run_id}/cancel` supports `interrupt` or `rollback` cancellation modes ([OpenAPI spec](https://langchain-ai.github.io/agent-protocol/openapi.json)).

Thread concurrency is part of the intended contract: the README says only one run per thread should be active at a time, with concurrent handling such as interrupt, enqueue, interrupt, or rollback discussed as a requirement; the roadmap still calls out adding a parameter to allow concurrent runs on a thread, so concurrency semantics appear not fully settled in the public spec ([repo README](https://github.com/langchain-ai/agent-protocol#threads-multi-turn-interactions), [roadmap](https://github.com/langchain-ai/agent-protocol#roadmap)).

## Persistence / state / checkpointing model

Thread state is developer-defined JSON-like data. The OpenAPI tag description says a thread keeps accumulated outputs, tracks agent state at every step, and applies checkpoints so clients can query latest state, specific state, full history, or partial history from a checkpoint ([OpenAPI spec](https://langchain-ai.github.io/agent-protocol/openapi.json)).

The README describes thread history as an append-only log of states and notes storage may optimize by storing diffs ([repo README](https://github.com/langchain-ai/agent-protocol#threads-multi-turn-interactions)). Streaming adds checkpoint events with ids, optional parent ids, superstep numbers, and sources such as input, loop, update, or fork; clients can fetch full state lazily with state commands or correlate checkpoints with `values` events ([streaming README](https://github.com/langchain-ai/agent-protocol/blob/main/streaming/README.md)).

Long-term memory is separate from thread state. The Store API manages namespace/key/value items and search/list operations for memory that can be available from any thread ([repo README](https://github.com/langchain-ai/agent-protocol#store-long-term-memory)).

## Observability / evaluation / debugging support

The protocol has strong execution observability primitives but does not define evaluation scoring. Thread history, checkpoints, state reads, state forks, lifecycle events, tool events, message deltas, state snapshots, state updates, and human-in-the-loop input events are all intended to make live runs inspectable and replayable ([streaming README](https://github.com/langchain-ai/agent-protocol/blob/main/streaming/README.md)).

The official LangChain announcement positions Agent Protocol partly as a way to connect LangGraph Studio to locally running agents, so Studio can visualize, interact with, and debug an agent server that implements the protocol ([LangChain blog](https://www.langchain.com/blog/agent-protocol-interoperability-for-llm-agents)). I did not find a primary Agent Protocol source that defines an evaluation result format, benchmark format, or pass/fail gate API.

## Provider / model / tool integration model

Agent Protocol does not prescribe model providers or tool runtimes. It standardizes the serving surface and payloads around agents. Messages are a first-class optional field and are described as a subset of major provider message formats, including OpenAI and Anthropic ([repo README](https://github.com/langchain-ai/agent-protocol#messages)).

The streaming protocol exposes tool lifecycle events independently of the model/provider implementation: `tool-started`, tool output deltas, `tool-finished`, and `tool-error`, correlated back to model tool-call content blocks by tool call id ([streaming README](https://github.com/langchain-ai/agent-protocol/blob/main/streaming/README.md)). Content blocks are extensible for text, reasoning, tool calls, server-side tool calls, multimodal data, and provider-specific extensions, so provider details can flow through without becoming the top-level API contract ([streaming README](https://github.com/langchain-ai/agent-protocol/blob/main/streaming/README.md)).

## Maturity and ecosystem notes

Current public maturity appears mixed. The hosted OpenAPI spec reports version `0.1.6` ([JSON spec](https://langchain-ai.github.io/agent-protocol/openapi.json)). GitHub shows the latest release as `langchain-protocol==0.0.18` dated June 18, 2026, with 14 releases, 612 stars, 53 forks, 11 open issues, and 8 open pull requests at the time checked ([repo page](https://github.com/langchain-ai/agent-protocol)). PyPI classifies `langchain-protocol` as `Development Status :: 3 - Alpha` and describes it as Python bindings for the LangChain agent streaming protocol ([PyPI metadata](https://pypi.org/pypi/langchain-protocol/json)).

There are useful generated artifacts, but they should not be mistaken for a complete production SDK. The repo provides Python server stubs generated from OpenAPI and generated Python/TypeScript streaming payload bindings, while the streaming README explicitly says those bindings do not include transport implementations, connection management, or helper APIs ([repo README resources](https://github.com/langchain-ai/agent-protocol#resources), [streaming README](https://github.com/langchain-ai/agent-protocol/blob/main/streaming/README.md)). The Python client package metadata still has OpenAPI-generator placeholders such as `GIT_USER_ID/GIT_REPO_ID`, which suggests rough edges in generated client packaging ([client pyproject](https://github.com/langchain-ai/agent-protocol/blob/main/client-python/pyproject.toml)).

## What looks relevant to kit-vnext

- The agent introspection model is directly relevant to kit-vnext capability attestation. `Agent.capabilities` and `/agents/{agent_id}/schemas` provide a concrete shape for discovering supported I/O modes and schemas before delegating work.
- Runs and background-run lifecycle APIs line up with kit-vnext's need to supervise external workers without embedding provider-specific runtime details in the control plane.
- Thread history, checkpoint ids, interrupt/resume semantics, state forks, and replayable streaming are useful reference material for recoverability and auditability, even if kit-vnext keeps its own event log as the source of truth.
- The streaming channel split is a practical taxonomy for worker observation: lifecycle, messages, tools, values, updates, checkpoints, tasks, custom. Kit-vnext could adapt this as an Agent seam driver contract or compatibility adapter, not as core domain law.
- The explicit separation between threads, runs, and store is a useful comparison point for kit-vnext's "two authorities" rule: run activity belongs in the control/event plane, while task status should remain with the work source.

## What looks irrelevant or risky for kit-vnext

- The protocol is agent-serving centric, not code-delivery centric. It does not define forge credentials, PR creation, review-thread handling, verification gates, branch/worktree safety, or worker/runner separation.
- Its thread is both state container and run registry. Kit-vnext's append-only event log and work-source status authority should not be replaced by Agent Protocol thread state.
- The public maturity signal is still alpha/early: OpenAPI `0.1.6`, PyPI alpha classifier, generated bindings without transport clients, and roadmap items for stream-mode detail, vector store search, replay parameters, and concurrent thread runs.
- LangGraph concepts leak through the streaming model: namespaces, graph state, Pregel tasks, checkpoints, and `Command(resume, update, goto)` semantics. That is fine for a LangGraph adapter but risky as a framework-neutral core contract for kit-vnext.
- Store is a generic long-term memory API. For kit-vnext, durable evidence, credentials, work-source records, and event logs need stricter ownership, retention, redaction, and verification semantics than a generic namespace/key/value memory surface provides.

## Primary sources

- [LangChain GitHub profile README](https://github.com/langchain-ai/.github/blob/main/profile/README.md)
- [Agent Protocol GitHub repository and README](https://github.com/langchain-ai/agent-protocol)
- [Agent Protocol OpenAPI docs](https://langchain-ai.github.io/agent-protocol/api.html)
- [Agent Protocol JSON OpenAPI spec](https://langchain-ai.github.io/agent-protocol/openapi.json)
- [Agent Streaming Protocol README](https://github.com/langchain-ai/agent-protocol/blob/main/streaming/README.md)
- [Agent Protocol Python server stubs](https://github.com/langchain-ai/agent-protocol/tree/main/server)
- [Agent Protocol Python client package metadata](https://github.com/langchain-ai/agent-protocol/blob/main/client-python/pyproject.toml)
- [langchain-protocol PyPI metadata](https://pypi.org/pypi/langchain-protocol/json)
- [LangChain announcement: Agent Protocol interoperability for LLM agents](https://www.langchain.com/blog/agent-protocol-interoperability-for-llm-agents)
