← [Back to README](./README.md)

# Acceptance criteria

## Workflow composition (PREFIX `WF`)

| # | Criterion | Designation |
| --- | --- | --- |
| **WF-1** | A user can define a PRD from notes, in-session brainstorming, or existing docs without requiring prior kit artifacts. | **[ship blocker]** |
| **WF-2** | A user can create an HLD / technical solution from a PRD, existing design docs, technical notes, or in-session context. | **[ship blocker]** |
| **WF-3** | A user can plan a track from a PRD plus HLD, from an HLD alone, or from existing design/backlog context when enough scope exists. | **[ship blocker]** |
| **WF-4** | Each workflow step records assumptions and blocking questions instead of forcing section-by-section prompting when context is rich. | **[ship blocker]** |
| **WF-5** | The docs clearly distinguish PRD, HLD, track, story brief, detailed story spec, implementation plan, and runtime artifacts. | **[ship blocker]** |

## Tracker and migration (PREFIX `TRK`)

| # | Criterion | Designation |
| --- | --- | --- |
| **TRK-1** | Runtime execution accepts only trackers that conform to the kit tracker contract. | **[ship blocker]** |
| **TRK-2** | Existing backlogs or custom markdown trackers can be migrated or guided into the kit tracker schema before execution. | **[ship blocker]** |
| **TRK-3** | Invalid trackers produce actionable validation errors that identify missing columns, invalid statuses, ownership issues, or dependency problems. | **[ship blocker]** |
| **TRK-4** | Tracker status remains the source of truth for eligibility and completion. | **[ship blocker]** |

## Runtime autonomy (PREFIX `RUN`)

| # | Criterion | Designation |
| --- | --- | --- |
| **RUN-1** | A user can launch one eligible story and receive either a verified PR/merge or a clear stopped state. | **[ship blocker]** |
| **RUN-2** | A user can launch track-level autopilot that repeatedly dispatches eligible stories until complete, blocked, budget-stopped, or manually aborted. | **[ship blocker]** |
| **RUN-3** | Story-level and track-level modes are both supported; neither mode is required for adopting the other. | **[ship blocker]** |
| **RUN-4** | The runtime supports the configured autonomy ceiling: implement, verify, open PR, wait for CI/review, fix findings, merge, delete branch, and continue to the next story. | **[ship blocker]** |
| **RUN-5** | The runtime can stop before PR creation, before merge, or after PR creation according to preset/config policy. | **[ship blocker]** |
| **RUN-6** | Ambiguous child state, failed verification, review uncertainty, auth failure, merge conflict, stale base, or inconsistent artifacts produce recoverable stopped states. | **[ship blocker]** |

## Safety, policy, and budgets (PREFIX `POL`)

| # | Criterion | Designation |
| --- | --- | --- |
| **POL-1** | New repos default to conservative behavior with dry-run/preflight and explicit approval before non-dry-run launch. | **[ship blocker]** |
| **POL-2** | Presets encode PR creation, CI wait, review wait, merge behavior, branch cleanup, and stop conditions. | **[ship blocker]** |
| **POL-3** | Users can configure named agent profiles with prompt/template defaults, model, reasoning effort, structured output contract, sandbox, approval policy, and host-specific settings. | **[ship blocker]** |
| **POL-4** | Users can configure policy-based budgets per agent profile for wall time, tokens, tool calls, failed tool calls, and cost when available. | **[ship blocker]** |
| **POL-5** | Budget policies can warn, stop launching new work, stop at the next checkpoint, or abort immediately. | **[ship blocker]** |
| **POL-6** | Budget configuration and actual usage are visible in run artifacts and status tools. | **[ship blocker]** |
| **POL-7** | Runtime operations bind logical task types to agent profiles, with safe defaults and per-run overrides that do not require editing generated prompts by hand. | **[ship blocker]** |

## Observability and management (PREFIX `OBS`)

| # | Criterion | Designation |
| --- | --- | --- |
| **OBS-1** | CLI/MCP tools expose realtime run status for parent run, child sessions, subagents, story, phase, latest progress, and blockers. | **[ship blocker]** |
| **OBS-2** | Users can manually abort a run through a supported CLI/MCP control surface. | **[ship blocker]** |
| **OBS-3** | Users can inspect session transcript paths, run artifacts, current outcome, and latest known command/tool activity when available. | **[ship blocker]** |
| **OBS-4** | Every run records wall time, turns, tool calls, failed calls, checkpoints, completion reason, and token breakdowns when host telemetry exposes them. | **[ship blocker]** |
| **OBS-5** | Run artifacts include machine-readable summary data and row-level child/session data suitable for later reports, dashboards, or MCP apps. | **[ship blocker]** |
| **OBS-6** | Human-readable run reports and behavioral analysis are available for completed or stopped runs. | **[target]** |
| **OBS-7** | Runtime progress can be streamed or subscribed to from CLI/MCP without requiring repeated manual polling. | **[target]** |

## Host and collaboration support (PREFIX `HC`)

| # | Criterion | Designation |
| --- | --- | --- |
| **HC-1** | Codex is a fully supported V1 execution host. | **[ship blocker]** |
| **HC-2** | The product defines a provider-neutral driver contract so future Claude or other host adapters do not require redesigning PRD/HLD/track concepts. | **[ship blocker]** |
| **HC-3** | GitHub is the V1 collaboration target for branches, PRs, checks, review comments/reactions, merge, and branch cleanup. | **[ship blocker]** |
| **HC-4** | Non-GitHub providers are documented as future work and are not required for V1 launch. | **[ship blocker]** |

## Evaluation and future surfaces (PREFIX `FUT`)

| # | Criterion | Designation |
| --- | --- | --- |
| **FUT-1** | V1 runtime observability does not require a full repeatable evaluation harness. | **[ship blocker]** |
| **FUT-2** | Artifacts are structured so a later TUI, dashboard, MCP app, or evaluation harness can consume them without reworking the core run model. | **[target]** |

## Ship-blocker summary

All `[ship blocker]` criteria must be met before V1 ships. `[target]` criteria may be deferred when
the implementation leaves a documented path for later delivery.

---
Previous: [07-success-metrics](./07-success-metrics.md) · Next: [09-risks-and-open-questions](./09-risks-and-open-questions.md) · Up: [README](./README.md)
