# Agent Protocol adoption review for kit-vnext

## Should we use it?

maybe

Use Agent Protocol only as a possible future `AgentProvider` compatibility adapter or protocol
reference. Do not adopt it as kit-vnext's core run, state, thread, store, or event-log model.

## Why / why not

Agent Protocol is relevant because it standardizes an agent-serving HTTP surface around agents, runs,
threads, streaming, schemas, and long-term store. The project report identifies useful primitives for
agent introspection, background run lifecycle, thread history, checkpoints, interrupt/resume, and
streaming events
([project report](../project-reports/agent-protocol.md#what-looks-relevant-to-kit-vnext)).

It should not drive kit-vnext architecture now. After design closure, kit-vnext deliberately centers
the SDK-owned provider ports, testkit mocks, recorded capability attestations, append-only event log,
worker/runner split, and later real-driver production readiness
([apply report](../../apply/APPLY-REPORT.md#sdk-and-package-boundary),
readiness matrix).
Agent Protocol is agent-serving centric, not code-delivery centric, and does not define Forge
credentials, PR evidence, review-thread handling, verification gates, branch/worktree safety, or
worker/runner isolation
([project report](../project-reports/agent-protocol.md#what-looks-irrelevant-or-risky-for-kit-vnext)).

The biggest conflict is state authority. Agent Protocol threads are state containers and run-history
anchors, while kit-vnext makes the run event log the single source of truth and keeps Work Source task
status separate
([core-01](../../../../docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md#mandate),
[architecture](../../../../docs/design/10-architecture/architecture.md#5-cross-cutting-invariants)).
Agent Protocol thread state, checkpoints, and store can be adapter inputs, but they must never replace
core-01 replay/projections, fnd-02 artifacts, or Work Source status authority.

## Where it maps to kit-vnext

- `prov-01` / `seam-agent-contract-mock`: Agent Protocol agents, runs, streaming events, schemas, and
  interrupts map most naturally behind `AgentProvider`, especially `probeCapabilities`,
  `startWorker`, `observe`, `answerApproval`, and `resumeOwned`
  ([AgentProvider catalog](../../../../docs/design/20-sdk-and-packaging/provider-ports.md#agent-provider),
  [prov-01](../../../../docs/design/30-domain-reference/providers/agent-execution/README.md#5-contracts--interfaces)).
- `core-02`: Agent Protocol capabilities and schemas are only discovery hints until converted into
  fresh positive `CapabilityAttestation` events and evaluated through kit-vnext gates
  ([capability attestation](../../../../docs/design/10-architecture/capability-attestation.md#evaluation-rules),
  [core-02](../../../../docs/design/30-domain-reference/core/capability-and-safety/README.md#4-design)).
- `core-04`: Agent Protocol lifecycle/message/tool/checkpoint streams can inform liveness only when
  normalized into current-session Agent events. Thread joins, client stream reconnects, or state reads
  must not refresh liveness by themselves
  ([core-04](../../../../docs/design/30-domain-reference/core/supervision-and-liveness/README.md#4-design)).
- `core-07`: Agent Protocol stream taxonomy is useful raw observation material once committed as
  redacted event payloads/artifact refs. Analysis must remain pure over committed log evidence, not
  live Agent Protocol service state
  ([core-07](../../../../docs/design/30-domain-reference/core/observability-and-analysis/README.md#4-design)).
- `fnd-02`: Agent Protocol store is not a substitute for kit-vnext storage ports, artifact retention,
  redaction, leases, or event-log durability
  ([storage port types](../../../../docs/design/20-sdk-and-packaging/storage-port-types.md#c-event-log-persistence)).
- `prov-04`, `prov-02`, `prov-03`: no direct adoption. Agent Protocol does not own process
  containment/kill, Forge evidence/merge, or task authority, which remain separate provider seams
  ([provider seams](../../../../docs/design/10-architecture/provider-seams.md#the-four-seams)).

## Concrete use cases

- Build a later experimental `AgentProvider` adapter for an Agent Protocol-compatible server, mapping
  server agent schemas/capabilities into probe evidence and mapping run/stream events into
  `AgentEvent`.
- Use Agent Protocol streaming channel names as comparison material when finalizing prov-01
  conformance fixtures for message, tool, lifecycle, checkpoint, and terminal observations.
- Use `/agents/{agent_id}/schemas`-style introspection as one input to provider smoke/conformance
  probes, while still requiring live proof for `canRelayApproval`, `canResumeOwned`, and
  `emitsStructuredToolExit`.
- Create replay fixtures from Agent Protocol runs to test that missing exit codes, ambiguous terminal
  states, lost approval channels, or checkpoint-only progress fail closed.

## Required design changes, if any

None now.

The applied design already has the right extension point: SDK-owned provider ports plus testkit mocks
first, real provider drivers later
(domain DAG). If Agent Protocol is
used later, it should be documented as a concrete or experimental `AgentProvider` mapping under
`prov-01`, not as a new core abstraction.

## Required implementation stories, if any

None for the core-first implementation sequence.

Possible later stories:

- Add an experimental Agent Protocol `AgentProvider` adapter story after the SDK provider ports and
  mock Agent provider exist.
- Add prov-01 conformance fixtures that replay Agent Protocol stream samples into normalized
  `AgentEvent` records.
- Add negative/adversarial fixtures for schema-only claims, checkpoint-only progress, missing
  approval answer persistence, missing tool exit status, and ambiguous terminal status.

## Risks and constraints

- Public maturity appears early: the project report cites OpenAPI `0.1.6`, PyPI alpha status, and
  generated bindings without complete transport/client helpers
  ([project report](../project-reports/agent-protocol.md#maturity-and-ecosystem-notes)).
- LangGraph concepts leak into the protocol shape. That is acceptable inside an adapter, but not as
  kit-vnext core domain law
  ([project report](../project-reports/agent-protocol.md#what-looks-irrelevant-or-risky-for-kit-vnext)).
- Thread state and long-term store must not become authoritative kit-vnext state. The authoritative
  run state remains core-01 replay, and task status remains Work Source authority
  ([architecture](../../../../docs/design/10-architecture/architecture.md#5-cross-cutting-invariants)).
- Capabilities advertised by an Agent Protocol service are self-report until probed and recorded as
  `CapabilityAttestation`; self-report-only evidence must deny
  ([capability attestation](../../../../docs/design/10-architecture/capability-attestation.md#evaluation-rules)).
- The adapter must preserve worker/runner isolation. Agent Protocol run APIs cannot be given Forge
  push, PR, review, check, or merge authority
  ([architecture](../../../../docs/design/10-architecture/architecture.md#4-run-sequence-end-to-end-happy-path)).

## Decision timing

after core-first stories

Revisit once `packages/sdk` has the provider-port interfaces, `packages/testkit` has the mock Agent
provider/conformance surface, and the core run/capability/supervision stories can prove behavior
without real processes or network
(readiness matrix).

## Recommended next action

Record Agent Protocol as a watch/adapt candidate for `prov-01` production-readiness research. Do not
change the current design closure or implementation ordering. When core-first stories are complete,
run a bounded spike that maps one Agent Protocol server into `AgentProvider` and reports which
capabilities can be freshly, positively attested.

## Sources

- [Agent Protocol project report](../project-reports/agent-protocol.md)
- [Design closure apply report](../../apply/APPLY-REPORT.md)
- [Architecture overview](../../../../docs/design/10-architecture/architecture.md)
- [Provider seams](../../../../docs/design/10-architecture/provider-seams.md)
- [Capability attestation](../../../../docs/design/10-architecture/capability-attestation.md)
- [SDK provider ports](../../../../docs/design/20-sdk-and-packaging/provider-ports.md)
- [Storage port types](../../../../docs/design/20-sdk-and-packaging/storage-port-types.md)
- Domain DAG
- Readiness matrix
- [prov-01 Agent Execution](../../../../docs/design/30-domain-reference/providers/agent-execution/README.md)
- [core-01 Run Lifecycle & Event State](../../../../docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md)
- [core-02 Capability & Safety](../../../../docs/design/30-domain-reference/core/capability-and-safety/README.md)
- [core-04 Supervision & Liveness](../../../../docs/design/30-domain-reference/core/supervision-and-liveness/README.md)
- [core-07 Observability & Analysis](../../../../docs/design/30-domain-reference/core/observability-and-analysis/README.md)

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../README.md) · **← Prev:** [LangChain leverage sources](../../langchain-leverage/SOURCES.md) · **Next →:** [Deep Agents adoption review for kit-vnext](./deep-agents-adoption.md)

<!-- /DOCS-NAV -->
