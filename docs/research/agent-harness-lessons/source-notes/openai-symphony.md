# OpenAI Symphony

## Source and access metadata

- Source: OpenAI's public [`openai/symphony`](https://github.com/openai/symphony) repository.
- Commit used: [`4cbe3a9699a73b862466c0b157ceca0c1985d6d7`](https://github.com/openai/symphony/tree/4cbe3a9699a73b862466c0b157ceca0c1985d6d7).
- Accessed: 2026-06-22.
- Primary source: [`SPEC.md`](https://github.com/openai/symphony/blob/4cbe3a9699a73b862466c0b157ceca0c1985d6d7/SPEC.md).
- Supporting sources: [`README.md`](https://github.com/openai/symphony/blob/4cbe3a9699a73b862466c0b157ceca0c1985d6d7/README.md), [`elixir/README.md`](https://github.com/openai/symphony/blob/4cbe3a9699a73b862466c0b157ceca0c1985d6d7/elixir/README.md), [`elixir/WORKFLOW.md`](https://github.com/openai/symphony/blob/4cbe3a9699a73b862466c0b157ceca0c1985d6d7/elixir/WORKFLOW.md).
- Implementation sources sampled: [`orchestrator.ex`](https://github.com/openai/symphony/blob/4cbe3a9699a73b862466c0b157ceca0c1985d6d7/elixir/lib/symphony_elixir/orchestrator.ex), [`agent_runner.ex`](https://github.com/openai/symphony/blob/4cbe3a9699a73b862466c0b157ceca0c1985d6d7/elixir/lib/symphony_elixir/agent_runner.ex), [`workspace.ex`](https://github.com/openai/symphony/blob/4cbe3a9699a73b862466c0b157ceca0c1985d6d7/elixir/lib/symphony_elixir/workspace.ex), [`workflow_store.ex`](https://github.com/openai/symphony/blob/4cbe3a9699a73b862466c0b157ceca0c1985d6d7/elixir/lib/symphony_elixir/workflow_store.ex), [`codex/app_server.ex`](https://github.com/openai/symphony/blob/4cbe3a9699a73b862466c0b157ceca0c1985d6d7/elixir/lib/symphony_elixir/codex/app_server.ex), [`codex/dynamic_tool.ex`](https://github.com/openai/symphony/blob/4cbe3a9699a73b862466c0b157ceca0c1985d6d7/elixir/lib/symphony_elixir/codex/dynamic_tool.ex).
- Observability sources sampled: [`docs/logging.md`](https://github.com/openai/symphony/blob/4cbe3a9699a73b862466c0b157ceca0c1985d6d7/elixir/docs/logging.md), [`docs/token_accounting.md`](https://github.com/openai/symphony/blob/4cbe3a9699a73b862466c0b157ceca0c1985d6d7/elixir/docs/token_accounting.md).

## Main guidelines

- Symphony defines a long-running service that polls an issue tracker, creates or reuses one isolated workspace per issue, and runs a coding-agent session inside that workspace.
- The README frames the user benefit as managing work rather than supervising agents; proof of work can include CI state, PR feedback, complexity review, and walkthrough media.
- The service is deliberately a scheduler, runner, and tracker reader. Tracker writes such as comments, status transitions, and PR links are usually performed by the worker through workflow prompt/tooling.
- `WORKFLOW.md` is the repository-owned contract: YAML front matter config plus a Markdown prompt template.
- Runtime policy lives with the repo: tracker config, active/terminal states, labels, polling, workspace root, hooks, agent limits, retry cap, Codex command, sandbox policy, and prompt.
- The orchestrator owns scheduling state; workers report outcomes and Codex events back to it.
- Reconciliation runs before dispatch so external tracker state can stop stale work.
- Observability is required at least through structured logs; dashboards and HTTP APIs are optional status surfaces.
- Implementations must document their trust, approval, sandbox, and operator-confirmation posture.

## Assumptions and operating model

- The spec version is Linear-oriented (`tracker.kind: linear`) and normalizes issue data before orchestration, prompt rendering, and observability.
- Codex app-server is the assumed agent protocol; Symphony treats the targeted Codex app-server schema as the source of truth for protocol details.
- Work normally runs on the local filesystem, with an optional SSH worker extension. In both cases the central orchestrator owns polling, claims, retries, and reconciliation.
- Workspaces persist after successful runs and are reused by issue identifier; VCS checkout/sync is implementation-defined and commonly delegated to hooks.
- Scheduler state is intentionally in-memory. Restart recovery comes from tracker polling and preserved workspaces, not from restored workers, retry timers, or session metadata.
- Operators control the system by editing `WORKFLOW.md`, changing tracker states, or restarting the process; most workflow changes should reload without restart.
- The public README calls Symphony an engineering preview for trusted environments; the Elixir README calls the implementation prototype software for evaluation.

## Service problem statement

- The spec targets four operational problems: replacing manual dispatch scripts with a daemon, isolating agent execution per issue, versioning workflow policy in-repo, and exposing enough runtime state to debug concurrent runs.
- A successful worker run does not necessarily mean an issue is terminal; it can mean the workflow reached a handoff state such as human review.
- This is a useful distinction: the control service can be deterministic while the work source remains the status authority.

## `WORKFLOW.md` repository contract

- Discovery order is explicit runtime path first, then `WORKFLOW.md` in the process working directory.
- The file may have YAML front matter; without it, the full file is the prompt body and config is empty.
- YAML front matter must decode to a map. Missing, malformed, or non-map workflow files produce typed errors.
- Unknown front matter keys are ignored for forward compatibility; extensions should document schemas, defaults, validation, and reload behavior.
- The prompt template is strict: unknown variables and filters fail rendering rather than silently weakening the task.
- Template inputs include the normalized `issue` object and optional `attempt`, so the prompt can branch for first attempts, retries, and continuations.
- The reference `elixir/WORKFLOW.md` shows a full agent contract: status routing, workpad discipline, PR feedback sweeps, validation, landing, and blocked-access handling.
- That same sample demonstrates risk: it delegates broad issue mutation, PR handling, and merge-flow decisions to the worker prompt/tooling.

## Scheduler, runner, and state model

- The scheduler claims eligible issues, starts workers, receives worker/Codex events, schedules retries, and terminates runs when tracker state changes.
- The runner creates the workspace, runs hooks, builds the prompt, starts Codex app-server, forwards app-server events, and fails the attempt on runner-level errors.
- A worker can run multiple back-to-back Codex turns in one live thread. After each turn it refreshes tracker state and continues if the issue is still active, routable, and below `agent.max_turns`.
- After normal worker exit, the orchestrator schedules a short continuation retry to re-check whether the active issue still needs another session.
- Core entities are normalized issue, workflow definition, typed service config, workspace, run attempt, live session, retry entry, and orchestrator runtime state.
- Internal orchestration states are separate from tracker states: unclaimed, claimed, running, retry queued, and released.
- `running`, `claimed`, and `retry_attempts` are the key authority maps; `completed` is bookkeeping and not a dispatch gate.
- Live session metadata tracks thread/turn IDs, composed session ID, app-server PID, last event/message/timestamp, token counters, rate limits, and turn count.
- The Elixir implementation adds `blocked` state for approval or operator-input requirements, but its README notes blocked entries are in memory only and restart clears them.

## Issue and tracker model

- Candidate issues require stable ID, human identifier, title, and state.
- Active and terminal states are workflow-configured and compared after normalization.
- Required labels are normalized; every configured label must be present for dispatch or continuation.
- `Todo` issues with non-terminal blockers are not eligible.
- Dispatch ordering is deterministic: priority first, oldest creation time second, identifier tie-breaker third.
- Tracker failures are non-fatal: candidate-fetch failure skips the tick, state-refresh failure keeps workers running, and startup cleanup failure logs and continues.
- Linear details are isolated behind an adapter so non-Linear trackers can preserve normalized outputs without copying Linear GraphQL mechanics.
- First-class tracker writes are a non-goal; even the optional `linear_graphql` tool remains part of the worker toolchain, not orchestrator business logic.

## Workspace isolation and hooks

- Workspace keys are sanitized from issue identifiers with only `[A-Za-z0-9._-]` allowed.
- The per-issue workspace path must stay under `workspace.root`.
- The Codex subprocess cwd must be the per-issue workspace, not the root or an arbitrary repo path.
- The Elixir implementation canonicalizes local paths to catch symlink escapes before launching Codex.
- Existing workspaces are reused; successful runs do not auto-delete them.
- Terminal state cleanup happens during startup sweep and active-run reconciliation.
- Supported hooks are `after_create`, `before_run`, `after_run`, and `before_remove`.
- Hooks run as shell scripts with workspace cwd and a shared timeout.
- `after_create` and `before_run` failures are fatal to setup/current attempt; `after_run` and `before_remove` failures are logged and ignored.
- Hooks are trusted configuration. The bundled workflow uses hooks to clone the repo, install dependencies, and run cleanup before workspace removal.

## Retry, backoff, and reconciliation

- Normal continuation retries use a short fixed delay around one second.
- Failure retries use exponential backoff with a 10 second base and configurable cap, defaulting to five minutes.
- Scheduling a retry cancels any prior retry for that issue and records attempt, identifier, due time, and error context.
- Retry handling refetches active candidates and releases the claim if the issue is missing or no longer eligible.
- Reconciliation includes stall detection based on last Codex activity or start time, then tracker state refresh.
- Terminal state stops the worker and cleans workspace; non-active non-terminal state stops the worker without cleanup; active state refreshes the running snapshot.
- Config validation failure blocks new dispatch but keeps reconciliation running, which is a good fail-closed shape.

## Dynamic reload

- The spec requires detecting `WORKFLOW.md` changes and reapplying config/prompt without restart.
- Reloaded config applies to future dispatch, retry scheduling, reconciliation decisions, hooks, and agent launches.
- In-flight sessions do not have to restart automatically on config changes.
- Invalid reloads must keep the last known good config and emit an operator-visible error.
- The Elixir implementation polls workflow file stamp/content hash and serves the cached last-known-good workflow when reload fails.

## Agent runner and Codex integration

- Codex app-server is launched via `bash -lc <codex.command>` with cwd set to the workspace.
- Thread start passes approval policy, thread sandbox, cwd, and advertised dynamic tools.
- Turn start passes prompt, cwd, issue-derived title, approval policy, and turn sandbox policy.
- The runner extracts thread and turn IDs for session identity and observability.
- Approval and user-input events must not stall indefinitely; implementations may approve, surface to an operator, auto-resolve, or fail according to documented policy.
- The Elixir defaults are safer reject-style approval settings when omitted, but the bundled workflow example sets `approval_policy: never`, workspace-write sandboxing, and network-enabled turns.
- Unsupported dynamic tool calls return structured failure instead of blocking the turn.
- The optional `linear_graphql` tool executes one raw Linear GraphQL operation using Symphony's configured tracker auth and returns structured success/failure output.

## Observability

- Required issue log context is issue ID plus human issue identifier; Codex lifecycle logs also include session ID.
- Logs should use stable `key=value` phrasing with action outcome and concise error reason.
- Runtime snapshots, dashboards, and HTTP APIs are optional but recommended.
- The optional HTTP surface includes state, per-issue inspection, and a refresh trigger with structured JSON errors.
- Token accounting prefers absolute thread totals and avoids double-counting delta-style token usage.
- Generic `usage` fields are interpreted by event type/path rather than by field name alone.
- Human-readable event summaries are observability only and should not drive scheduler logic.

## Failure modes and anti-patterns

- Treating worker self-report as completion proof instead of requiring external evidence.
- Letting tracker writes hide in prompt/tool behavior without explicit authority boundaries.
- Assuming restart is durable recovery; retry timers, live sessions, and blocked state are not restored.
- Treating workspace path checks as a full security boundary.
- Combining permissive Codex policy, network access, raw tracker mutation tools, and untrusted tracker/repo content.
- Treating hooks as casual config rather than privileged shell.
- Making dashboard state correctness-critical.
- Silently falling back after workflow parse failures.

## Practices worth copying

- Version the work contract with the repository, but parse it strictly and surface typed errors.
- Keep scheduler mutations behind one authority and make claims explicit.
- Reconcile work-source state before dispatch.
- Keep scheduler/runner responsibilities separate from tracker write behavior.
- Enforce workspace cwd and root-containment checks before agent launch.
- Preserve workspaces across attempts so retries can resume from local context.
- Use last-known-good dynamic reload instead of crashing or accepting broken config.
- Specify failure classes and recovery behavior in design, not only code.
- Build observability around stable IDs, session IDs, retry state, token totals, and rate limits.
- Publish a conformance matrix covering workflow parsing, workspace safety, tracker normalization, dispatch/retry/reconciliation, app-server behavior, observability, and host lifecycle.

## Relevance to kit-vnext

- Symphony supports kit-vnext's premise: deterministic code can orchestrate bounded agent workers without an LLM orchestrator.
- The scheduler/runner/tracker-reader boundary maps well to kit-vnext seams, but kit-vnext should keep Worker/Runner isolation stricter: workers edit/commit, runners hold forge credentials and publish/merge.
- `WORKFLOW.md` is a useful repo-owned execution contract pattern, but it must not override design-owned invariants or gate policy.
- Symphony's state shape is useful, but kit-vnext needs an append-only event log and projections rather than volatile scheduler memory.
- Symphony's tracker write boundary reinforces kit-vnext's two-authorities rule: task status belongs to the work source, run activity belongs to the event log.
- Dynamic reload is attractive, but kit-vnext should tie reloads to versioned config events, capability attestation, and fail-closed gate updates.
- `linear_graphql` is flexible but broad. kit-vnext should prefer narrow Work Source operations over raw tracker access in worker sessions.
- Operator-visible blocked state is worth copying, but it should be durable.

## Source-backed caveats

- `SPEC.md` is draft v1 and language-agnostic.
- The repo README describes Symphony as a low-key engineering preview for trusted environments.
- The Elixir README describes the implementation as prototype software for evaluation and recommends hardened implementations from the spec.
- Core conformance is currently Linear and Codex app-server oriented.
- The spec intentionally does not mandate one approval, sandbox, or operator-confirmation policy.
- The bundled workflow uses high-trust settings that are poor kit-vnext defaults: no-approval style policy, workspace-write sandbox, and network-enabled turns.
- Runtime durability is limited: retry queue, live worker/session state, and blocked entries are not restored after restart.
- Workspace population, VCS sync, and destructive reset policy are implementation-defined.
- Hooks and `linear_graphql` can mutate important external state and should be treated as privileged integration surfaces.
- The spec warns not to assume tracker data, repo contents, prompt inputs, or tool arguments are trustworthy just because they come from a normal workflow.
