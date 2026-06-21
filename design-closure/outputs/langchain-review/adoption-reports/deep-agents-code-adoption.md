# Deep Agents Code adoption review for kit-vnext
## Should we use it?
maybe

Use Deep Agents Code as provider-driver prior art, not as kit-vnext architecture. It may inform a
future Agent provider driver and remote/sandbox Execution Host driver, but it should not replace the
deterministic control plane, event log, SDK provider ports, testkit mocks, or capability gates.

## Why / why not
Deep Agents Code is a terminal coding agent with an interactive/headless CLI, model-provider
switching, skills, MCP tools, memory, approval gates, remote sandbox tool targeting, and LangSmith
tracing, according to the input project report. Those are relevant examples for worker operation and
driver ergonomics.

It conflicts with kit-vnext if treated as a control plane. kit-vnext's live design says the Control
plane is deterministic and host-neutral; providers are contracts plus concrete drivers; every step is
an appended event; worker prose and provider self-report do not satisfy gates. Deep Agents Code's
SQLite checkpoint state, memory, auto-approve mode, broad shell allow-lists, arbitrary Python
`class_path` configuration, and unauthenticated-localhost threat-model item are therefore not
authoritative enough for run state, verification, completion, merge, approval, or recovery decisions.

The applied closure reinforces this boundary: SDK-owned provider ports and testkit mocks come before
real provider drivers; live provider attestations are production-readiness gates, not core build/test
prerequisites.

## Where it maps to kit-vnext
- `prov-01` / `seam-agent-contract-mock`: Deep Agents Code's coding-agent protocol, approval
  requests, session resume, tool observations, skills, subagents, and model-provider selection map
  only behind `AgentProvider`, especially `startWorker`, `observe`, `answerApproval`, `resumeOwned`,
  `ToolObserved`, and capabilities such as `canRelayApproval`, `canResumeOwned`, and
  `emitsStructuredToolExit`.
- `prov-04` / `seam-execution-host-contract-mock`: its local-vs-remote sandbox model is useful
  evidence for future Execution Host drivers, especially the "agent loop local, tools target sandbox"
  pattern. It must still satisfy kit-vnext `ExecutionHostProvider` containment, `runCommand`,
  `commandDigest`, egress negative probes, termination proof, and runner-owned verification capture.
- `core-03`: its default human approval and non-interactive controls are useful UX references, but
  kit-vnext approval decisions stay deterministic, event-backed, and limited to manual/assisted v1
  modes.
- `core-02`: any Deep Agents Code capability must be probed and recorded as
  `CapabilityAttestation`; config flags, CLI claims, and worker reports are not gate evidence.
- `core-05`: Deep Agents Code tool outputs and self-reports cannot prove completion or merge.
  Completion still requires local git evidence, runner-owned verify, exact-head Forge evidence,
  protected-policy handling, and an allowed capability gate.
- `core-07` and `fnd-02`: LangSmith traces can be useful artifacts or external diagnostics, but
  kit-vnext analysis remains a pure function over the run event log, projections, and redacted
  artifact refs.
- `fnd-04`: Deep Agents Code provider config, MCP environment forwarding, shell execution, and
  arbitrary Python plugin loading are security inputs for driver threat modeling. They do not weaken
  worker/runner credential isolation or worker-no-Forge rules.

## Concrete use cases
- Use the Deep Agents Code report as a checklist when designing a possible `provider-deepagents-code`
  Agent driver spike: event normalization, approval answer channel behavior, resume behavior,
  tool-exit capture, output redaction, and session linkage.
- Compare its remote sandbox behavior against `ExecutionHostProvider` remote-host requirements:
  workspace attachment, cwd containment, process ownership, egress confinement, termination proof,
  and whether runner-owned verify can be captured outside the agent's own tool stream.
- Mine its non-interactive controls for edge/CLI ergonomics after the core flow exists: max turns,
  timeout, shell allow-lists, quiet output, and startup commands.
- Use its threat model as provider-driver test input: checkpoint tampering, prompt injection through
  fetched/local content, unsafe config execution, MCP subprocess environment exposure, and localhost
  server access.
- Treat LangSmith trace separation as optional observability enrichment, stored as redacted
  `ArtifactRef`s or cited evidence refs, never as the only run truth.

## Required design changes, if any
None now.

The applied design already has the right extension points: SDK-owned provider ports, provider seam
contracts, capability attestations, storage/artifact refs, credentials and egress policy, and
production-readiness real-driver stories. A future Deep Agents Code driver may need a provider-domain
evidence appendix and conformance-story details, but not an architecture change.

## Required implementation stories, if any
- After SDK ports and testkit mocks exist, add a research/spike story for
  `provider-deepagents-code` or a Deep Agents Code-backed `provider-codex` alternative. Acceptance
  criteria should prove only mapping feasibility, not production readiness.
- Add conformance fixtures for Deep Agents Code-style failures: missing exit code, lost approval
  channel, stale resume, checkpoint tamper signal, unsafe auto-approve attempt, sandbox escape or
  egress negative-probe failure, and MCP/config environment leakage.
- Add an optional trace-import artifact path only after `fnd-02` and `core-07` exist, preserving
  redaction, retention, digest, and analysis-input rules.
- If a real driver proceeds, add live capability probes for the target version/platform before any
  live power is enabled.

## Risks and constraints
- Do not adopt Deep Agents Code as orchestrator, state store, approval authority, verifier, Forge
  actor, or merge decision-maker.
- Do not treat `~/.deepagents` SQLite checkpoints, memory, skills, LangGraph state, or LangSmith
  traces as kit-vnext's event log.
- Disable or mediate `--auto-approve`, broad shell allow-lists, web/fetch, MCP tools, and arbitrary
  provider/sandbox `class_path` loading unless the runner can constrain, audit, and attest them.
- Custom subagents inheriting main-agent tools are weaker than kit-vnext's bounded worker contracts;
  that inheritance should be treated as a risk until proven constrained.
- Deep Agents Code was reported as beta and rapidly changing, so exact schema and CLI behavior must
  be version-pinned and re-probed during any driver work.
- Production live powers still require fresh positive provider probes in the concrete scope; recorded
  or mock attestations only support core and conformance tests.

## Decision timing
after provider drivers

## Recommended next action
Do not change kit-vnext design now. Add a backlog note for provider-driver research after the
core-first SDK/testkit stories are underway: evaluate whether Deep Agents Code can satisfy
`AgentProvider` and, separately, whether its sandbox mode can satisfy `ExecutionHostProvider`.

## Sources
- Input project report:
  `design-closure/outputs/langchain-review/project-reports/deep-agents-code.md`
- Applied closure report:
  `design-closure/outputs/apply/APPLY-REPORT.md`
- Architecture and invariants:
  `docs/design/10-architecture/architecture.md`,
  `docs/design/10-architecture/provider-seams.md`,
  `docs/design/10-architecture/capability-attestation.md`
- SDK/provider/storage ports:
  `docs/design/20-sdk-and-packaging/provider-ports.md`,
  `docs/design/20-sdk-and-packaging/storage-port-types.md`
- Implementation sequencing:
  `docs/implementation/domain-dag.md`,
  `docs/implementation/readiness-matrix.md`
- Relevant domains:
  `docs/design/30-domain-reference/providers/agent-execution/README.md`,
  `docs/design/30-domain-reference/providers/execution-host/README.md`,
  `docs/design/30-domain-reference/core/capability-and-safety/README.md`,
  `docs/design/30-domain-reference/core/approval-and-escalation/README.md`,
  `docs/design/30-domain-reference/core/completion-and-merge/README.md`,
  `docs/design/30-domain-reference/core/observability-and-analysis/README.md`,
  `docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md`,
  `docs/design/30-domain-reference/foundation/credentials-and-secrets/README.md`
- Upstream sources cited by the input report:
  [Deep Agents Code overview](https://docs.langchain.com/oss/python/deepagents/code/overview),
  [Deep Agents Code architecture](https://github.com/langchain-ai/deepagents/blob/main/libs/code/ARCHITECTURE.md),
  [Deep Agents Code threat model](https://github.com/langchain-ai/deepagents/blob/main/libs/code/THREAT_MODEL.md),
  [Deep Agents Code data locations](https://docs.langchain.com/oss/python/deepagents/code/data-locations),
  [Deep Agents Code configuration](https://docs.langchain.com/oss/python/deepagents/code/configuration),
  [Deep Agents Code remote sandboxes](https://docs.langchain.com/oss/python/deepagents/code/remote-sandboxes),
  [Deep Agents Code PyPI package](https://pypi.org/project/deepagents-code/)
