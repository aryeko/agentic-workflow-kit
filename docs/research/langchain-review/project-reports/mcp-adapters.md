# MCP Adapters
## What it is

MCP Adapters is LangChain AI's adapter layer for using Model Context Protocol servers from LangChain and LangGraph. The LangChain organization profile lists "MCP Adapters" as an OSS extension whose job is to "make MCP tools compatible with LangChain and LangGraph" ([profile README](https://github.com/langchain-ai/.github/blob/main/profile/README.md)). The main Python repository describes the package as a lightweight wrapper around MCP tools for LangChain/LangGraph agents, and notes a separate JavaScript/TypeScript version in LangChainJS ([Python repo README](https://github.com/langchain-ai/langchain-mcp-adapters), [LangChainJS MCP adapters README](https://github.com/langchain-ai/langchainjs/tree/main/libs/langchain-mcp-adapters)).

## Core capabilities

The Python package converts MCP tools into LangChain tools, connects to one or more MCP servers, and loads tools from them ([repo README](https://github.com/langchain-ai/langchain-mcp-adapters)). Current LangChain docs also document MCP resources as LangChain `Blob` objects, prompts as LangChain messages, structured tool content as `MCPToolArtifact`, multimodal content as LangChain standard content blocks, tool interceptors, progress notifications, logging callbacks, and MCP elicitation callbacks ([LangChain MCP docs](https://docs.langchain.com/oss/python/langchain/mcp)). The latest Python README examples cover stdio, HTTP/streamable HTTP, runtime HTTP headers, error handling, LangGraph `StateGraph`, and LangGraph API Server use ([repo README](https://github.com/langchain-ai/langchain-mcp-adapters)).

## How it works architecturally

Architecturally, the adapter is a client-side bridge: it uses MCP client sessions to discover server tools, then wraps each discovered MCP tool as a LangChain `StructuredTool`. With `MultiServerMCPClient`, calls can be made across named server connections; with `load_mcp_tools`, callers can operate on an explicit MCP `ClientSession` ([source: client.py](https://raw.githubusercontent.com/langchain-ai/langchain-mcp-adapters/main/langchain_mcp_adapters/client.py), [source: tools.py](https://raw.githubusercontent.com/langchain-ai/langchain-mcp-adapters/main/langchain_mcp_adapters/tools.py)). If a persistent session is not supplied, generated tools create a session for a tool call, initialize it, call the MCP tool, and clean up; this is why the docs describe `MultiServerMCPClient` as stateless by default ([LangChain MCP docs](https://docs.langchain.com/oss/python/langchain/mcp)).

The adapter is not an orchestrator. It does not own agent planning, checkpointing, merge policy, or durable workflow state. Those concerns remain in LangChain/LangGraph or the application. Its own architecture is mostly transport/session configuration, MCP-to-LangChain schema/content conversion, callbacks, and interceptor composition.

## Main abstractions / APIs

Primary Python APIs:

- `MultiServerMCPClient(connections, callbacks=None, tool_interceptors=None, tool_name_prefix=False, handle_tool_errors=True)` manages named MCP server configs and exposes `session(server_name)`, `get_tools()`, `get_prompt()`, and `get_resources()` ([source: client.py](https://raw.githubusercontent.com/langchain-ai/langchain-mcp-adapters/main/langchain_mcp_adapters/client.py), [API reference](https://reference.langchain.com/python/langchain-mcp-adapters/client/MultiServerMCPClient)).
- `load_mcp_tools(session, ...)` and `convert_mcp_tool_to_langchain_tool(...)` list MCP tools, convert input schemas and metadata, and return LangChain `BaseTool` / `StructuredTool` instances ([source: tools.py](https://raw.githubusercontent.com/langchain-ai/langchain-mcp-adapters/main/langchain_mcp_adapters/tools.py)).
- `MCPToolCallRequest` plus `ToolCallInterceptor` provide an async wrapper chain around tool execution; `request.override(...)` returns a modified request rather than mutating the original ([source: interceptors.py](https://raw.githubusercontent.com/langchain-ai/langchain-mcp-adapters/main/langchain_mcp_adapters/interceptors.py), [LangChain MCP docs](https://docs.langchain.com/oss/python/langchain/mcp)).
- `Callbacks` supports progress, logging, and elicitation integrations for MCP protocol notifications ([LangChain MCP docs](https://docs.langchain.com/oss/python/langchain/mcp)).
- `to_fastmcp(tool)` converts a LangChain tool back into a FastMCP tool, with limitations around injected arguments ([source: tools.py](https://raw.githubusercontent.com/langchain-ai/langchain-mcp-adapters/main/langchain_mcp_adapters/tools.py)).

The JS/TS package exposes analogous `MultiServerMCPClient` and `loadMcpTools` APIs, plus JS-specific configuration such as stdio/streamable HTTP reconnection, SSE fallback, OAuth provider support, tool naming prefixes, notification callbacks, and before/after tool hooks ([LangChainJS MCP adapters README](https://github.com/langchain-ai/langchainjs/tree/main/libs/langchain-mcp-adapters), [JS reference](https://reference.langchain.com/javascript/langchain-mcp-adapters)).

## Operational model

The adapter runs embedded in the application process. MCP servers are external endpoints or subprocesses configured per server: stdio launches a local subprocess, while HTTP/streamable HTTP and SSE connect over network transports ([LangChain MCP docs](https://docs.langchain.com/oss/python/langchain/mcp)). HTTP transports can carry static headers, per-call header overrides from interceptors, or custom `httpx.Auth` mechanisms through the official MCP SDK ([LangChain MCP docs](https://docs.langchain.com/oss/python/langchain/mcp)).

By default, each generated tool invocation creates a fresh MCP `ClientSession`; callers that need server-local continuity can explicitly open `client.session("server")` and load tools/resources/prompts against that session ([LangChain MCP docs](https://docs.langchain.com/oss/python/langchain/mcp)). Tool execution errors reported by MCP as `CallToolResult(isError=True)` are returned to the model as failed tool messages by default in `langchain-mcp-adapters>=0.3.0`; transport/session/content-conversion failures still raise ([LangChain MCP docs](https://docs.langchain.com/oss/python/langchain/mcp), [GitHub releases](https://github.com/langchain-ai/langchain-mcp-adapters/releases)).

## Persistence / state / checkpointing model

MCP Adapters has no durable persistence or checkpointing model of its own confirmed in the primary sources. The documented default is stateless per tool invocation, with explicit `ClientSession` scopes available for stateful MCP servers ([LangChain MCP docs](https://docs.langchain.com/oss/python/langchain/mcp)). Any graph state, checkpointing, long-term store, human approval pause/resume, or durable recovery comes from LangGraph/LangChain or the caller's application, not from this adapter package.

## Observability / evaluation / debugging support

The package exposes operational hooks rather than a full observability system. LangChain docs show LangSmith tracing as the recommended way to trace MCP tool calls alongside agent reasoning ([LangChain MCP docs](https://docs.langchain.com/oss/python/langchain/mcp)). Adapter-level callbacks can capture MCP progress notifications and server logging notifications with server/tool context, and interceptors can add custom logging, retries, request IDs, or fallback behavior around tool calls ([LangChain MCP docs](https://docs.langchain.com/oss/python/langchain/mcp)). The JS package also documents debug logging via the `debug` package, top-level notification callbacks, and progress callbacks ([LangChainJS MCP adapters README](https://github.com/langchain-ai/langchainjs/tree/main/libs/langchain-mcp-adapters)).

No primary source confirmed built-in evaluation, trace storage, replay, or audit-log persistence inside MCP Adapters itself.

## Provider / model / tool integration model

The integration model is tool-centric. MCP servers expose tools, resources, and prompts through the MCP protocol; the adapter converts them into LangChain/LangGraph-native surfaces. The resulting tools can be passed to `create_agent`, bound to chat models, or used in a LangGraph `ToolNode` / `StateGraph` ([repo README](https://github.com/langchain-ai/langchain-mcp-adapters), [LangChain MCP docs](https://docs.langchain.com/oss/python/langchain/mcp)). Model providers are therefore indirect: the adapter does not choose models, but the converted tools can be used with any LangChain-compatible agent/model stack that supports tool calling.

The adapter supports both local and remote tool providers through MCP transports: stdio for local subprocess servers, HTTP/streamable HTTP for remote servers, and SSE for legacy/compatibility cases ([LangChain MCP docs](https://docs.langchain.com/oss/python/langchain/mcp), [LangChainJS MCP adapters README](https://github.com/langchain-ai/langchainjs/tree/main/libs/langchain-mcp-adapters)). Interceptors are the main extension point for provider-specific concerns such as injecting per-user context, credentials, headers, authorization checks, retries, or mapping tool results into LangGraph `Command` objects ([LangChain MCP docs](https://docs.langchain.com/oss/python/langchain/mcp)).

## Maturity and ecosystem notes

The Python package is maintained under `langchain-ai`, has visible adoption signals in GitHub, and is published as `langchain-mcp-adapters` on PyPI. The GitHub UI showed about 3.6k stars, 449 forks, 45 issues, 35 pull requests, and 184 commits when observed; PyPI lists version `0.3.0`, released June 10, 2026, with verified maintainer details under `langchain` ([GitHub repo](https://github.com/langchain-ai/langchain-mcp-adapters), [PyPI](https://pypi.org/project/langchain-mcp-adapters/)). The `pyproject.toml` currently declares Python `>=3.10`, `langchain-core>=1.0.0,<2.0.0`, and `mcp>=1.9.2` ([pyproject.toml](https://raw.githubusercontent.com/langchain-ai/langchain-mcp-adapters/main/pyproject.toml)).

The release history shows active maintenance and a still-moving surface: `0.2.0` introduced structured output support with LangChain standard content blocks, and `0.3.0` added failed-tool-output behavior for MCP tool execution errors and updated streamable HTTP usage ([GitHub releases](https://github.com/langchain-ai/langchain-mcp-adapters/releases)). The JS/TS package exists separately in LangChainJS and has a somewhat different operational API, including reconnection behavior and OAuth support ([LangChainJS MCP adapters README](https://github.com/langchain-ai/langchainjs/tree/main/libs/langchain-mcp-adapters)).

## What looks relevant to kit-vnext

The most relevant lesson is the adapter shape, not direct orchestration adoption. MCP Adapters demonstrates a narrow provider bridge: discover external capabilities, normalize them into host-framework tools, preserve structured/multimodal outputs, expose callbacks, and let the caller decide orchestration. That maps well to kit-vnext's provider-seam model, where tool/provider specifics should live behind drivers rather than leak into the control plane.

Specific ideas worth studying for kit-vnext are: per-server transport config; explicit stateless-by-default versus caller-managed session lifetimes; tool-name prefixing to avoid collisions; immutable request override in interceptors; structured-content preservation; failed tool outputs versus transport failures; progress/logging callbacks with server/tool context; and a clear split between local stdio servers and remote HTTP servers.

## What looks irrelevant or risky for kit-vnext

Directly adopting MCP Adapters as a core kit-vnext provider would likely be a poor fit unless kit-vnext chooses Python/LangChain as a runtime dependency. kit-vnext is a deterministic delivery control plane with strict Agent, Execution Host, Forge, and Work Source seams; MCP Adapters is a LangChain/LangGraph tool bridge and does not provide capability attestation, worker/runner isolation, append-only event logs, exact-head Forge evidence, or deterministic recovery.

The risky parts are mostly operational. Stdio MCP servers are subprocesses and the LangChain docs explicitly warn to evaluate whether stdio is appropriate in a web server context ([repo README](https://github.com/langchain-ai/langchain-mcp-adapters)). Per-call fresh sessions are clean but can be inefficient or surprising for stateful tools; persistent sessions push lifecycle responsibility to the caller. Interceptors can inject credentials and alter requests/results, which is powerful but would need kit-vnext-grade policy, redaction, event capture, and capability gates before use in a software-delivery control plane. JS and Python APIs also differ, so any multi-language design should avoid assuming a single adapter contract.

## Primary sources

- [LangChain AI organization profile README](https://github.com/langchain-ai/.github/blob/main/profile/README.md)
- [langchain-ai/langchain-mcp-adapters repository](https://github.com/langchain-ai/langchain-mcp-adapters)
- [Python README raw source](https://raw.githubusercontent.com/langchain-ai/langchain-mcp-adapters/main/README.md)
- [LangChain MCP docs](https://docs.langchain.com/oss/python/langchain/mcp)
- [MultiServerMCPClient API reference](https://reference.langchain.com/python/langchain-mcp-adapters/client/MultiServerMCPClient)
- [Python package reference](https://reference.langchain.com/python/langchain-mcp-adapters/langchain_mcp_adapters)
- [client.py source](https://raw.githubusercontent.com/langchain-ai/langchain-mcp-adapters/main/langchain_mcp_adapters/client.py)
- [tools.py source](https://raw.githubusercontent.com/langchain-ai/langchain-mcp-adapters/main/langchain_mcp_adapters/tools.py)
- [interceptors.py source](https://raw.githubusercontent.com/langchain-ai/langchain-mcp-adapters/main/langchain_mcp_adapters/interceptors.py)
- [pyproject.toml](https://raw.githubusercontent.com/langchain-ai/langchain-mcp-adapters/main/pyproject.toml)
- [GitHub releases](https://github.com/langchain-ai/langchain-mcp-adapters/releases)
- [PyPI package](https://pypi.org/project/langchain-mcp-adapters/)
- [LangChainJS MCP adapters README](https://github.com/langchain-ai/langchainjs/tree/main/libs/langchain-mcp-adapters)
- [JavaScript reference](https://reference.langchain.com/javascript/langchain-mcp-adapters)

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../README.md) · **← Prev:** [LangSmith](./langsmith.md) · **Next →:** [Open SWE](./open-swe.md)

<!-- /DOCS-NAV -->
