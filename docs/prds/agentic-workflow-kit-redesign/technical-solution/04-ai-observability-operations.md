# AI, observability, and operations

This page covers prompt/driver boundaries, CLI/MCP tools, notifications, event/metric contracts,
rollout, security, and test strategy.

## Prompt boundaries

Workflow prompts remain instruction-first markdown in `skills/`, but generated child prompts should
be treated as runtime API payloads:

- `buildGenericPrompt` continues to assemble story, Git, PR, implementation, and safety policy, but
  it receives an already-resolved agent profile instead of hardcoded defaults.
- Agent profiles select prompt/template, model, reasoning effort, sandbox, approval, host config,
  and structured-output defaults before prompt construction.
- Prompt configuration can reference built-in templates or repo-local template paths. Inline prompt
  overrides are allowed only when schema validation keeps required safety and evidence sections.
- Structured output configuration declares whether the host should request schema-constrained output
  and which schema should be used. Drivers that cannot enforce structured output must record that
  downgrade in child evidence.
- Story briefs must cite PRD criteria and technical solution headings so detailed story specs do
  not invent cross-cutting architecture.
- Review and recovery prompts must include artifact paths and evidence requirements, not only prose
  summaries.
- Incremental pre-PR review loops should preserve reviewer context by reusing the same review
  subagent/thread when a host can continue it. When a host cannot continue a completed reviewer,
  spawning a new read-only reviewer with the incremental packet is an expected fallback, not a
  downgrade, as long as the journal records the continuity mode and a real subagent review result.

## Triggers and tools

V1 triggers are explicit CLI/MCP/user actions:

- define product
- design technical solution
- plan delivery track
- validate/migrate tracker
- dry-run story/eligible stories
- run story
- run track autopilot
- watch/stream/analyze/report
- abort

MCP and CLI should expose the same logical operations through the product API defined in
[API surface](./05-api-surface.md). The operations are:

- project/config/profile inspection
- artifact creation and validation
- tracker validation and migration
- story and track run preview/start
- run status, stream, control, inspect, report, and export

For progress, do not couple parent notifications directly to raw Codex child notifications. The
driver emits normalized run events; the MCP layer encodes subscribed events as standard
`notifications/progress` for liveness and optional custom structured notifications for capable
clients.

## Host behavior

Codex-specific behavior stays inside `CodexMcpStoryRunner`:

- parse `codex/event` notifications
- treat `session_configured` as session linkage/startup acknowledgement
- continue supporting standard MCP progress when present
- capture `structuredContent.threadId`
- launch children in the prepared story worktree cwd
- discover session logs for analysis

The provider-neutral `StoryRunner` contract should expose lifecycle events, result evidence,
metrics, and cancellation without naming Codex event internals.

## Evaluation hooks

V1 does not include a full benchmark harness, but analyzer/report outputs should be compatible with
future evaluation:

- row-level metrics per child/session
- checkpoint details
- transcript links
- behavior summaries
- completion reason
- agent profile used, including prompt/template id and structured-output schema id

## Observability/events/metrics

| Signal | Type | Purpose | Owner/consumer |
| --- | --- | --- | --- |
| `run-started` | event | Establish run id, command, config snapshot, artifact root, and selected agent profiles. | Runner, analyzer, user |
| `tracker-validated` | event | Prove tracker contract and eligibility were checked before execution. | Runtime, delivery planner |
| `story-claimed` | event | Show story ownership transition and claim session. | Runner, recovery |
| `child-launch-requested` | event | Record story id, launch id, expected branch/worktree, agent profile, prompt/template id, structured-output schema id, and prompt hash. | Runner, analyzer |
| `child-session-linked` | event | Link host session id/log path and progress source. | Runner, analyzer, user |
| `child-progress` | event | Capture normalized child progress independent of host-specific notification type. | Runner, stream subscribers |
| `budget-warning` | event | Show budget threshold crossed. | Runner, user |
| `budget-stop` | event | Explain stop-new-launches/checkpoint-stop/abort decision. | Runner, recovery |
| `control-requested` | event | Record user/system abort or future pause/recover request. | Run control service |
| `control-applied` | event | Prove control affected runner and/or child session. | Run control service, user |
| `verification-recorded` | event | Capture command, phase, status, and evidence. | Runner, analyzer |
| `pre-pr-review-*` | event family | Capture local review mode, loops, findings, and fix batches. | Analyzer, reviewer |
| `pr-review-*` | event family | Capture GitHub bot/human review findings, replies, and resolution. | Analyzer, maintainer |
| `pr-checks-*` | event family | Capture CI check wait/result evidence. | Analyzer, maintainer |
| `merge-*` | event family | Capture merge and branch cleanup evidence. | Analyzer, maintainer |
| `run-complete` / `run-blocked` / `run-aborted` | event | Terminal outcome. | User, analyzer, reports |
| `tokens-observed` | metric event | Record token fields when host telemetry or transcript parsing makes them available. | Metrics, budget policy |
| `summary.json` | artifact | Stable machine-readable run summary. | CLI/MCP, future UI/eval |
| `rows.json` | artifact | Child/session rows for analysis and reports. | Analyzer, future eval |
| `report.md` | artifact | Human-readable run explanation. | User, reviewer |

Realtime CLI/MCP status reads from `state.json`, `metrics.live.json`, `events.ndjson`, and control
state. Streaming/subscription follows the normalized run event stream and applies config/tool-call
filters for topic, level, story id, and data inclusion.

Local pre-PR review events should include review-loop continuity fields when available:
`loop`, `agentId`, `previousAgentId`, and `continuityMode`. Supported continuity modes are
`reused-agent`, `new-agent-incremental-context`, and `full-context`. Analyzer and report surfaces
should distinguish an execution downgrade from a host fallback that still produced a real subagent
review.

## Notification model

Runtime events have three consumers with different payload needs:

| Consumer | Transport | Payload | Purpose |
| --- | --- | --- | --- |
| Durable artifacts | `events.ndjson`, `metrics.live.json`, `summary.json` | Full normalized event rows, bounded data, metrics snapshots | Reconstruction, reports, future UI/eval |
| Watch/status calls | CLI/MCP request/response | Latest state plus recent bounded events | Manual polling fallback and quick inspection |
| Streaming subscribers | MCP long-lived request notifications | Filtered progress and optional structured event data | Live orchestration without manual polling |

Subscription filters should be dynamic per request and constrained by config defaults:

```yaml
stream:
  topics: [run, story, child, pr, merge, budget, error]
  minLevel: info
  includeData: summary
  storyIds: []
  throttleMs: 2000
```

`includeData` should support at least `none`, `summary`, and `full-bounded`. The default should be
`summary` so orchestrating sessions get useful liveness without receiving full child transcripts or
large tool payloads.

## Migration/deploy surfaces

No database migrations or hosted deploy surfaces are required.

Rollout should be compatibility-first:

1. Add schema fields as optional with defaults.
2. Preserve existing artifact names and analyzer compatibility.
3. Add new artifact files without changing the meaning of existing ones.
4. Add new CLI/MCP tools while preserving existing tool names and input behavior.
5. Update `.codex-plugin/`, `.claude-plugin/`, marketplace fixtures, references, presets, and tests
   in the same changes that alter plugin/runtime behavior.
6. Keep root `.mcp.json` and `.codex-plugin/.mcp.json` surface-specific.

Rollback path:

- Existing configs without agent profiles, task bindings, or budgets must continue to parse.
- Existing run artifacts must still analyze.
- If streaming/subscription is unavailable in a host, `watch_run` polling remains a fallback.
- If token telemetry is unavailable, budgets on those dimensions are reported as unenforceable
  instead of failing unrelated runs.

Security and permission boundaries:

- `danger-full-access` and `approvalPolicy: never` remain explicit and visible in launch policy.
- Worktree cwd remains a safety boundary for child writes.
- Abort/control operations must operate only on known run directories and linked child sessions.
- Migration/import must write draft artifacts and validation reports rather than mutating arbitrary
  user docs in place.

## Testing strategy

| Test layer | Scope | Command or gate | PRD/solution coverage |
| --- | --- | --- | --- |
| Config schema tests | Agent profiles, task bindings, prompt defaults, structured-output contracts, budgets, observability config, defaults, generated JSON schema drift. | `pnpm vitest run test/config-schema.test.ts test/config-doc-sync.test.ts` | POL-3, POL-4, POL-5, POL-6, POL-7, OBS-5 |
| Preset tests | Conservative defaults and autonomy presets. | `pnpm vitest run test/presets.test.ts` | POL-1, POL-2, RUN-4, RUN-5 |
| Contract/template tests | PRD, technical solution, tracker, story brief, migration report templates. | Existing docs/template tests plus new migration tests | WF-1..WF-5, TRK-2 |
| Tracker parser/validator tests | Valid/invalid status matrix, dependency validation, actionable diagnostics. | Orchestrator Vitest tests | TRK-1, TRK-3, TRK-4 |
| Migration/import tests | Existing markdown/table backlog to draft tracker and validation report. | Focused migration tests with fixtures | TRK-2 |
| Runner unit tests | Story-level and track-level loops, stop policies, budget policy, abort controls, duplicate launch guard. | Orchestrator Vitest tests | RUN-1..RUN-6, POL-4..POL-6, OBS-2 |
| Driver contract tests | Host-neutral lifecycle, cancellation, metrics/evidence behavior. | Fake `StoryRunner` tests | HC-2, RUN-1, OBS-4 |
| Codex MCP driver tests | `codex/event`, `notifications/progress`, session linkage, worktree cwd, timeouts. | Mock MCP client tests plus smoke where available | HC-1, OBS-1, OBS-4 |
| MCP tool tests | Tool schemas, bounded responses, stream/watch/abort/report behavior. | MCP server tests | OBS-1, OBS-2, OBS-3, OBS-7 |
| Analyzer/report tests | Existing and new artifact shapes, transcript parsing, token fields, summary/report output. | Analyzer fixture tests | OBS-4, OBS-5, OBS-6, FUT-2 |
| GitHub policy tests | Prompt/evidence handling for CI, review findings, merge, branch cleanup. | Prompt snapshot/unit tests and integration-smoke where safe | HC-3, RUN-4, RUN-6 |
| Package/plugin smoke | Published package, Codex plugin fixture, Claude plugin fixture, MCP startup. | `pnpm build`, `pnpm pack:dry-run`, `pnpm smoke:codex-plugin`, `pnpm check` | HC-1, HC-2, workflow surfaces |

Before marking any delivery story complete, run the closest focused test first and `pnpm check`
before handoff. For packaging/protocol changes, also run `pnpm build`, `pnpm pack:dry-run`, and
`pnpm smoke:codex-plugin`.
