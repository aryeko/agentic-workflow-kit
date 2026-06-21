# LangSmith adoption review for kit-vnext
## Should we use it?
maybe

Use LangSmith as later observability and evaluation prior art, not as a core dependency or replacement
control plane.

## Why / why not
LangSmith's strongest fit is trace inspection, monitoring, feedback, annotation, offline/online
evaluation, datasets, and JSON/API/CLI access for LLM application analysis. The project report shows
LangSmith records trace/run/thread/feedback data, supports OpenTelemetry ingestion, and offers
evaluation and annotation workflows useful for debugging and regression loops
([project report](../project-reports/langsmith.md#observability--evaluation--debugging-support)).

That does not make it a fit for kit-vnext's authoritative runtime model. kit-vnext's core state is
an append-only event log with pure projections, not a trace tree or SaaS-owned telemetry store
([core-01](../../../../docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md#4-design)).
Capability gates must evaluate recorded evidence and fresh positive provider attestations, never
driver self-report or external observability alone
([capability attestation](../../../../docs/design/10-architecture/capability-attestation.md#evaluation-rules)).
The applied closure also makes SDK provider ports and testkit mocks the core-first path while real
driver live attestations remain production-readiness work
([apply report](../../apply/APPLY-REPORT.md#domain-catalog-and-implementation-contract)).

Adopting LangSmith Deployment or Agent Server as kit's runtime would conflict with current invariants:
worker/runner isolation, Forge credential separation, Work Source as task-status authority, and the
event log as run-activity authority are design-owned constraints
([architecture](../../../../docs/design/10-architecture/architecture.md#5-cross-cutting-invariants)).

## Where it maps to kit-vnext
- `core-07` Observability & Analysis: closest conceptual map. LangSmith's trace/run/thread,
  feedback, annotation, dashboards, and evals can inform future report/export UX, issue triage, and
  regression dataset workflows. Core-07 remains pure over committed run events and redacted artifacts,
  and OTel export is explicitly deferred
  ([core-07](../../../../docs/design/30-domain-reference/core/observability-and-analysis/README.md#10-open-questions)).
- `fnd-02` Storage & Artifacts: LangSmith's exported traces and datasets map only as external analysis
  artifacts. kit evidence must stay write-once, digested, redacted, exportable, and barred from using
  scratch refs for gates
  ([fnd-02](../../../../docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md#4-design)).
- `core-05` Completion, Verification & Merge: LangSmith evaluation results could become cited
  evidence only if captured by runner-owned commands or approved evidence events. They cannot replace
  local git, verify, CI, PR/review, exact-head, or capability-gate evidence
  ([core-05](../../../../docs/design/30-domain-reference/core/completion-and-merge/README.md#4-design)).
- Provider seams `prov-01` through `prov-04`: LangSmith may be an optional telemetry sink behind a
  later exporter, not a new provider seam. The SDK-owned provider ports remain `AgentProvider`,
  `ExecutionHostProvider`, `ForgeProvider`, and `WorkSourceProvider`
  ([provider ports](../../../../docs/design/20-sdk-and-packaging/provider-ports.md#sdk-provider-ports-and-capability-attestation)).
- `edge-01`: future operator surfaces may borrow LangSmith-style filtering, threads, feedback, and
  annotation review patterns, after core reports exist.

## Concrete use cases
- Export redacted core-07 analysis artifacts and selected run-event-derived spans to OpenTelemetry,
  with LangSmith as one possible sink after the core analyzer exists.
- Promote terminal failures, blocked runs, approval failures, and verifier failures into evaluation
  datasets for regression checks, mirroring LangSmith's dataset/experiment model.
- Use LangSmith-style annotation queues as inspiration for human review of ambiguous agent behavior,
  but keep approvals and merge gates inside kit's recorded event model.
- Compare LangSmith CLI/API JSON patterns when designing kit operator diagnostics, provided schemas are
  treated as external inspiration because the project report notes the LangSmith CLI is alpha
  ([project report](../project-reports/langsmith.md#maturity-and-ecosystem-notes)).

## Required design changes, if any
None now.

Do not add LangSmith to the provider-port catalog, capability-attestation model, event-log authority,
or completion gates. The only plausible future design addition is an explicitly non-authoritative
observability export from `core-07`, likely via OTel, after the deferred export question is reopened.

## Required implementation stories, if any
None for core-first implementation.

Later optional stories:
- Add a `core-07` export spike that maps committed `RunEventEnvelope` data and redacted artifact refs
  to OTel spans without changing replay semantics.
- Add a testkit fixture that turns recorded terminal-analysis issues into local regression examples.
- Add an operator-report prototype that can link to external trace sinks while preserving local
  evidence refs as the source of truth.

## Risks and constraints
- External service dependency, API keys, workspace/region configuration, retention limits, rate limits,
  and plan-specific export features can weaken offline determinism if made load-bearing
  ([project report](../project-reports/langsmith.md#operational-model)).
- LangSmith traces are evidence views, not kit's event-sourced state. Treating them as authoritative
  would violate core-01 and core-02.
- Prompt/tool registry or deployment concepts from LangSmith should not bypass kit's provider seams,
  credential boundaries, or worker/runner isolation.
- Real provider production readiness still requires fresh live attestations. Recorded/mock evidence can
  prove core and conformance behavior but not live production capability
  ([readiness matrix](../../../../docs/implementation/readiness-matrix.md#update-rule)).

## Decision timing
after core-first stories

## Recommended next action
Record LangSmith as watch-listed prior art for `core-07` export/evaluation UX. Do not create a
LangSmith integration story until the SDK event log, storage/artifact ports, provider mocks, core-02
gates, and core-07 analyzer have executable story evidence.

## Sources
- [LangSmith project report](../project-reports/langsmith.md)
- [Design closure apply report](../../apply/APPLY-REPORT.md)
- [Architecture](../../../../docs/design/10-architecture/architecture.md)
- [Provider seams](../../../../docs/design/10-architecture/provider-seams.md)
- [Capability attestation](../../../../docs/design/10-architecture/capability-attestation.md)
- [SDK provider ports](../../../../docs/design/20-sdk-and-packaging/provider-ports.md)
- [Storage port types](../../../../docs/design/20-sdk-and-packaging/storage-port-types.md)
- [Domain DAG](../../../../docs/implementation/domain-dag.md)
- [Readiness matrix](../../../../docs/implementation/readiness-matrix.md)
- [core-01 Run Lifecycle & Event State](../../../../docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md)
- [core-02 Capability & Safety](../../../../docs/design/30-domain-reference/core/capability-and-safety/README.md)
- [core-05 Completion, Verification & Merge](../../../../docs/design/30-domain-reference/core/completion-and-merge/README.md)
- [core-07 Observability & Analysis](../../../../docs/design/30-domain-reference/core/observability-and-analysis/README.md)
- [fnd-02 Storage & Artifacts](../../../../docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md)
- [prov-01 Agent Execution](../../../../docs/design/30-domain-reference/providers/agent-execution/README.md)
- [prov-02 Forge / Collaboration](../../../../docs/design/30-domain-reference/providers/forge-collaboration/README.md)
- [prov-03 Work Source](../../../../docs/design/30-domain-reference/providers/work-source/README.md)
- [prov-04 Execution Host](../../../../docs/design/30-domain-reference/providers/execution-host/README.md)

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../README.md) · **← Prev:** [LangGraph.js adoption review for kit-vnext](./langgraph-js-adoption.md) · **Next →:** [MCP Adapters adoption review for kit-vnext](./mcp-adapters-adoption.md)

<!-- /DOCS-NAV -->
