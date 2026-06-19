---
title: "Supervision & Liveness - liveness model"
status: approved
last-reviewed: "2026-06-19"
---

# Liveness Model

## Liveness inputs

Liveness is a pure fold over committed run events plus the current clock supplied to the reducer. A
Run is active only when the event stream proves a current, non-superseded Agent session and recent
worker-originated activity for that session.

Events that advance liveness:

| Class | Event source | Effect |
|---|---|---|
| Startup linkage | `AgentSessionLinked` paired with non-ambiguous core-01 `SessionLinked` for the current session | Satisfies startup and enters `active`. |
| Worker progress | `AgentProgressObserved` for the current session | Refreshes idle and no-progress timers when the Agent contract marks it as progress, not telemetry noise. |
| Tool completion | `AgentToolObserved` with `exitCode`, `outputRef`, and current-session `itemId` when present | Refreshes idle and no-progress timers; closes matching per-tool timer. |
| Approval request | `AgentApprovalRequested` with an `answerChannelRef` | Refreshes idle, enters `waiting-for-approval`, and arms approval-SLA. It is not implementation progress. |
| Terminal observation | `AgentSessionTerminal` or `WorkerProcessExited` for the current worker handle | Stops liveness supervision; it never makes the worker active. |

Events that never advance liveness: parent polls, `waitRunEvents` responses or timeouts, watch
reconnects, projection reads, cached projection rebuilds, lifecycle transitions alone, `SessionLinked`
without a matching Agent linkage event, `WorkerSpawned`, `HostWorkspaceAttached`,
`HostCapabilityAttested`, `AgentCapabilityAttested`, `AgentApprovalAnswered`, Operator decisions,
approval decisions, runner-owned command events, Forge events, Work Source events, and raw host output
that is not normalized into an Agent worker event.

A stale worker can never look active because only a current-session Agent event can refresh the
projection. Coordinator activity and read-side observation are deliberately inert.

## Timers and defaults

Timer defaults are policy inputs; these are proposed v1 defaults:

| Timer | Starts | Stops | Default |
|---|---|---|---|
| `startup` | `worker-starting` lifecycle or `WorkerSpawned` | Current-session `AgentSessionLinked` | 120 seconds |
| `idle` | First current-session startup/progress/tool/approval event | Next liveness-advancing worker event | 15 minutes |
| `no-progress` | First progress or tool-completion event after startup | Next progress or tool-completion event | 45 minutes |
| `per-tool` | First current-session event with a new stable tool `itemId` | `AgentToolObserved` for that `itemId` | 30 minutes |
| `approval-SLA` | `AgentApprovalRequested` | A recorded approval answer or terminal event | 24 hours |
| `max-runtime` | `worker-starting` lifecycle | Terminal lifecycle or worker terminal observation | 8 hours |

`approval-SLA` is local supervision vocabulary only. It means the Operator attention window for a
pending approval; it does not assume approval-domain semantics.

When a tool cannot be correlated to a stable current-session `itemId`, `per-tool` is not guessed. The
projection enters `tool-tracking-unavailable` and falls back to idle/no-progress/max-runtime timers.

## Liveness projection

```ts
type LivenessState =
  | "not-started" | "starting" | "active" | "waiting-for-approval"
  | "approval-overdue" | "stale" | "supervision-lost"
  | "termination-requested" | "terminated";

type LivenessReason =
  | "startup-timeout" | "idle-timeout" | "no-progress-timeout" | "tool-timeout"
  | "approval-sla-exceeded" | "max-runtime-exceeded" | "event-cursor-unavailable"
  | "session-linkage-ambiguous" | "agent-progress-unobservable"
  | "tool-tracking-unavailable" | "termination-unavailable" | "termination-unproven"
  | "worker-terminal-observed";

type LivenessProjection = {
  runId: string;
  state: LivenessState;
  reason?: LivenessReason;
  currentSessionId?: string;
  workerHandleId?: string;
  lastWorkerEventSequence?: number;
  lastProgressSequence?: number;
  staleSince?: string;
  timers: Record<string, { deadline: string; exceeded: boolean }>;
  terminal: boolean;
};
```

`stale` means the worker missed a timer while the event cursor and session linkage are coherent.
`supervision-lost` means the supervisor cannot prove liveness because the cursor, linkage, Agent
progress guarantee, or termination guarantee is unavailable or ambiguous. `terminated` means an Agent
or Host terminal event was observed, or the Execution Host returned termination proof.

## Termination handoff

On `startup`, `idle`, `no-progress`, `per-tool`, or `max-runtime` expiry for an owned worker,
Supervision & Liveness appends `SupervisorTerminationRequested` and calls
`ExecutionHost.terminateWorker(handle, policy)`. It never signals, kills, reaps, or proves-empty
directly.

If the Host returns `TerminationResult.proof.containmentEmpty = true`, the projection records
`terminated` and supervision stops. If `canKill` is missing/stale/negative or the Host returns
`termination-unproven`, the projection records `supervision-lost` with `termination-unavailable` or
`termination-unproven`.

`WorkerTerminated` records the terminal Agent/Host observation or Host termination proof. It must be
appended before terminal lifecycle closure, or in the same barrier batch as `SupervisorStopped` when
core-04 closes supervision. It is not a permitted post-terminal append after core-01 lifecycle has
already reached a terminal state.

`SupervisorStopped` is the single terminal-summary fact for this domain. It is a core-04
non-lifecycle event that cites the terminal source events and is allowed after a terminal lifecycle
transition only under core-01's ratified post-terminal append rule: reuse the terminal epoch until
lease expiry, and require a fresh epoch only after lease loss. It never advances liveness, refreshes
timers, records progress, requests termination, or changes core-01 lifecycle state. After
`SupervisorStopped`, core-04 emits no more supervisor, liveness, progress, timer, termination, or
terminal-summary facts for the Run.
