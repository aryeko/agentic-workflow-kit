# LangChain adoption review for kit-vnext

## Should we use it?

maybe

Do not adopt LangChain/LangGraph as kit-vnext's control plane. Consider it later as an optional
provider-side integration or as reference material for agent runtime patterns, observability, and
human-in-the-loop ergonomics.

## Why / why not

LangChain is an LLM application and agent harness: `create_agent` combines a model, tools, prompt,
middleware, structured output, context, checkpointing, and runtime behavior; LangGraph supplies the
durable graph/checkpoint substrate underneath current agents
([project report](../project-reports/langchain.md), [LangChain overview](https://docs.langchain.com/oss/python/langchain/overview),
[LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence)). That is useful
ecosystem surface area, but it conflicts with kit-vnext if placed in the core. kit-vnext's live design
requires a deterministic, host-neutral control plane where the event log is source of truth, gates are
pure over recorded evidence, provider specifics sit behind four SDK-owned ports, and workers never
hold runner/Forge credentials (`docs/design/10-architecture/architecture.md`,
`docs/design/10-architecture/provider-seams.md`,
`docs/design/30-domain-reference/core/capability-and-safety/README.md`,
`docs/design/30-domain-reference/foundation/credentials-and-secrets/README.md`).

The post-closure design also intentionally moves SDK provider ports and testkit mocks ahead of real
provider drivers. Real runtime attestations are production-readiness work, not a core build/test
prerequisite (`design-closure/outputs/apply/APPLY-REPORT.md`,
`docs/implementation/domain-dag.md`, `docs/implementation/readiness-matrix.md`). LangChain adoption
should not disturb that order.

## Where it maps to kit-vnext

- `prov-01` Agent Execution: possible future `AgentProvider` adapter for a LangChain/LangGraph-based
  worker, only if it emits the existing normalized events, approval requests, terminal state, tool
  observations, and fresh `CapabilityAttestation` payloads
  (`docs/design/20-sdk-and-packaging/provider-ports.md`,
  `docs/design/30-domain-reference/providers/agent-execution/README.md`).
- `prov-04` Execution Host: LangChain must not own process containment, runner verify, command
  capture, termination, or egress proof. Those remain `ExecutionHostProvider` responsibilities
  (`docs/design/30-domain-reference/providers/execution-host/README.md`).
- `core-03` Approval & Escalation: LangChain human-in-the-loop ideas map only as reference patterns;
  kit decisions remain recorded, deterministic, policy-bound, and human/assisted in v1
  (`docs/design/30-domain-reference/core/approval-and-escalation/README.md`,
  [LangChain human-in-the-loop](https://docs.langchain.com/oss/python/langchain/human-in-the-loop)).
- `core-07` Observability & Analysis: LangSmith's tracing/evaluation model is a useful comparison
  point, but kit analysis stays a pure function over run log evidence and redacted artifacts
  (`docs/design/30-domain-reference/core/observability-and-analysis/README.md`,
  [LangSmith Observability](https://docs.langchain.com/langsmith/observability),
  [LangSmith Evaluation](https://docs.langchain.com/langsmith/evaluation)).
- `fnd-02` Storage & Artifacts / `core-01` Run Lifecycle: LangGraph checkpointing resembles durable
  run-state concerns, but kit's authoritative state is still the append-only event log plus pure
  projections, not a graph runtime checkpoint store
  (`docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md`,
  `docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md`).

## Concrete use cases

- Build a later experimental `provider-langchain-agent` spike that implements only the SDK
  `AgentProvider` contract and runs under the existing Execution Host.
- Use LangChain/LangGraph docs as comparison material for approval pause/resume, explicit runtime
  context, streaming, and checkpoint terminology while implementing kit's own provider conformance
  tests.
- Study LangSmith-style traces, datasets, online/offline evals, and feedback loops when shaping
  `core-07` report/export ergonomics, without depending on LangSmith in the core.
- Use LangChain provider integration breadth as market evidence for future real-driver priorities,
  not as a replacement for kit's SDK-owned provider ports.

## Required design changes, if any

None now. The applied design already has the right extension point: SDK-owned provider ports with
mock/conformance surfaces and production driver stories later
(`docs/design/20-sdk-and-packaging/provider-ports.md`,
`docs/implementation/domain-dag.md`). A future LangChain adapter should be a provider story, not an
architecture change.

## Required implementation stories, if any

None before the core-first backlog. Later, after the SDK/testkit seams exist:

- Research story: prove whether a LangChain/LangGraph worker can produce kit's required
  `AgentEvent` stream, stable session linkage, approval answer channel, structured tool exits, and
  terminal classification.
- Conformance story: add adversarial fixtures for dropped approval, missing exit code, lost linkage,
  ambiguous terminal state, and stale/negative attestations.
- Production-readiness story: if the adapter remains useful, add live probes for
  `canRelayApproval`, `canPersistApprovalAnswerChannel`, `canResumeOwned`,
  `emitsStructuredToolExit`, and host parentage, scoped to a pinned version and platform.

## Risks and constraints

- Orchestrator drift: LangChain's agent loop, middleware, routing, retries, or memory must not become
  hidden control-plane logic.
- State authority conflict: LangGraph checkpoints cannot replace kit's event log, durability classes,
  artifact refs, or pure projections.
- Capability ambiguity: provider claims, schema support, or LangChain middleware behavior are not
  sufficient; kit requires fresh positive probes and recorded attestations.
- Credential boundary risk: any LangChain tool or agent process must run as a worker without Forge
  credentials and under Execution Host egress/containment controls.
- API churn: the project report notes active v1/v1.3 release movement and namespace/package changes,
  so pinning and conformance evidence would be mandatory before any production driver.
- Platform coupling: LangSmith may be useful operationally, but a commercial observability service
  cannot become required for core analysis or gate decisions.

## Decision timing

after core-first stories

Revisit after `packages/sdk`, `packages/testkit`, core event/gate implementation, and provider
contract mocks exist. Do not schedule real LangChain driver work before the seam contracts can reject
non-conforming behavior.

## Recommended next action

Record LangChain as a watched provider-adapter candidate for `prov-01`, with no design change now.
When the Agent seam implementation stories are ready, add one bounded research ticket: validate a
LangChain/LangGraph worker against the existing `AgentProvider` contract and fail it unless it can
produce kit-native events, attestations, and evidence without owning orchestration.

## Sources

- `design-closure/outputs/langchain-review/project-reports/langchain.md`
- `design-closure/outputs/apply/APPLY-REPORT.md`
- `docs/design/10-architecture/architecture.md`
- `docs/design/10-architecture/provider-seams.md`
- `docs/design/10-architecture/capability-attestation.md`
- `docs/design/20-sdk-and-packaging/provider-ports.md`
- `docs/design/20-sdk-and-packaging/storage-port-types.md`
- `docs/implementation/domain-dag.md`
- `docs/implementation/readiness-matrix.md`
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md`
- `docs/design/30-domain-reference/core/capability-and-safety/README.md`
- `docs/design/30-domain-reference/core/approval-and-escalation/README.md`
- `docs/design/30-domain-reference/core/completion-and-merge/README.md`
- `docs/design/30-domain-reference/core/observability-and-analysis/README.md`
- `docs/design/30-domain-reference/providers/agent-execution/README.md`
- `docs/design/30-domain-reference/providers/execution-host/README.md`
- `docs/design/30-domain-reference/providers/forge-collaboration/README.md`
- `docs/design/30-domain-reference/providers/work-source/README.md`
- [LangChain overview](https://docs.langchain.com/oss/python/langchain/overview)
- [LangChain agents](https://docs.langchain.com/oss/python/langchain/agents)
- [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [LangChain human-in-the-loop](https://docs.langchain.com/oss/python/langchain/human-in-the-loop)
- [LangSmith Observability](https://docs.langchain.com/langsmith/observability)
- [LangSmith Evaluation](https://docs.langchain.com/langsmith/evaluation)

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../README.md) · **← Prev:** [Deep Agents.js adoption review for kit-vnext](./deep-agents-js-adoption.md) · **Next →:** [LangChain.js adoption review for kit-vnext](./langchain-js-adoption.md)

<!-- /DOCS-NAV -->
