# Runtime flows

This page describes the main call sequences, runtime loop, and control-state model.

## Authoring flow

Workflow steps are independently invokable. Each skill can consume upstream kit artifacts when they
exist, but must also accept explicit in-session context or externally authored documents.

```mermaid
sequenceDiagram
  autonumber
  participant User as "User / orchestrating agent"
  participant Skill as "Workflow skill"
  participant Context as "Repo docs and supplied context"
  participant Contracts as "Reference contracts/templates"
  participant Output as "Generated artifact"
  participant Validator as "Contract validation"

  User->>Skill: "Invoke define/design/plan step"
  Skill->>Context: "Read upstream artifact if present"
  Skill->>Context: "Read supplied notes or external design"
  Skill->>Contracts: "Load required contract and template"
  Skill->>Skill: "Record assumptions and only blocking gaps"
  Skill->>Output: "Write PRD, technical solution, tracker, or story brief"
  Skill->>Validator: "Validate contract shape and required links"
  Validator-->>User: "Artifact path, assumptions, next optional step"
```

## Story runtime sequence

Story execution is the core unit. Track autopilot is a scheduler over story runs, not a separate
execution model.

```mermaid
sequenceDiagram
  autonumber
  participant Parent as "Parent Codex session / CLI user"
  participant MCP as "WorkflowKit MCP or CLI"
  participant Handler as "Command handler"
  participant Config as "Config/profile resolver"
  participant Tracker as "Tracker validator and claimer"
  participant Runner as "WorkflowRunner"
  participant Driver as "StoryRunner driver"
  participant Child as "Child Codex session"
  participant Repo as "Repo worktree"
  participant GH as "GitHub"
  participant Obs as "Journal / metrics / analyzer"

  Parent->>MCP: "run_story(track, storyId, overrides)"
  MCP->>Handler: "Validate tool args and call shared handler"
  Handler->>Config: "Load config and resolve task binding"
  Config-->>Handler: "ResolvedAgentProfile and budget policy"
  Handler->>Tracker: "Parse tracker and verify story eligibility"
  Tracker-->>Handler: "Eligible story graph and claim plan"
  Handler->>Runner: "Start story run request"
  Runner->>Obs: "run-started / tracker-validated"
  Runner->>Tracker: "Claim story as in-progress"
  Runner->>Obs: "story-claimed"
  Runner->>Driver: "launchStory(request, profile, promptContext)"
  Driver->>Child: "start Codex MCP session with model/reasoning/prompt"
  Child-->>Driver: "session_configured / codex event stream"
  Driver-->>Obs: "child-session-linked / child-progress"
  Child->>Repo: "Edit, test, commit"
  Child->>GH: "Open PR, wait checks/reviews, merge when allowed"
  Child-->>Driver: "Structured result and evidence"
  Driver-->>Runner: "StoryRunResult"
  Runner->>Obs: "verification, PR, merge, budget, terminal events"
  Runner->>Tracker: "Refresh tracker and completion gate"
  Runner-->>Handler: "Run outcome"
  Handler->>Obs: "Analyze or update summary artifacts"
  Handler-->>MCP: "Bounded structured response"
  MCP-->>Parent: "Outcome with artifact paths"
```

## Track autopilot sequence

Autopilot repeatedly refreshes the tracker graph, launches currently eligible stories up to the
configured parallelism, waits for settlement, applies stop/budget/recovery policy, then checks
whether new stories became eligible.

```mermaid
flowchart TD
  Start["run_eligible / workflow-autopilot"] --> Load["Load config, profiles, budgets"]
  Load --> Validate["Validate tracker graph"]
  Validate --> Eligible{"Eligible stories available?"}
  Eligible -- "No" --> TerminalCheck{"Any active children?"}
  TerminalCheck -- "No" --> Complete["Terminal: complete or no-eligible"]
  TerminalCheck -- "Yes" --> Wait["Wait for child settlement"]
  Eligible -- "Yes" --> Capacity{"Parallel capacity available?"}
  Capacity -- "No" --> Wait
  Capacity -- "Yes" --> Launch["Claim story and launch child"]
  Launch --> Observe["Stream events and update metrics"]
  Observe --> Budget{"Budget/control stop?"}
  Budget -- "Abort" --> Abort["Abort parent loop and signal active children"]
  Budget -- "Stop new launches" --> Wait
  Budget -- "Continue" --> Eligible
  Wait --> Settle["Apply completion gate and recovery guard"]
  Settle --> Refresh["Refresh tracker and GitHub evidence"]
  Refresh --> Eligible
  Abort --> Report["Write terminal artifacts and report"]
  Complete --> Report
```

## Streaming and run control sequence

Progress notifications should come from normalized WorkflowKit events, not raw Codex child events.

```mermaid
sequenceDiagram
  autonumber
  participant Client as "Orchestrating MCP client"
  participant Tool as "WorkflowKit MCP tool"
  participant Stream as "Run event stream"
  participant Journal as "RunJournal"
  participant Runner as "WorkflowRunner"
  participant Driver as "StoryRunner driver"
  participant Control as "Run control service"

  Client->>Tool: "stream_run(runId, topics, level, includeData)"
  Tool->>Stream: "Subscribe with filters"
  Runner->>Journal: "Append normalized event"
  Driver->>Journal: "Append normalized child event"
  Journal-->>Stream: "Fan out event row"
  Stream-->>Tool: "Filtered event"
  Tool-->>Client: "notifications/progress or custom notification"
  Client->>Tool: "abort_run(runId, reason)"
  Tool->>Control: "Append control request"
  Control->>Journal: "control-requested"
  Control->>Runner: "Apply stop-new-work and driver abort"
  Runner->>Driver: "abort child when supported"
  Runner->>Journal: "control-applied / run-aborted"
  Journal-->>Stream: "Terminal event"
  Tool-->>Client: "Abort outcome and artifact paths"
```

## Runtime state and controls

```mermaid
stateDiagram-v2
  [*] --> Created
  Created --> Validating: "load config + tracker"
  Validating --> Rejected: "invalid config/tracker"
  Validating --> Ready: "valid graph"
  Ready --> Claiming: "eligible story selected"
  Claiming --> Launching: "claim written"
  Launching --> RunningChild: "child launch accepted"
  RunningChild --> WaitingGate: "child terminal result"
  RunningChild --> Aborting: "abort requested"
  RunningChild --> BudgetStopping: "budget action"
  WaitingGate --> Recovering: "recoverable failure"
  Recovering --> Launching: "retry allowed"
  WaitingGate --> Settled: "completion gate passed/failed"
  BudgetStopping --> Settled: "checkpoint stop"
  Aborting --> Aborted: "parent and child settled"
  Settled --> Ready: "track loop continues"
  Settled --> Complete: "all required work complete"
  Settled --> Blocked: "no progress possible"
  Rejected --> [*]
  Complete --> [*]
  Blocked --> [*]
  Aborted --> [*]
```

| State/control | Technical meaning | Artifact evidence |
| --- | --- | --- |
| `Created` | Run id and artifact root allocated before any mutation. | `run.json`, `run-started` |
| `Validating` | Config, agent profile bindings, tracker graph, and command args are validated. | `config.resolved.json`, `tracker-validated` or validation diagnostics |
| `Ready` | Runtime has a valid graph and no active launch at this instant. | `state.json`, eligibility snapshot |
| `Claiming` | Runner is performing the status transition that prevents duplicate launch. | `story-claim-requested`, `story-claimed` |
| `Launching` | Prompt/profile resolved and driver start requested. | `child-launch-requested` with profile, prompt hash, output schema |
| `RunningChild` | Child session is linked or pending linkage and progress can stream. | `child-session-linked`, `child-progress`, metrics |
| `WaitingGate` | Driver returned; parent is evaluating verification, PR, tracker, and policy evidence. | completion-gate events, GitHub evidence |
| `Recovering` | Failure is classified as recoverable and retry/repair policy is being applied. | recovery decision events |
| `BudgetStopping` | Budget policy is stopping new launches or stopping at the next checkpoint. | `budget-warning`, `budget-stop` |
| `Aborting` | User/system requested abort; parent loop must stop new work and signal live children where supported. | `controls.ndjson`, `control-requested`, `control-applied` |
| `Settled` | A story attempt has a terminal classification; track loop may continue if allowed. | child result, state refresh |
| `Complete` | Completion comes from tracker/GitHub evidence, not child prose. | `run-complete`, tracker state, PR/merge evidence |
| `Blocked` | No configured recovery or eligible work remains. | `run-blocked`, blocker diagnostics |
| `Rejected` | No execution mutation occurred because validation failed. | validation report |

Control actions:

- `abort`: durable request in `controls.ndjson`; immediately stop new story launches; ask each
  active driver to cancel; classify still-running child state conservatively if cancellation cannot
  be confirmed.
- `stop-new-launches`: budget/policy control that lets active children reach a checkpoint but
  prevents new eligible stories from starting.
- `checkpoint-stop`: budget/policy control that waits for current story completion gate, then ends
  the loop without launching newly eligible work.
- `resume`: not required in V1; artifacts should be shaped so a future resume can reconstruct
  completed, active, and blocked work without reading prose transcripts.

Budget controls are evaluated at runner checkpoints after live metrics and budget artifacts are
written. The runner uses the strongest observed action with this precedence: `abort`,
`checkpoint-stop`, `stop-new-launches`, then `warn`. Budget stop actions are independent from child
failure policy: they prevent new launches even when `stopLaunchingOnBlocked` is `false`. `warn`
records evidence only, `stop-new-launches` and `checkpoint-stop` let active children settle before
ending the track loop, and `abort` also signals active child sessions through the driver abort
signal when supported. Completion still comes only from tracker/GitHub evidence; budget policy can
stop autonomy, but it cannot mark a story complete.
