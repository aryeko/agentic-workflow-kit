---
title: AWK09 detailed technical story spec
owner: codex-2026-06-13T23-54-50Z
last-reviewed: 2026-06-14
related:
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK09.md
  - ../../prds/agentic-workflow-kit-redesign/README.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution/05-api-surface.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution/04-ai-observability-operations.md
---

# AWK09 detailed technical story spec

## Source story brief

`docs/tracks/agentic-workflow-kit-redesign/stories/AWK09.md`

## Decisions resolved from the story brief

| Question | Decision | Rationale |
| --- | --- | --- |
| Does the MCP SDK surface support custom notifications in this server path? | Standard `notifications/progress` is required for `workflow_run_stream`; structured `notifications/workflow_event` is best-effort and must be guarded behind the tool callback `extra.sendNotification` path. | The installed SDK exposes `RequestHandlerExtra.sendNotification(...)` and examples use it for progress. The default `McpServer` tool callback is typed to `ServerNotification`, so custom notifications need explicit typed/generic plumbing or a narrow internal cast. V1 can meet liveness with standard progress and still return replayed events in the final response. |
| What default stream replay/tail limit should V1 use? | Default replay tail is 20 events, maximum accepted replay/tail is 200 events, default poll interval is 1000 ms, default throttle is 2000 ms, and default max stream duration is 300000 ms. | This matches the API-surface example, keeps MCP responses bounded, and prevents long-lived calls from hanging forever when a run never reaches terminal state. |

## Exact types/contracts

Add product operations to `packages/orchestrator/src/api/facade.ts`:

```ts
type WorkflowApiOperation =
  | existing operations
  | "workflow_run_status"
  | "workflow_run_stream"
  | "workflow_run_inspect";

interface WorkflowRunStatusInput extends CliOverrides {
  runId?: string;
  runPath?: string;
  events?: WorkflowRunEventQuery;
}

interface WorkflowRunStreamInput extends CliOverrides {
  runId?: string;
  runPath?: string;
  subscription?: WorkflowRunStreamSubscription;
}

interface WorkflowRunInspectInput extends CliOverrides {
  runId?: string;
  runPath?: string;
  include?: "summary" | "artifacts" | "children" | "full-bounded";
}

interface WorkflowRunEventQuery {
  limit?: number;
  topics?: WorkflowRunEventTopic[];
  storyIds?: string[];
  minLevel?: WorkflowRunEventLevel;
}

interface WorkflowRunStreamSubscription extends WorkflowRunEventQuery {
  includeData?: "none" | "summary" | "full-bounded";
  replay?: { lastEvents?: number };
  throttleMs?: number;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

type WorkflowRunEventTopic =
  | "run"
  | "tracker"
  | "story"
  | "child"
  | "review"
  | "pr"
  | "merge"
  | "budget"
  | "control"
  | "error"
  | "debug";

type WorkflowRunEventLevel = "debug" | "info" | "warn" | "error";
```

Add handler-level contracts to `packages/orchestrator/src/commands/handlers.ts`:

```ts
interface RunEventRecord {
  id: string;
  recordedAt: string | null;
  eventAt: string | null;
  type: string;
  topic: WorkflowRunEventTopic;
  level: WorkflowRunEventLevel;
  message: string;
  storyId: string | null;
  childId: string | null;
  data?: Record<string, unknown>;
}

interface WorkflowRunStatusResult {
  runId: string;
  status: string | null;
  active: string[];
  completedCount: number;
  blockedStoryId: string | null;
  blockedReason: string | null;
  controls: RunControlRequest[];
  artifacts: Record<string, string>;
  metrics: unknown | null;
  recentEvents: RunEventRecord[];
}

interface WorkflowRunStreamResult {
  runId: string;
  terminal: boolean;
  status: string | null;
  eventsDelivered: number;
  timedOut: boolean;
  events: RunEventRecord[];
}

interface WorkflowRunInspectResult {
  runId: string;
  status: string | null;
  artifactDir: string;
  artifacts: Array<{ kind: string; path: string; exists: boolean; sizeBytes: number | null }>;
  children: Array<{ storyId: string; launchPath: string | null; resultPath: string | null; sessionId: string | null; sessionLogPath: string | null }>;
  pr: { urls: string[]; numbers: number[] };
  metrics: unknown | null;
}
```

Run id/path resolution:

- If `runPath` is supplied, resolve it directly.
- If `runId` is supplied, resolve `<config.artifacts.runsDirAbs>/<runId>`.
- If neither is supplied, fail with `RUN_NOT_FOUND`.
- Resolved run directories must stay under `config.artifacts.runsDirAbs` unless an absolute `runPath` was explicitly supplied for backward compatibility with existing `watch_run`.

Bounds:

- Default event limit: 25 for status, 20 for stream replay.
- Maximum event limit: 200.
- Maximum serialized event data per event: 20000 bytes when `includeData` is `full-bounded`; summary mode keeps scalar fields plus artifact/session refs only.
- Inspect must list artifact refs and child/session refs, not copy full transcripts.

## Exact files/modules

```text
packages/orchestrator/src/types.ts  Add WorkflowCommand variants for run status, run stream, run inspect and reusable stream/status input fields.
packages/orchestrator/src/commands/handlers.ts  Add runStatusHandler, runStreamHandler, runInspectHandler, event normalization, event filtering, run-id resolution, and bounded artifact listing.
packages/orchestrator/src/api/facade.ts  Add workflow_run_status, workflow_run_stream, workflow_run_inspect envelopes and set project capability streaming true.
packages/orchestrator/src/mcp/tools.ts  Register workflow_run_status, workflow_run_stream, workflow_run_inspect and read-only MCP resources for project/config/tracks/runs state.
packages/orchestrator/src/mcp/server.ts  No behavioral change unless resource registration needs server-level imports.
packages/orchestrator/src/cli/args.ts  Parse product CLI commands: run status, run stream, run inspect.
packages/orchestrator/src/cli.ts  Print JSON envelopes for product commands and NDJSON for stream when requested.
packages/orchestrator/tests/mcp-server.test.ts  Cover tool registration, status/inspect responses, stream replay/progress behavior, and bounds.
packages/orchestrator/tests/cli.test.ts  Cover CLI parsing/output for run status, run stream, and run inspect.
packages/orchestrator/tests/handlers.test.ts  Cover event normalization/filtering/run-id resolution if existing tests are a better fit than CLI/MCP tests.
docs/architecture.md  Update the API surface description from future tense to shipped status/stream/inspect behavior.
docs/getting-started.md  Add concise operator examples for status/stream/inspect.
```

## Query/schema/prompt/event/component design

No database, prompt, or UI changes.

Event normalization maps current `events.ndjson` rows into public topics:

- `run-started`, `run-complete`, `run-blocked`, `run-aborted`, `run_started`, `final_verification_passed` -> `run`
- `tracker-*`, `story-claimed`, `story_selected`, `claimed`, `plan_written`, `spec_written` -> `tracker` or `story`
- `child-*`, `session-*`, `codex-*` -> `child`
- `pre_pr_review_*` -> `review`
- `pr_*`, `pr-checks-*` -> `pr`
- `merge-*`, `pr_merged`, `cleanup_complete` -> `merge`
- `budget-*`, `tokens-observed` -> `budget`
- `control-*` -> `control`
- event types containing `error`, `failed`, or `blocked` with no better topic -> `error`

`workflow_run_status`:

- reads `state.json`, `metrics.live.json`, `controls.ndjson`, and bounded event tail;
- returns the shared envelope through the product facade;
- does not wait or mutate.

`workflow_run_stream`:

- first replays a bounded tail matching filters;
- when invoked through MCP, emits standard `notifications/progress` if the incoming request has a progress token;
- polls `events.ndjson` until terminal state, client abort, or timeout;
- returns delivered normalized events in the final bounded envelope so clients without notification support still get useful output;
- does not replace `watch_run`, `watch_run_start`, or `watch_run_poll`.

`workflow_run_inspect`:

- returns a bounded artifact/session/PR index from the run directory;
- includes child launch/result refs and transcript paths where present;
- does not generate analyzer reports, export bundles, or copy transcript contents.

MCP resources:

- `workflow://project/context`
- `workflow://config/resolved`
- `workflow://tracks`
- `workflow://tracks/{trackId}`
- `workflow://runs/{runId}/state`
- `workflow://runs/{runId}/events`

Resources are read-only and bounded. If resource templates are too large for this story, ship the first three static resources plus run state/events as direct resources with tests; leave report resources to AWK10.

CLI:

- `agentic-workflow-kit run status <runId-or-path> [--json] [--limit N]`
- `agentic-workflow-kit run stream <runId-or-path> [--format ndjson|json] [--limit N] [--timeout-ms N]`
- `agentic-workflow-kit run inspect <runId-or-path> [--json]`

Preserve legacy `watch-run` and `analyze-run`.

## Tests

- `packages/orchestrator/tests/mcp-server.test.ts`
  - tool list includes `workflow_run_status`, `workflow_run_stream`, `workflow_run_inspect`;
  - `workflow_project_inspect` returns `capabilities.streaming: true`;
  - status reads state/metrics/control/recent events through a product envelope;
  - stream replays bounded events and returns `eventsDelivered`;
  - stream sends progress notifications when the MCP callback receives a progress token;
  - inspect returns artifact refs and child session refs without transcript bodies.
- `packages/orchestrator/tests/cli.test.ts`
  - parse and run `run status`, `run stream`, and `run inspect`;
  - stream NDJSON mode emits one JSON object per event plus a final summary;
  - missing run ids set a nonzero exit code through a `RUN_NOT_FOUND` envelope.
- Focused command:

```bash
pnpm vitest run packages/orchestrator/tests/mcp-server.test.ts packages/orchestrator/tests/cli.test.ts
```

- Full configured gate:

```bash
pnpm check
```

## Migration/deploy concerns

No migrations or hosted deploy work. The change is additive and must preserve all existing legacy CLI/MCP tools, artifact file names, and analyzer compatibility. Existing run artifacts may omit controls, metrics, children, or summary files; status/inspect must return `null`, empty arrays, or missing artifact refs rather than failing unrelated reads.

Public behavior changes require updating canonical docs in this PR. Per repo convention, delete this transient spec and the AWK09 plan before final completion after folding durable content into canonical docs.

## Blocking technical questions

None
