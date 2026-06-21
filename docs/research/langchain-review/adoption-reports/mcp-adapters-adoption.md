# MCP Adapters adoption review for kit-vnext

## Should we use it?

maybe

Use MCP Adapters as research input for provider-driver and edge adapter design, not as a direct
kit-vnext dependency or core architecture component.

## Why / why not

MCP Adapters is a narrow LangChain/LangGraph bridge: it discovers MCP tools/resources/prompts and
wraps them as LangChain-native tools with transport/session configuration, callbacks, interceptors,
and structured-content conversion. The project report confirms it is not an orchestrator and does
not own durable state, checkpointing, merge policy, recovery, capability attestation, or evidence
gates
([project report](../project-reports/mcp-adapters.md)).

That shape is useful as adapter-pattern evidence, but direct adoption conflicts with kit-vnext's
applied closure. Live kit-vnext now treats provider ports and `CapabilityAttestation` as SDK-owned
contracts, keeps concrete driver risk in provider packages, builds core first against testkit mocks,
and pushes real-driver readiness to production stories
([apply report](../../apply/APPLY-REPORT.md);
[provider ports](../../../../docs/design/20-sdk-and-packaging/provider-ports.md);
[domain DAG](../../../../docs/implementation/domain-dag.md)).

## Where it maps to kit-vnext

- `edge-01`: MCP is already an operator surface beside CLI; MCP Adapters can inform request/response
  wrapper ergonomics, but the edge must call the Control plane once per action and contain no run
  logic
  ([edge-01](../../../../docs/design/30-domain-reference/edge/operator-surface/README.md)).
- `prov-01`: tool/event normalization, approval/elicitation handling, and structured tool outputs map
  loosely to `AgentProvider` observation events and `ApprovalKind = "mcp-elicitation"`, but the
  canonical contract remains SDK-owned
  ([provider ports](../../../../docs/design/20-sdk-and-packaging/provider-ports.md);
  [prov-01](../../../../docs/design/30-domain-reference/providers/agent-execution/README.md)).
- `prov-04`: stdio MCP servers are subprocesses, so any real use belongs behind
  `ExecutionHostProvider` containment, egress, command capture, and termination proofs, not inside
  core or edge code
  ([prov-04](../../../../docs/design/30-domain-reference/providers/execution-host/README.md)).
- `core-02`: adapter callbacks/interceptors cannot be trusted as claims; any capability they imply
  must become recorded evidence and fresh positive `CapabilityAttestation` input to a gate
  ([capability attestation](../../../../docs/design/10-architecture/capability-attestation.md);
  [core-02](../../../../docs/design/30-domain-reference/core/capability-and-safety/README.md)).
- `core-01` / `fnd-02`: progress, logging, tool results, and artifacts must be appended or stored via
  kit-vnext event/artifact ports; MCP Adapter's stateless/session-local behavior is not a substitute
  for the event log as source of truth
  ([core-01](../../../../docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md);
  [storage port types](../../../../docs/design/20-sdk-and-packaging/storage-port-types.md)).

## Concrete use cases

- Study tool-name prefixing for future MCP tool exposure in `edge-01` so operator-facing tools avoid
  collisions.
- Borrow immutable request-override/interceptor ideas for provider-driver internals, while requiring
  every policy-relevant change to emit recorded evidence.
- Use its stateless-by-default versus explicit session model as a caution for `AgentProvider`
  ownership and resume semantics.
- Preserve structured/multimodal tool content as artifacts with digests instead of flattening it into
  prose.
- Treat progress/logging callbacks as inputs to `core-07` observability only after redaction and event
  capture.

## Required design changes, if any

None now. The applied design already has the right homes: SDK provider ports, testkit mocks,
capability attestations, `edge-01` MCP tools, and later real-provider driver stories. Do not add a
LangChain or MCP Adapters dependency to the core design.

Possible future design note, after driver work starts: document whether kit-vnext's own `packages/mcp`
surface exposes only operator commands or also controlled provider-tool bridges.

## Required implementation stories, if any

None for core-first stories.

Later, after seam ports and mocks exist:

- `edge-01`: implement kit-vnext MCP tools over `OperatorControlPort` without importing provider
  drivers.
- `prov-01` research spike: test whether MCP elicitation/tool-call events from a concrete Agent
  driver can be normalized into `AgentEvent` and attested.
- `prov-04` research spike: evaluate safe stdio MCP subprocess execution under the local host driver,
  including termination, egress negative probes, and output redaction.
- `testkit`: add adversarial fixtures for tool-name collisions, malformed structured content,
  dropped progress notifications, session loss, and interceptor-injected credential misuse.

## Risks and constraints

- LangChain-specific dependency shape is wrong for kit-vnext's deterministic, TypeScript SDK-owned
  control plane unless isolated to a driver experiment.
- Interceptors can alter headers, credentials, requests, and results; kit-vnext must route those
  through fnd-04 policy, redaction, and recorded evidence before any gate relies on them.
- Stateless per-call sessions can hide lifecycle and resume failures; kit-vnext requires explicit
  ownership, linkage, and replayable session facts.
- MCP tool errors and transport/session errors have different semantics; kit-vnext failure tokens
  must stay explicit and fail closed.
- Real MCP servers may be subprocesses or remote endpoints; production use requires prov-04
  containment, egress attestation, credential scoping, and live capability probes.

## Decision timing

after provider drivers

## Recommended next action

Keep MCP Adapters in the research backlog as an adapter-pattern reference. Do not change the applied
kit-vnext design. Revisit when `AgentProvider`, `ExecutionHostProvider`, testkit mocks, and edge MCP
commands exist and the team is ready to evaluate real provider-driver production readiness.

## Sources

- [MCP Adapters project report](../project-reports/mcp-adapters.md)
- [Design closure apply report](../../apply/APPLY-REPORT.md)
- [Architecture](../../../../docs/design/10-architecture/architecture.md)
- [Provider seams](../../../../docs/design/10-architecture/provider-seams.md)
- [Capability attestation](../../../../docs/design/10-architecture/capability-attestation.md)
- [SDK provider ports](../../../../docs/design/20-sdk-and-packaging/provider-ports.md)
- [Storage port types](../../../../docs/design/20-sdk-and-packaging/storage-port-types.md)
- [Domain DAG](../../../../docs/implementation/domain-dag.md)
- [Readiness matrix](../../../../docs/implementation/readiness-matrix.md)
- [Agent Execution](../../../../docs/design/30-domain-reference/providers/agent-execution/README.md)
- [Execution Host](../../../../docs/design/30-domain-reference/providers/execution-host/README.md)
- [Forge / Collaboration](../../../../docs/design/30-domain-reference/providers/forge-collaboration/README.md)
- [Work Source](../../../../docs/design/30-domain-reference/providers/work-source/README.md)
- [Operator & Entry Surface](../../../../docs/design/30-domain-reference/edge/operator-surface/README.md)

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../README.md) · **← Prev:** [LangSmith adoption review for kit-vnext](./langsmith-adoption.md) · **Next →:** [Open SWE adoption review for kit-vnext](./open-swe-adoption.md)

<!-- /DOCS-NAV -->
