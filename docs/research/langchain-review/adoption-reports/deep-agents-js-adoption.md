# Deep Agents.js adoption review for kit-vnext
## Should we use it?
maybe

Use Deep Agents.js as a later provider-driver research input, not as kit-vnext core architecture.
It is useful evidence for how a modern JS agent harness handles subagents, virtual filesystems,
permissions, streaming, HITL interrupts, and persistence. It should not replace kit-vnext's
deterministic control plane.

## Why / why not
Deep Agents.js is explicitly a batteries-included LangChain/LangGraph agent harness: it plans with
`write_todos`, uses filesystem tools, delegates through `task`, applies middleware, supports
permissions/HITL interrupts, and inherits LangGraph state/checkpointing and streaming behavior
([project report](../project-reports/deep-agents-js.md)).

That overlaps with worker-harness concerns, but conflicts with core kit-vnext invariants if adopted
inside the control plane. kit-vnext requires a deterministic core, append-only event log as source of
truth, evidence-based gates, worker/runner isolation, and provider seams for Agent, Execution Host,
Forge, and Work Source (`docs/design/10-architecture/architecture.md`,
`docs/design/10-architecture/provider-seams.md`). Deep Agents.js intentionally coordinates work with
an LLM-driven agent and tells users to enforce safety at the tool/sandbox layer, so it can only fit
behind an AgentProvider or ExecutionHostProvider boundary.

After design closure, the corpus also makes provider ports SDK-owned, with mocks/testkit first and
real drivers treated as production-readiness work (`docs/design/20-sdk-and-packaging/provider-ports.md`,
`docs/implementation/domain-dag.md`, `docs/implementation/readiness-matrix.md`). That timing argues
against adopting Deep Agents.js now.

## Where it maps to kit-vnext
- `prov-01` / `seam-agent-contract-mock`: possible research baseline for an AgentProvider-like
  worker harness, especially normalized progress, terminal, approval/HITL, delegated subagent, and
  tool-observation streams (`docs/design/30-domain-reference/providers/agent-execution/README.md`).
- `prov-04`: sandbox/local-shell/backend concepts are relevant only as contrast for host execution,
  containment, command capture, and egress risk. kit-vnext must keep process spawning, runner-owned
  verify, kill, and command evidence in ExecutionHostProvider, not the agent harness
  (`docs/design/30-domain-reference/providers/execution-host/README.md`).
- `core-04`: Deep Agents.js event streaming can inform UI/debug projection shapes, but liveness in
  kit-vnext must advance only from committed current-session worker events, not from LangGraph
  checkpoint state or parent polling (`docs/design/30-domain-reference/core/supervision-and-liveness/README.md`).
- `core-03`: HITL interrupts and permission prompts map conceptually to Approval & Escalation, but
  kit-vnext still records pending/decision/outcome events and maps only deterministic scoped grants
  to the Agent seam (`docs/design/30-domain-reference/core/approval-and-escalation/README.md`).
- `core-02`: Deep Agents.js capability claims are not enough. Any use must emit fresh positive
  `CapabilityAttestation` evidence and fail closed when absent, stale, negative, or wrong-scope
  (`docs/design/10-architecture/capability-attestation.md`,
  `docs/design/30-domain-reference/core/capability-and-safety/README.md`).
- `fnd-02` / `core-01`: LangGraph checkpoints, stores, and virtual filesystems do not replace the
  kit-vnext Run log, fnd-02 EventLogStore, ArtifactStore, or pure projections
  (`docs/design/20-sdk-and-packaging/storage-port-types.md`,
  `docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md`).
- `core-07`: typed streaming projections may inspire analysis/report inputs, but analysis remains a
  pure replay over committed event evidence and redacted artifact refs
  (`docs/design/30-domain-reference/core/observability-and-analysis/README.md`).

## Concrete use cases
- Later `prov-01` spike: wrap a Deep Agents.js worker behind `AgentProvider` and prove whether it can
  emit stable `linked`, `progress`, `approval-requested`, `tool-observed`, `degraded`, and `terminal`
  events without leaking LangGraph-specific semantics into core.
- Testkit inspiration: model adversarial worker behaviors from Deep Agents.js streams, such as lost
  tool exits, ambiguous subagent terminal states, delayed HITL answers, and virtual filesystem writes.
- UI/debug reference: compare Deep Agents.js v3 event stream projections with kit-vnext operator
  surfaces after core event schemas exist.
- Provider-readiness research: evaluate whether Deep Agents.js permissions, LocalShellBackend, and
  sandbox integrations can satisfy kit-vnext's explicit attestation and containment evidence
  requirements.

## Required design changes, if any
None now.

Do not add Deep Agents.js to the architecture, domain DAG, SDK provider-port catalog, or core design.
The applied closure already resolved the important shape: SDK-owned provider ports, testkit mocks,
core-first readiness, and real-provider live attestations later
(`design-closure/outputs/apply/APPLY-REPORT.md`).

If a later spike proves value, the design change should be narrow: document Deep Agents.js as one
candidate concrete Agent driver or Execution Host adjunct, never as a core orchestration dependency.

## Required implementation stories, if any
None for current core-first implementation.

Later, after seam contracts and mocks exist:

- Research story: `provider-deepagents-agent-spike`, behind `AgentProvider`, with no core imports and
  no Forge credentials.
- Conformance story: map Deep Agents.js stream events to the frozen AgentProvider event union and
  prove degraded handling for missing linkage, missing exit codes, ambiguous terminal states, and
  lost approval channels.
- Attestation story: define live probes for approval relay, resume, structured tool exit, parentage,
  sandbox/permission behavior, and egress confinement before any live power is enabled.
- Security story: evaluate filesystem/backend/local-shell modes against fnd-04 credential injection,
  redaction, and prov-04 containment requirements.

## Risks and constraints
- Core conflict: an LLM-driven coordinator in core would violate the deterministic control-plane
  invariant and AD-14's deferred LLM adjudication posture.
- Boundary risk: Deep Agents.js combines planning, tools, filesystem state, permissions, and
  subagents; kit-vnext must split these through AgentProvider, ExecutionHostProvider, fnd-02, and
  core approval/gate events.
- Evidence risk: LangGraph checkpoints, LangSmith traces, and agent self-report are useful debug
  artifacts, but they are not kit-vnext gate evidence unless converted into committed events and
  artifact refs.
- Safety risk: FilesystemBackend and LocalShellBackend-like capabilities are production-sensitive;
  kit-vnext needs containment, egress negative probes, credential redaction, and runner-owned command
  capture before live use.
- Timing risk: current readiness is design-approved but not package-implemented; introducing a new
  harness now would distract from SDK ports, testkit mocks, and deterministic core stories
  (`docs/implementation/readiness-matrix.md`).

## Decision timing
after provider drivers

Deep Agents.js should be revisited only after SDK provider ports, testkit mocks, core gates, and at
least the initial Codex/local real-driver production-readiness stories are underway. Before then,
there is no stable seam implementation to test it against.

## Recommended next action
Record as watchlisted provider research. Do not change kit-vnext design or implementation plan now.
When `seam-agent-contract-mock` and `seam-execution-host-contract-mock` are implemented, run a small
read-only spike that maps Deep Agents.js events/backends/permissions to the SDK provider-port
contracts and reports pass/fail gaps.

## Sources
- Local project report: `design-closure/outputs/langchain-review/project-reports/deep-agents-js.md`
- Applied closure report: `design-closure/outputs/apply/APPLY-REPORT.md`
- Architecture and seams: `docs/design/10-architecture/architecture.md`,
  `docs/design/10-architecture/provider-seams.md`,
  `docs/design/10-architecture/capability-attestation.md`
- SDK/provider/storage contracts: `docs/design/20-sdk-and-packaging/provider-ports.md`,
  `docs/design/20-sdk-and-packaging/storage-port-types.md`
- Implementation ordering/readiness: `docs/implementation/domain-dag.md`,
  `docs/implementation/readiness-matrix.md`
- Relevant domains: `docs/design/30-domain-reference/providers/agent-execution/README.md`,
  `docs/design/30-domain-reference/providers/execution-host/README.md`,
  `docs/design/30-domain-reference/core/capability-and-safety/README.md`,
  `docs/design/30-domain-reference/core/approval-and-escalation/README.md`,
  `docs/design/30-domain-reference/core/supervision-and-liveness/README.md`,
  `docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md`,
  `docs/design/30-domain-reference/core/observability-and-analysis/README.md`
- Deep Agents.js primary sources cited by the project report:
  [Deep Agents.js README](https://github.com/langchain-ai/deepagentsjs/blob/main/libs/deepagents/README.md),
  [source `agent.ts`](https://github.com/langchain-ai/deepagentsjs/blob/main/libs/deepagents/src/agent.ts),
  [types](https://github.com/langchain-ai/deepagentsjs/blob/main/libs/deepagents/src/types.ts),
  [overview](https://docs.langchain.com/oss/javascript/deepagents/overview),
  [tools](https://docs.langchain.com/oss/javascript/deepagents/tools),
  [backends](https://docs.langchain.com/oss/javascript/deepagents/backends),
  [event streaming](https://docs.langchain.com/oss/javascript/deepagents/event-streaming),
  [production guide](https://docs.langchain.com/oss/javascript/deepagents/going-to-production)
