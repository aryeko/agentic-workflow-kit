# Open SWE adoption review for kit-vnext

## Should we use it?

maybe

Do not adopt Open SWE as kit-vnext's control-plane architecture or runtime substrate. Use it as a
reference implementation for later provider-driver, edge-trigger, reviewer, and operational patterns
after the core-first SDK/testkit stories exist.

## Why / why not

Open SWE is useful evidence because it is a real asynchronous coding-agent application with
webhook-triggered work intake, sandbox-backed execution, deterministic thread reuse, queued mid-run
messages, GitHub PR automation, reviewer/analyzer graphs, CI monitoring, and LangSmith tracing
([project report](../project-reports/open-swe.md)).

It conflicts with kit-vnext if treated as an architecture source. Open SWE is agent-harness-first:
LangGraph/Deep Agents coordinate runs, the main agent can commit, push, open or update PRs, and reply
in source channels. kit-vnext's applied design closure instead keeps a deterministic control plane,
SDK-owned provider ports, event-log authority, mock-driven core tests, capability attestations, and
strict worker/runner isolation ([architecture](../../../../docs/design/10-architecture/architecture.md),
[provider seams](../../../../docs/design/10-architecture/provider-seams.md),
[apply report](../../apply/APPLY-REPORT.md)).

The adoption posture should therefore be selective: learn from Open SWE's driver-facing mechanics and
operator product surface, but keep kit-vnext's existing contracts as the source of truth.

## Where it maps to kit-vnext

- `prov-01` Agent Execution: Open SWE's Deep Agents main agent, subagent use, queued follow-up
  messages, reviewer/analyzer split, and model/tool middleware are useful comparison material for the
  future Codex driver and mock/incident fixtures. They should not replace `AgentProvider` or move
  orchestration into prompts ([prov-01](../../../../docs/design/30-domain-reference/providers/agent-execution/README.md)).
- `prov-04` Execution Host: Open SWE's sandbox provider factory maps conceptually to
  `ExecutionHostProvider`, especially sandbox identity reuse and provider selection. Local no-isolation
  development mode is not production evidence; kit-vnext still requires containment, command capture,
  termination proof, and egress negative probes ([prov-04](../../../../docs/design/30-domain-reference/providers/execution-host/README.md)).
- `prov-02` Forge Collaboration: Open SWE's GitHub App, PR automation, review-thread reconciliation,
  and CI monitor are relevant to GitHub driver production readiness. Any worker-owned push/PR behavior
  must be rejected; Forge remains runner-owned, exact-head, credentialed, and fail-closed
  ([prov-02](../../../../docs/design/30-domain-reference/providers/forge-collaboration/README.md)).
- `prov-03` Work Source: Slack/Linear/GitHub webhook normalization can inform later external Work
  Source or edge-trigger adapters, but task status authority and claim/snapshot semantics remain the
  Work Source contract, not LangGraph thread metadata ([prov-03](../../../../docs/design/30-domain-reference/providers/work-source/README.md)).
- `core-01` and `fnd-02`: Open SWE's LangGraph threads, metadata, stores, and checkpointing are an
  operational comparison point only. kit-vnext's run event log remains the single source of truth,
  with SDK storage ports for leases, append receipts, artifacts, replay health, and durability
  ([core-01](../../../../docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md),
  [storage ports](../../../../docs/design/20-sdk-and-packaging/storage-port-types.md)).
- `core-02`: Open SWE middleware and provider settings can inspire probe scenarios, but kit-vnext
  gates autonomy only on recorded `CapabilityAttestation` events and committed gate records
  ([capability attestation](../../../../docs/design/10-architecture/capability-attestation.md),
  [core-02](../../../../docs/design/30-domain-reference/core/capability-and-safety/README.md)).
- `core-05`/`core-06`/`core-07`: reviewer findings, CI sweep fallback, and analyzer traces map to
  completion evidence, recovery classification, and analysis patterns, but only after they are
  expressed as replayable events and redacted artifacts ([core-05](../../../../docs/design/30-domain-reference/core/completion-and-merge/README.md),
  [core-06](../../../../docs/design/30-domain-reference/core/recovery-and-reconciliation/README.md),
  [core-07](../../../../docs/design/30-domain-reference/core/observability-and-analysis/README.md)).
- `edge-01`: Slack/Linear/GitHub invocation and dashboard settings are later edge/trigger ideas.
  They do not belong in v1 run logic; edge remains a thin adapter over the operator control port
  ([edge-01](../../../../docs/design/30-domain-reference/edge/operator-surface/README.md)).

## Concrete use cases

- Use Open SWE's GitHub App permission model, proxy-token pattern, and review-thread reconciliation as
  research inputs when implementing `provider-github`.
- Add Open SWE-inspired conformance scenarios: queued follow-up while a worker is busy, sandbox
  eviction/reconnect, stale PR head, unresolved review threads, failing CI auto-fix temptation, and
  reviewer finding persistence.
- Compare its sandbox provider matrix against `ExecutionHostProvider` production-readiness stories,
  especially what can and cannot prove containment, termination, and egress confinement.
- Use its separate reviewer/analyzer graphs as product reference for future core-07 reports and
  edge-01 explainability, not as load-bearing adjudicators.
- Later, model Slack/Linear/GitHub webhook intake as external trigger producers of the existing
  operator/work-source envelopes.

## Required design changes, if any

None now.

The applied design closure already has the right homes: SDK-owned provider ports, storage port types,
capability attestations, mock/conformance surfaces, and real-driver production-readiness stories
([provider ports](../../../../docs/design/20-sdk-and-packaging/provider-ports.md),
[domain DAG](../../../../docs/implementation/domain-dag.md),
[readiness matrix](../../../../docs/implementation/readiness-matrix.md)).

Potential future design notes may be useful after core-first stories: external trigger envelope
details for Slack/Linear/GitHub, reviewer-finding artifact conventions, and GitHub App credential
proxy requirements. These should extend existing domains, not add a LangGraph-style orchestration
layer.

## Required implementation stories, if any

None before the current core-first sequence.

After SDK ports and testkit mocks exist, consider these implementation stories:

- `provider-github`: GitHub App driver research spike using Open SWE as comparison input for scoped
  permissions, PR review threads, CI monitor signals, and exact-head refusal cases.
- `provider-local` or future remote host driver: sandbox reconnect/eviction conformance cases, with
  explicit negative results for non-isolated local mode.
- `testkit`: adversarial fixtures for queued mid-run messages, sandbox loss, stale metadata,
  review-thread mismatch, and CI-fix loops.
- `core-07`/`edge-01`: redacted reviewer/analyzer report rendering from event-log evidence refs.
- Future external-trigger story: Slack/Linear/GitHub trigger adapters that produce existing control
  envelopes and never bypass Work Source claims or operator audit events.

## Risks and constraints

- Architecture drift: adopting Open SWE wholesale would move coordination into LangGraph/prompt
  middleware and undermine kit-vnext's deterministic control plane.
- Worker/runner violation: Open SWE-style agent PR operations conflict with AD-12; kit-vnext workers
  edit and commit locally only, while the runner owns push, PR, evidence, and merge.
- State fragmentation: Open SWE state spans LangGraph threads, metadata, store items, sandbox state,
  dashboard settings, GitHub/Slack/Linear, and LangSmith traces. kit-vnext requires replayable event
  log authority and pure projections.
- Capability inflation: sandbox or provider claims must not become production powers without fresh
  positive `CapabilityAttestation` events in the concrete platform scope.
- Maturity risk: the project report found no published Open SWE releases, so references should be
  pinned or treated as research, not stable API contracts.
- Product temptation: Slack/Linear/dashboard flows are attractive, but v1 prioritizes manual/assisted
  core correctness over broad external-trigger automation.

## Decision timing

after provider drivers

Use Open SWE now only as research evidence while writing provider-driver and testkit stories. Make
adoption decisions for concrete patterns after core-first stories and SDK/testkit mocks are in place;
do not block the current implementation sequence on Open SWE.

## Recommended next action

Record a "watch and mine for provider-driver fixtures" decision. When `provider-github`,
`provider-local`/remote host, and external-trigger stories are authored, pull specific Open SWE
source links from the project report into those story evidence sections and convert only compatible
patterns into contract tests.

## Sources

- Local project report:
  [design-closure/outputs/langchain-review/project-reports/open-swe.md](../project-reports/open-swe.md).
- Applied closure:
  [design-closure/outputs/apply/APPLY-REPORT.md](../../apply/APPLY-REPORT.md).
- kit-vnext architecture and seams:
  [architecture.md](../../../../docs/design/10-architecture/architecture.md),
  [provider-seams.md](../../../../docs/design/10-architecture/provider-seams.md),
  [capability-attestation.md](../../../../docs/design/10-architecture/capability-attestation.md).
- SDK and implementation posture:
  [provider-ports.md](../../../../docs/design/20-sdk-and-packaging/provider-ports.md),
  [storage-port-types.md](../../../../docs/design/20-sdk-and-packaging/storage-port-types.md),
  [domain-dag.md](../../../../docs/implementation/domain-dag.md),
  [readiness-matrix.md](../../../../docs/implementation/readiness-matrix.md).
- Domain references:
  [prov-01](../../../../docs/design/30-domain-reference/providers/agent-execution/README.md),
  [prov-04](../../../../docs/design/30-domain-reference/providers/execution-host/README.md),
  [prov-02](../../../../docs/design/30-domain-reference/providers/forge-collaboration/README.md),
  [prov-03](../../../../docs/design/30-domain-reference/providers/work-source/README.md),
  [core-01](../../../../docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md),
  [core-02](../../../../docs/design/30-domain-reference/core/capability-and-safety/README.md),
  [core-05](../../../../docs/design/30-domain-reference/core/completion-and-merge/README.md),
  [core-06](../../../../docs/design/30-domain-reference/core/recovery-and-reconciliation/README.md),
  [core-07](../../../../docs/design/30-domain-reference/core/observability-and-analysis/README.md),
  [edge-01](../../../../docs/design/30-domain-reference/edge/operator-surface/README.md).
