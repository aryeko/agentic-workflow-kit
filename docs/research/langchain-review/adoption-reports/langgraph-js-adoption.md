# LangGraph.js adoption review for kit-vnext

## Should we use it?

maybe

Do not adopt LangGraph.js as kit-vnext's control-plane runtime now. Use it as prior art for durable
agent-flow concepts and, later, evaluate whether a tightly wrapped provider-side experiment is useful.

## Why / why not

LangGraph.js maps well to long-running agent workflow concerns: explicit graph state, durable
checkpointing, human interrupts/resume, streaming, retries, and replay discipline. The input report
also notes important operational caveats: checkpoint resume replays from checkpoint boundaries, side
effects must be idempotent, and recent releases touched concurrency and checkpoint replay determinism
([project report](../project-reports/langgraph-js.md), [LangGraph overview](https://docs.langchain.com/oss/javascript/langgraph/overview),
[Functional API](https://docs.langchain.com/oss/javascript/langgraph/functional-api)).

Those are useful comparison points, but they conflict with adopting LangGraph.js as the core substrate.
After design closure, kit-vnext is explicitly a deterministic control plane whose source of truth is
its own append-only run event log and pure projections, not runtime checkpoints
([core-01](../../../../docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md),
[fnd-02](../../../../docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md)).
The closure also made SDK-owned provider ports and testkit mocks the build substrate, with real
drivers and live attestations later production-readiness work
([apply report](../../apply/APPLY-REPORT.md),
[provider ports](../../../../docs/design/20-sdk-and-packaging/provider-ports.md),
[domain DAG](../../../../docs/implementation/domain-dag.md)).

LangGraph.js should therefore influence tests, operator guidance, and maybe future provider-driver
experiments, not the architecture.

## Where it maps to kit-vnext

- `core-01` / `fnd-02`: LangGraph checkpoints and state history are relevant prior art for replay and
  recovery UX, but they cannot replace kit-vnext's leased append-only event log, durability classes,
  artifact refs, and pure projections
  ([checkpointers](https://docs.langchain.com/oss/javascript/langgraph/checkpointers),
  [core-01](../../../../docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md),
  [storage port types](../../../../docs/design/20-sdk-and-packaging/storage-port-types.md)).
- `core-03`: `interrupt()` / `Command({ resume })` maps conceptually to parked approvals and resume,
  but kit-vnext keeps approval adjudication, scoped grants, and durable pending state in core events
  ([interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts),
  [core-03](../../../../docs/design/30-domain-reference/core/approval-and-escalation/README.md)).
- `core-04`: LangGraph streaming modes are useful comparison material for liveness/event taxonomy, but
  kit-vnext liveness advances only from current-session worker events, never from parent polling or
  projection reads ([streaming](https://docs.langchain.com/oss/javascript/langgraph/streaming),
  [core-04](../../../../docs/design/30-domain-reference/core/supervision-and-liveness/README.md)).
- `core-06`: LangGraph replay/idempotency warnings are good test-case inspiration for resume-vs-restart
  and side-effect safety; kit-vnext recovery remains pure classification over recorded evidence and
  fnd-02 leases ([core-06](../../../../docs/design/30-domain-reference/core/recovery-and-reconciliation/README.md)).
- `core-07`: LangGraph debug streams and LangSmith tracing are comparison points only. kit-vnext
  analysis is replay-only over committed run events and redacted artifacts
  ([core-07](../../../../docs/design/30-domain-reference/core/observability-and-analysis/README.md)).
- `prov-01`: LangGraph could be studied as an AgentProvider-adjacent adapter only if it emits the
  SDK-owned `AgentProvider` event shapes, capability attestations, approval channels, terminal events,
  and tool observations without weakening Codex/mock conformance
  ([prov-01](../../../../docs/design/30-domain-reference/providers/agent-execution/README.md)).

It does not map cleanly to `prov-02`, `prov-03`, or `prov-04`: Forge exact-head evidence, Work Source
status authority, and Execution Host containment/runner-command capture are kit-vnext seams, not
LangGraph responsibilities
([provider seams](../../../../docs/design/10-architecture/provider-seams.md),
[prov-02](../../../../docs/design/30-domain-reference/providers/forge-collaboration/README.md),
[prov-03](../../../../docs/design/30-domain-reference/providers/work-source/README.md),
[prov-04](../../../../docs/design/30-domain-reference/providers/execution-host/README.md)).

## Concrete use cases

- Add replay/idempotency adversarial scenarios to testkit mocks: interrupted approval, duplicate
  resume, retried side effect, stale checkpoint-like state, and concurrent event ordering.
- Use LangGraph's human-interrupt model as a checklist while implementing core-03 park/resume tests.
- Compare streaming event classes against core-04/core-07 event taxonomies to ensure kit-vnext has
  enough progress, tool, terminal, and debug evidence without importing LangGraph.
- After core-first stories, run a small spike that wraps a LangGraph-managed worker loop behind
  `AgentProvider` mock-like conformance, proving whether it can emit exact kit-vnext events and
  attestations.

## Required design changes, if any

None.

The applied closure already has the right boundary: SDK-owned ports, testkit mocks, core-first
readiness, live/provider attestations later, and real drivers as production-readiness work
([apply report](../../apply/APPLY-REPORT.md), [readiness matrix](../../../../docs/implementation/readiness-matrix.md)).
LangGraph.js does not justify changing the event-log authority, provider seams, worker/runner split,
or capability attestation model.

## Required implementation stories, if any

No required implementation story now.

Optional later stories:

- `testkit`: add LangGraph-inspired replay/idempotency mock fixtures for approval, retry, terminal,
  and duplicate-resume cases.
- `core-03` / `core-06`: add conformance tests that encode checkpoint-replay hazards as kit-vnext
  event-log recovery cases.
- `prov-01` research: after the SDK AgentProvider and mock conformance suite exist, spike a
  LangGraph-backed adapter only as an implementation behind the existing Agent seam.

## Risks and constraints

- Runtime checkpoints are not audit evidence. Treating LangGraph checkpoint state as authoritative
  would violate core-01 and the two-authority model.
- LangGraph's model/tool loop is not a Forge, Work Source, Execution Host, or credential isolation
  model. Using it broadly would blur the four seams.
- LangSmith observability is platform-coupled. It may be useful externally, but required kit-vnext
  gates must stay on local recorded evidence unless a future provider seam explicitly owns it.
- Replay semantics can rerun unfinished work. Any experiment must prove idempotency, side-effect
  containment, and exact event emission under failure.
- Recent LangGraph.js release notes in the project report mention fixes around concurrent invocation
  isolation and checkpoint replay determinism, so version-pinned conformance would be mandatory before
  any production use ([project report](../project-reports/langgraph-js.md),
  [releases](https://github.com/langchain-ai/langgraphjs/releases)).

## Decision timing

after core-first stories

Do not decide on dependency adoption until `packages/sdk`, `packages/testkit`, core event/replay
contracts, and provider mock conformance exist. A later provider-driver spike can be evaluated against
those contracts without changing the architecture.

## Recommended next action

Record LangGraph.js as "maybe later, provider-side only." Add its useful concepts to the test backlog:
approval interrupt/resume, replay idempotency, retry timeout behavior, streaming event coverage, and
checkpoint-like stale state. Do not add LangGraph.js to kit-vnext dependencies or design docs now.

## Sources

- Local input: [LangGraph.js project report](../project-reports/langgraph-js.md)
- Local closure evidence: [APPLY-REPORT.md](../../apply/APPLY-REPORT.md)
- Local kit-vnext design: [architecture.md](../../../../docs/design/10-architecture/architecture.md),
  [provider-seams.md](../../../../docs/design/10-architecture/provider-seams.md),
  [capability-attestation.md](../../../../docs/design/10-architecture/capability-attestation.md),
  [provider-ports.md](../../../../docs/design/20-sdk-and-packaging/provider-ports.md),
  [storage-port-types.md](../../../../docs/design/20-sdk-and-packaging/storage-port-types.md),
  [domain-dag.md](../../../../docs/implementation/domain-dag.md),
  [readiness-matrix.md](../../../../docs/implementation/readiness-matrix.md)
- Domain docs: [core-01](../../../../docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md),
  [core-02](../../../../docs/design/30-domain-reference/core/capability-and-safety/README.md),
  [core-03](../../../../docs/design/30-domain-reference/core/approval-and-escalation/README.md),
  [core-04](../../../../docs/design/30-domain-reference/core/supervision-and-liveness/README.md),
  [core-05](../../../../docs/design/30-domain-reference/core/completion-and-merge/README.md),
  [core-06](../../../../docs/design/30-domain-reference/core/recovery-and-reconciliation/README.md),
  [core-07](../../../../docs/design/30-domain-reference/core/observability-and-analysis/README.md),
  [fnd-02](../../../../docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md),
  [prov-01](../../../../docs/design/30-domain-reference/providers/agent-execution/README.md),
  [prov-02](../../../../docs/design/30-domain-reference/providers/forge-collaboration/README.md),
  [prov-03](../../../../docs/design/30-domain-reference/providers/work-source/README.md),
  [prov-04](../../../../docs/design/30-domain-reference/providers/execution-host/README.md)
- External sources from the project report: [LangGraph overview](https://docs.langchain.com/oss/javascript/langgraph/overview),
  [Graph API](https://docs.langchain.com/oss/javascript/langgraph/graph-api),
  [Functional API](https://docs.langchain.com/oss/javascript/langgraph/functional-api),
  [persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence),
  [checkpointers](https://docs.langchain.com/oss/javascript/langgraph/checkpointers),
  [interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts),
  [streaming](https://docs.langchain.com/oss/javascript/langgraph/streaming),
  [fault tolerance](https://docs.langchain.com/oss/javascript/langgraph/fault-tolerance),
  [LangGraph.js repository](https://github.com/langchain-ai/langgraphjs),
  [LangGraph.js releases](https://github.com/langchain-ai/langgraphjs/releases)

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../README.md) · **← Prev:** [LangGraph adoption review for kit-vnext](./langgraph-adoption.md) · **Next →:** [LangSmith adoption review for kit-vnext](./langsmith-adoption.md)

<!-- /DOCS-NAV -->
