# Data contracts

V1 is local-first and file-backed. This page captures the config, artifact, metric, and interface
contracts that implementation stories should preserve.

## Data flow

```mermaid
flowchart LR
  Config[".workflow/config.yaml"] --> Resolve["Resolved config"]
  PRD["PRD / technical solution"] --> StoryContext["Story prompt context"]
  Tracker["Tracker README + story briefs"] --> Validate["Validated story graph"]
  Resolve --> Profile["Resolved agent profile"]
  Profile --> Prompt["Prompt payload + output schema"]
  Validate --> RunRequest["Story run request"]
  StoryContext --> Prompt
  RunRequest --> Child["Child session"]
  Prompt --> Child
  Child --> Evidence["Structured result + evidence"]
  Evidence --> Events["events.ndjson"]
  Events --> Metrics["metrics.live.json"]
  Events --> Summary["summary.json / rows.json / report.md"]
  Evidence --> TrackerUpdate["Tracker refresh / completion gate"]
```

## Config schema

Extend `.workflow/config.yaml` and the generated `references/config.schema.json` with these logical
blocks:

```yaml
childSession:
  speed: derive # derive | fast | standard
agents:
  profiles:
    storyImplementer:
      driver: codex-mcp
      model: null
      reasoning: medium
      speed: derive
      approvalPolicy: never
      sandbox: workspace-write
      prompt:
        template: built-in/story-implementer
        variables:
          includeRepoInstructions: true
          includePrPolicy: true
          includeVerificationPolicy: true
      structuredOutput:
        schema: built-in/child-run-result
        required: true
      budget:
        wallMs:
          limit: 7200000
          action: checkpoint-stop
        activeTokens:
          limit: null
          warnAtPercent: 80
          action: stop-new-launches
    prePrReviewer:
      driver: codex-mcp
      model: null
      reasoning: medium
      speed: derive
      prompt:
        template: built-in/pre-pr-reviewer
      structuredOutput:
        schema: built-in/review-result
        required: true
      budget: {}
    planner:
      driver: inline
      prompt:
        template: built-in/planner
      structuredOutput:
        schema: built-in/planning-result
        required: false
      budget: {}
    analyzer:
      driver: inline
      prompt:
        template: built-in/analyzer
      structuredOutput:
        schema: built-in/run-analysis
        required: true
      budget: {}
    recovery:
      driver: inline
      prompt:
        template: built-in/recovery
      structuredOutput:
        schema: built-in/recovery-decision
        required: true
      budget: {}
  bindings:
    implementStory: storyImplementer
    prePrReview: prePrReviewer
    planTrack: planner
    analyzeRun: analyzer
    recoverRun: recovery
observability:
  stream:
    enabled: true
    defaultTopics: [run, story, child, tracker, review, pr, merge, budget, error]
    minLevel: info
    throttleMs: 2000
  reports:
    writeSummaryJson: true
    writeRowsJson: true
    writeMarkdownReport: true
```

Exact field names can change during implementation, but the model must support named agent
profiles, built-in defaults, task bindings, per-run overrides, prompt/template selection,
speed/service-tier policy, structured-output contracts, budget actions, and stream/report policy.
For the Codex driver, the normalized speed policy maps to host config without exposing Codex's raw
service-tier quirks as product concepts: `derive` passes no override, `fast` requests Codex Fast
mode, and `standard` explicitly clears any inherited Fast choice and records the Codex opt-out marker.
Raw `childSession.config` remains available for advanced driver-specific settings, but normalized
speed policy should reject or otherwise make conflicts with raw service-tier keys unambiguous.

## Run artifact shape

Preserve existing artifact compatibility:

```text
.codex/agentic-workflow-kit/runs/<runId>/
  run.json
  config.resolved.json
  state.json
  metrics.live.json
  events.ndjson
  stories.initial.json
  stories/
  children/
```

Add or formalize:

```text
  controls.ndjson              requested abort controls; pause/resume/recovery are future-compatible
  summary.json                 normalized run-level summary
  rows.json                    row-level child/session metrics
  report.md                    human-readable report
  analysis.json                analyzer result, equivalent to detailed analyze output
  transcripts.json             session id/path index; not full transcript copies by default
  budgets.json                 configured vs observed budget outcomes
```

Retention is repo-local. Runtime artifacts remain ignored by completion dirty checks. Runtime
completion writes execution artifacts such as summary, rows, budgets, and transcript indexes.
Report artifacts are written only by explicit report/export operations: `analyze-run` stays
read-only, while report generation writes `analysis.json` and `report.md` deterministically from
current run artifacts. Transcript files stay in host session storage and are referenced by path;
bounded exports do not follow those paths or copy transcript contents by default.

## Metrics fields

Metrics should distinguish:

- wall time and phase durations
- child startup time, active time, no-progress time, and total runtime
- tool calls total, by tool, failed, retried, and error rate
- subagent counts by role/status
- token totals: input, output, reasoning, cache read/write, total, active
- budget limits, warning thresholds, actions taken, and unavailable telemetry fields
- GitHub checkpoints: PR opened, checks passed/failed, review pending/clear/findings, findings
  fixed/replied, merged, branch deleted

When a host cannot expose a field live, the field must be `null` with an explicit unavailable
reason instead of omitted.

## Interface contracts

These are logical contracts for delivery planning. Exact TypeScript names can change during
implementation, but each concept should have schema/tests before runtime behavior depends on it.

```ts
type AgentTaskType =
  | "implementStory"
  | "prePrReview"
  | "planTrack"
  | "analyzeRun"
  | "recoverRun"
  | "migrateTracker";

interface AgentProfile {
  driver: "codex-mcp" | "inline";
  model?: string | null;
  reasoning?: "low" | "medium" | "high" | string;
  approvalPolicy?: string;
  sandbox?: string;
  prompt: PromptTemplateRef;
  structuredOutput?: StructuredOutputRef;
  budget?: BudgetPolicy;
  host?: Record<string, unknown>;
}

interface TaskBinding {
  taskType: AgentTaskType;
  profileName: string;
}

interface ResolvedAgentProfile extends AgentProfile {
  profileName: string;
  taskType: AgentTaskType;
  promptHash: string;
  structuredOutputRequired: boolean;
  resolvedBudget: BudgetPolicy;
  capabilityDowngrades: CapabilityDowngrade[];
}

interface StoryRunRequest {
  runId: string;
  trackId: string;
  storyId: string;
  worktreeCwd: string;
  resolvedProfile: ResolvedAgentProfile;
  promptContext: StoryPromptContext;
  controlSignal: AbortSignal;
}

interface StoryRunner {
  capabilities(): StoryRunnerCapabilities;
  launchStory(request: StoryRunRequest): AsyncIterable<RunEvent>;
  abort?(runId: string, childId: string, reason: string): Promise<AbortResult>;
}

type RunControlOutcome = "requested" | "applied" | "unsupported" | "already-terminal";

interface RunControlRequest {
  id: string;
  runId: string;
  action: "abort";
  storyId: string | null;
  reason: string | null;
  requestedAt: string;
  requestedBy: string;
}

interface RunControlResult {
  ok: true;
  runId: string;
  action: "abort";
  outcome: RunControlOutcome;
  reason: string | null;
  requestedAt: string;
  appliedAt: string | null;
  runPath: string;
  activeStoryIds: string[];
  childOutcomes: Array<{
    storyId: string;
    sessionId: string | null;
    outcome: RunControlOutcome;
    detail: string | null;
  }>;
  artifacts: {
    controls: "controls.ndjson";
    events: "events.ndjson";
    state: "state.json";
  };
}

interface RunEvent {
  id: string;
  runId: string;
  storyId?: string;
  childId?: string;
  timestamp: string;
  topic:
    | "run"
    | "story"
    | "child"
    | "tracker"
    | "review"
    | "pr"
    | "merge"
    | "budget"
    | "control"
    | "error";
  level: "debug" | "info" | "warning" | "error";
  type: string;
  message: string;
  data?: Record<string, unknown>;
}
```

Contract rules:

- `ResolvedAgentProfile` is written before child launch so analyzer/report output can explain which
  prompt, model, reasoning effort, budget, and structured-output schema were used.
- `StoryRunner` emits normalized `RunEvent` rows. The Codex driver can derive them from
  `codex/event`, standard MCP progress, final structured content, transcript parsing, and local
  evidence, but callers should not consume raw Codex event names.
- `RunEvent.data` must be bounded and scrubbed for secrets. Transcript paths are allowed; transcript
  contents are not copied into progress notifications by default.
- `AbortResult` distinguishes requested, confirmed, unsupported, and already-terminal outcomes.
