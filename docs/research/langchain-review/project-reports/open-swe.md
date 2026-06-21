# Open SWE

## What it is

Open SWE is LangChain's open-source asynchronous coding-agent application for building an internal software-engineering agent, not just a library. LangChain's organization profile lists it as an "open source asynchronous coding agent" among OSS extensions and apps ([LangChain profile README](https://github.com/langchain-ai/.github/blob/main/profile/README.md)). The Open SWE repository describes it as an "open-source framework for building your org's internal coding agent" built on LangGraph and Deep Agents, with cloud sandboxes, Slack/Linear/GitHub invocation, subagents, and automatic draft PR creation ([repo README](https://github.com/langchain-ai/open-swe)).

Practically, it is a fork-and-customize reference app: a Python LangGraph/FastAPI backend plus a TanStack Start/Vite dashboard, with GitHub App auth, LangSmith tracing/sandboxes, webhook handlers, review automation, and CI auto-fix flows ([installation guide](https://github.com/langchain-ai/open-swe/blob/main/INSTALLATION.md)).

## Core capabilities

- Trigger coding work from Linear, Slack, or GitHub by mentioning `@openswe`; each source creates or reuses a deterministic LangGraph thread ([README](https://github.com/langchain-ai/open-swe), [webapp implementation](https://github.com/langchain-ai/open-swe/blob/main/agent/webapp.py)).
- Run each task in an isolated sandbox, clone the target repo, execute shell/file operations, commit changes, and open or update draft PRs ([README](https://github.com/langchain-ai/open-swe), [customization guide](https://github.com/langchain-ai/open-swe/blob/main/CUSTOMIZATION.md)).
- Accept mid-run follow-up messages by queuing them for a busy thread and injecting them before later model calls ([thread helper](https://github.com/langchain-ai/open-swe/blob/main/agent/utils/thread_ops.py), [customization guide](https://github.com/langchain-ai/open-swe/blob/main/CUSTOMIZATION.md)).
- Spawn Deep Agents subagents for parallel subtasks; the main agent uses a general-purpose subagent model/profile path ([agent server](https://github.com/langchain-ai/open-swe/blob/main/agent/server.py)).
- Run a specialized reviewer graph with persisted findings, GitHub review-thread reconciliation, and publish/resolve/reply tools ([reviewer graph](https://github.com/langchain-ai/open-swe/blob/main/agent/reviewer.py), [findings store](https://github.com/langchain-ai/open-swe/blob/main/agent/reviewer_findings.py)).
- Monitor failing CI and agent-authored PRs through webhooks plus a scheduler-style `ci_monitor` sweep fallback ([installation guide](https://github.com/langchain-ai/open-swe/blob/main/INSTALLATION.md), [ci_monitor.py](https://github.com/langchain-ai/open-swe/blob/main/agent/ci_monitor.py)).

## How it works architecturally

The backend is a LangGraph app plus a FastAPI web app served together. `langgraph.json` declares separate graphs for `agent`, `reviewer`, `analyzer`, `chat`, `scheduler`, and `ci_monitor`, and routes HTTP to `agent.webapp:app` ([langgraph.json](https://github.com/langchain-ai/open-swe/blob/main/langgraph.json)). The install guide summarizes the two runnable pieces as a LangGraph/FastAPI backend and an optional dashboard over `/dashboard/api/*` ([installation guide](https://github.com/langchain-ai/open-swe/blob/main/INSTALLATION.md)).

The main agent is assembled in `get_agent()` with `create_deep_agent(...)`: a model, constructed system prompt, curated tools, a sandbox backend factory, a general-purpose subagent, and middleware for model-call limits, tool errors, message queue checks, GitHub proxy refresh, Slack status, sandbox circuit breaking, fallback models, and sanitization ([agent server](https://github.com/langchain-ai/open-swe/blob/main/agent/server.py)). Webhooks translate external events into LangGraph runs with source-specific config and metadata ([webapp.py](https://github.com/langchain-ai/open-swe/blob/main/agent/webapp.py)).

The reviewer and analyzer are separate graphs rather than modes inside the same prompt. The reviewer prepares a PR checkout/diff, exposes review-specific finding tools, and publishes a single GitHub review. The analyzer mines historical feedback and finding outcomes to save per-repo review-style guidance ([reviewer.py](https://github.com/langchain-ai/open-swe/blob/main/agent/reviewer.py), [analyzer.py](https://github.com/langchain-ai/open-swe/blob/main/agent/analyzer.py)).

## Main abstractions / APIs

- LangGraph thread/run/store APIs: deterministic thread IDs, `runs.create(...)`, thread metadata, thread status, and store namespaces for queued messages ([webapp.py](https://github.com/langchain-ai/open-swe/blob/main/agent/webapp.py), [thread_ops.py](https://github.com/langchain-ai/open-swe/blob/main/agent/utils/thread_ops.py)).
- Deep Agents `create_deep_agent`, sandbox backend protocol, built-in file/shell/todo/subagent tools, and middleware hooks ([customization guide](https://github.com/langchain-ai/open-swe/blob/main/CUSTOMIZATION.md), [server.py](https://github.com/langchain-ai/open-swe/blob/main/agent/server.py)).
- Sandbox provider factories keyed by `SANDBOX_TYPE`; supported providers documented as LangSmith, Daytona, Runloop, Modal, and local development ([customization guide](https://github.com/langchain-ai/open-swe/blob/main/CUSTOMIZATION.md)).
- Tool functions: web fetch/search, HTTP request, Slack replies/thread reads, Linear CRUD/comment tools, GitHub PR/review tools, and reviewer finding tools ([tools package](https://github.com/langchain-ai/open-swe/tree/main/agent/tools)).
- Dashboard settings APIs for GitHub login, model/profile settings, team defaults, enabled repos, review style, user mappings, and Agents chat UI ([installation guide](https://github.com/langchain-ai/open-swe/blob/main/INSTALLATION.md)).

## Operational model

Open SWE is deployed as a webhook-driven service. Setup requires Python 3.11-3.13, `uv`, LangGraph CLI, a GitHub App, LangSmith configuration, webhook endpoints, and optionally Bun/Node for the dashboard ([installation guide](https://github.com/langchain-ai/open-swe/blob/main/INSTALLATION.md)). Local development commonly uses `langgraph dev` and ngrok for public webhooks; the Makefile exposes `dev`, `run`, `test`, `integration_tests`, `lint`, and formatting targets ([Makefile](https://github.com/langchain-ai/open-swe/blob/main/Makefile)).

GitHub access is centered on a GitHub App. The documented permissions include contents, PRs, issues, checks, metadata, optional statuses, and optional org-member reads for dashboard login gating ([installation guide](https://github.com/langchain-ai/open-swe/blob/main/INSTALLATION.md)). Runtime GitHub operations inside LangSmith sandboxes use a proxy: agents invoke `GH_TOKEN=dummy gh ...`, while Open SWE configures proxy rules with runtime-minted GitHub App or per-user tokens rather than storing broad GitHub access tokens in deployment env vars ([customization guide](https://github.com/langchain-ai/open-swe/blob/main/CUSTOMIZATION.md)).

Repositories are resolved from source context: Slack thread metadata/channel topic/user profile/team defaults/env defaults, Linear team/project mappings or explicit `repo:owner/name`, and GitHub webhook repo payloads ([customization guide](https://github.com/langchain-ai/open-swe/blob/main/CUSTOMIZATION.md), [webapp.py](https://github.com/langchain-ai/open-swe/blob/main/agent/webapp.py)).

## Persistence / state / checkpointing model

LangGraph supplies the durable coordination substrate: thread IDs, thread metadata, runs, store items, and a configured checkpointer TTL. The current `langgraph.json` sets checkpointer TTL deletion with a default TTL of 43,200 minutes and hourly sweeps ([langgraph.json](https://github.com/langchain-ai/open-swe/blob/main/langgraph.json)).

Sandbox identity is persisted in LangGraph thread metadata as `sandbox_id`; the server can wait on a creating sentinel, reconnect to a cached sandbox, refresh GitHub proxy credentials, or recreate an unreachable sandbox ([server.py](https://github.com/langchain-ai/open-swe/blob/main/agent/server.py)). Mid-run messages are stored under a LangGraph store namespace `("queue", thread_id)` with a capped FIFO message list ([thread_ops.py](https://github.com/langchain-ai/open-swe/blob/main/agent/utils/thread_ops.py)).

Reviewer findings are persisted in LangGraph thread metadata under the canonical reviewer thread for a PR. The code explicitly chooses metadata because it survives sandbox eviction and is queryable across threads ([reviewer_findings.py](https://github.com/langchain-ai/open-swe/blob/main/agent/reviewer_findings.py)). Dashboard/user/team settings appear to be persisted through dashboard modules, but the exact backing store should be confirmed in those modules before adoption claims.

## Observability / evaluation / debugging support

Open SWE uses LangSmith for tracing and sandbox infrastructure. The install guide states that all agent runs are logged for debugging/observability, with separate tracing projects for `open-swe-agent` and `open-swe-review` ([installation guide](https://github.com/langchain-ai/open-swe/blob/main/INSTALLATION.md)). The tracing helper wraps graph factories in LangSmith tracing contexts using those project names ([tracing.py](https://github.com/langchain-ai/open-swe/blob/main/agent/utils/tracing.py)).

The reviewer path includes durable findings, outcome tracking, review-thread reconciliation, and a style analyzer that learns per-repo review guidance from historical human PR feedback and past finding outcomes ([reviewer.py](https://github.com/langchain-ai/open-swe/blob/main/agent/reviewer.py), [analyzer.py](https://github.com/langchain-ai/open-swe/blob/main/agent/analyzer.py)). The repo includes an `evals/reviewer` tree, but I did not confirm from primary docs that there is a mature published evaluation suite or release process.

## Provider / model / tool integration model

Models use LangChain provider strings through `make_model()` / `langchain.chat_models.init_chat_model`, with documented examples for OpenAI, Anthropic, and Google. OpenAI models use the Responses API by default; models can vary by context such as Slack versus Linear or per dashboard profile/team setting ([customization guide](https://github.com/langchain-ai/open-swe/blob/main/CUSTOMIZATION.md), [server.py](https://github.com/langchain-ai/open-swe/blob/main/agent/server.py)).

Sandbox integration is pluggable behind Deep Agents' `SandboxBackendProtocol`, requiring file operations, shell execution, and an `id`; custom providers can be registered in `agent/utils/sandbox.py` ([customization guide](https://github.com/langchain-ai/open-swe/blob/main/CUSTOMIZATION.md)). The dependency manifest includes provider and integration packages such as `deepagents`, `langgraph`, `langsmith`, `langchain-openai`, `langchain-anthropic`, `langchain-google-genai`, `langchain-daytona`, `langchain-modal`, `langchain-runloop`, and `langchain-mcp-adapters` ([pyproject.toml](https://github.com/langchain-ai/open-swe/blob/main/pyproject.toml)).

Tool integration is plain Python functions registered in `get_agent()`. The docs recommend adding tools under `agent/tools/`, using function name/docstring/type hints as the tool surface, and conditionally varying tools by trigger source ([customization guide](https://github.com/langchain-ai/open-swe/blob/main/CUSTOMIZATION.md)).

## Maturity and ecosystem notes

Open SWE is active and visible, with the GitHub page showing roughly 10k stars, 1.1k forks, hundreds of commits, and Python/TypeScript code ([repo](https://github.com/langchain-ai/open-swe)). The repository is MIT licensed ([repo README](https://github.com/langchain-ai/open-swe)).

As of the current GitHub releases page, there are no published releases, so adoption should treat `main` as the live integration surface rather than a versioned product API ([releases page](https://github.com/langchain-ai/open-swe/releases)). The docs and implementation are evolving: for example, the current README/features and `langgraph.json` include reviewer/analyzer/chat/scheduler/CI-monitor surfaces beyond the simpler marketing/blog architecture description ([README](https://github.com/langchain-ai/open-swe), [langgraph.json](https://github.com/langchain-ai/open-swe/blob/main/langgraph.json)).

## What looks relevant to kit-vnext

- Thread-centered durability: deterministic source-to-thread mapping, thread metadata for sandbox identity, and queued follow-up messages are concrete patterns for recoverable, asynchronous agent runs.
- Explicit execution-host abstraction: Deep Agents' sandbox backend protocol and Open SWE's provider factory table mirror kit-vnext's need to keep execution hosts behind a seam.
- Sandbox credential proxying: `GH_TOKEN=dummy gh` plus runtime proxy credential minting is relevant to AD-12-style worker isolation and avoiding long-lived GitHub tokens in the worker environment.
- Separate reviewer/analyzer graphs: review automation is split from implementation, with durable finding state and reconciliation against live GitHub review threads.
- Webhook-to-run adaptation: Slack/Linear/GitHub handlers normalize external work-source events into run config and metadata, which is close to kit-vnext's Work Source boundary.
- LangSmith tracing plus per-graph projects: useful as an observability comparison point, even if kit-vnext should keep telemetry behind its own event-log/projection model.

## What looks irrelevant or risky for kit-vnext

- Open SWE is intentionally agent-harness-first and prompt/middleware-heavy; kit-vnext's core invariant is a deterministic control plane with rented worker agents, so adopting Open SWE wholesale would blur orchestrator/worker boundaries.
- The main agent is responsible for committing, pushing, opening/updating draft PRs, and replying in source channels; that conflicts with kit-vnext's worker/runner isolation unless heavily refactored ([customization guide](https://github.com/langchain-ai/open-swe/blob/main/CUSTOMIZATION.md)).
- State is split across LangGraph threads, metadata, store items, sandbox state, dashboard settings, GitHub/Slack/Linear, and LangSmith traces. That is pragmatic for an app, but kit-vnext's event log as single source of truth would need a stricter projection/adaptation layer.
- Local sandbox mode has no isolation and is documented as development-only; any adoption must fail closed around sandbox capability and credentials ([customization guide](https://github.com/langchain-ai/open-swe/blob/main/CUSTOMIZATION.md)).
- No published releases means API/stability risk. Pinning directly to `main` would be inappropriate for kit-vnext's control-plane contracts.
- Some docs/blog statements appear older than the current implementation, so implementation inspection is necessary before using Open SWE as design evidence.

## Primary sources

- [LangChain organization profile README](https://github.com/langchain-ai/.github/blob/main/profile/README.md)
- [Open SWE repository README](https://github.com/langchain-ai/open-swe)
- [Open SWE installation guide](https://github.com/langchain-ai/open-swe/blob/main/INSTALLATION.md)
- [Open SWE customization guide](https://github.com/langchain-ai/open-swe/blob/main/CUSTOMIZATION.md)
- [Open SWE `langgraph.json`](https://github.com/langchain-ai/open-swe/blob/main/langgraph.json)
- [Open SWE `pyproject.toml`](https://github.com/langchain-ai/open-swe/blob/main/pyproject.toml)
- [Open SWE `agent/server.py`](https://github.com/langchain-ai/open-swe/blob/main/agent/server.py)
- [Open SWE `agent/webapp.py`](https://github.com/langchain-ai/open-swe/blob/main/agent/webapp.py)
- [Open SWE `agent/reviewer.py`](https://github.com/langchain-ai/open-swe/blob/main/agent/reviewer.py)
- [Open SWE `agent/analyzer.py`](https://github.com/langchain-ai/open-swe/blob/main/agent/analyzer.py)
- [Open SWE reviewer findings store](https://github.com/langchain-ai/open-swe/blob/main/agent/reviewer_findings.py)
- [Open SWE thread helpers](https://github.com/langchain-ai/open-swe/blob/main/agent/utils/thread_ops.py)
- [Open SWE tracing helper](https://github.com/langchain-ai/open-swe/blob/main/agent/utils/tracing.py)
- [Open SWE CI monitor](https://github.com/langchain-ai/open-swe/blob/main/agent/ci_monitor.py)
- [Open SWE releases page](https://github.com/langchain-ai/open-swe/releases)
- [LangChain announcement blog, March 17, 2026](https://www.langchain.com/blog/open-swe-an-open-source-framework-for-internal-coding-agents)
