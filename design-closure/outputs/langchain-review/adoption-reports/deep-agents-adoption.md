# Deep Agents adoption review for kit-vnext

## Should we use it?

maybe

Deep Agents should be treated as a candidate Agent provider research input, not as a kit-vnext
architecture dependency or control-plane replacement.

## Why / why not

Deep Agents is relevant because it packages several worker-harness behaviors kit-vnext needs to
observe behind `AgentProvider`: planning/todo state, subagent delegation, filesystem-backed context,
human interrupts, permission rules, streamable subagent/tool activity, checkpointed threads, and
storage backends. The project report shows that `create_deep_agent` returns a LangGraph
`CompiledStateGraph`, supports built-in filesystem tools, subagents, human-in-the-loop interrupts,
permission rules, memory, and event streaming
([project report](../project-reports/deep-agents.md)).

It should not be adopted as a core orchestration layer. The current kit-vnext architecture says the
Control plane is deterministic and host-neutral, all host/tool specifics live behind the four provider
seams, capability gates rely on recorded fresh positive attestations, the Event log is the source of
truth, and worker/runner responsibilities are isolated
([architecture](../../../../docs/design/10-architecture/architecture.md),
[provider seams](../../../../docs/design/10-architecture/provider-seams.md),
[capability attestation](../../../../docs/design/10-architecture/capability-attestation.md)).
Deep Agents' own security posture is "trust the LLM" and its local shell/filesystem backends can act
with the user's permissions; those are acceptable only inside a tightly wrapped provider driver with
external containment, redaction, audit, and fail-closed gates
([project report](../project-reports/deep-agents.md)).

The applied closure strengthens this conclusion: SDK-owned provider ports and testkit mocks come
before real provider production readiness, and live runtime attestations are production gates rather
than SDK/core build prerequisites
([apply report](../../apply/APPLY-REPORT.md),
[provider ports](../../../../docs/design/20-sdk-and-packaging/provider-ports.md),
[readiness matrix](../../../../docs/implementation/readiness-matrix.md)).

## Where it maps to kit-vnext

- `prov-01` Agent Execution: possible future concrete driver or comparison fixture for
  `AgentProvider.startWorker`, `observe`, `answerApproval`, `resumeOwned`, normalized
  `approval-requested`, `tool-observed`, `degraded`, and `terminal` events
  ([prov-01](../../../../docs/design/30-domain-reference/providers/agent-execution/README.md),
  [AgentProvider types](../../../../docs/design/20-sdk-and-packaging/provider-ports.md)).
- `seam-agent-contract-mock` / `packages/testkit`: useful source of adversarial mock scenarios:
  dropped approvals, missing exit codes, lost linkage, ambiguous terminal states, and permission
  bypasses through custom tools/MCP
  ([domain DAG](../../../../docs/implementation/domain-dag.md),
  [prov-01 contract](../../../../docs/design/30-domain-reference/providers/agent-execution/contracts-and-conformance.md)).
- `core-03` Approval & Escalation: Deep Agents interrupts map to approval requests, but kit-vnext
  must own classification, decision, scoped grant mapping, park/resume, and audit events
  ([core-03](../../../../docs/design/30-domain-reference/core/approval-and-escalation/README.md)).
- `core-02` Capability & Safety: Deep Agents claims such as resumability, structured tool exits, or
  approval relay are not trusted until probed and recorded as `CapabilityAttestation`
  ([core-02](../../../../docs/design/30-domain-reference/core/capability-and-safety/README.md)).
- `prov-04` Execution Host: Deep Agents filesystem/shell behavior must run under the host's
  containment, egress policy, termination, and runner-owned command capture; Deep Agents tool output
  is not runner-owned verification evidence
  ([prov-04](../../../../docs/design/30-domain-reference/providers/execution-host/README.md)).
- `core-01` / `fnd-02`: Deep Agents checkpoints, files, and memory are worker context only. Durable
  run state remains the kit-vnext append-only Event log; worker artifacts must be stored as
  redacted, digested artifact refs
  ([core-01](../../../../docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md),
  [fnd-02](../../../../docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md)).
- `core-07` Observability & Analysis: Deep Agents event streaming and subagent projections are useful
  observed facts if normalized into run-log events/artifacts; LangSmith traces are optional external
  diagnostics, not authoritative state
  ([core-07](../../../../docs/design/30-domain-reference/core/observability-and-analysis/README.md)).

## Concrete use cases

- Build a research-only `provider-deepagents` spike after the SDK `AgentProvider` contract and mock
  exist, proving whether Deep Agents can emit stable `linked`, `approval-requested`,
  `tool-observed`, `degraded`, and `terminal` events.
- Add Deep Agents-inspired conformance fixtures to the Agent mock: subagent final-only summaries,
  hidden intermediate tool failures, permission interruption, permission bypass through custom tools,
  missing exit code, checkpoint resume failure, and ambiguous terminal state.
- Use Deep Agents as a comparative model for worker context quarantine: parent coordinator receives
  final subagent results, while detailed subagent streams become optional redacted artifacts and
  analysis inputs.
- Evaluate Deep Agents human-interrupt behavior against kit-vnext park/resume deadlines and scoped
  grant taxonomy.
- Later, test whether the TypeScript implementation is mature enough for a provider driver; the
  project report indicates Python is the stronger documented surface today
  ([project report](../project-reports/deep-agents.md)).

## Required design changes, if any

None now.

Do not change kit-vnext architecture for Deep Agents. The current closure already gives the right
extension point: SDK-owned provider ports, testkit mocks first, real provider drivers later, and
fresh production attestations before live powers
([apply report](../../apply/APPLY-REPORT.md),
[domain DAG](../../../../docs/implementation/domain-dag.md)).

If a Deep Agents driver is later pursued, only provider-driver design addenda should be needed:
driver mapping, capability probes, evidence fixtures, failure tokens, and conformance cases under the
Agent provider domain. Core semantics should not move into Deep Agents.

## Required implementation stories, if any

- After `seam-agent-contract-mock`: add Agent mock/conformance cases inspired by Deep Agents
  subagents, interrupts, permission rules, filesystem context, and checkpoint resume.
- After SDK/core ports exist: create a research story for a non-production `provider-deepagents`
  adapter that maps Deep Agents streams and interrupts into `AgentProvider` events without Forge
  credentials or runner-owned verification authority.
- Before any live use: add capability probes for approval relay, durable answer channels, owned
  resume, structured tool exit, parentage, permission-boundary behavior, redacted output refs, and
  terminal classification.
- Before production: run the adapter only through `ExecutionHostProvider` containment and fnd-04
  scoped injection/egress policy, then require fresh positive attestations for the concrete platform.

## Risks and constraints

- Deep Agents must not become the orchestrator. Completion, verification, merge, recovery, approval
  adjudication, and policy remain deterministic core responsibilities.
- Deep Agents memory/checkpoints are not authoritative run state; treating them as source of truth
  would violate `core-01`.
- Its permission rules do not cover every side-effect path in the project report, especially custom
  tools, MCP tools, and sandbox/command execution; kit-vnext must enforce boundaries through
  `prov-04`, `fnd-04`, and core gates.
- LangSmith/LangGraph deployment features may be useful operationally, but provider-neutral
  kit-vnext cannot require a hosted LangChain stack in the SDK/core path.
- LLM grading/rubrics are advisory at most. They cannot satisfy `core-05` evidence predicates or
  replace runner-owned verify, CI, review, protection, and exact-head Forge evidence
  ([core-05](../../../../docs/design/30-domain-reference/core/completion-and-merge/README.md)).
- TypeScript parity is not proven by the reviewed evidence; do not schedule a TypeScript production
  driver until the live JS package surface is verified.

## Decision timing

after core-first stories

Revisit after SDK provider ports, `seam-agent-contract-mock`, core-01/core-02/core-03, and the
testkit conformance path exist. Real driver adoption belongs after those core-first stories, not
before them.

## Recommended next action

Record Deep Agents as a watchlisted Agent-provider candidate and mine it for Agent mock/conformance
cases. Do not add a dependency or design change now. The first actionable work item should be a
post-`seam-agent-contract-mock` research story that maps Deep Agents events, interrupts, filesystem
tools, and resume behavior to the frozen `AgentProvider` surface and reports which capabilities can
be honestly attested.

## Sources

- [Deep Agents project report](../project-reports/deep-agents.md)
- [Design closure apply report](../../apply/APPLY-REPORT.md)
- [Architecture](../../../../docs/design/10-architecture/architecture.md)
- [Provider seams](../../../../docs/design/10-architecture/provider-seams.md)
- [Capability attestation](../../../../docs/design/10-architecture/capability-attestation.md)
- [SDK provider ports](../../../../docs/design/20-sdk-and-packaging/provider-ports.md)
- [Storage port types](../../../../docs/design/20-sdk-and-packaging/storage-port-types.md)
- [Domain DAG](../../../../docs/implementation/domain-dag.md)
- [Readiness matrix](../../../../docs/implementation/readiness-matrix.md)
- [Agent Execution domain](../../../../docs/design/30-domain-reference/providers/agent-execution/README.md)
- [Execution Host domain](../../../../docs/design/30-domain-reference/providers/execution-host/README.md)
- [Capability & Safety domain](../../../../docs/design/30-domain-reference/core/capability-and-safety/README.md)
- [Approval & Escalation domain](../../../../docs/design/30-domain-reference/core/approval-and-escalation/README.md)
- [Completion, Verification & Merge domain](../../../../docs/design/30-domain-reference/core/completion-and-merge/README.md)
- [Run Lifecycle & Event State domain](../../../../docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md)
- [Storage & Artifacts domain](../../../../docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md)
- [Observability & Analysis domain](../../../../docs/design/30-domain-reference/core/observability-and-analysis/README.md)
