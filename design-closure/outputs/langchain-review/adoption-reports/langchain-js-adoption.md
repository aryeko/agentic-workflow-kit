# LangChain.js adoption review for kit-vnext

## Should we use it?

maybe

LangChain.js should not enter kit-vnext core or SDK provider-port definitions now. It is plausible as
a later optional `AgentProvider` driver or research harness after the SDK ports, testkit mocks, and
core-first stories are implemented.

## Why / why not

LangChain.js maps well to agent harness experimentation: the project report identifies
`createAgent`, typed tools, middleware, streaming, provider model packages, MCP adapters, LangSmith
tracing, and AgentEvals as mature TypeScript surfaces for building and inspecting LLM applications
([project report](../project-reports/langchain-js.md)). Those are useful when comparing worker
providers or building an experimental agent implementation.

It conflicts with kit-vnext if treated as an orchestrator or control-plane substrate. Current
kit-vnext architecture requires a deterministic, host-neutral Control plane, four provider seams,
fresh capability attestations, worker/runner separation, and an append-only event log as the run
source of truth ([architecture](../../../../docs/design/10-architecture/architecture.md),
[provider seams](../../../../docs/design/10-architecture/provider-seams.md),
[capability attestation](../../../../docs/design/10-architecture/capability-attestation.md)). A
model-driven LangChain agent loop cannot decide completion, approval, merge, recovery, or work-source
status for kit-vnext.

The applied closure also moved the provider interfaces and `CapabilityAttestation` into SDK-owned
contracts and made real live drivers production-readiness work, not core readiness
([apply report](../../apply/APPLY-REPORT.md),
[provider ports](../../../../docs/design/20-sdk-and-packaging/provider-ports.md),
[readiness matrix](../../../../docs/implementation/readiness-matrix.md)). That strongly favors
learning from LangChain.js later, behind the Agent seam, rather than adopting it now.

## Where it maps to kit-vnext

- `prov-01` / `seam-agent-contract-mock`: possible future experimental `AgentProvider` driver
  wrapping LangChain `createAgent`, model providers, tools, middleware, streaming, and optional MCP
  tools. It must emit kit-vnext `linked`, `approval-requested`, `tool-observed`, `guardian-review`,
  `degraded`, and `terminal` events, not LangChain-native state ([Agent Execution](../../../../docs/design/30-domain-reference/providers/agent-execution/README.md),
  [provider ports](../../../../docs/design/20-sdk-and-packaging/provider-ports.md)).
- `core-02`: LangChain capabilities must be probed and recorded as SDK `CapabilityAttestation`
  payloads. Documentation or model/provider self-report is not enough ([Capability & Safety](../../../../docs/design/30-domain-reference/core/capability-and-safety/README.md)).
- `core-03`: LangChain human-in-the-loop middleware is conceptually similar to approval pause/reply,
  but kit-vnext approval decisions, deadlines, scoped grants, park/resume, and audit events remain
  core-owned ([Approval & Escalation](../../../../docs/design/30-domain-reference/core/approval-and-escalation/README.md)).
- `core-07`: LangSmith traces and AgentEvals can inform analysis and worker-provider debugging, but
  core-07 analysis remains a pure replay over kit-vnext log events and redacted artifacts
  ([Observability & Analysis](../../../../docs/design/30-domain-reference/core/observability-and-analysis/README.md)).
- `fnd-02` / `core-01`: LangChain checkpointing or memory stores are not run truth. kit-vnext run
  truth remains the append-only event log and durable artifacts ([Run Lifecycle & Event State](../../../../docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md),
  [storage port types](../../../../docs/design/20-sdk-and-packaging/storage-port-types.md)).
- `prov-04`: if LangChain tools execute commands, execution still must occur inside an attested
  Execution Host with runner-owned verification separate from worker observations ([Execution Host](../../../../docs/design/30-domain-reference/providers/execution-host/README.md)).

## Concrete use cases

- Build a later LangChain-backed `AgentProvider` spike to test whether a LangChain worker can produce
  stable structured tool observations, approval relay, terminal classification, and resumable session
  linkage.
- Use LangChain provider integrations as a comparison set when designing provider conformance
  fixtures for model/tool behavior.
- Use LangSmith and AgentEvals as optional debugging/evaluation aids for worker-provider research,
  while preserving kit-vnext event refs as the only gate evidence.
- Use LangChain MCP adapters in an interop probe, especially for tool schema and per-call session
  behavior, without letting MCP adapter state bypass kit-vnext seams.

## Required design changes, if any

None now. The current design already has the right extension point: `AgentProvider` in the SDK-owned
provider-port catalog, with real drivers deferred to production-readiness stories. Adding a
LangChain-specific architecture change now would be premature and risks weakening the deterministic
core-first boundary.

If pursued later, it should be documented as a concrete driver mapping under `prov-01`, not as a new
core abstraction or replacement for the Codex/mock contract.

## Required implementation stories, if any

- After `seam-agent-contract-mock` exists, add a research story for a `provider-langchain`
  feasibility spike behind `AgentProvider`.
- Probe whether LangChain.js can provide or be wrapped to provide: approval answer persistence,
  owned resume, structured tool exit with exit code and redacted output refs, single terminal state,
  stable session linkage, and process parentage via the Execution Host.
- Add conformance fixtures where LangChain emits incomplete, delayed, or ambiguous tool/approval
  data; verify kit-vnext degrades rather than fabricating evidence.
- Keep dependencies optional and isolated in a provider package. Do not add `langchain`,
  `@langchain/langgraph`, LangSmith, or provider packages to SDK/core packages.

## Risks and constraints

- Control-plane substitution risk: LangChain agents are model-driven; kit-vnext requires plain-code
  deterministic gates.
- Persistence mismatch: LangChain checkpointing and stores are agent/application memory, not the
  kit-vnext event log.
- Side-effect leakage: LangChain tools can perform arbitrary actions unless wrapped by the
  Execution Host, Credentials, Approval, and Forge seams.
- Evidence mismatch: LangSmith traces and model/tool events are helpful diagnostics, but CI, review
  threads, exact head SHA, command digests, and capability attestations remain kit-vnext evidence.
- Dependency churn and surface area: the ecosystem is broad and fast-moving; keep it outside SDK/core.
- Production-readiness gap: the current readiness matrix says packages and runtime attestations are
  not implemented yet, so LangChain live claims would need fresh probes before any production use.

## Decision timing

after core-first stories

Do not adopt during foundation, SDK provider-port, testkit mock, or core gate implementation. Revisit
after the Agent seam contract/mock exists and core can reject bad provider behavior deterministically.

## Recommended next action

Record LangChain.js as a later optional `prov-01` research candidate. No architecture change now.
When core-first stories land, run a bounded `provider-langchain` spike against the SDK
`AgentProvider` conformance suite and decide from probe results.

## Sources

- [LangChain.js project report](../project-reports/langchain-js.md)
- [Design closure apply report](../../apply/APPLY-REPORT.md)
- [kit-vnext architecture](../../../../docs/design/10-architecture/architecture.md)
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
- [Run Lifecycle & Event State](../../../../docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md)
- [Capability & Safety](../../../../docs/design/30-domain-reference/core/capability-and-safety/README.md)
- [Approval & Escalation](../../../../docs/design/30-domain-reference/core/approval-and-escalation/README.md)
- [Completion, Verification & Merge](../../../../docs/design/30-domain-reference/core/completion-and-merge/README.md)
- [Observability & Analysis](../../../../docs/design/30-domain-reference/core/observability-and-analysis/README.md)
