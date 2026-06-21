# LangGraph adoption review for kit-vnext
## Should we use it?
maybe

Do not adopt LangGraph as kit-vnext's control-plane runtime or persistence substrate. Use it as a later reference for durable execution vocabulary, typed streaming, interrupt/resume ergonomics, and replay/fork documentation.

## Why / why not
LangGraph is relevant because it is a low-level framework for long-running, stateful LLM workflows with durable execution, persistence, interrupts, streaming, time travel, and human-in-the-loop controls ([project report](../project-reports/langgraph.md#core-capabilities)). Its graph model, checkpointing, typed event-stream projections, and `thread_id` resume cursor are adjacent to kit-vnext's own run lifecycle, approval parking, liveness, and recovery concerns ([project report](../project-reports/langgraph.md#how-it-works-architecturally), [project report](../project-reports/langgraph.md#operational-model)).

It should not become a kit-vnext dependency because kit-vnext's post-closure architecture is already fixed around a deterministic, host-neutral core; SDK-owned provider ports; an append-only event log as the authored run state; worker/runner isolation; and fail-closed capability attestations ([architecture](../../../../docs/design/10-architecture/architecture.md#1-layers), [architecture](../../../../docs/design/10-architecture/architecture.md#5-cross-cutting-invariants), [provider ports](../../../../docs/design/20-sdk-and-packaging/provider-ports.md#sdk-provider-ports-and-capability-attestation)). LangGraph's checkpoint state is useful for comparison, but adopting it wholesale would blur snapshots with kit-vnext's event log authority ([core-01](../../../../docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md#mandate), [project report](../project-reports/langgraph.md#what-looks-irrelevant-or-risky-for-kit-vnext)).

LangGraph's LangSmith/Agent Server production path is also the wrong default for v1 because kit-vnext is deliberately provider-neutral and local/core-first. The applied closure explicitly moved real provider live attestations to production-readiness work and made SDK/core readiness mock- and fixture-driven ([apply report](../../apply/APPLY-REPORT.md#domain-catalog-and-implementation-contract), readiness matrix).

## Where it maps to kit-vnext
- `core-01` Run Lifecycle & Event State: LangGraph checkpointers, thread-scoped state, and event streaming map only as reference concepts. kit-vnext already owns `RunEventLog`, `RunWriter`, pure projections, sequence cursors, and durable/barrier event semantics ([core-01](../../../../docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md#4-design)).
- `core-03` Approval & Escalation: LangGraph interrupts map to durable approval parking/resume UX, but kit-vnext must keep deterministic policy-to-human adjudication and treat any future LLM judgment only as recorded input ([core-03](../../../../docs/design/30-domain-reference/core/approval-and-escalation/README.md#mandate), [project report](../project-reports/langgraph.md#core-capabilities)).
- `core-04` Supervision & Liveness: LangGraph streaming is a reference for operator-visible streams, but liveness in kit-vnext must derive only from current-session worker events, not stream plumbing, polls, or projection reads ([core-04](../../../../docs/design/30-domain-reference/core/supervision-and-liveness/README.md#4-design)).
- `core-06` Recovery & Reconciliation: LangGraph time travel and replay/fork semantics are worth studying for documentation of side effects, but kit-vnext recovery remains a pure classifier over recorded evidence plus explicit provider controls after gates ([core-06](../../../../docs/design/30-domain-reference/core/recovery-and-reconciliation/README.md#4-design), [project report](../project-reports/langgraph.md#persistence--state--checkpointing-model)).
- `core-07` Observability & Analysis: LangGraph typed event streams map to report and telemetry ergonomics, not authority. kit-vnext analysis remains a pure function over committed run events, projections, and selected redacted artifacts ([core-07](../../../../docs/design/30-domain-reference/core/observability-and-analysis/README.md#4-design)).
- `prov-01` AgentProvider: LangGraph could be a possible future agent-driver implementation detail only if it sits behind `AgentProvider` and emits the same normalized events and attestations. It must not leak LangGraph state machines into core ([agent provider](../../../../docs/design/30-domain-reference/providers/agent-execution/README.md#5-contracts--interfaces)).
- `fnd-02` Storage & Artifacts: LangGraph persistence is not a substitute for kit-vnext's `EventLogStore`, `LeaseStore`, and `ArtifactStore` contracts ([storage port types](../../../../docs/design/20-sdk-and-packaging/storage-port-types.md#storage-port-types)).

## Concrete use cases
- Reference LangGraph's interrupt/resume docs when designing operator-facing approval parking and resume flows, while preserving kit-vnext's `ApprovalPendingPersisted`, `ApprovalParked`, `ApprovalResumed`, and `ApprovalOutcomeRecorded` event authority.
- Compare LangGraph stream modes against kit-vnext event cursor and analysis surfaces when implementing `waitRunEvents`, terminal analysis reports, and operator-visible run timelines.
- Use LangGraph's time-travel warnings as a checklist for kit-vnext recovery docs: replay must not re-run Forge writes, runner commands, worker side effects, or approval delivery without explicit fenced controls.
- Consider a future experimental `provider-langgraph-agent` only after `AgentProvider`, `ExecutionHostProvider`, fnd-02 storage, and testkit conformance exist. It would be a provider-driver experiment, not a core rewrite.

## Required design changes, if any
None now.

Do not change kit-vnext architecture to graphs, checkpointers, LangSmith deployment, or LangChain model/tool abstractions. If LangGraph is revisited later, the only design work should be a provider-driver research note explaining whether it can implement `AgentProvider` without violating the four seams, event-log authority, capability attestation, or worker/runner isolation.

## Required implementation stories, if any
None for Frontier 0 through Frontier 5.

After core-first stories, optional research stories could be:

- Add a short `core-03`/`core-06` design note comparing interrupt/resume and replay/fork side-effect rules against LangGraph.
- Add typed event-stream fixture cases to `core-07` or `testkit` inspired by LangGraph's streaming projections.
- Spike a non-production `provider-langgraph-agent` feasibility story only after the SDK `AgentProvider` conformance suite exists.

## Risks and constraints
- Checkpoint authority risk: LangGraph snapshots/checkpoints could conflict with kit-vnext's append-only event log as the sole authored run state.
- Side-effect replay risk: LangGraph time travel may re-execute downstream LLM calls, API requests, and interrupts; kit-vnext software delivery actions require exact-head checks, leases, and provider evidence before any replay-like recovery.
- Dependency and neutrality risk: LangSmith/Agent Server would add platform coupling to a design that currently isolates host/tool specifics behind provider seams.
- Worker/runner risk: LangGraph nodes can contain arbitrary provider calls and side effects. kit-vnext must keep worker edits/local commits separate from runner-owned verify, push, PR, and merge.
- Readiness risk: current implementation readiness is still story-contract/package/conformance pending across all domains, so adopting another runtime now would distract from the approved core-first sequence (readiness matrix).

## Decision timing
after core-first stories

## Recommended next action
Record LangGraph as "reference only" in the unified adoption summary. Revisit after SDK provider ports, fnd-02 storage, core-01 event log, core-03 approval parking, core-04 liveness, core-06 recovery, core-07 analysis, and testkit mocks have executable stories and conformance evidence.

## Sources
- Local project report: [LangGraph](../project-reports/langgraph.md)
- Applied closure evidence: [APPLY-REPORT.md](../../apply/APPLY-REPORT.md)
- kit-vnext architecture: [architecture.md](../../../../docs/design/10-architecture/architecture.md)
- Provider seams: [provider-seams.md](../../../../docs/design/10-architecture/provider-seams.md)
- Capability attestation: [capability-attestation.md](../../../../docs/design/10-architecture/capability-attestation.md)
- SDK provider ports: [provider-ports.md](../../../../docs/design/20-sdk-and-packaging/provider-ports.md)
- Storage port types: [storage-port-types.md](../../../../docs/design/20-sdk-and-packaging/storage-port-types.md)
- Implementation DAG: domain-dag.md
- Readiness matrix: readiness-matrix.md
- Relevant domain designs: [core-01](../../../../docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md), [core-03](../../../../docs/design/30-domain-reference/core/approval-and-escalation/README.md), [core-04](../../../../docs/design/30-domain-reference/core/supervision-and-liveness/README.md), [core-05](../../../../docs/design/30-domain-reference/core/completion-and-merge/README.md), [core-06](../../../../docs/design/30-domain-reference/core/recovery-and-reconciliation/README.md), [core-07](../../../../docs/design/30-domain-reference/core/observability-and-analysis/README.md), [prov-01](../../../../docs/design/30-domain-reference/providers/agent-execution/README.md), [prov-04](../../../../docs/design/30-domain-reference/providers/execution-host/README.md)
- External sources summarized by the project report: [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview), [Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api), [Functional API](https://docs.langchain.com/oss/python/langgraph/functional-api), [Persistence](https://docs.langchain.com/oss/python/langgraph/persistence), [Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts), [Event streaming](https://docs.langchain.com/oss/python/langgraph/event-streaming), [Streaming](https://docs.langchain.com/oss/python/langgraph/streaming), [Time travel](https://docs.langchain.com/oss/python/langgraph/use-time-travel), [LangGraph releases](https://github.com/langchain-ai/langgraph/releases)

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../README.md) · **← Prev:** [LangChain.js adoption review for kit-vnext](./langchain-js-adoption.md) · **Next →:** [LangGraph.js adoption review for kit-vnext](./langgraph-js-adoption.md)

<!-- /DOCS-NAV -->
