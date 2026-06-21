# Deep Agents

## What it is

Deep Agents is LangChain's open source "agent harness": an opinionated, ready-to-run layer for long-running agents that need planning, filesystem-backed context, subagents, memory, and human review. LangChain's profile lists Deep Agents alongside LangChain and LangGraph as a core OSS library for agents that can plan, use subagents, and leverage file systems for complex tasks ([LangChain profile README](https://github.com/langchain-ai/.github/blob/main/profile/README.md); [Deep Agents repo](https://github.com/langchain-ai/deepagents)).

Architecturally, it is not a new runtime. The Python docs describe it as a standalone library built on LangChain agent building blocks and the LangGraph runtime for durable execution, streaming, human-in-the-loop, and related runtime features ([overview](https://docs.langchain.com/oss/python/deepagents/overview)). The API returns a LangGraph `CompiledStateGraph`, so users can compose it with LangGraph features rather than treating it as a black-box service ([API reference](https://reference.langchain.com/python/deepagents/graph/)).

## Core capabilities

- Planning through a built-in `write_todos` tool for task decomposition and progress tracking ([overview](https://docs.langchain.com/oss/python/deepagents/overview)).
- Filesystem tools: `ls`, `read_file`, `write_file`, `edit_file`, `glob`, and `grep`, backed by pluggable storage backends ([backends](https://docs.langchain.com/oss/python/deepagents/backends)).
- Subagents via a built-in `task` tool, including default general-purpose subagents and caller-defined specialized subagents ([subagents](https://docs.langchain.com/oss/python/deepagents/subagents)).
- Context management through summarization, context compression, and offloading large tool results into the virtual filesystem ([overview](https://docs.langchain.com/oss/python/deepagents/overview)).
- Human-in-the-loop interrupts for sensitive tool calls, with approve, edit, reject, or respond decisions depending on configuration ([human-in-the-loop](https://docs.langchain.com/oss/python/deepagents/human-in-the-loop)).
- Declarative filesystem permission rules for built-in filesystem tools, including allow, deny, and interrupt modes ([permissions](https://docs.langchain.com/oss/python/deepagents/permissions)).
- Long-term memory through filesystem-backed files stored by backends such as LangGraph Store or LangSmith Context Hub ([memory](https://docs.langchain.com/oss/python/deepagents/memory)).
- Optional runtime grading through beta `RubricMiddleware`, where a grader model evaluates output against a rubric and can drive revision loops ([grading rubrics](https://docs.langchain.com/oss/python/deepagents/rubric)).

## How it works architecturally

Deep Agents wraps LangChain's `create_agent` style loop with a default middleware stack. The API reference lists built-in tools and names the standard middleware stack as todo list, filesystem, subagent, summarization, Anthropic prompt caching, and tool-call patching middleware, with user middleware appended after that stack ([API reference](https://reference.langchain.com/python/deepagents/graph/)).

The main agent acts as a coordinator. Subagents are separate delegated runs with isolated context windows; the parent receives the final subagent result instead of every intermediate tool call, which the docs frame as "context quarantine" for large reads, web/database work, and specialized tasks ([subagents](https://docs.langchain.com/oss/python/deepagents/subagents)). Custom subagents can be dictionary specs or compiled LangGraph subgraphs, so users can mix the harness with lower-level graph orchestration ([Deep Agents repo FAQ](https://github.com/langchain-ai/deepagents)).

Execution state is LangGraph state plus optional checkpointers and stores. The default `StateBackend` stores agent files in LangGraph agent state for the current thread, persisting across turns through checkpoints but not across threads ([backends](https://docs.langchain.com/oss/python/deepagents/backends)). Production deployment guidance treats thread id and runtime context as explicit invocation parameters and relies on LangSmith or LangGraph infrastructure for threads, runs, stores, and checkpointers ([going to production](https://docs.langchain.com/oss/python/deepagents/going-to-production)).

## Main abstractions / APIs

The central Python API is:

```python
from deepagents import create_deep_agent

agent = create_deep_agent(
    model="openai:gpt-5.5",
    tools=[my_custom_tool],
    system_prompt="You are a research assistant.",
)
```

`create_deep_agent` accepts `model`, `tools`, `system_prompt`, `middleware`, `subagents`, `skills`, `memory`, `response_format`, `context_schema`, `checkpointer`, `store`, `backend`, `interrupt_on`, `debug`, `name`, and `cache`, and returns a `CompiledStateGraph` ([API reference](https://reference.langchain.com/python/deepagents/graph/)).

Important supporting abstractions include:

- `SubAgent` / `CompiledSubAgent` for delegated workers with name, description, prompt, optional tools, optional model, and optional middleware ([subagents](https://docs.langchain.com/oss/python/deepagents/subagents)).
- Backends such as `StateBackend`, `FilesystemBackend`, `LocalShellBackend`, `StoreBackend`, `ContextHubBackend`, and `CompositeBackend` ([backends](https://docs.langchain.com/oss/python/deepagents/backends)).
- `FilesystemPermission` rules for read/write access decisions on built-in filesystem tools ([permissions](https://docs.langchain.com/oss/python/deepagents/permissions)).
- `interrupt_on` and `HumanInTheLoopMiddleware` for approval gates ([human-in-the-loop](https://docs.langchain.com/oss/python/deepagents/human-in-the-loop)).
- Provider and harness profiles for model initialization and model-specific harness tuning ([models](https://docs.langchain.com/oss/python/deepagents/models)).

There is also a TypeScript/JavaScript implementation. Its README says `createDeepAgent` returns a compiled LangGraph graph and provides Node and browser entrypoints, but the Python repo and docs appear more mature and broader in capability coverage ([deepagentsjs repo](https://github.com/langchain-ai/deepagentsjs)).

## Operational model

Deep Agents can run locally as a library, in a LangGraph/LangSmith deployment, or via Deep Agents Code as a terminal coding agent. Production guidance recommends Managed Deep Agents or LangSmith Deployment, with infrastructure for threads, runs, store, checkpointer, auth, webhooks, cron, and observability ([going to production](https://docs.langchain.com/oss/python/deepagents/going-to-production)).

Operationally, each invocation should include a stable `thread_id` for conversation state and a typed runtime `context` for run-scoped data such as user id, credentials, feature flags, or session metadata ([going to production](https://docs.langchain.com/oss/python/deepagents/going-to-production)). Side effects are mediated by tools and backends. Local shell and filesystem backends can touch the host directly; the docs explicitly warn that shell commands run with the user's permissions and should not be used for production or untrusted input ([backends](https://docs.langchain.com/oss/python/deepagents/backends)).

## Persistence / state / checkpointing model

Short-term state is thread-scoped: messages, scratch files, and default backend files persist within the same thread through the checkpointer, but are not shared across threads by default ([backends](https://docs.langchain.com/oss/python/deepagents/backends); [memory](https://docs.langchain.com/oss/python/deepagents/memory)).

Long-term memory is modeled as files. The agent can load memory files into its system prompt, read them on demand, and optionally update them through filesystem tools. Durability and sharing are controlled by backend routing and namespace choices, for example per-assistant or per-user `StoreBackend` namespaces ([memory](https://docs.langchain.com/oss/python/deepagents/memory)).

Deep Agents also has LangSmith Context Hub support for versioned prompt, memory, and skill files. `ContextHubBackend` reads a Hub repo tree lazily, persists writes as Hub commits, and uses optimistic parent-commit writes with conflict retry requirements ([backends](https://docs.langchain.com/oss/python/deepagents/backends)). LangChain's v0.6 release notes add `DeltaChannel` as a checkpoint-storage optimization for long-running, long-context agents, but that is release-note evidence rather than a formal API stability guarantee ([Deep Agents v0.6 release note](https://www.langchain.com/blog/deep-agents-0-6)).

## Observability / evaluation / debugging support

Deep Agents inherits LangGraph streaming and adds Deep Agents-specific subagent projections. `stream.subagents` exposes each delegated task with name, path, lifecycle status, messages, nested subagents, tool calls, values, and output; top-level streams can also expose coordinator messages and tool calls ([event streaming](https://docs.langchain.com/oss/python/deepagents/event-streaming)).

LangSmith is the primary observability product: docs recommend tracing requests, debugging behavior, evaluating outputs, and monitoring production usage through LangSmith ([overview](https://docs.langchain.com/oss/python/deepagents/overview); [going to production](https://docs.langchain.com/oss/python/deepagents/going-to-production)). The repo and docs also reference a Deep Agents eval suite for basic agent operations across model providers, with category scores for file ops, retrieval, tool use, memory, conversation, and summarization; the docs caution these evals are necessary but not sufficient for longer tasks ([models](https://docs.langchain.com/oss/python/deepagents/models)).

Runtime evaluation support exists through beta `RubricMiddleware`, which runs a grader model against a user-supplied rubric and loops until satisfied, capped, failed, or errored. It emits custom grading events and supports an `on_evaluation` callback ([grading rubrics](https://docs.langchain.com/oss/python/deepagents/rubric)).

## Provider / model / tool integration model

Deep Agents is provider-agnostic only within the limits of tool-calling chat models. The docs state it works with any LangChain chat model that supports tool calling, with `provider:model` strings resolving through LangChain's `init_chat_model` ([models](https://docs.langchain.com/oss/python/deepagents/models)).

Tool integration is broad: custom callables, LangChain tools, tool dicts, and tools loaded from MCP servers through `langchain-mcp-adapters` can be passed to `create_deep_agent` ([tools](https://docs.langchain.com/oss/python/deepagents/tools)). The model/provider table includes OpenAI, Anthropic, Google, OpenRouter, Fireworks, Baseten, Ollama, and open-weight models through compatible providers, but exact model identifiers are provider-catalog dependent and should be verified at integration time ([models](https://docs.langchain.com/oss/python/deepagents/models)).

Filesystem and execution integration is backend-based. Backends can be local, in-memory, LangGraph Store, Context Hub, sandbox, or composite-routed. Permission rules apply only to built-in filesystem tools, not custom tools, MCP tools, or sandbox command execution, so boundary enforcement must happen at the backend, sandbox, and tool layer ([permissions](https://docs.langchain.com/oss/python/deepagents/permissions); [backends](https://docs.langchain.com/oss/python/deepagents/backends)).

## Maturity and ecosystem notes

The Python repo is active and materially adopted by open-source signals: as of the live GitHub page, it shows thousands of forks/stars and 2,000+ commits, with latest release `deepagents==0.6.11` on June 18, 2026 ([Deep Agents repo](https://github.com/langchain-ai/deepagents)). PyPI also lists `deepagents 0.6.11` as the latest release on June 18, 2026 ([PyPI](https://pypi.org/project/deepagents/)). The TypeScript repo exists separately, is MIT licensed, and has Node/browser entrypoints, but it is smaller by repository activity and documented capability surface ([deepagentsjs repo](https://github.com/langchain-ai/deepagentsjs)).

Several features are explicitly marked beta or preview in primary docs, including event streaming, grading rubrics, profiles, interpreters, and Managed Deep Agents private preview/beta surfaces ([overview](https://docs.langchain.com/oss/python/deepagents/overview); [going to production](https://docs.langchain.com/oss/python/deepagents/going-to-production)). That suggests the core harness is usable, but some of the most relevant operational features are still moving.

The security posture is candid: the repo says Deep Agents follows a "trust the LLM" model and that the agent can do anything its tools allow, so boundaries must be enforced at the tool or sandbox layer ([Deep Agents repo security note](https://github.com/langchain-ai/deepagents)). This is a useful warning for adoption, not a disqualifier.

## What looks relevant to kit-vnext

- Agent seam candidate: Deep Agents could be evaluated as one implementation behind kit-vnext's Agent provider seam, because it exposes bounded runs, tool activity, subagents, interrupt/resume patterns, and a compiled graph API rather than requiring core coupling.
- Provider-agnostic model surface: its LangChain model integration could help test multiple model providers behind a common contract, as long as kit-vnext treats the model as an attested worker capability rather than a trusted supervisor.
- Context and subagent patterns: filesystem-backed context, subagent isolation, and explicit streaming projections are directly relevant to long-running worker observability and context containment.
- Human-in-the-loop mechanics: `interrupt_on` and filesystem permission interrupt mode map well to kit-vnext's need to surface worker requests for human decisions, provided decisions are recorded externally by kit-vnext.
- Persistence primitives: thread ids, checkpointers, stores, and namespace-scoped memory are useful comparison points for kit-vnext run recovery and per-worker state, though kit-vnext should keep its own event log as the authoritative state.
- Tool/MCP ecosystem: MCP support and LangChain tools could reduce adapter work for experimental providers, but only after permissions, audit logging, and secret handling are enforced outside the LLM's discretion.

## What looks irrelevant or risky for kit-vnext

- Not a control plane replacement: Deep Agents is itself an agent harness. kit-vnext's AGENTS contract says supervision, state, gating, recovery, and merge authority belong to deterministic code, not an LLM orchestrator. Deep Agents should not own final completion, verification, PR, merge, or policy decisions.
- "Trust the LLM" security model conflicts with kit-vnext's fail-closed posture unless wrapped tightly. Local shell and filesystem backends can read secrets or execute arbitrary commands, and permission rules do not cover custom tools, MCP tools, or sandbox `execute` ([backends](https://docs.langchain.com/oss/python/deepagents/backends); [permissions](https://docs.langchain.com/oss/python/deepagents/permissions)).
- Hosted LangSmith coupling may not fit a provider-neutral core. LangSmith is the best-supported production/observability path, but kit-vnext's provider seams should not require a specific commercial platform.
- Memory-as-files is useful but dangerous if treated as authoritative state. kit-vnext's run truth should remain an append-only event log and projections; Deep Agents memory/checkpoints are worker context and recovery aids, not system authority.
- Runtime grading is not a substitute for kit-vnext verification gates. `RubricMiddleware` is beta and LLM-as-judge based, so it may be useful as an advisory signal but not as a merge/completion gate.
- JavaScript support should be verified separately before TypeScript-first adoption. Primary sources confirm a TS implementation, but the Python docs are more extensive and current capability parity is not fully confirmed from the sources reviewed.

## Primary sources

- [LangChain organization profile README](https://github.com/langchain-ai/.github/blob/main/profile/README.md)
- [langchain-ai/deepagents GitHub repository](https://github.com/langchain-ai/deepagents)
- [Deep Agents overview docs](https://docs.langchain.com/oss/python/deepagents/overview)
- [Deep Agents API reference: create_deep_agent](https://reference.langchain.com/python/deepagents/graph/)
- [Deep Agents backends docs](https://docs.langchain.com/oss/python/deepagents/backends)
- [Deep Agents subagents docs](https://docs.langchain.com/oss/python/deepagents/subagents)
- [Deep Agents human-in-the-loop docs](https://docs.langchain.com/oss/python/deepagents/human-in-the-loop)
- [Deep Agents permissions docs](https://docs.langchain.com/oss/python/deepagents/permissions)
- [Deep Agents memory docs](https://docs.langchain.com/oss/python/deepagents/memory)
- [Deep Agents event streaming docs](https://docs.langchain.com/oss/python/deepagents/event-streaming)
- [Deep Agents models docs](https://docs.langchain.com/oss/python/deepagents/models)
- [Deep Agents tools docs](https://docs.langchain.com/oss/python/deepagents/tools)
- [Deep Agents going to production docs](https://docs.langchain.com/oss/python/deepagents/going-to-production)
- [Deep Agents grading rubrics docs](https://docs.langchain.com/oss/python/deepagents/rubric)
- [Deep Agents v0.6 release note](https://www.langchain.com/blog/deep-agents-0-6)
- [deepagents on PyPI](https://pypi.org/project/deepagents/)
- [langchain-ai/deepagentsjs GitHub repository](https://github.com/langchain-ai/deepagentsjs)
