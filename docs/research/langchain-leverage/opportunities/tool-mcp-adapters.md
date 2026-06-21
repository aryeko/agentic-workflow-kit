# Tool and MCP adapter patterns

## Opportunity summary

Score line: code avoided: medium-high; product gain: medium; seam fit: high; invariant risk:
medium if copied as patterns, high if imported into core; dependency risk: medium; timing: after
provider seam ports and mocks, before/alongside real Agent and Execution Host drivers; use type:
copied pattern now, optional provider-side adapter later.

MCP Adapters can reduce kit-vnext's edge/provider tool-bridging work by supplying a proven pattern
for discovering MCP tools, mapping transport/session lifecycles, preserving structured tool content,
separating tool execution errors from transport failures, and constructing conformance fixtures for
multi-server tools. The leverage is source-level pattern reuse, not direct control-plane adoption.

The correct kit-vnext shape is:

- Core and SDK keep the canonical contracts: `AgentProvider`, `ExecutionHostProvider`,
  `CapabilityAttestation`, `AgentEvent`, `ToolObserved`, `ApprovalKind`, and `ScopedGrant`.
- Edge MCP tools remain operator commands over `OperatorControlPort`; they do not invoke provider
  drivers or expose LangChain tools.
- Provider packages may use MCP adapter ideas internally to bridge external MCP servers into
  `AgentProvider` observations or Execution Host-managed subprocesses.
- Testkit can mine MCP adapter behavior into fixtures without depending on LangChain runtime types.

This keeps LangChain `StructuredTool`, `ToolMessage`, LangGraph `Command`, and LangChain runtime
context out of kit-vnext core while still avoiding a cold-start implementation of common MCP adapter
problems.

## Candidate projects

- `langchain-ai/langchain-mcp-adapters` (Python): primary source for the narrow adapter shape. It
  implements `MultiServerMCPClient`, `load_mcp_tools`, MCP-to-LangChain content conversion,
  structured-content artifact preservation, paginated tool listing, per-call session creation, and
  tool-call interceptors.
- `@langchain/mcp-adapters` (LangChain.js): relevant because kit-vnext is TypeScript-oriented. It
  documents stdio and streamable HTTP transports, SSE fallback, reconnection options, OAuth/custom
  headers, tool-name prefixing, standardized content blocks, progress/message callbacks, and explicit
  client cleanup.
- LangChain Python and JavaScript MCP docs: useful for current behavior around stateless defaults,
  explicit stateful sessions, tool error handling, structured content, multimodal content,
  resources, prompts, logging, progress notifications, and elicitation.
- Agent Protocol: secondary comparison only. It is useful for later `AgentProvider` compatibility
  thinking around runs, threads, schemas, and streaming, but it is broader than MCP tool bridging and
  must not replace kit-vnext run state or event-log authority.

## What to leverage

Leverage the adapter mechanics, not the framework semantics.

- Multi-server discovery: accept named MCP server configs, load tools from one server or all servers,
  and preserve server identity on every discovered tool. This maps well to provider-driver fixtures
  for tool-name collisions and source attribution.
- Session lifecycle split: default to fresh per-call sessions for stateless operation, but support an
  explicit persistent session scope when a server is stateful. In kit-vnext terms, this becomes
  `AgentSession` / `providerSessionId` evidence and must be observable, not hidden in a tool object.
- Transport taxonomy: stdio local subprocesses, HTTP/streamable HTTP, SSE fallback/legacy support,
  headers, auth, reconnect, and explicit close. Stdio belongs behind `ExecutionHostProvider`
  containment; HTTP egress belongs behind credentials/egress policy and host attestation.
- Tool schema and content conversion: preserve MCP tool names, descriptions, input schemas, text,
  image/file/resource content, and `structuredContent`. In kit-vnext this should become artifact refs
  and normalized `ToolObserved` evidence, not LangChain `ToolMessage` payloads.
- Failure taxonomy: distinguish MCP tool execution errors (`CallToolResult(isError=True)`) from
  transport/session/content-conversion failures. This is directly useful for fail-closed
  conformance cases.
- Interceptor pattern: immutable request override plus onion-style handler composition is a good
  driver-internal pattern for request decoration, retries, headers, logging, and policy checks.
  However, policy-relevant interceptor behavior must emit recorded evidence before core gates rely on
  it.
- Notifications and progress: server log/progress callbacks are useful as raw observation material
  for `core-07` and `AgentProgressObserved`, after redaction and event capture.
- Conformance fixtures: adapters suggest concrete adversarial cases: duplicate tool names,
  pagination loops, missing structured content, unsupported audio content, server list-change
  notifications, session loss, stale headers, transport failure, tool error result, interceptor
  short-circuit, and credential/header mutation.

## Why it helps kit-vnext

MCP is already part of kit-vnext's edge vocabulary, and MCP-like tool exposure is likely to appear in
real provider drivers. Without borrowing adapter patterns, kit-vnext would need to rediscover several
sharp edges:

- how to represent multiple MCP servers without name collisions;
- when a tool call should create a fresh session versus reuse an owned session;
- how to preserve structured and multimodal tool outputs without flattening them into prose;
- how to tell user-visible tool failures apart from adapter/transport failure;
- how to attach server/tool context to progress and logging;
- how to test local stdio MCP servers without letting subprocess lifecycle escape host ownership.

The product gain is most visible in three areas.

First, edge/provider tool bridging becomes less bespoke. The edge can expose kit-vnext operator MCP
tools over one canonical envelope, while provider drivers can use the same discovery/session lessons
for external MCP tool surfaces.

Second, tool discovery and lifecycle mapping can become explicit acceptance criteria instead of
implementation folklore. Every MCP-backed provider story can prove named-server discovery,
pagination, collision handling, session ownership, close/release behavior, and failure semantics.

Third, conformance fixtures become richer early. The MCP adapter codebase provides a compact source
of negative and boundary cases before kit-vnext has real provider drivers.

## Direct reuse vs adapter vs copied pattern

Do not directly reuse MCP Adapters in `packages/sdk`, core domains, or `packages/mcp`.

Recommended split:

- Copied pattern: use the source-level patterns for testkit fixtures, driver-internal pipelines, and
  story acceptance criteria. This is the immediate value.
- Adapter: later, a provider package may wrap `@langchain/mcp-adapters` or call MCP SDK APIs
  directly if the package is explicitly experimental or provider-specific. That wrapper must map
  every result to kit-vnext `AgentEvent`, `ToolObserved`, `AgentFailure`, `CapabilityAttestation`,
  and artifact refs.
- Direct reuse: acceptable only inside an optional provider-driver experiment, never across the
  SDK/core boundary. Direct reuse in core would import LangChain tool semantics, dependency churn, and
  middleware behavior into the deterministic control plane.

If kit-vnext needs a TypeScript MCP bridge, prefer a small kit-owned adapter over MCP SDK primitives
or a provider-local wrapper around `@langchain/mcp-adapters`. The adapter's public output should be a
kit-native `DiscoveredTool` / `ToolObservation` fixture shape or existing provider contract payload,
not a LangChain `StructuredTool`.

## Source-level fit notes

Python `MultiServerMCPClient` is a close conceptual fit for provider-driver internals. Its
constructor keeps a map of named server connections, optional callbacks, optional tool interceptors,
tool-name prefix behavior, and a `handle_tool_errors` switch. `get_tools()` loads tools from one
server or all servers and creates load tasks per server. This maps to a kit-vnext fixture builder for
multi-server discovery and duplicate-name handling.

The Python docs and source make the session policy explicit: default `MultiServerMCPClient` usage is
stateless, where each generated tool invocation creates a fresh MCP `ClientSession`, initializes it,
calls the tool, and cleans up. The same client also exposes `session(server_name)` so callers can
hold a persistent session for stateful servers. For kit-vnext, this is useful vocabulary for
`ownershipClass`, `providerSessionId`, `canResumeOwned`, and `stopObserving`; it must not be hidden
inside a LangChain tool callable.

`tools.py` is the strongest source-level fixture input. It lists tools with pagination and a
maximum-iteration guard, converts MCP content into text/image/file blocks, preserves
`structuredContent` as `MCPToolArtifact`, treats `isError=True` as a tool execution error, and lets
transport/session/content-conversion errors propagate separately. Kit-vnext should translate these
into explicit conformance rows: paginated discovery, unsupported content, structured artifact
capture, failed tool output, and transport failure.

`interceptors.py` has a clean request lifecycle pattern: `MCPToolCallRequest` has modifiable fields
for name, args, and headers, read-only context for server/runtime, and `override()` returns a new
request using dataclass replacement. `ToolCallInterceptor` composes around an async handler and may
retry, skip, or wrap execution. The immutable override pattern fits kit-vnext style, but runtime
context, header injection, and short-circuiting are security-sensitive; in kit-vnext they must be
driver-local and evidence-producing.

The JavaScript README adds TypeScript-relevant operational details: stdio and streamable HTTP
transports, automatic SSE fallback, OAuth provider support, reconnection strategies, standardized
content blocks, top-level message/progress callbacks, list-change callbacks, `loadMcpTools`, and
explicit `client.close()`. These map to Execution Host and conformance concerns more than to core
logic.

Agent Protocol is not a tool adapter. Its source-level fit is limited to later compatibility
fixtures around agent schemas, runs, thread-scoped streams, and tool lifecycle events. It should not
influence MCP tool bridge design except as a reminder that external protocols often bundle state
models that kit-vnext must keep behind `AgentProvider`.

## Required kit-vnext stories

No core-first story should depend on MCP Adapters.

Later stories worth adding after SDK provider ports and testkit mocks exist:

- `testkit-mcp-tool-fixtures`: add MCP-inspired fixtures for named-server discovery, paginated tool
  lists, duplicate names, structured/multimodal outputs, tool execution errors, transport failures,
  unsupported content, session loss, and interceptor/header mutation.
- `seam-agent-mcp-observation-spike`: map MCP tool call/progress/elicitation samples into
  `AgentEvent`, `ApprovalKind = "mcp-elicitation"`, `ToolObserved`, artifact refs, and fail-closed
  `AgentFailure` tokens.
- `seam-execution-host-mcp-stdio-spike`: prove that local stdio MCP servers run only under
  `ExecutionHostProvider` containment, termination, output redaction, and egress policy.
- `edge-mcp-operator-surface`: implement kit-vnext's own MCP operator tools over
  `OperatorControlPort` with no provider imports, no run logic, and one control-plane call per
  operator action.
- `provider-mcp-bridge-experiment`: optional provider-local experiment that either wraps
  `@langchain/mcp-adapters` or the MCP SDK directly, then reports which behaviors can be attested
  without leaking LangChain types.

## Risks and constraints

- LangChain semantics leak: `StructuredTool`, `ToolMessage`, LangGraph `Command`, runtime context,
  and middleware hooks are not kit-vnext contracts. Importing them into SDK/core would violate the
  provider seam posture.
- Capability self-report risk: tool discovery, schema presence, and adapter callbacks are only hints
  until kit-vnext records fresh positive `CapabilityAttestation` evidence.
- Session ambiguity risk: stateless per-call sessions are simple but can hide continuity failures;
  persistent sessions require explicit ownership, release, and resume evidence.
- Subprocess risk: stdio MCP servers are real subprocesses. They require Execution Host containment,
  termination proof, output capture, redaction, and egress controls.
- Credential risk: adapter interceptors can add headers and user context. In kit-vnext, credential
  injection must flow through fnd-04 and recorded policy/audit events, never arbitrary middleware.
- Error semantics risk: returning MCP tool errors to an LLM as ordinary tool messages may be useful
  inside an agent harness, but kit-vnext gates need explicit degraded/failure events and cannot let a
  model self-correct away evidence gaps.
- Version drift: Python and JavaScript adapter APIs differ, and both sit on fast-moving LangChain/MCP
  surfaces. Any direct dependency should be provider-local and pinned.
- Timing constraint: the readiness matrix says packages and conformance are not implemented yet.
  MCP adapter work should wait until provider ports, mocks, and core gates can reject nonconforming
  behavior.

## Recommended verdict

Use MCP Adapters as source-level leverage for provider-driver and testkit design, not as a
kit-vnext core dependency.

The recommended adoption is `maybe`, with copied patterns now and optional provider-side adapter
experiments later. MCP Adapters can save meaningful work around multi-server discovery, session
lifecycle, content preservation, interceptor shape, progress/logging callbacks, and conformance
fixtures. It should not change the design closure: core remains deterministic, edge remains a thin
operator adapter, provider ports remain SDK-owned, and real MCP tool execution remains behind Agent
and Execution Host seams with recorded capability evidence.

## Sources

- Local design: `AGENTS.md`
- Local review: `design-closure/outputs/langchain-review/README.md`
- Local review: `design-closure/outputs/langchain-review/UNIFIED-REPORT.md`
- Local project report: `design-closure/outputs/langchain-review/project-reports/mcp-adapters.md`
- Local adoption report: `design-closure/outputs/langchain-review/adoption-reports/mcp-adapters-adoption.md`
- Local project report: `design-closure/outputs/langchain-review/project-reports/agent-protocol.md`
- Local adoption report: `design-closure/outputs/langchain-review/adoption-reports/agent-protocol-adoption.md`
- Local design: `docs/design/30-domain-reference/edge/operator-surface/README.md`
- Local design: `docs/design/20-sdk-and-packaging/provider-ports.md`
- Local design: `docs/design/10-architecture/provider-seams.md`
- Local design: `docs/design/30-domain-reference/providers/agent-execution/README.md`
- Local design: `docs/design/30-domain-reference/providers/execution-host/README.md`
- Local implementation planning: `docs/implementation/domain-dag.md`
- Local implementation planning: `docs/implementation/readiness-matrix.md`
- Upstream: [langchain-ai/langchain-mcp-adapters](https://github.com/langchain-ai/langchain-mcp-adapters)
- Upstream source:
  [client.py](https://raw.githubusercontent.com/langchain-ai/langchain-mcp-adapters/main/langchain_mcp_adapters/client.py)
- Upstream source:
  [tools.py](https://raw.githubusercontent.com/langchain-ai/langchain-mcp-adapters/main/langchain_mcp_adapters/tools.py)
- Upstream source:
  [interceptors.py](https://raw.githubusercontent.com/langchain-ai/langchain-mcp-adapters/main/langchain_mcp_adapters/interceptors.py)
- Upstream docs: [LangChain Python MCP docs](https://docs.langchain.com/oss/python/langchain/mcp)
- Upstream docs: [LangChain JavaScript MCP docs](https://docs.langchain.com/oss/javascript/langchain/mcp)
- Upstream source:
  [LangChain.js MCP Adapters README](https://raw.githubusercontent.com/langchain-ai/langchainjs/main/libs/langchain-mcp-adapters/README.md)
- Upstream reference:
  [MultiServerMCPClient](https://reference.langchain.com/python/langchain-mcp-adapters/client/MultiServerMCPClient)
- Upstream secondary comparison: [Agent Protocol](https://github.com/langchain-ai/agent-protocol)
- Upstream secondary comparison:
  [Agent Protocol OpenAPI](https://langchain-ai.github.io/agent-protocol/openapi.json)

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../README.md) · **← Prev:** [Observability and evals](./observability-evals.md) · **Next →:** [LangChain leverage report](../README.md)

<!-- /DOCS-NAV -->
