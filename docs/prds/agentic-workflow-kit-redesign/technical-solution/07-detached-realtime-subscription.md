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
and `events.ndjson` is a first-class run artifact (see [03-data-contracts.md](03-data-contracts.md),
"Run artifact shape"). Detached replay-by-cursor is therefore supported by existing infrastructure:
any reader can resume from a stored offset into `events.ndjson`. No second event schema and no new
event store are required.

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
- R7 — Subscriptions reach a **terminal** state on run abort/block/complete: a terminal event, a
  `terminal` flag on pull, and a final wake. Terminal is idempotent and observable.
- R8 — Filters (`topics`, `minLevel`, `storyIds`, `includeData`) and `throttleMs` are **stored
  server-side** with the subscription, so neither host nor agent must track them between turns.
- R9 — A subscription is **scoped to one run**; its handle is the capability reference for pull and
  unsubscribe.
- R10 — The capability is **purely additive**. `workflow_run_stream`, `notifications/progress`, and
  `notifications/workflow_event` behavior is unchanged, and the existing normalized event model is
  reused unchanged.

## Attached vs pull vs detached

| Path | Tool(s) | Cursor owner | Delivery | Survives turn yield? | Best for |
| --- | --- | --- | --- | --- | --- |
| Attached stream | `workflow_run_stream` | n/a (in-flight request) | push via progress token | No — ends with the request | Orchestrator/CLI blocked on the stream |
| Pull | `watch_run_start` / `watch_run_poll` | client-side | poll only | Yes, but the agent must keep polling | Periodic supervision when push is not needed |
| Detached subscription | `workflow_run_subscribe` / `workflow_run_subscription_poll` / `workflow_run_unsubscribe` | server-side (stored) | wake signal + pull | Yes — the wake lets the host resume an idle agent | Agent that yields its turn but wants realtime wakes |

The detached path's differentiator over the pull path is twofold: the cursor and filters are stored
server-side (the host tracks only the handle), and a wake signal lets the host suspend the agent and
resume it on events instead of polling on a fixed cadence.

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

### Sequence

```mermaid
sequenceDiagram
  autonumber
  participant Agent as "Detached orchestrating agent"
  participant Host as "MCP host (wake mechanism)"
  participant Tool as "WorkflowKit MCP tool"
  participant Reg as "Subscription registry"
  participant Wake as "Wake-signal artifact"
  participant Journal as "RunJournal / events.ndjson"
  participant Runner as "WorkflowRunner / Driver"

  Agent->>Tool: "workflow_run_subscribe(runId, filters, wakeOn)"
  Tool->>Reg: "Create subscription record + initial cursor"
  Tool->>Journal: "Read bounded replay tail"
  Tool-->>Agent: "subscriptionId, committedCursor, nextCursor, wakePath, replay tail, host hints"
  Agent->>Host: "Yield turn; bind wake to wakePath"
  Runner->>Journal: "Append normalized event"
  Journal-->>Tool: "New row past committed cursor"
  Tool->>Wake: "Touch wake artifact (coalesced by throttleMs)"
  Wake-->>Host: "Filesystem change / signal"
  Host->>Agent: "Resume idle turn"
  Agent->>Tool: "workflow_run_subscription_poll(subscriptionId, ackCursor=prior nextCursor)"
  Tool->>Reg: "Commit ackCursor; read filters"
  Tool->>Journal: "Read + filter events after committed cursor"
  Tool-->>Agent: "Ordered batch + nextCursor + terminal flag"
  Note over Runner,Journal: "On run abort/block/complete -> terminal event"
  Journal-->>Tool: "Terminal row"
  Tool->>Wake: "Final wake (terminal)"
  Tool->>Reg: "Mark subscription terminal"
  Agent->>Tool: "workflow_run_subscription_poll -> terminal=true"
  Agent->>Tool: "workflow_run_unsubscribe(subscriptionId)"
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
    <subscriptionId>.json        durable subscription record (filters, cursor, terminal state)
    <subscriptionId>.wake        tiny wake-signal artifact (mtime + minimal payload)
```

Retention follows the existing rule: runtime artifacts are repo-local and ignored by completion
dirty checks. Subscription records and wake artifacts are runtime artifacts and inherit that rule.

## API surface (additive)

Naming follows existing conventions: MCP tools are `workflow_run_*`; CLI verbs are
`agentic-workflow-kit run <verb>`. Returned event payloads reuse the existing
`notifications/workflow_event` event shape; no new event schema is introduced.

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

`wakeOn` selects which events touch the wake artifact, matching on any of `minLevel`, `topics`
(`RunEvent.topic` values, e.g. `merge`/`pr`), or `types` (concrete `RunEvent.type` names, e.g.
`run-blocked`, `child-error`). It defaults to the subscription filter (every deliverable event
wakes); narrowing it lets a host sleep through routine progress and wake only on notable
transitions. Use `topics` for topic-level matches such as `merge` and `pr` — `merge`/`pr` are
topics, not event types, so listing them under `types` would never match. **Terminal transitions
(`run-complete`, `run-aborted`, `run-blocked`) always fire a final wake regardless of `wakeOn`**, so
a host can never sleep through the end of a run. `throttleMs` coalesces wake touches so bursts
produce at most one wake per window.

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
      "poll": {"mcpTool": "workflow_run_subscription_poll", "arg": "subscriptionId"},
      "close": {"mcpTool": "workflow_run_unsubscribe", "arg": "subscriptionId"}
    }
  }
}
```

### `workflow_run_subscription_poll`

Return deliverable events for a subscription and report terminal state. The cursor and filters are
**server-side and keyed to `subscriptionId`** (distinct from `watch_run_poll`, which keeps the
cursor client-side), but the server **commits the cursor only on acknowledgement**, never simply
because a batch was returned.

The cursor is **two-phase** to preserve at-least-once delivery (R5). Each poll returns the batch
since the last *committed* cursor plus a `nextCursor` marking the end of that batch. The server
commits `nextCursor` only when the client passes it back as `ackCursor` on a subsequent poll
(acknowledging it durably processed that batch). If the host crashes or the transport fails after
the server returns a batch but before the client acks, the next poll re-delivers from the last
committed cursor — no events are lost. Clients dedupe on `RunEvent.id`. This makes the detached path
at least as safe as `watch_run_poll`'s client-owned cursor.

Input (omit `ackCursor` on the first poll):

```json
{
  "repo": "/repo",
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
    "eventsDelivered": 184
  }
}
```

`committedCursor` echoes the position the server advanced to from this call's `ackCursor`;
`nextCursor` is the position the client should ack on its next poll once it has durably processed the
returned batch. A poll with no new events returns an empty `events` array with `nextCursor` equal to
`committedCursor`; this is the expected idle case and is cheap.

### `workflow_run_unsubscribe`

Idempotent teardown. Marks the subscription closed/terminal and removes the wake artifact. Safe to
call after terminal or more than once.

Input:

```json
{ "repo": "/repo", "subscriptionId": "sub_8f2c..." }
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
- `agentic-workflow-kit run subscription-poll <subscriptionId> [--max N] [--format ndjson]`
- `agentic-workflow-kit run unsubscribe <subscriptionId>`

CLI defaults to human-readable with `--json` / `--format ndjson` for automation, consistent with the
existing CLI API goals.

## Data contracts

These reuse the existing `RunEvent` model (see [03-data-contracts.md](03-data-contracts.md),
"Interface contracts"). Exact TypeScript names can change during implementation; each concept gets
schema/tests before runtime depends on it.

```ts
// Reused unchanged from 03-data-contracts.md: RunEvent (id, runId, storyId?, childId?,
// timestamp, topic, level, type, message, data?). No second event schema is introduced.

interface RunSubscriptionFilter {
  topics: RunEvent["topic"][];
  minLevel: RunEvent["level"];
  storyIds: string[];
  includeData: "none" | "summary" | "full-bounded"; // same enum as the attached stream path
}

interface RunSubscriptionWakePolicy {
  minLevel?: RunEvent["level"];
  topics?: RunEvent["topic"][];   // e.g. "merge", "pr"
  types?: string[];               // concrete RunEvent.type names, e.g. "run-blocked", "child-error"
}

interface RunSubscription {
  id: string;                          // capability handle
  runId: string;                       // run scope
  filter: RunSubscriptionFilter;
  wakeOn: RunSubscriptionWakePolicy;   // defaults to filter when omitted
  throttleMs: number;
  committedCursor: string;             // last acked offset into events.ndjson (delivery resumes here)
  createdAt: string;
  updatedAt: string;
  terminal: boolean;
  status: "active" | "complete" | "blocked" | "aborted" | "closed";
}

interface RunSubscriptionWakeSignal {
  subscriptionId: string;
  runId: string;
  wokeAt: string;
  reason: "events-available" | "terminal";
  cursorAtWake: string;
}

interface RunSubscriptionPollInput {
  subscriptionId: string;
  ackCursor?: string;      // nextCursor from the prior poll; commits delivery up to here. Omit on first poll.
  max?: number;
}

interface RunSubscriptionPollResult {
  subscriptionId: string;
  events: RunEvent[];      // filtered + scrubbed via includeData, same rules as the stream path
  committedCursor: string; // position advanced to from this call's ackCursor
  nextCursor: string;      // end of the returned batch; ack this on the next poll once processed
  terminal: boolean;
  status: RunSubscription["status"];
  eventsDelivered: number;
}
```

Contract rules:

- `RunEvent.data` scrubbing and `includeData` shaping follow the same rules and the same enum
  (`none` | `summary` | `full-bounded`) as the attached stream path; the detached path never exposes
  raw child host events and never introduces a second `includeData` value.
- The wake artifact carries only `RunSubscriptionWakeSignal` (a pointer), never event bodies — the
  host reads events through the poll tool, keeping the wake file tiny.
- Cursors are opaque to clients; only the kit interprets them. Delivery resumes from
  `committedCursor`, which advances **only** when the client acks a prior `nextCursor` (two-phase),
  preserving at-least-once across a crash between batch return and processing. Clients dedupe on
  `RunEvent.id`.

## Host-integration contract

This is the boundary the kit guarantees and the host must complete.

### Kit guarantees

| Guarantee | Behavior |
| --- | --- |
| Ordering | Events delivered in `events.ndjson` append order; the committed cursor is monotonic. |
| Delivery | At-least-once via a two-phase cursor: the server advances `committedCursor` only when the client acks the prior `nextCursor`, so a crash between batch return and processing re-delivers rather than skips. Clients must be idempotent on `RunEvent.id`. At-most-once is not offered. |
| Replay on reconnect | `subscribe` returns a bounded replay tail; `poll` always resumes from `committedCursor` regardless of how long the subscriber was away or whether the last batch was acked. |
| Terminal signaling | On abort/block/complete: a terminal event in the journal, `terminal: true` on poll, and a final wake with `reason: "terminal"`. |
| Backpressure / throttle | `throttleMs` coalesces wake touches; `poll` batches and honors `max`. A wake means "there may be work", not "exactly one event". |
| Scoping / auth | A subscription is scoped to one run; `subscriptionId` is the capability handle for poll and unsubscribe. |
| Durability | Subscription records and cursors are files; they survive a kit process restart. `events.ndjson` is the source of truth; the wake artifact is reconstructable from the record + journal. |

### Host responsibilities

The host binds its own wake mechanism to the wake artifact. A reference adapter loop:

```text
1. call workflow_run_subscribe(runId, filters, wakeOn) -> { subscriptionId, wakeArtifact, ... }
2. process the returned replay tail; track its nextCursor as the pending ack; yield the agent's turn
3. watch wakeArtifact (fs.watch / mtime poll / OS signal); keep a long fallback timer for liveness
4. on wake: resume the agent; call workflow_run_subscription_poll(subscriptionId, ackCursor=pending)
5. durably process the returned events, then set pending = nextCursor from the result
6. if terminal -> stop watching + workflow_run_unsubscribe; else yield again and return to step 3
```

The ack in step 4 commits the previous batch; if the host crashed before step 5 last time, the same
events are re-delivered (dedupe on `RunEvent.id`).

The kit does not assume any specific host mechanism. fs.watch is push-quality where available;
mtime poll is the portable fallback; an OS signal is available where the host can register one. All
three observe the same wake artifact.

## Failure, abort, and terminal semantics

| Situation | Behavior |
| --- | --- |
| Run completes / blocks / aborts | Terminal journal event -> subscription `terminal: true`, `status` set accordingly, final wake (`reason: "terminal"`); host unsubscribes. |
| Kit process restart | Subscription record + `committedCursor` are durable files; on next poll, delivery resumes from `committedCursor` (an unacked batch is simply re-delivered). The wake artifact is reconstructed lazily. |
| No new matching events while run is alive | No wake fires (avoids busy-wake). The host's long fallback timer covers liveness. |
| Burst of events | Coalesced into at most one wake per `throttleMs`; the following poll returns the batch. |
| Subscriber never returns (orphan) | Subscription is cleaned up on run completion / TTL; `unsubscribe` is idempotent and safe to call late. |
| Unknown / closed `subscriptionId` | Poll/unsubscribe return a clear, structured error via the existing error envelope; no partial state is created. |
| Poll after terminal | Returns `terminal: true`, `committedCursor` == `nextCursor`, and an empty `events` tail; safe and idempotent. |

## Reuse and the "no change" boundary

This capability is parallel and additive. Explicitly unchanged:

- `workflow_run_stream` (attached, long-lived, progress-token keyed) — behavior unchanged.
- `notifications/progress` and `notifications/workflow_event` — payloads and semantics unchanged.
- `watch_run_start` / `watch_run_poll` / `watch_run_stop` — behavior unchanged.

Explicitly reused, not reinvented:

- The normalized `RunEvent` model and the topic/level/storyId/includeData filters.
- `events.ndjson` as the durable event sink and `RunJournal` as the append path.
- The `events.ndjson` cursor model already used by `watch_run_poll`.
- The MCP success/error envelope and the artifact-ref + next-steps response shape.

## Observability

- Journal a `subscription-created`, `subscription-woken`, and `subscription-closed` event under a
  suitable existing topic (e.g. `run`/`control`) so subscription lifecycle is auditable from the
  same journal, without a new schema.
- Surface active-subscription count and last-wake timestamps in the run summary/inspect output so
  operators can see detached subscribers.
- Record wake coalescing counts (wakes fired vs events delivered) to make throttle behavior
  observable.

## Testing strategy

Verification gate when implemented: `pnpm check` (Biome lint + typecheck + Vitest), per
[AGENTS.md](../../../../AGENTS.md).

- Unit — subscription registry create/poll/unsubscribe; two-phase cursor (committed advances only on
  ack) and monotonicity; an unacked batch re-delivers on the next poll; filter application (`topics`,
  `minLevel`, `storyIds`, `includeData` incl. `full-bounded`); terminal marking; wake touch on
  matching event; `throttleMs` coalescing; `wakeOn` narrowing vs the delivery filter, incl.
  topic-level (`merge`/`pr`) vs type-level matches.
- Integration — drive a fake/in-memory journal: subscribe, append events, assert the wake artifact
  is touched, poll returns the ordered filtered batch, the committed cursor advances only after ack,
  and the terminal flow fires a final wake and `terminal: true`. Assert at-least-once replay after a
  simulated gap/restart with an unacked batch. Reuse the existing journal / `artifactStore` test
  patterns.
- Contract — schema/round-trip tests for the new tool inputs/outputs and the subscription record;
  assert returned events match the existing `workflow_event` shape (no second schema).
- Regression — assert `workflow_run_stream`, the `notifications/*` paths, and `watch_run_*` are
  unchanged.
- Manual — subscribe to a real dry-run, observe the wake artifact mtime change as events append,
  poll to retrieve them, and confirm terminal on run completion.

## Open technical questions

- Q1 — Wake transport detail: standardize on touch-mtime + minimal JSON payload in the `.wake` file
  (recommended default, most portable), and document fs.watch / OS-signal as host-side bindings over
  the same file. Confirm no host in scope needs a richer transport (webhook/named pipe) in V1.
- Q2 — Cross-process wake authority: when the kit runs as multiple processes for one run, decide
  which process owns wake-artifact touches (recommended: the journal-writing runner process, since
  it already owns appends).
- Q3 — Subscription TTL / max active subscriptions per run (recommended: cleaned on run completion
  plus a generous idle TTL; a soft cap with a clear error beyond it).

## Assumptions

- A1 — `events.ndjson` remains the single durable normalized event sink and append order is the
  canonical event order (holds today via `RunJournal`).
- A2 — Hosts can observe a file via at least one of fs.watch, mtime poll, or an OS signal; the kit
  targets the lowest common denominator (mtime) and lets richer mechanisms bind to the same file.
- A3 — Subscribers are idempotent on `RunEvent.id`, consistent with the at-least-once guarantee.
- A4 — Runtime artifacts (including `subscriptions/`) stay repo-local and ignored by completion
  dirty checks, consistent with existing run-artifact retention.

## Inputs for delivery tracker / story briefs

Provided so a future `plan-delivery-track` pass can slice stories without re-deriving design. (No
tracker stories are created by this document.)

- Foundation candidate — subscription registry + cursor + `subscriptions/` artifacts and the durable
  record/poll core over `events.ndjson`. Cites sections "Chosen mechanism", "Run artifact
  additions", "Data contracts".
- Pilot candidate — `workflow_run_subscribe` / `workflow_run_subscription_poll` /
  `workflow_run_unsubscribe` MCP tools + facade, plus the wake-artifact writer. Cites "API surface",
  "Host-integration contract".
- Rollout candidate — CLI verbs and the documented host-adapter contract + example loop. Cites "API
  surface" (CLI) and "Host-integration contract".
- Polish candidate — observability (lifecycle events, summary/inspect surfacing, coalescing counts)
  and TTL/cleanup. Cites "Observability", "Failure, abort, and terminal semantics".
- File contention / sequencing — touches `runner/RunJournal.ts` (artifact additions),
  `mcp/tools.ts` and `api/facade.ts` (new tools/facade), and the CLI command layer. The new tools
  are parallel to `workflow_run_stream`; do not modify the stream path. Sequence foundation before
  pilot before rollout.
- Validation expectations to inherit — the at-least-once + replay-on-reconnect + terminal-wake tests
  in "Testing strategy", and the regression assertion that existing streaming/poll tools are
  unchanged.
