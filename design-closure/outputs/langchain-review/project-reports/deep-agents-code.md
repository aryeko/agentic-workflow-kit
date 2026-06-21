# Deep Agents Code
## What it is

Deep Agents Code (`dcode`) is LangChain's open source terminal coding agent built on the Deep Agents SDK. LangChain's profile README lists it as an OSS extension/app: "open source coding agent in your terminal, similar to Claude Code or Cursor, powered by any LLM" ([LangChain GitHub profile](https://github.com/langchain-ai/.github/blob/main/profile/README.md)). The product docs describe it as a terminal coding agent that can switch model providers mid-session, persist memory across conversations, use skills, and gate code execution through approval controls ([Deep Agents Code overview](https://docs.langchain.com/oss/python/deepagents/code/overview)).

It is packaged as the Python `deepagents-code` distribution, latest observed PyPI version `0.1.20` released June 17, 2026, classified as Beta and requiring Python 3.11+ ([PyPI](https://pypi.org/project/deepagents-code/)). The source lives in the `langchain-ai/deepagents` monorepo under `libs/code` ([repo tree](https://github.com/langchain-ai/deepagents/tree/main/libs/code)).

## Core capabilities

- Interactive TUI and headless/non-interactive mode, including piping stdin, quiet output, `--max-turns`, `--timeout`, and shell allow-lists for CI-like use ([overview, non-interactive mode](https://docs.langchain.com/oss/python/deepagents/code/overview)).
- Built-in file, search, edit, shell, web search, fetch URL, task delegation, user-question, context compaction, todo, and thread-id tools, with destructive operations gated by human approval unless auto-approve is enabled ([overview, built-in tools](https://docs.langchain.com/oss/python/deepagents/code/overview)).
- Persistent memory, project/user `AGENTS.md` instruction loading, reusable skills, custom subagents, MCP tools, and remote sandbox execution ([memory and skills](https://docs.langchain.com/oss/python/deepagents/code/memory-and-skills), [MCP tools](https://docs.langchain.com/oss/python/deepagents/code/mcp-tools), [remote sandboxes](https://docs.langchain.com/oss/python/deepagents/code/remote-sandboxes)).
- LangSmith tracing for model calls, tool calls, decisions, and separate shell-command traces when executed code also emits LangSmith traces ([overview, tracing](https://docs.langchain.com/oss/python/deepagents/code/overview)).

## How it works architecturally

Upstream describes Deep Agents Code as a reference implementation that combines the Deep Agents SDK with a terminal experience, persistence, tools, skills, and optional sandboxed execution ([Deep Agents Code architecture](https://github.com/langchain-ai/deepagents/blob/main/libs/code/ARCHITECTURE.md)).

The runtime has two halves:

- Terminal client: presentation, user input, approvals, interactive/headless output.
- Agent server: agent graph runtime, model, tools, memory, skills, and backend.

The two communicate over a streaming protocol. The client sends user input to the server, the server runs the agent and streams events back, and the client renders those events and collects any human responses. The docs say this separation keeps the UI responsive while using LangGraph streaming, checkpointing, and resume behavior ([architecture](https://github.com/langchain-ai/deepagents/blob/main/libs/code/ARCHITECTURE.md)).

The underlying Deep Agents stack sits above LangChain's agent abstraction and LangGraph's runtime; the repo README says Deep Agents is an opinionated harness with filesystem, subagents, context management, skills, persistence, checkpointing, tracing, evaluation, and deployment via LangSmith ([Deep Agents repo README](https://github.com/langchain-ai/deepagents)).

## Main abstractions / APIs

- CLI entrypoints: `dcode` and `deepagents-code` are package console scripts ([pyproject](https://github.com/langchain-ai/deepagents/blob/main/libs/code/pyproject.toml)).
- Runtime modes: interactive TUI, `-n/--non-interactive`, piped stdin, `--startup-cmd`, `--model`, `--agent`, `--skill`, `--sandbox`, `--resume`, `--auto-approve`, `--shell-allow-list`, `--max-turns`, and `--timeout` ([overview command reference](https://docs.langchain.com/oss/python/deepagents/code/overview)).
- Slash command surface: `/model`, `/agents`, `/auth`, `/remember`, `/skill:<name>`, `/offload`, `/threads`, `/mcp`, `/reload`, `/trace`, `/tokens`, `/install`, `/update`, and others; the upstream generated command catalog lists 28 public slash commands ([COMMANDS.md](https://github.com/langchain-ai/deepagents/blob/main/libs/code/COMMANDS.md)).
- Customization artifacts: `AGENTS.md`, `SKILL.md`, `.mcp.json`, `~/.deepagents/config.toml`, `~/.deepagents/.env`, `hooks.json`, per-agent directories, and project `.deepagents/` / `.agents/` folders ([configuration](https://docs.langchain.com/oss/python/deepagents/code/configuration), [data locations](https://docs.langchain.com/oss/python/deepagents/code/data-locations)).
- SDK-level basis: the docs point builders to `create_deep_agent(...)` in the underlying Deep Agents SDK, but Deep Agents Code itself is primarily a prebuilt app/CLI rather than a library-first API ([Deep Agents overview](https://docs.langchain.com/oss/python/deepagents/overview)).

## Operational model

Deep Agents Code runs locally by default. It can execute against the local filesystem/shell, or use a remote sandbox as the target for tool calls while the `dcode` process, LLM loop, memory, and tool dispatch remain on the user's machine. The remote sandbox docs call this the "sandbox as tool" pattern: `read_file`, `write_file`, `execute`, and related tools target the sandbox, not the local filesystem ([remote sandboxes](https://docs.langchain.com/oss/python/deepagents/code/remote-sandboxes)).

Human-in-the-loop is part of the operational posture. Write/edit/execute/web/fetch/task operations are approval-gated by default, while `--auto-approve` bypasses approval. In non-interactive mode, shell execution is disabled unless commands are allow-listed or all shell commands are enabled, which the docs explicitly mark as risky ([overview, built-in tools and non-interactive shell](https://docs.langchain.com/oss/python/deepagents/code/overview)).

Operational extension points include model provider extras, sandbox provider extras, MCP servers, hooks, skills, project/user instructions, and custom subagents. Configuration resolves from environment overrides, app-stored credentials, config files, and defaults, with `dcode config` commands for inspection and redacted bug-report output ([configuration](https://docs.langchain.com/oss/python/deepagents/code/configuration)).

## Persistence / state / checkpointing model

Confirmed for Deep Agents Code:

- Conversations/checkpoints are stored in `~/.deepagents/.state/sessions.db`, a SQLite checkpoint database ([data locations](https://docs.langchain.com/oss/python/deepagents/code/data-locations)).
- Per-agent memory, skills, and subagent definitions live under `~/.deepagents/{agent}/`; project instructions and skills can live in project `AGENTS.md`, `.deepagents/`, or `.agents/` paths ([data locations](https://docs.langchain.com/oss/python/deepagents/code/data-locations)).
- Conversation compaction/offloading writes older conversation content to backend storage under `/conversation_history/{thread_id}.md`, replacing older context with a summary while preserving retrievability ([overview, compact_conversation note](https://docs.langchain.com/oss/python/deepagents/code/overview)).
- The threat model states LangGraph checkpoints in `~/.deepagents/*.db` contain full conversation history and agent state, and can re-enter LLM context on resume if tampered with by a local attacker ([THREAT_MODEL.md](https://github.com/langchain-ai/deepagents/blob/main/libs/code/THREAT_MODEL.md)).

Inference from SDK docs/repo, not independently specified for every CLI path: the server side uses LangGraph streaming, checkpointing, and resume behavior, because the Deep Agents Code architecture says the client/server split lets it use those LangGraph capabilities ([Deep Agents Code architecture](https://github.com/langchain-ai/deepagents/blob/main/libs/code/ARCHITECTURE.md)).

## Observability / evaluation / debugging support

Deep Agents Code supports LangSmith tracing for its own model calls, tool calls, orchestration, middleware, and decisions. It can route its agent traces to a dedicated `DEEPAGENTS_CODE_LANGSMITH_PROJECT` and keep traces emitted by shell-run applications in a separate `LANGSMITH_PROJECT`; `/trace` opens the current thread in LangSmith ([overview, Trace with LangSmith](https://docs.langchain.com/oss/python/deepagents/code/overview)).

For local diagnosis, `dcode config show/list/get/path` reports effective configuration and sources while redacting secrets ([configuration](https://docs.langchain.com/oss/python/deepagents/code/configuration)). The command catalog includes `/tokens`, `/timestamps`, `/debug-error` as a hidden command, `/restart`, `/reload`, `/feedback`, and `/version` ([COMMANDS.md](https://github.com/langchain-ai/deepagents/blob/main/libs/code/COMMANDS.md)).

For evaluation, the primary sources found here are stronger at the SDK/platform level than at the CLI level. The Deep Agents repo README claims first-class tracing, evaluation, and deployment via LangSmith for the Deep Agents harness ([repo README](https://github.com/langchain-ai/deepagents)); I did not confirm a Deep Agents Code-specific evaluator API beyond tracing and the monorepo's `libs/evals` package listing ([libs README](https://github.com/langchain-ai/deepagents/tree/main/libs)).

## Provider / model / tool integration model

Model integration is LangChain-provider based. Deep Agents Code supports any LangChain-compatible chat model provider and any OpenAI- or Anthropic-compatible API that supports tool calling. OpenAI, Anthropic, and Gemini are included by default; many others are optional extras, including Azure OpenAI, Bedrock, Hugging Face, Ollama, Groq, Fireworks, OpenRouter, LiteLLM, Mistral, DeepSeek, xAI, and more ([model providers](https://docs.langchain.com/oss/python/deepagents/code/providers), [PyPI extras](https://pypi.org/project/deepagents-code/)).

Provider resolution includes `/auth`, `dcode auth`, environment variables, `DEEPAGENTS_CODE_` scoped overrides, `config.toml`, model profile overrides, and arbitrary provider `class_path` imports. The docs warn that `class_path` executes arbitrary Python from the user's config environment ([configuration](https://docs.langchain.com/oss/python/deepagents/code/configuration)).

Tool integration includes:

- Built-in coding tools for files, shell, search, web, URL fetch, task delegation, compaction, todos, and user questions ([overview](https://docs.langchain.com/oss/python/deepagents/code/overview)).
- MCP servers discovered from user/project `.mcp.json` files, connected at startup, with tool filtering, OAuth login, project-level trust, and system-prompt awareness ([MCP tools](https://docs.langchain.com/oss/python/deepagents/code/mcp-tools)).
- Pluggable sandbox providers: built-ins plus third-party entry points under `deepagents_code.sandbox_providers`, or config-declared providers via `class_path` ([remote sandboxes](https://docs.langchain.com/oss/python/deepagents/code/remote-sandboxes)).
- Skills and subagents, where skills are `SKILL.md` packages loaded on demand and subagents are `AGENTS.md` files with YAML frontmatter; current Deep Agents Code custom subagents inherit the main agent's tools, and async subagents are documented as unavailable in Deep Agents Code at this time ([memory and skills](https://docs.langchain.com/oss/python/deepagents/code/memory-and-skills), [subagents](https://docs.langchain.com/oss/python/deepagents/code/subagents)).

## Maturity and ecosystem notes

- Package maturity: PyPI classifies `deepagents-code` as Beta; the observed release history began at `0.0.1` on April 30, 2026 and reached `0.1.20` by June 17, 2026, indicating rapid iteration ([PyPI release history](https://pypi.org/project/deepagents-code/)).
- Repo maturity: the parent `langchain-ai/deepagents` repository showed 24.9k stars, 3.5k forks, 90 open issues, 39 open PRs, and latest SDK release `deepagents==0.6.11` on June 18, 2026 at the time viewed ([repo README/sidebar](https://github.com/langchain-ai/deepagents)).
- Platform support: docs state Deep Agents Code is not officially supported on Windows; Windows users are directed to WSL ([overview](https://docs.langchain.com/oss/python/deepagents/code/overview)).
- Ecosystem fit: it is tightly coupled to LangChain/LangGraph/LangSmith, but intentionally model-provider agnostic and open source. The comparison page says Deep Agents is production-used by OpenSWE and LangSmith Fleet; that statement applies to the SDK/harness, not necessarily to Deep Agents Code as a CLI product ([comparison](https://docs.langchain.com/oss/python/deepagents/comparison)).
- Security posture: upstream explicitly says Deep Agents follows a "trust the LLM" model and boundaries should be enforced at the tool/sandbox level, not by expecting the model to self-police ([repo README security section](https://github.com/langchain-ai/deepagents)).

## What looks relevant to kit-vnext

- Provider-neutral agent seam reference: Deep Agents Code is a concrete example of a coding agent product built around a model-agnostic provider layer. That is relevant to kit-vnext's AgentProvider seam, especially for normalizing model selection, credentials, and provider metadata without baking provider specifics into the control plane.
- Execution Host seam thinking: its local-vs-remote sandbox model maps closely to kit-vnext's Execution Host seam. The "agent loop local, tools target sandbox" pattern is useful prior art for remote execution as a driver behind a seam, not a core rewrite.
- Approval and non-interactive controls: default HITL gates, `--auto-approve`, shell allow-lists, max-turns, and timeout controls are practical surfaces to compare against kit-vnext's manual/assisted autonomy scope and fail-closed gates.
- Persistent agent memory/skills: useful as input to Agent provider behavior and worker customization, but should remain provider-side evidence/context in kit-vnext rather than becoming run truth.
- Observability: LangSmith trace separation between agent traces and shell-command traces is relevant to kit-vnext's requirement to distinguish worker behavior from runner-owned verification evidence.
- Security/threat model: upstream's threat model is directly useful as a checklist for provider-driver risk: unauthenticated localhost agent server, SQLite checkpoint tampering, prompt injection through fetched content or local files, arbitrary Python via config `class_path`, and MCP subprocess environment forwarding.

## What looks irrelevant or risky for kit-vnext

- It is itself an agent harness/application. Kit-vnext's accepted architecture says the control plane is deterministic code and agents are rented workers, so Deep Agents Code should not become the orchestrator or authority for run state, gating, verification, PR evidence, or merge decisions.
- Its local SQLite checkpoint state and memory are not equivalent to kit-vnext's append-only run event log. Treating `dcode` session state as authoritative would violate kit-vnext's event-log/projection model and evidence-over-prose rule.
- `--auto-approve` and broad shell allow-lists conflict with kit-vnext v1's manual/assisted-only autonomy unless they are disabled or mediated by the runner/control plane.
- The CLI's client/server model includes an unauthenticated localhost LangGraph dev server per the upstream threat model. That needs containment or attestation before any provider driver could claim safe resume/control capabilities.
- `class_path` providers and config-declared sandbox providers execute arbitrary local Python. This is acceptable for an end-user CLI trust model, but risky for kit-vnext provider loading unless it is isolated inside provider packages, pinned, probed, and denied access to Forge credentials.
- Deep Agents Code custom subagents currently inherit the main agent's tools and do not expose full subagent tool/middleware configuration through `AGENTS.md`; this is weaker than kit-vnext's need for bounded worker contracts and capability-specific attestations.
- LangSmith observability is useful, but kit-vnext cannot make LangSmith a required source of truth unless routed through its Storage/Artifacts and Observability domains; otherwise it would couple the core to a concrete vendor surface.

## Primary sources

- [LangChain GitHub profile README](https://github.com/langchain-ai/.github/blob/main/profile/README.md)
- [Deep Agents Code docs: overview](https://docs.langchain.com/oss/python/deepagents/code/overview)
- [Deep Agents Code docs: memory and skills](https://docs.langchain.com/oss/python/deepagents/code/memory-and-skills)
- [Deep Agents Code docs: remote sandboxes](https://docs.langchain.com/oss/python/deepagents/code/remote-sandboxes)
- [Deep Agents Code docs: subagents](https://docs.langchain.com/oss/python/deepagents/code/subagents)
- [Deep Agents Code docs: model providers](https://docs.langchain.com/oss/python/deepagents/code/providers)
- [Deep Agents Code docs: configuration](https://docs.langchain.com/oss/python/deepagents/code/configuration)
- [Deep Agents Code docs: MCP tools](https://docs.langchain.com/oss/python/deepagents/code/mcp-tools)
- [Deep Agents Code docs: data locations](https://docs.langchain.com/oss/python/deepagents/code/data-locations)
- [Deep Agents Code PyPI package](https://pypi.org/project/deepagents-code/)
- [Deep Agents monorepo](https://github.com/langchain-ai/deepagents)
- [Deep Agents Code source tree](https://github.com/langchain-ai/deepagents/tree/main/libs/code)
- [Deep Agents Code architecture note](https://github.com/langchain-ai/deepagents/blob/main/libs/code/ARCHITECTURE.md)
- [Deep Agents Code command catalog](https://github.com/langchain-ai/deepagents/blob/main/libs/code/COMMANDS.md)
- [Deep Agents Code threat model](https://github.com/langchain-ai/deepagents/blob/main/libs/code/THREAT_MODEL.md)
- [Deep Agents SDK overview](https://docs.langchain.com/oss/python/deepagents/overview)
- [Deep Agents comparison with Claude Agent SDK](https://docs.langchain.com/oss/python/deepagents/comparison)
