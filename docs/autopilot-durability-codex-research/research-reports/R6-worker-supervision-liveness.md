# R6 - Worker Supervision and Liveness

## Executive Recommendation

Adopt an event-cursor based supervision contract where only child-originated progress, phase, tool, approval,
control, and terminal events advance liveness; parent polling, watch reconnects, and projection reads never
reset stale timers. Confidence: high for the contract shape, medium for exact timeout defaults until validated
against real Codex and Claude runs.

## Sources Checked

- `docs/autopilot-durability-codex-research/README.md`, local charter, checked 2026-06-18. Defines the
  research scope, required report format, and R6 deliverable.
- `docs/autopilot-durability/design/00-overview.md`, local draft design, checked 2026-06-18. Defines the
  host-neutral event log, progress message class, ownership classes, and capability-gating spine.
- `docs/autopilot-durability/design/02-lifecycle-and-control-plane.md`, local draft design, checked
  2026-06-18. Defines the current intended D2 supervision states, real-progress requirement, and
  host-agnostic wait primitive requirement.
- `docs/autopilot-durability/design/05-observability-and-analysis.md`, local draft design, checked
  2026-06-18. Defines structured telemetry, nullable unavailable metrics, and analyzer correlation needs.
- Model Context Protocol Progress, https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/progress,
  version 2025-11-25 latest, checked 2026-06-18. Shows optional progress notifications, monotonic progress
  values, and that notifications must stop at task completion.
- Model Context Protocol Ping, https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/ping,
  version 2025-11-25 latest, checked 2026-06-18. Shows a protocol-level connection health check that can
  mark a connection stale, distinct from application progress.
- Model Context Protocol Cancellation, https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/cancellation,
  version 2025-11-25 latest, checked 2026-06-18. Shows cancellation is optional, best-effort, and race-prone.
- Model Context Protocol Tasks, https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks,
  version 2025-11-25 latest and experimental, checked 2026-06-18. Shows a task lifecycle with `working`,
  `input_required`, terminal states, `lastUpdatedAt`, suggested `pollInterval`, optional status notifications,
  and task progress notifications.
- Temporal Activity failure detection, https://docs.temporal.io/encyclopedia/detecting-activity-failures,
  checked 2026-06-18. Shows the separation between overall execution timeouts, start-to-close timeouts,
  heartbeat timeouts, heartbeat payloads, cancellation delivery on heartbeat, and heartbeat throttling.
- Temporal Activity execution, https://docs.temporal.io/activity-execution, checked 2026-06-18. Shows that
  lost work is not detected directly and must be bounded by timeouts; async completion can be used when an
  external process can heartbeat and complete later.
- Kubernetes API concepts, https://kubernetes.io/docs/reference/using-api/api-concepts/, current docs checked
  2026-06-18. Shows list-then-watch with `resourceVersion`, streamed changes, reconnect from the last version,
  and bookmarks that must not be assumed at fixed intervals.
- Kubernetes liveness, readiness, and startup probes,
  https://kubernetes.io/docs/concepts/workloads/pods/probes/, current docs checked 2026-06-18. Shows separate
  startup, liveness, and readiness probes, cautioning that liveness must indicate unrecoverable failure to
  avoid cascading restarts.
- Celery monitoring guide, https://docs.celeryq.dev/en/main/userguide/monitoring.html, Celery 5.6.2 docs
  checked 2026-06-18. Shows worker and task events, including monitor wakeup forcing heartbeat and task
  lifecycle events.
- OpenTelemetry span event deprecation blog,
  https://opentelemetry.io/blog/2026/deprecating-span-events/, published 2026-03-17 and checked 2026-06-18.
  Shows current guidance moving new event instrumentation toward log-based events correlated with traces,
  rather than relying on span-event APIs.

## Findings

Facts from sources:

- MCP progress is optional. Receivers may choose not to send progress, choose their own frequency, and omit
  totals. If progress is sent, the progress value must increase and progress notifications must stop after
  completion. For MCP task-augmented requests, progress notifications use the same progress token for the task
  lifetime and stop at terminal status.
- MCP ping checks connection responsiveness, not task progress. A missed ping can justify marking the
  connection stale, terminating, or reconnecting, but a successful ping only proves the peer responded.
- MCP cancellation is explicitly best-effort: receivers should stop work and free resources but may ignore
  cancellation if the request is unknown, complete, or cannot be cancelled. Late cancellation races are expected.
- MCP tasks, introduced in 2025-11-25 and still experimental, provide a useful model but not a mandatory
  dependency: `working`, `input_required`, `completed`, `failed`, and `cancelled`; `lastUpdatedAt`; suggested
  `pollInterval`; optional status notifications; and poll-for-truth behavior because notifications are not
  reliable enough to depend on alone.
- Temporal separates timeout classes. A start-to-close timeout bounds a single execution attempt, a
  schedule-to-close timeout bounds the full activity, and heartbeat timeout bounds time since the last accepted
  heartbeat. For long-running work, Temporal recommends frequent heartbeat with a relatively short heartbeat
  timeout.
- Temporal heartbeats can include progress payload for retry/resume. Temporal also warns that SDKs throttle
  delivered heartbeats, so raw local heartbeat calls and accepted service heartbeats are not identical.
- Temporal frames heartbeating around definite progress, not just time passing: long-running activities should
  heartbeat when the task can report meaningful status or progress, and no heartbeat means cancellation may not
  be delivered promptly.
- Kubernetes watch uses a durable cursor model: get/list current state, then watch changes after the returned
  `resourceVersion`; on disconnect, resume from the last returned resource version or re-list and start again.
- Kubernetes bookmarks help clients know they are synced to a resource version, but clients must not assume
  bookmarks will arrive or arrive at any specific interval. That is directly relevant to not treating watch
  keepalives as child progress.
- Kubernetes separates startup, readiness, and liveness. Liveness failure can restart or kill work, so the
  signal must be carefully designed to indicate a real unrecoverable condition, not temporary slowness or load.
- Celery distinguishes worker heartbeat events from task lifecycle events. A monitor may force heartbeats to
  discover workers, but task progress comes from task-specific events such as received, started, succeeded, or
  failed.
- OpenTelemetry's 2026 guidance says new event instrumentation should favor log-based events correlated with
  context over new span-event API usage. This supports keeping workflow-kit's durable event log as the source of
  truth and exporting to observability systems secondarily.

Interpretation for workflow-kit:

- Parent polls, watches, pings, projection rebuilds, and file-system wakeups are reader activity. They can show
  the supervisor is alive or connected, but they cannot prove the child is making progress.
- A heartbeat is useful only if its producer and semantics are explicit. A runtime-level ping is a connection
  heartbeat. A child heartbeat is a child-originated "still working" event. A progress event is stronger: it
  records a changed phase, tool call boundary, evidence update, approval state change, output cursor advance, or
  other monotonic activity.
- The kit should not require every host to expose live token metrics, live tool-call metrics, or protocol-native
  task status. The durable contract should accept richer driver events where available and record
  `unavailableReason` when unavailable.
- Stale detection must be based on the age and class of the last child-originated event, plus process ownership
  and terminal state. It must ignore supervisor `poll`, `watch-timeout`, `projection-read`, `analysis-read`, and
  status API calls.

## Options

### Option A - Treat any observable activity as liveness

This uses file mtime changes, parent polling, status command calls, watch reconnects, and child stdout/stderr as
evidence that the run is alive.

Enables:

- Simple implementation against current artifacts.
- Works even when the runtime has no structured progress channel.
- Low initial integration cost.

Cannot do:

- It cannot distinguish a healthy parent loop from a stale child.
- It can reproduce the known failure mode where `child-supervisor-poll` makes a stale child look active.
- It makes no-progress timeout semantics dependent on observer behavior.
- It cannot safely unlock recovery or auto-merge gates because the child may be hung while the parent remains
  busy.

### Option B - Require structured child progress and heartbeat events

This requires the driver or child wrapper to emit child-originated events into the durable event log. Stale
detection only uses events whose source is `child` or `driver` and whose event class is allowed to advance
liveness.

Enables:

- Clean separation between child progress and parent observation.
- Rich analysis: last real progress, phase duration, tool duration, approval wait duration, and no-progress
  reason are all reconstructable from the event log.
- Host neutrality: drivers can map MCP progress/tasks, Codex item/tool events, Claude transcript events, or
  wrapper-emitted events into the same contract.
- Safe degraded mode: if a host cannot emit a signal, that absence is visible and can fail closed.

Cannot do:

- It cannot provide fine-grained progress for opaque runtimes unless the child wrapper can observe stdout,
  transcript, process state, or protocol events.
- It requires careful event classification so noisy output does not become false progress.
- It needs driver-specific probes to know which live metrics exist.

### Option C - Adopt MCP Tasks as the primary liveness model

This maps each child story to an MCP task and relies on `tasks/get`, `lastUpdatedAt`, status notifications,
progress tokens, and `tasks/result`.

Enables:

- A standard state machine with `working`, `input_required`, and terminal states.
- Native polling interval hints and long-running request semantics.
- Natural mapping to approval/input-required states.

Cannot do:

- The MCP Tasks spec is experimental as of version 2025-11-25.
- Existing Claude/Codex surfaces may not support it consistently.
- MCP status notifications are optional, so polling remains required.
- It does not solve OS process ownership or external agent transcript liveness by itself.

## Recommendation

Use Option B as the durable contract, with MCP Tasks as an optional adapter when a driver can prove support.

The supervision contract should define event classes and liveness semantics explicitly:

| Event class | Source | Advances liveness? | Notes |
|---|---|---:|---|
| `child-session-linked` | driver | yes | Proves session identity and starts the linked phase. |
| `child-phase-changed` | child/driver | yes | Phase must change monotonically, for example `launching`, `planning`, `editing`, `verifying`, `reviewing`, `blocked`, `settling`. |
| `child-tool-started` | child/driver | yes | Starts a tool span; records tool name, command, cwd, and opaque tool call id when available. |
| `child-tool-output` | child/driver | limited | Advances liveness only if output cursor increases for an active tool; cap noisy output so a chatty hung command does not hide max tool duration. |
| `child-tool-finished` | child/driver | yes | Records exit status and duration. |
| `child-heartbeat` | child/driver | weak yes | Advances idle liveness but not no-progress liveness unless it carries progress payload or active phase/tool context. |
| `child-evidence-updated` | child/driver | yes | Changed files, verification command start/end, PR refs, reviewer findings, blockers. |
| `approval-requested` | child/driver | yes, then parks | Enters `awaiting-approval`; no-progress timer is suspended or replaced by approval SLA. |
| `approval-decision` | parent/human/policy | no by itself | Resumes child wait state but does not prove child consumed it. |
| `control-requested` | parent | no | Parent activity. |
| `control-outcome` | driver | no, unless terminal | Control evidence, not child progress. |
| `child-terminal` / `child-run-result` | child/driver | terminal | Stops all timers and progress notifications. |
| `supervisor-poll`, `wait-timeout`, `watch-opened`, `watch-closed`, `projection-read` | parent | no | Reader/supervisor activity only. |
| `connection-ping-ok` | driver/protocol | no | Connection health, not child progress. |

Use two separate timers:

- `idleTimeout`: time since any child-originated liveness event, including weak heartbeat. This detects lost
  child communication or dead process wrappers.
- `noProgressTimeout`: time since strong progress: phase change, tool boundary, evidence update, terminal
  result, or monotonic progress payload. This detects a child that is alive but not moving the story forward.

Use additional bounded timers for specific states:

- `startupTimeout`: launch to `child-session-linked` or first progress. Similar to a Kubernetes startup probe,
  this prevents a slow launch from being killed under normal no-progress rules.
- `toolNoOutputTimeout`: active tool start to next output cursor or finish. This should be command-class aware;
  install/test commands may be quiet for longer than shell commands.
- `toolMaxRuntime`: active tool start to finish. A command can output forever and still exceed maximum runtime.
- `approvalSla`: approval requested to decision. While parked, the child is not stale just because it is waiting
  for input.
- `decisionConsumptionTimeout`: approval decision to next child event. This detects a decision that never
  reached or resumed the child.
- `settleTimeout`: terminal/control request to child terminal or process reaped. Prevents endless terminating
  states.
- `maxRuntime`: overall story attempt wall-clock bound.

The host-agnostic wait primitive should be:

```text
waitRunEvents(runId, { afterSeq, until, includeSnapshot, timeoutMs })
  -> { snapshot?, events: Event[], nextSeq, timedOut, terminal }
```

Semantics:

- `afterSeq` is an event-log cursor, not a timestamp. The response returns only events with `seq > afterSeq`.
- If `includeSnapshot` is true, return the current projection before streaming or long-polling.
- `until` can include predicates such as `terminal`, `storyTerminal`, `approvalRequested`, `progress`,
  `seq>=N`, or `any`.
- If no matching event arrives before `timeoutMs`, return `timedOut: true` with the current `nextSeq`; do not
  append a progress event.
- Watch disconnects are normal. Callers resume with `nextSeq`, following the Kubernetes list/watch pattern.
- Optional keepalive or bookmark responses may prove the wait channel is connected, but must not advance child
  liveness.
- The primitive can be backed by in-process event emitters, file tailing, HTTP long-polling, SSE, or MCP task
  polling. The contract exposed to operators and analyzers remains the event cursor.

This should be paired with a projection field set that is fully derived:

- `lastChildEventAt`, `lastChildEventSeq`, `lastChildEventClass`
- `lastStrongProgressAt`, `lastStrongProgressSeq`, `lastStrongProgressClass`
- `lastWeakHeartbeatAt`, `lastWeakHeartbeatSeq`
- `activePhase`, `activeTool`, `activeApprovalRequest`
- `idleForMs`, `noProgressForMs`, `stateTimerForMs`
- `livenessState`: `starting`, `linked`, `progressing`, `idle`, `no-progress`, `awaiting-approval`,
  `terminating`, `terminal`, `unknown-degraded`
- `metricAvailability`: per metric with `available: boolean` and `unavailableReason`

## Tradeoffs and Risks

- Stronger correctness costs implementation work. Each driver must classify events rather than dumping raw text
  into the journal.
- Weak heartbeat semantics are easy to misuse. Heartbeats must be explicit about whether they are connection,
  child, tool, or progress heartbeats.
- Output-as-progress can hide hung commands that print forever. It should reset `idleTimeout`, but `toolMaxRuntime`
  and `noProgressTimeout` must still apply unless semantic progress is present.
- Timeout defaults can be hostile if too short. The first shipped defaults should be conservative and should
  emit `stalled` before killing where ownership/control confidence is not proven.
- MCP Tasks are attractive but experimental. The kit can map them into the event contract, but should not make
  the event contract depend on their availability.
- Some hosts may only provide final transcripts. Those can improve postmortem analysis but cannot unlock live
  liveness guarantees.
- Exporting events to OpenTelemetry should not replace the local append-only event log. Current OpenTelemetry
  guidance is still changing around event APIs; the local log should remain authoritative.

## Fallback and Degraded Modes

- If a runtime provides structured tool/phase/progress events, use them as strong progress.
- If a runtime provides only connection ping, record connection health but keep `livenessState` as
  `unknown-degraded` or `idle` based on process evidence; do not reset no-progress.
- If a runtime provides stdout/stderr only, emit `child-tool-output` with cursor offsets and classify it as weak
  liveness. Require `toolMaxRuntime` and `maxRuntime` to bound noisy commands.
- If a runtime provides only a process handle, derive process-alive evidence from owned process state. This can
  prove the child is alive, not that it is progressing; auto-recover and auto-merge should stay denied unless
  independent evidence also passes.
- If no live metrics are available but final transcripts exist, run in observe-later mode: enforce wall-clock
  process bounds, emit unavailable metric records, and analyze after terminalization.
- If the wait primitive cannot stream, fall back to polling the append-only event log by `seq`. Polling cadence
  should be separate from liveness timers and should never append progress-like events.
- If the parent restarts, rebuild projections from the event log, recompute timers from event timestamps, and
  fence stale writers before deciding whether the child is idle, no-progress, parked, or terminal.
- If an approval is pending, suppress no-progress termination and use `approvalSla`. If the SLA expires, park as
  `manual_recovery_required` rather than relaunching over a possibly waiting child.
- If event timestamps are suspect, order by monotonic `seq` for state transitions and use parent receipt time for
  timeout calculations. Record the clock issue for analysis.

## Validation Spikes

- Build a fake driver that emits scripted phase/tool/heartbeat/output/approval/terminal events. Assert that parent
  poll events never reset `lastStrongProgressAt` or `lastChildEventAt`.
- Replay the June incident artifacts after translating them into draft events. Assert that parent polling does
  not keep the child `active` and that the analyzer flags stale child progress.
- Prototype `waitRunEvents` over a local NDJSON event log using `afterSeq`, timeout, and reconnect. Verify no
  events are missed across disconnects and that keepalive timeouts do not write progress.
- Add a noisy command fixture that writes output forever. Assert `idleTimeout` stays fresh but `toolMaxRuntime`
  still terminates the owned process group.
- Add a quiet long-running verification fixture. Assert command-class timeout configuration prevents premature
  no-progress failure while still enforcing `maxRuntime`.
- Probe current Codex and Claude drivers for available live event classes: session linkage, tool start/end,
  stdout cursor, approval request, token metrics, and terminal result. Record unavailable metrics explicitly.
- Map MCP 2025-11-25 Tasks into the event contract in a small prototype, but keep it behind capability detection
  because the spec is experimental.
- Test parent restart: append events, stop the supervisor, rebuild projection, and verify timers resume from the
  latest child-originated event rather than from restart time.

## Open Questions

- What should the default `idleTimeout`, `noProgressTimeout`, `toolNoOutputTimeout`, and `toolMaxRuntime` be for
  common story classes?
- Should timeout defaults live in `.workflow/config.yaml` by story type, command type, or driver capability?
- Which child phases are standard enough for a cross-driver enum, and which should remain free-form with a stable
  high-level category?
- How should transcript-only hosts expose approximate tool boundaries without overclaiming live progress?
- Should `approvalSla` be a hard block, a notification-only threshold, or a policy-driven choice?
- Should the operator wait API expose SSE/HTTP directly, or only through MCP tools that return long-poll results?
- What exact Codex app-server and MCP-server event classes are available in the target version chosen by R1?
