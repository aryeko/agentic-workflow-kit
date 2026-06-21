# Coding-agent operations

## Opportunity summary

Open SWE and Deep Agents Code should reduce kit-vnext implementation work by acting as source-level
evidence for provider-driver stories, conformance fixtures, async coding-agent operations, reviewer
and CI monitor behavior, sandbox threat modeling, and operator UX. They should not become the
kit-vnext runtime, state store, approval authority, verifier, Forge actor, or merge gate.

Concise score line: code avoided `medium`; product gain `high`; seam fit `medium-high`; invariant
risk `high if adopted wholesale, low if mined for fixtures/adapters`; dependency risk `medium-high`;
timing `after SDK provider ports, testkit mocks, and core gates`; use type `adapter spike plus copied
patterns and test fixtures, not direct runtime reuse`.

The highest-leverage path is to translate Open SWE and Deep Agents Code into bounded provider-driver
stories:

- Open SWE: async run intake, deterministic thread reuse, queued follow-up messages, sandbox identity
  reuse, GitHub App credential proxying, reviewer finding persistence, review-thread reconciliation,
  CI sweep fallback, and dashboard/Slack/Linear/GitHub UX patterns.
- Deep Agents Code: terminal/headless coding-agent controls, approval-gated tool operations,
  non-interactive limits, session resume, model/provider selection, MCP loading, remote sandbox
  targeting, command output behavior, and explicit security fixtures from its threat model.

## Candidate projects

1. `provider-codex` conformance expansion from Deep Agents Code patterns.
   Treat `dcode` as a comparable coding-agent provider, not the first production driver. Mine it for
   `AgentProvider` tests around `startWorker`, `observe`, `answerApproval`, `resumeOwned`, terminal
   classification, lost approval channels, missing tool exit codes, session resume, and headless
   operation. This avoids inventing all coding-agent incident cases from scratch.

2. `provider-local` / future remote `ExecutionHostProvider` conformance expansion.
   Use Deep Agents Code's "sandbox as tool" model and Open SWE's persistent sandbox/provider matrix
   to define host fixtures for workspace attachment, cwd containment, process ownership, sandbox
   reconnect/eviction, egress negative probes, command capture, and termination proof. This avoids
   designing remote-host edge cases only from the local driver.

3. `provider-github` production-readiness story set.
   Use Open SWE's GitHub App model, proxy-token pattern, reviewer threads, persisted review findings,
   and CI monitor sweep as comparison input for Forge evidence reads, exact-head refusal cases,
   thread inspection, check-run/workflow-run gaps, and conflict/fallback handling. This reduces
   product discovery for GitHub driver behavior while preserving kit-vnext's runner-only Forge role.

4. Work Source and edge trigger spike.
   Use Open SWE's Slack, Linear, and GitHub invocation model as external-trigger prior art. The kit
   output should be trigger adapters that produce existing Work Source or operator-control envelopes,
   never LangGraph thread metadata as task authority.

5. Core-07 operational report UX.
   Use Open SWE's split reviewer/analyzer/CI-monitor surfaces and Deep Agents Code's trace, config,
   threads, version, token, and JSON output commands as product references for run analysis artifacts,
   degraded-mode reports, and operator-facing diagnostics.

6. Security fixture pack.
   Convert Deep Agents Code's threat model into adversarial fixtures for provider loading, MCP env
   leakage, unauthenticated localhost control, SQLite/checkpoint tampering, prompt injection through
   fetched/local content, broad shell allow-lists, arbitrary `class_path` imports, and sandbox provider
   trust boundaries.

## What to leverage

Open SWE source-level leverage:

- `langgraph.json` currently declares separate graphs for `agent`, `reviewer`, `analyzer`, `chat`,
  `scheduler`, and `ci_monitor`, plus a FastAPI app and checkpointer TTL. This is useful as a concrete
  decomposition of async coding-agent operations, not as kit-vnext's orchestration substrate.
- The README describes cloud sandbox execution, persistent per-thread sandbox reuse, sandbox
  recreation, Slack/Linear/GitHub invocation, queued mid-run follow-up messages, subagents,
  prompt-driven validation, and automatic draft PR creation. Kit-vnext should copy the product
  scenarios, not the worker-owned push/PR behavior.
- `agent/utils/thread_ops.py` has a small but useful busy-thread queue pattern: check whether a thread
  is busy, then store FIFO pending messages under a `("queue", thread_id)` namespace.
- `agent/reviewer_findings.py` persists reviewer findings in thread metadata, tracks severity,
  confidence, anchors, GitHub review/comment/thread ids, human replies, reconciliation notes, and
  surface state. This is strong prior art for durable finding artifacts and review-thread
  reconciliation tests.
- `agent/ci_monitor.py` is intentionally a cron/sweep fallback for open agent PRs when CI webhooks are
  not reliable and for merge conflicts where GitHub emits no webhook. That pattern maps well to
  Forge evidence refresh and recovery classification.
- The Open SWE docs describe `GH_TOKEN=dummy gh` inside the sandbox backed by a proxy that mints
  GitHub App or user tokens at runtime. This is directly relevant to AD-12, but only if the worker
  still cannot push, open PRs, or merge in kit-vnext.

Deep Agents Code source-level leverage:

- The overview documents a terminal coding agent with built-in file, shell, web, task, memory,
  context compaction, HITL, skills, MCP, tracing, and remote sandbox capabilities.
- The command surface covers `--non-interactive`, `--max-turns`, `--timeout`, `--quiet`, `--json`,
  `--resume`, `--startup-cmd`, `--sandbox`, `--sandbox-id`, `--mcp-config`, `--no-mcp`,
  `--trust-project-mcp`, `--auto-approve`, and `--shell-allow-list`. These are useful UX and fixture
  inputs for agent-driver behavior, but several are dangerous if passed through unmediated.
- The remote sandbox docs describe the "sandbox as tool" pattern: the local `dcode` process owns the
  LLM loop, memory, and tool dispatch, while file and command tools target a remote sandbox. That is a
  useful adapter pattern for future `ExecutionHostProvider` work because it decouples the agent loop
  from the workspace where commands run.
- The architecture note splits the terminal client from the agent server over a streaming protocol,
  with the server owning model/tools/memory/backend and the client owning presentation/input. That
  helps define where an `AgentProvider` adapter can observe events and approvals without owning the
  UI.
- The threat model is directly useful. It names local HTTP+SSE control over `127.0.0.1`, noop
  LangGraph auth, `DA_SERVER_*` environment channels, SQLite checkpoint persistence, MCP subprocesses,
  hooks, sandbox provider factories, user-controlled `class_path` imports, local context scripts, and
  checkpoint tampering assumptions. These should become negative fixtures and attestation checks.

## Why it helps kit-vnext

This reduces work in five places without changing the architecture:

- Provider-driver stories get realistic acceptance criteria. Instead of abstract "support approvals"
  and "support resume", story authors can require lost answer channel, stale resume, busy-thread
  follow-up, sandbox reconnect, missing exit code, webhook-missed CI, and exact-head review-thread
  cases drawn from real coding-agent systems.
- Async coding-agent operations become testable early. Open SWE's queue/reuse/reviewer/CI sweep
  behavior and Deep Agents Code's headless/resume/time-limit behavior can be expressed as mock Agent,
  Host, Forge, and Work Source scripts before any real driver is production-ready.
- Reviewer and CI monitor product behavior gets a concrete reference. Open SWE's persisted findings
  and CI monitor fallback show useful operational flows, while kit-vnext keeps completion and merge as
  pure evidence predicates in `core-05`.
- Sandbox and threat-model coverage improves. Deep Agents Code's threat model gives immediate fixture
  names for config execution, checkpoint tampering, MCP leakage, localhost control, and sandbox trust
  rather than waiting for security review late in driver work.
- Operational UX gets better without broad scope creep. Deep Agents Code's JSON management commands,
  dry-run destructive commands, config-source reporting, `/trace`, `/threads`, `/version`, and Open
  SWE's dashboard concepts can inform `edge-01` and `core-07` after the event log exists.

## Direct reuse vs adapter vs copied pattern

| Area | Recommended use | Rationale |
|---|---|---|
| Open SWE LangGraph graphs | Copied pattern / fixture source | Useful decomposition, but LangGraph threads/checkpoints cannot become kit-vnext run truth. |
| Open SWE Slack/Linear/GitHub triggers | Adapter later | Map to Work Source or operator-control envelopes; do not bypass claim/snapshot/status authority. |
| Open SWE GitHub App/proxy token model | Copied pattern for Forge story evidence | Good credential pattern, but kit-vnext runner must own Forge actions. |
| Open SWE reviewer findings and CI monitor | Copied pattern plus conformance fixtures | Strong product/reference behavior for review and CI evidence; decisions remain `core-05`. |
| Deep Agents Code CLI/headless controls | Adapter spike for Agent driver comparisons | Helps normalize provider behavior; exact CLI/API is beta and should not be a hard dependency. |
| Deep Agents Code remote sandbox providers | Copied pattern for Execution Host stories | The "sandbox as tool" model informs remote-host design; production powers still need attestations. |
| Deep Agents Code threat model | Direct fixture source | Convert named risks into negative probes and security conformance cases. |
| LangSmith traces from either project | Optional export/import adapter later | Useful diagnostics, but never authoritative state or required evidence. |

## Source-level fit notes

`AgentProvider` fit:

- Open SWE shows useful async operations: deterministic source-to-thread mapping, busy-thread
  follow-up queues, main/reviewer/analyzer graph separation, and provider-side model/tool middleware.
  These map to mock `AgentEvent` streams and possibly future driver behavior. They do not replace
  `AgentProvider` because kit-vnext requires normalized `linked`, `approval-requested`,
  `tool-observed`, `guardian-review`, `degraded`, and `terminal` events with fresh capability
  attestations.
- Deep Agents Code maps more directly to a coding-agent adapter surface because it has interactive
  and headless operation, session resume, approval controls, shell/tool observations, and a streaming
  client/server split. It is still provider-side only: its SQLite checkpoints, memories, skills, and
  trace state cannot satisfy kit-vnext event-log or gate requirements.

`ExecutionHostProvider` fit:

- Open SWE's sandbox matrix and sandbox identity reuse are good fixtures for remote host attach,
  reconnect, eviction, and recreation. Local no-isolation mode must be a negative or dev-only case.
- Deep Agents Code's "agent loop local, tools remote" model is useful but awkward for kit-vnext: the
  Host seam owns worker process containment and runner-owned command capture. If the agent loop is
  local while commands run remote, the adapter must prove which process tree is killable, where
  credentials are injected, how command output is captured, and whether egress confinement is real.

`ForgeProvider` fit:

- Open SWE is the stronger source. Its GitHub App, proxy-token, review-thread, and CI monitor
  patterns map to `provider-github` stories for scoped credentials, thread inspection, exact-head
  evidence, stale PR head handling, webhook gaps, and conflict sweeps.
- The conflict is structural: Open SWE's agent can commit, push, open/update PRs, and reply in source
  channels. Kit-vnext must reject that as runtime authority. Any reuse must move those actions behind
  runner-owned Forge calls and `expectedHeadSha`.

`WorkSourceProvider` fit:

- Open SWE trigger normalization can inform external trigger adapters, but Work Source remains task
  status authority. Slack/Linear/GitHub events can propose work, append comments, or map to task
  source records; LangGraph thread metadata cannot become task claim/status state.

`core-05`, `core-06`, and `core-07` fit:

- Reviewer findings, CI monitor fallback, stale-head handling, and analyzer-style reports become
  evidence and issue patterns. They do not become adjudicators.
- Recovery should copy scenarios: sandbox lost, reviewer thread missing, CI webhook missed, merge
  conflict found only by sweep, busy thread with queued messages, stale run head, and ambiguous
  provider terminal.
- Observability should copy UX and report shape: trace links, config-source reporting, thread lists,
  reviewer-finding summaries, CI sweep notes, and honest degraded-state explanations.

## Required kit-vnext stories

1. `agent-provider-coding-fixtures`
   Add testkit fixtures for coding-agent event streams from Open SWE and Deep Agents Code patterns:
   queued follow-up, approval requested then channel lost, persisted answer channel, resume owned,
   missing structured exit code, ambiguous terminal, provider lost, host lost, and headless timeout.

2. `agent-provider-deepagents-code-spike`
   Research-only adapter spike after `seam-agent-contract-mock`. Map current Deep Agents Code
   behavior to `AgentProvider` capabilities and return a compatibility matrix. No production
   dependency and no runtime adoption.

3. `execution-host-sandbox-fixtures`
   Add host conformance fixtures for remote sandbox attach/reuse, sandbox id stale or unreachable,
   cwd outside mount, setup script failure, command output capture, command digest, egress negative
   probe, termination unproven, and credential material destruction.

4. `github-forge-open-swe-evidence-spike`
   Use Open SWE source as comparison input for GitHub App permissions, token proxying, review-thread
   collection, finding reconciliation, CI webhook fallback, conflict sweep, and exact-head refusal.
   Output provider-github story criteria and mock scenarios.

5. `reviewer-ci-monitor-fixture-pack`
   Add core/provider fixtures for unresolved review threads, human replies requiring reassessment,
   resolved/dismissed findings, finding cap/severity ordering, CI webhook missing, check failure,
   merge conflict, and agent-authored PR detection. `core-05` still decides from committed evidence.

6. `deepagents-code-threat-fixtures`
   Convert the Deep Agents Code threat model into negative probes: unauthenticated localhost server,
   checkpoint tampering, MCP subprocess env exposure, hook subprocess leakage, arbitrary `class_path`,
   project MCP trust, web/fetch prompt injection, broad shell allow-list, and sandbox provider spoofing.

7. `ops-ux-diagnostics-reference`
   After `core-07` and `edge-01`, use both projects to shape reports and commands: JSON status
   envelopes, dry-run destructive operations, config provenance, thread/run listing, trace links,
   reviewer finding summaries, and CI monitor notes. These reports must be projections over the
   kit-vnext event log and redacted artifacts.

## Risks and constraints

- Runtime drift: both projects are moving quickly. Open SWE has no stable published release surface in
  the first-pass report, and Deep Agents Code is beta/rapidly iterating. Pin exact commits/versions for
  any fixture extraction.
- Architecture drift: adopting LangGraph checkpoints or Deep Agents Code SQLite sessions as run truth
  would violate the event-log invariant.
- Worker/runner drift: Open SWE worker-owned PR operations are attractive product behavior but violate
  AD-12. Reuse only through runner-owned Forge actions.
- Capability inflation: documented sandbox support, CLI flags, or source comments are not capability
  attestations. Live powers still require fresh positive `CapabilityAttestation` records in the exact
  driver/platform/freshness scope.
- Credential and egress risk: MCP servers, observability tools, sandbox provider credentials, shell
  allow-lists, web fetch, hooks, and arbitrary provider loading need negative probes and redaction
  fixtures before use.
- State fragmentation: Open SWE spreads useful state across LangGraph threads, stores, metadata,
  sandbox state, GitHub, Slack, Linear, and LangSmith. Kit-vnext must convert only selected facts into
  event-log evidence and artifact refs.
- Product scope risk: Slack, Linear, dashboards, analyzer learning, and CI autofix are useful, but v1
  should keep manual/assisted modes and core correctness ahead of broad autonomous operations.

## Recommended verdict

Use Open SWE and Deep Agents Code aggressively as source-level prior art for stories, adapters, and
fixtures, but do not adopt either as a runtime dependency.

The best near-term action is to create a small "coding-agent operations fixture pack" after the SDK
provider ports and testkit mocks are underway. That pack should extract provider-neutral scenarios
from current Open SWE and Deep Agents Code sources and express them as mock Agent, Host, Forge, Work
Source, `core-05`, `core-06`, and `core-07` tests. Production driver work can then prove real Codex,
GitHub, and local/remote host behavior against those fixtures with fresh capability attestations.

Direct runtime adoption should remain a no-go unless a future adapter can satisfy kit-vnext ports
without owning orchestration, state, approval, verification, Forge credentials, or merge decisions.

## Sources

- Local first-pass synthesis:
  [LangChain unified report](../../langchain-review/UNIFIED-REPORT.md),
  [Open SWE project report](../../langchain-review/project-reports/open-swe.md),
  [Open SWE adoption report](../../langchain-review/adoption-reports/open-swe-adoption.md),
  [Deep Agents Code project report](../../langchain-review/project-reports/deep-agents-code.md),
  [Deep Agents Code adoption report](../../langchain-review/adoption-reports/deep-agents-code-adoption.md).
- kit-vnext design:
  [provider ports](../../../../docs/design/20-sdk-and-packaging/provider-ports.md),
  [Agent Execution](../../../../docs/design/30-domain-reference/providers/agent-execution/README.md),
  [Execution Host](../../../../docs/design/30-domain-reference/providers/execution-host/README.md),
  [Forge Collaboration](../../../../docs/design/30-domain-reference/providers/forge-collaboration/README.md),
  [Work Source](../../../../docs/design/30-domain-reference/providers/work-source/README.md),
  [Completion and Merge](../../../../docs/design/30-domain-reference/core/completion-and-merge/README.md),
  [Recovery and Reconciliation](../../../../docs/design/30-domain-reference/core/recovery-and-reconciliation/README.md),
  [Observability and Analysis](../../../../docs/design/30-domain-reference/core/observability-and-analysis/README.md),
  [domain DAG](../../../../docs/implementation/domain-dag.md),
  [readiness matrix](../../../../docs/implementation/readiness-matrix.md).
- Current Open SWE primary sources:
  [repository README](https://github.com/langchain-ai/open-swe),
  [langgraph.json](https://raw.githubusercontent.com/langchain-ai/open-swe/main/langgraph.json),
  [thread helpers](https://raw.githubusercontent.com/langchain-ai/open-swe/main/agent/utils/thread_ops.py),
  [reviewer findings](https://raw.githubusercontent.com/langchain-ai/open-swe/main/agent/reviewer_findings.py),
  [CI monitor](https://raw.githubusercontent.com/langchain-ai/open-swe/main/agent/ci_monitor.py).
- Current Deep Agents Code primary sources:
  [overview](https://docs.langchain.com/oss/python/deepagents/code/overview),
  [remote sandboxes](https://docs.langchain.com/oss/python/deepagents/code/remote-sandboxes),
  [architecture note](https://raw.githubusercontent.com/langchain-ai/deepagents/main/libs/code/ARCHITECTURE.md),
  [threat model](https://raw.githubusercontent.com/langchain-ai/deepagents/main/libs/code/THREAT_MODEL.md).

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../README.md) · **← Prev:** [AgentProvider acceleration](./agent-provider-acceleration.md) · **Next →:** [Durable execution and tests](./durable-execution-tests.md)

<!-- /DOCS-NAV -->
