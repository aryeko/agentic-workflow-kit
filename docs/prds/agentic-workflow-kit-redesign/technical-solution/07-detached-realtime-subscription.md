# Detached realtime event subscription

This page designs an additive realtime delivery primitive for a run: a **durable, detached
subscription** that keeps delivering normalized run events to a subscriber after the originating
tool call has returned, until terminal state or explicit unsubscribe. It is parallel to, and does
not change, the existing attached streaming path (`workflow_run_stream`) or the existing pull path
(`watch_run_start` / `watch_run_poll`).

This section is self-contained: it captures the motivation, requirements, mechanism, API surface,
data contracts, the host-integration boundary, failure semantics, and validation so a future
implementation story can be planned and built from it without rereading the conversation that
produced it.

## Problem statement and motivation

The kit already streams realtime, normalized run events — but **only to an *attached* client**.
`workflow_run_stream` is a long-lived MCP request: it replays a bounded tail and then pushes
notifications **for as long as that single request is in flight**, because the progress
notifications are keyed to the caller's own request progress token. The current API contract states
it plainly (see [05-api-surface.md](05-api-surface.md), `workflow_run_stream`):

> `workflow_run_stream` is a long-lived MCP request. It should replay a bounded tail by default,
> then push new normalized events until terminal state or client cancellation.

In the implementation, the push path is keyed to `extra._meta.progressToken`
(`packages/orchestrator/src/mcp/tools.ts`, `workflow_run_stream` registration), so the subscription
ends the instant the request returns.

That model serves an orchestrator or CLI that **stays blocked on the stream**. It does **not** serve
an orchestrating agent that **returns its turn to stay interruptible** — the common Claude-Code
supervision pattern. The moment such an agent stops awaiting the call, the subscription ends and no
further events arrive. A detached agent can only resume via **host-level wake mechanisms**: today
that is scheduled-wakeup *polling*, or `watch_run_poll` cursor pulls. There is no way for a detached
agent to be *pushed* a "story merged", "run blocked", or "child failed" wake in realtime. Polling is
the only lever, and it is wasteful (wakes with nothing to do) and laggy (events wait for the next
poll tick).

### The host boundary (a constraint, not a blocker)

The act of *waking an idle agent* lives in the **MCP host** (Claude Code, Codex, etc.), not in the
MCP server. The kit cannot reach into a host and resume a suspended turn. Therefore the kit's job is
to expose a **durable, detached subscription primitive plus a documented host-integration contract**
that a host can bind its existing wake mechanism to. This document names that boundary explicitly:
the kit owns the durable event sink, the subscription registry, and a wake signal; the host owns the
binding from that signal to its own resume mechanism.

### Verified enabler

The event journal is already durable, append-only NDJSON. `RunJournal.record` appends through
`artifactStore.appendEvent` to `events.ndjson` (`packages/orchestrator/src/runner/RunJournal.ts`),
and control-surface helpers append the same journal from command handlers. `events.ndjson` is a
first-class run artifact (see [03-data-contracts.md](03-data-contracts.md), "Run artifact shape").
Detached replay-by-cursor is therefore supported by existing infrastructure: any reader can resume
from a stored offset into `events.ndjson`. No second event schema and no new event store are
required, but implementation must centralize wake notification across every event append path.

### Version and compatibility alignment

The merged runtime/config versioning surface is the version boundary for this feature:

- Public MCP/CLI envelopes continue to use runtime `apiVersion: "1"`. Detached subscription tools
  do not introduce a second public API version.
- `workflow_runtime_info` remains the discovery surface for package, MCP server, API, and config
  schema versions. `workflow_project_inspect.capabilities` should add a capability flag for this
  feature, e.g. `detachedRunSubscriptions: true`.
- The subscription registry record gets its own internal artifact `schemaVersion: 1`. That version
  applies only to files under a run's `subscriptions/` directory and is independent of the public
  API version and `.workflow/config.yaml` schema version.
- This design adds no `.workflow/config.yaml` keys or default semantics. Therefore it does **not**
  require bumping `CURRENT_CONFIG_SCHEMA_VERSION` beyond the current `0.6.0`; only a future
  config-backed option for subscriptions should trigger a config schema version change.
- Subscribe-by-`runId` is config-dependent because the runtime must resolve project context and run
  artifact roots through the configured repo. Explicit run-artifact operations by `runPath` may use
  the existing read-tool fallback only where current run readers already support artifact-local
  inspection without loading a compatible repo config.

## Technical requirements

Each requirement is observable and testable.

- R1 — A subscriber can register a subscription that **outlives the registering tool call**. After
  the call returns, the subscription remains active and continues to accrue deliverable events.
- R2 — Registration is **non-blocking**: `workflow_run_subscribe` returns immediately with a
  subscription handle, the committed and next cursors, the wake-artifact path, a bounded replay tail,
  and host-adapter hints. It never blocks awaiting future events.
- R3 — The kit emits a **wake signal** the host can observe with its existing mechanisms
  (filesystem watch, mtime poll, or OS signal) whenever new matching events exist past the cursor,
  or a configured wake condition fires.
- R4 — A subscriber can **pull deliverable events** for a subscription by handle; the kit returns
  the filtered, ordered batch after the committed cursor and a `nextCursor` for the client to ack.
- R5 — Delivery is **at-least-once** with **replay-on-reconnect**, enforced by a two-phase cursor:
  the committed cursor advances only on ack, so after any gap (turn yielded, process restart, or an
  unacked batch) the next pull re-delivers from the last committed cursor with no lost events.
- R6 — Events are delivered in **journal-append order**; the committed cursor is monotonic.
- R7 — Subscriptions reach a **terminal** state whenever the run is no longer live (`complete`,
  `blocked`, `aborted`, `supervision_lost`, or `dry-run`): a terminal event when one exists, a
  `terminal` flag on pull, and a final wake. Terminal is idempotent and observable.
- R8 — Filters (`topics`, `minLevel`, `storyIds`, `includeData`) and `throttleMs` are **stored
  server-side** with the subscription, so neither host nor agent must track them between turns.
- R9 — A subscription is **scoped to one run**; its handle is the capability reference for pull and
  unsubscribe.
- R10 — The capability is **purely additive**. `workflow_run_stream`, `notifications/progress`, and
  `notifications/workflow_event` behavior is unchanged, and the existing normalized event model is
  reused unchanged.
- R11 — Subscription tools respect runtime/config version surfaces. Runtime/package/API/config
  schema versions are discoverable through `workflow_runtime_info`; project discovery advertises
  detached subscription capability; config-incompatible `runId` resolution fails with the same
  structured compatibility guidance as other config-dependent runtime actions.

## Attached vs pull vs detached

| Path | Tool(s) | Cursor owner | Delivery | Survives turn yield? | Best for |
| --- | --- | --- | --- | --- | --- |
| Attached stream | `workflow_run_stream` | n/a (in-flight request) | push via progress token | No — ends with the request | Orchestrator/CLI blocked on the stream |
| Pull | `watch_run_start` / `watch_run_poll` | client-side | poll only | Yes, but the agent must keep polling | Periodic supervision when push is not needed |
| Detached subscription | `workflow_run_subscribe` / `workflow_run_subscription_poll` / `workflow_run_unsubscribe` | server-side (stored) | wake signal + pull | Yes — the wake lets the host resume an idle agent | Agent that yields its turn but wants realtime wakes |

The detached path's differentiator over the pull path is twofold: the cursor and filters are stored
server-side (the host tracks only the run ref plus subscription handle, not cursor/filter state),
and a wake signal lets the host suspend the agent and resume it on events instead of polling on a
fixed cadence.

## Chosen mechanism: durable cursor + wake-signal file

The mechanism reuses the durable journal and adds two small artifacts plus a registry, all under the
existing run artifact directory.

### Components

- **Subscription registry record** — one durable JSON file per subscription holding its identity,
  run scope, stored filters, throttle, wake conditions, last-delivered cursor, and terminal state.
  Server-stored so the cursor and filters survive process restarts and turn boundaries.
- **Wake-signal artifact** — one tiny file per subscription that the kit touches (updates its mtime
  and a small payload) when matching events exist past the cursor, or a wake condition fires. This
  is the "push" lever: the host watches this file (fs.watch / mtime poll / signal) and resumes the
  agent. The kit never reaches into the host.
- **Cursor** — an offset into `events.ndjson`, using the same line/offset cursor model already used
  by `watch_run_poll`. The wake artifact only signals "there is work past your cursor"; the actual
  events are read on the next pull.
- **Subscription notifier** — a shared event-append hook that evaluates active subscriptions and
  touches wake artifacts after matching journal appends. This is not the originating MCP tool; it
  must run from every path that writes `events.ndjson`.

### Event append and wake authority

Implementation must route every write to `events.ndjson` through a shared append helper or call the
same `RunSubscriptionNotifier` immediately after append. Today, runner events flow through
`RunJournal.record`, while control-surface events can flow through command-level append helpers.
Both paths must invoke the same notifier so a `control-requested`, `run-aborted`, `run-blocked`,
`run-complete`, or `run-supervision-lost` event cannot be deliverable but fail to wake a subscriber.

The process that appends the event owns wake evaluation for that append. If multiple kit processes
append to one run, each append path evaluates the durable subscription records after its own write.
Wake files are idempotent and coalesced by `throttleMs`, so duplicate touches are acceptable;
missed touches are not. This resolves cross-process wake authority for V1 without a separate daemon.

### Sequence

```mermaid
sequenceDiagram
  autonumber
  participant Agent as "Detached orchestrating agent"
  participant Host as "MCP host (wake mechanism)"
  participant Tool as "WorkflowKit MCP tool"
  participant Notify as "Subscription notifier"
  participant Reg as "Subscription registry"
  participant Wake as "Wake-signal artifact"
  participant Journal as "RunJournal / events.ndjson"
  participant Runner as "WorkflowRunner / Driver"

  Agent->>Tool: "workflow_run_subscribe(runId, filters, wakeOn)"
  Tool->>Reg: "Create subscription record + initial cursor"
  Tool->>Journal: "Read bounded replay tail"
  Tool-->>Agent: "subscriptionId, committedCursor, nextCursor, wakePath, replay tail, host hints"
  Agent->>Host: "Yield turn; bind wake to wakePath"
  Runner->>Journal: "Append raw event"
  Journal->>Notify: "Evaluate normalized row against subscriptions"
  Notify->>Reg: "Read filters, committed cursor, terminal state"
  Notify->>Wake: "Touch wake artifact (coalesced by throttleMs)"
  Wake-->>Host: "Filesystem change / signal"
  Host->>Agent: "Resume idle turn"
  Agent->>Tool: "workflow_run_subscription_poll(runId, subscriptionId, ackCursor=prior nextCursor)"
  Tool->>Reg: "Commit ackCursor; read filters"
  Tool->>Journal: "Read + filter events after committed cursor"
  Tool-->>Agent: "Ordered batch + nextCursor + terminal flag"
  Note over Runner,Journal: "On terminal run state -> terminal event when available"
  Journal->>Notify: "Terminal row or terminal state observed"
  Notify->>Wake: "Final wake (terminal)"
  Notify->>Reg: "Mark subscription terminal"
  Agent->>Tool: "workflow_run_subscription_poll -> terminal=true"
  Agent->>Tool: "workflow_run_unsubscribe(runId, subscriptionId)"
  Tool->>Reg: "Mark closed; remove wake artifact"
```

## Run artifact additions

Formalize a `subscriptions/` directory under the existing run artifact root (see
[03-data-contracts.md](03-data-contracts.md), "Run artifact shape"). This is additive; no existing
artifact changes.

```text
.codex/agentic-workflow-kit/runs/<runId>/
  events.ndjson                  existing durable normalized event journal (reused, unchanged)
  controls.ndjson                existing
  ...
  subscriptions/                 new: detached subscription registry + wake signals
    <subscriptionId>.json        durable schemaVersion: 1 record (filters, cursor, terminal state)
    <subscriptionId>.wake        tiny wake-signal artifact (mtime + minimal payload)
```

Retention follows the existing rule: runtime artifacts are repo-local and ignored by completion
dirty checks. Subscription records and wake artifacts are runtime artifacts and inherit that rule.

## API surface (additive)

Naming follows existing conventions: MCP tools are `workflow_run_*`; CLI verbs are
`agentic-workflow-kit run <verb>`. Returned event payloads reuse the existing
`notifications/workflow_event` normalized event shape; no new public event schema is introduced.
All MCP results use the shared WorkflowKit envelope with `apiVersion: "1"`. Capability/version
discovery is split deliberately: `workflow_runtime_info` reports runtime/API/config versions, while
`workflow_project_inspect.capabilities.detachedRunSubscriptions` reports whether this feature is
available in the resolved project/runtime.

### `workflow_run_subscribe`

Register a durable detached subscription. **Returns immediately (non-blocking).** Parallel to
`workflow_run_stream` but it does not hold the request open.

Input:

```json
{
  "repo": "/repo",
  "runId": "2026-06-13T15-48-02-107Z",
  "subscription": {
    "topics": ["run", "story", "child", "pr", "merge", "budget", "error"],
    "minLevel": "info",
    "storyIds": [],
    "includeData": "summary",
    "replay": {"lastEvents": 20},
    "throttleMs": 2000,
    "wakeOn": {
      "minLevel": "warning",
      "topics": ["merge", "pr"],
      "types": ["run-blocked", "run-aborted", "run-complete", "child-error", "child-startup-failed"]
    }
  }
}
```

`wakeOn` selects which normalized events touch the wake artifact, matching on any of `minLevel`,
`topics` (normalized event topic values, e.g. `merge`/`pr`), or `types` (concrete raw event type
names, e.g. `run-blocked`, `child-error`). It defaults to the subscription filter (every
deliverable event wakes); narrowing it lets a host sleep through routine progress and wake only on
notable transitions. Use `topics` for topic-level matches such as `merge` and `pr` — `merge`/`pr`
are topics, not event types, so listing them under `types` would never match. **Terminal transitions
(`run-complete`, `run-aborted`, `run-blocked`, `run-supervision-lost`, and already-terminal
`dry-run` state) always fire a final wake regardless of `wakeOn`**, so a host can never sleep
through the end of a run. `throttleMs` coalesces wake touches so bursts produce at most one wake per
window.

Output:

```json
{
  "ok": true,
  "operation": "workflow_run_subscribe",
  "result": {
    "runId": "2026-06-13T15-48-02-107Z",
    "subscriptionId": "sub_8f2c...",
    "committedCursor": "events.ndjson:0",
    "nextCursor": "events.ndjson:20",
    "wakeArtifact": "subscriptions/sub_8f2c....wake",
    "subscriptionArtifact": "subscriptions/sub_8f2c....json",
    "replay": [ /* bounded tail of normalized events, workflow_event shape */ ],
    "terminal": false,
    "hostAdapter": {
      "watch": "subscriptions/sub_8f2c....wake",
      "poll": {
        "mcpTool": "workflow_run_subscription_poll",
        "args": {
          "runId": "2026-06-13T15-48-02-107Z",
          "subscriptionId": "sub_8f2c..."
        }
      },
      "close": {
        "mcpTool": "workflow_run_unsubscribe",
        "args": {
          "runId": "2026-06-13T15-48-02-107Z",
          "subscriptionId": "sub_8f2c..."
        }
      }
    }
  }
}
```

### `workflow_run_subscription_poll`

Return deliverable events for a subscription and report terminal state. The cursor and filters are
**server-side and keyed to the run plus `subscriptionId`** (distinct from `watch_run_poll`, which
keeps the cursor client-side), but the server **commits the cursor only on acknowledgement**, never
simply because a batch was returned.

The cursor is **two-phase** to preserve at-least-once delivery (R5). Each poll returns the batch
since the last *committed* cursor plus a `nextCursor` marking the end of that batch. The server
commits `nextCursor` only when the client passes it back as `ackCursor` on a subsequent poll
(acknowledging it durably processed that batch). If the host crashes or the transport fails after
the server returns a batch but before the client acks, the next poll re-delivers from the last
committed cursor — no events are lost. Clients dedupe on normalized event `id`. This makes the
detached path at least as safe as `watch_run_poll`'s client-owned cursor.

Input (omit `ackCursor` on the first poll):

```json
{
  "repo": "/repo",
  "runId": "2026-06-13T15-48-02-107Z",
  "subscriptionId": "sub_8f2c...",
  "ackCursor": "events.ndjson:120",
  "max": 200
}
```

Output:

```json
{
  "ok": true,
  "operation": "workflow_run_subscription_poll",
  "result": {
    "subscriptionId": "sub_8f2c...",
    "events": [ /* ordered, filtered events after the committed cursor, workflow_event shape */ ],
    "committedCursor": "events.ndjson:120",
    "nextCursor": "events.ndjson:184",
    "terminal": true,
    "status": "complete",
    "eventsDelivered": 64
  }
}
```

`committedCursor` echoes the position the server advanced to from this call's `ackCursor`;
`nextCursor` is the position the client should ack on its next poll once it has durably processed the
returned batch. A poll with no new events returns an empty `events` array with `nextCursor` equal to
`committedCursor`; this is the expected idle case and is cheap. `eventsDelivered` is the current
poll page length, not a cumulative total.

### `workflow_run_unsubscribe`

Idempotent teardown. Marks the subscription closed/terminal and removes the wake artifact. Safe to
call after terminal or more than once.

Input:

```json
{
  "repo": "/repo",
  "runId": "2026-06-13T15-48-02-107Z",
  "subscriptionId": "sub_8f2c..."
}
```

Output:

```json
{
  "ok": true,
  "operation": "workflow_run_unsubscribe",
  "result": { "subscriptionId": "sub_8f2c...", "closed": true }
}
```

### CLI

- `agentic-workflow-kit run subscribe <runId> [--topics ...] [--min-level ...] [--story ...] [--wake-on ...] [--throttle-ms ...]`
- `agentic-workflow-kit run subscription-poll <runId-or-path> <subscriptionId> [--max N] [--format ndjson]`
- `agentic-workflow-kit run unsubscribe <runId-or-path> <subscriptionId>`

CLI defaults to human-readable with `--json` / `--format ndjson` for automation, consistent with the
existing CLI API goals.

## Data contracts

These reuse the existing normalized event model surfaced by `workflow_run_stream` and
`notifications/workflow_event` (see [03-data-contracts.md](03-data-contracts.md), "Interface
contracts"). Exact TypeScript names can change during implementation; each concept gets
schema/tests before runtime depends on it.

```ts
// Reused unchanged from the existing normalized event surface:
// NormalizedRunEvent (id, storyId?, childId?, recordedAt, eventAt, topic, level, type, message,
// data?). Raw journal rows remain append-only; filtering and delivery use the normalized shape.
// No second public event schema is introduced.

interface RunSubscriptionFilter {
  topics: NormalizedRunEvent["topic"][];
  minLevel: NormalizedRunEvent["level"];
  storyIds: string[];
  includeData: "none" | "summary" | "full-bounded"; // same enum as the attached stream path
}

interface RunSubscriptionWakePolicy {
  minLevel?: NormalizedRunEvent["level"];
  topics?: NormalizedRunEvent["topic"][]; // e.g. "merge", "pr"
  types?: string[];                       // concrete raw event type names, e.g. "run-blocked"
}

interface RunSubscription {
  schemaVersion: 1;                   // internal runtime artifact schema, not public API/config version
  id: string;                          // capability handle
  runId: string;                       // run scope
  filter: RunSubscriptionFilter;
  wakeOn: RunSubscriptionWakePolicy;   // defaults to filter when omitted
  throttleMs: number;
  committedCursor: string;             // last acked offset into events.ndjson (delivery resumes here)
  createdAt: string;
  updatedAt: string;
  terminal: boolean;
  status: "active" | "complete" | "blocked" | "aborted" | "supervision_lost" | "dry-run" | "closed";
}

interface RunSubscriptionWakeSignal {
  subscriptionId: string;
  runId: string;
  wokeAt: string;
  reason: "events-available" | "terminal";
  cursorAtWake: string;
}

interface RunSubscriptionPollInput {
  runId?: string;             // or runPath; follows existing run read-tool resolution
  runPath?: string;
  subscriptionId: string;
  ackCursor?: string;      // nextCursor from the prior poll; commits delivery up to here. Omit on first poll.
  max?: number;
}

interface RunSubscriptionPollResult {
  subscriptionId: string;
  events: NormalizedRunEvent[]; // filtered + scrubbed via includeData, same rules as the stream path
  committedCursor: string; // position advanced to from this call's ackCursor
  nextCursor: string;      // end of the returned batch; ack this on the next poll once processed
  terminal: boolean;
  status: RunSubscription["status"];
  eventsDelivered: number; // current poll page length
}
```

Contract rules:

- Normalized event `data` scrubbing and `includeData` shaping follow the same rules and the same enum
  (`none` | `summary` | `full-bounded`) as the attached stream path; the detached path never exposes
  raw child host events and never introduces a second `includeData` value.
- `RunSubscription.schemaVersion` is persisted in `<subscriptionId>.json` and versioned separately
  from runtime `apiVersion` and `.workflow/config.yaml` schema compatibility. V1 readers should
  reject unknown future subscription artifact versions with a clear artifact-schema error rather
  than silently corrupting cursor state.
- The wake artifact carries only `RunSubscriptionWakeSignal` (a pointer), never event bodies — the
  host reads events through the poll tool, keeping the wake file tiny.
- Cursors are opaque to clients; only the kit interprets them. Delivery resumes from
  `committedCursor`, which advances **only** when the client acks a prior `nextCursor` (two-phase),
  preserving at-least-once across a crash between batch return and processing. Clients dedupe on
  normalized event `id`.

## Host-integration contract

This is the boundary the kit guarantees and the host must complete.

### Kit guarantees

| Guarantee | Behavior |
| --- | --- |
| Ordering | Events delivered in `events.ndjson` append order; the committed cursor is monotonic. |
| Delivery | At-least-once via a two-phase cursor: the server advances `committedCursor` only when the client acks the prior `nextCursor`, so a crash between batch return and processing re-delivers rather than skips. Clients must be idempotent on normalized event `id`. At-most-once is not offered. |
| Replay on reconnect | `subscribe` returns a bounded replay tail; `poll` always resumes from `committedCursor` regardless of how long the subscriber was away or whether the last batch was acked. |
| Terminal signaling | On complete/block/abort/supervision-lost, and on already-terminal dry-run state: terminal state is reflected in the subscription, `terminal: true` on poll, and a final wake with `reason: "terminal"`. |
| Backpressure / throttle | `throttleMs` coalesces wake touches; `poll` batches and honors `max`. A wake means "there may be work", not "exactly one event". |
| Scoping / auth | A subscription is scoped to one run; run ref plus `subscriptionId` are the capability reference for poll and unsubscribe. |
| Durability | Subscription records and cursors are files; they survive a kit process restart. `events.ndjson` is the source of truth; the wake artifact is reconstructable from the record + journal. |

### Host responsibilities

The host binds its own wake mechanism to the wake artifact. A reference adapter loop:

```text
1. call workflow_run_subscribe(runId, filters, wakeOn) -> { subscriptionId, wakeArtifact, ... }
2. process the returned replay tail; track its nextCursor as the pending ack; yield the agent's turn
3. watch wakeArtifact (fs.watch / mtime poll / OS signal); keep a long fallback timer for liveness
4. on wake: resume the agent; call workflow_run_subscription_poll(runId, subscriptionId, ackCursor=pending)
5. durably process the returned events, then set pending = nextCursor from the result
6. if terminal -> stop watching + workflow_run_unsubscribe(runId, subscriptionId); else yield again and return to step 3
```

The ack in step 4 commits the previous batch; if the host crashed before step 5 last time, the same
events are re-delivered (dedupe on normalized event `id`).

The kit does not assume any specific host mechanism. fs.watch is push-quality where available;
mtime poll is the portable fallback; an OS signal is available where the host can register one. All
three observe the same wake artifact.

## Failure, abort, and terminal semantics

| Situation | Behavior |
| --- | --- |
| Run completes / blocks / aborts | Terminal journal event -> subscription `terminal: true`, `status` set accordingly, final wake (`reason: "terminal"`); host unsubscribes. |
| Run enters `supervision_lost` | `run-supervision-lost` event -> subscription `terminal: true`, `status: "supervision_lost"`, final wake; host can analyze/recover rather than continue waiting. |
| Subscription is created for an already-terminal dry-run or completed run | `subscribe` returns terminal state immediately with replay tail and a wake artifact that does not require future touches. |
| Kit process restart | Subscription record + `committedCursor` are durable files; on next poll, delivery resumes from `committedCursor` (an unacked batch is simply re-delivered). The wake artifact is reconstructed lazily. |
| No new matching events while run is alive | No wake fires (avoids busy-wake). The host's long fallback timer covers liveness. |
| Burst of events | Coalesced into at most one wake per `throttleMs`; the following poll returns the batch. |
| Subscriber never returns (orphan) | Subscription is cleaned up on run completion / TTL; `unsubscribe` is idempotent and safe to call late. |
| Unknown / closed `subscriptionId` | Poll/unsubscribe return a clear, structured error via the existing error envelope; no partial state is created. |
| Config is missing or incompatible for `runId` resolution | Subscribe/status-style resolution by `runId` fails closed with config compatibility diagnostics and `next` actions pointing to `workflow_config_status` / `workflow_config_upgrade`. Artifact-local poll/unsubscribe by explicit `runPath` may continue only where existing run-read fallback semantics can identify the run artifact without compatible config. |
| Poll after terminal | Returns `terminal: true`, `committedCursor` == `nextCursor`, and an empty `events` tail; safe and idempotent. |

## Reuse and the "no change" boundary

This capability is parallel and additive. Explicitly unchanged:

- `workflow_run_stream` (attached, long-lived, progress-token keyed) — behavior unchanged.
- `notifications/progress` and `notifications/workflow_event` — payloads and semantics unchanged.
- `watch_run_start` / `watch_run_poll` / `watch_run_stop` — behavior unchanged.
- `workflow_runtime_info`, `workflow_config_status`, and `workflow_config_upgrade` — remain the
  runtime/config compatibility surfaces; subscription tools consume their policy rather than
  redefining version behavior.

Explicitly reused, not reinvented:

- The normalized event model and the topic/level/storyId/includeData filters.
- `events.ndjson` as the durable event sink; `RunJournal.record` and command-level append helpers
  must converge on the same subscription notifier.
- The `events.ndjson` cursor model already used by `watch_run_poll`.
- The MCP success/error envelope and the artifact-ref + next-steps response shape.

## Observability

- Journal a `subscription-created`, `subscription-woken`, and `subscription-closed` event under a
  suitable existing topic (e.g. `run`/`control`) so subscription lifecycle is auditable from the
  same journal, without a new schema.
- Surface active-subscription count, total subscription count, per-subscription status/cursor
  summaries, metrics, and last-wake timestamps in inspect output so operators can see detached
  subscribers without reading raw artifacts.
- Surface `detachedRunSubscriptions: true` in project inspection capabilities when the runtime can
  create and poll subscription artifacts.
- Record wake counts, matched-event counts, coalescing counts, and durable delivered-event counts in
  each subscription record to make throttle behavior observable.

## Testing strategy

Verification gate when implemented: `pnpm check` (Biome lint + typecheck + Vitest), per
[AGENTS.md](../../../../AGENTS.md).

- Unit — subscription registry create/poll/unsubscribe; run-ref plus subscription-id lookup;
  two-phase cursor (committed advances only on
  ack) and monotonicity; an unacked batch re-delivers on the next poll; filter application (`topics`,
  `minLevel`, `storyIds`, `includeData` incl. `full-bounded`); terminal marking; wake touch on
  matching event; `throttleMs` coalescing; `wakeOn` narrowing vs the delivery filter, incl.
  topic-level (`merge`/`pr`) vs type-level matches; terminal status mapping for `complete`,
  `blocked`, `aborted`, `supervision_lost`, and already-terminal `dry-run`.
- Integration — drive a fake/in-memory journal: subscribe, append events, assert the wake artifact
  is touched, poll returns the ordered filtered batch, the committed cursor advances only after ack,
  and the terminal flow fires a final wake and `terminal: true`. Assert at-least-once replay after a
  simulated gap/restart with an unacked batch. Cover both `RunJournal.record` and command-level
  append helper paths so every journal writer wakes subscribers. Reuse the existing journal /
  `artifactStore` test patterns.
- Contract — schema/round-trip tests for the new tool inputs/outputs and the subscription record;
  assert returned events match the existing `workflow_event` shape (no second schema); assert
  `schemaVersion: 1` is required for subscription records and unknown future schema versions fail
  with an artifact-schema diagnostic.
- Compatibility — cover current `"0.6.0"` configs, legacy numeric `version: 1`, unsupported-old,
  unsupported-new, and missing-version configs. Assert subscribe-by-`runId` follows the config
  compatibility classifier and points blocked users at `workflow_config_status` /
  `workflow_config_upgrade`; assert explicit `runPath` poll/unsubscribe works only for the
  artifact-local fallback cases already supported by run readers.
- Regression — assert `workflow_run_stream`, the `notifications/*` paths, and `watch_run_*` are
  unchanged.
- Tool surface — update CLI/MCP surface tests so `workflow_runtime_info`,
  `workflow_config_status`, `workflow_config_upgrade`, `workflow_run_subscribe`,
  `workflow_run_subscription_poll`, and `workflow_run_unsubscribe` remain discoverable together,
  and project inspection advertises `detachedRunSubscriptions`.
- Manual — subscribe to a disposable live run, observe the wake artifact mtime change as events
  append, poll to retrieve them, and confirm terminal on run completion. Also subscribe to an
  already-terminal dry-run and confirm `terminal: true` is returned immediately.

## Open technical questions

No question blocks delivery-track planning. These defaults should be preserved in story briefs
unless a detailed technical story spec proves they need adjustment:

- Q1 — Wake transport detail: standardize on touch-mtime + minimal JSON payload in the `.wake` file
  (recommended default, most portable), and document fs.watch / OS-signal as host-side bindings over
  the same file. Richer transports such as webhook or named pipe are out of V1 scope unless a host
  adapter proves file observation is unavailable.
- Q2 — Subscription TTL / max active subscriptions per run: clean up on run completion plus a
  generous idle TTL; enforce a soft cap per run with a clear structured error beyond it.

## Assumptions

- A1 — `events.ndjson` remains the single durable normalized event sink and append order is the
  canonical event order (holds today via `RunJournal` and command-level append helpers).
- A2 — Hosts can observe a file via at least one of fs.watch, mtime poll, or an OS signal; the kit
  targets the lowest common denominator (mtime) and lets richer mechanisms bind to the same file.
- A3 — Subscribers are idempotent on normalized event `id`, consistent with the at-least-once
  guarantee.
- A4 — Runtime artifacts (including `subscriptions/`) stay repo-local and ignored by completion
  dirty checks, consistent with existing run-artifact retention.
- A5 — The event writer owns wake evaluation for its own append. A shared notifier is called from
  all append paths instead of depending on a long-lived MCP tool after the original request returns.
- A6 — Runtime `apiVersion` remains `"1"` for this feature; no public event payload or envelope
  version changes are required.
- A7 — `CURRENT_CONFIG_SCHEMA_VERSION` remains `0.6.0` unless implementation adds subscription
  settings to `.workflow/config.yaml`.
- A8 — Subscription artifact `schemaVersion: 1` is the migration boundary for files under
  `subscriptions/`, separate from package semver, public API version, and config schema semver.

## Inputs for delivery tracker / story briefs

Provided so a future `plan-delivery-track` pass can slice stories without re-deriving design. (No
tracker stories are created by this document.)

- Foundation candidate — subscription registry + cursor + `subscriptions/` artifacts, run-ref plus
  subscription-id lookup, and the durable record/poll core over `events.ndjson`. PRD criteria:
  OBS-1, OBS-5, OBS-7, FUT-2. Cites sections "Chosen mechanism", "Run artifact additions", "Data
  contracts".
- Pilot candidate — `workflow_run_subscribe` / `workflow_run_subscription_poll` /
  `workflow_run_unsubscribe` MCP tools + facade, plus the shared wake notifier for every event
  append path and required observability (lifecycle events, inspect surfacing, coalescing counts).
  PRD criteria: OBS-1, OBS-3, OBS-5, OBS-7, FUT-2. Cites "API surface", "Event append and wake
  authority", "Host-integration contract", "Observability", "Failure, abort, and terminal
  semantics".
- Rollout candidate — CLI verbs and the documented host-adapter contract + example loop. Cites "API
  surface" (CLI) and "Host-integration contract". PRD criteria: OBS-7, HC-1, HC-2.
- Polish candidate — optional operator refinements beyond the required inspect summary, such as
  richer reports or dashboards if later usage shows they are needed.
- File contention / sequencing — touches `runner/RunJournal.ts` (artifact additions),
  command-level event append helpers, `mcp/tools.ts` and `api/facade.ts` (new tools/facade), and the
  CLI command layer. The new tools are parallel to `workflow_run_stream`; do not modify the stream
  path. Sequence foundation before pilot before rollout.
- Validation expectations to inherit — the at-least-once + replay-on-reconnect + terminal-wake tests
  in "Testing strategy", run-ref lookup tests, append-path wake coverage, and the regression
  assertion that existing streaming/poll tools are unchanged. Also inherit the version-aware cases:
  current/legacy/unsupported config compatibility, `schemaVersion: 1` record validation, and
  `workflow_project_inspect.capabilities.detachedRunSubscriptions` discovery.
