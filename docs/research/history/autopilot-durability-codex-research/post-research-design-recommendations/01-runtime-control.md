---
title: Runtime and control recommendations
status: post-research recommendation draft
last-reviewed: 2026-06-18
sources: [R1, R2, R6]
---

# Runtime and control

## Problem

The incidents showed that the current child runtime could start work but could not be reliably controlled.
The parent could lose the session id, could not interrupt the active child through the live transport, and
could not kill orphaned descendants. A separate helper process is not a control channel to the live child.

## Recommendation

Use a phased hybrid driver:

1. **Phase 0:** keep `codex mcp-server` only if the kit owns the live stdio process, records durable session
   linkage, implements MCP `elicitation/create`, and reports interrupt as degraded unless proven.
2. **Phase 1:** add `codex app-server` as the target typed driver, behind version and capability probes.
   Use app-server thread/turn ids, streamed events, typed approval requests, and `turn/interrupt`.
3. **Degraded:** use `codex exec --json` only for pre-provisioned, no-approval automation.
4. **Observe-only:** treat Codex Desktop/App sessions and human-run `codex resume` sessions as observation
   sources unless the kit itself spawned the live process or controls the app-server connection.

Sources: [R1](../research-reports/R1-codex-runtime-control.md),
[R2](../research-reports/R2-process-ownership-termination.md),
[R6](../research-reports/R6-worker-supervision-liveness.md).

## Required ownership contract

The driver must expose a child execution handle, not just a session id:

- process containment: root pid, process group/session/cgroup/job handle, start time;
- protocol identity: Codex session id, thread id, turn id, item ids where available;
- log identity: session log path or transcript ref;
- ownership class: `owned`, `kit-spawned-resume`, `unowned-observe-only`, or `legacy`;
- capabilities: approval relay, graceful interrupt, hard kill, event stream, resume, scoped grants;
- event writer identity and run/story linkage.

`auto-merge`, `auto-recover`, and unattended operation require an owned child with hard termination
capability and coherent run state.

## Termination model

Immediate pid kill is insufficient. The runner must terminate the full process tree or stronger
containment:

1. request protocol interrupt if available;
2. signal the owned containment target (`SIGTERM` to process group, cgroup/systemd stop, Windows Job Object);
3. wait a bounded grace period;
4. send final kill (`SIGKILL`, cgroup/job termination, systemd final signal);
5. reap direct children;
6. prove containment empty or emit `termination-unverified`.

Preferred containment by platform:

| Platform | Recommended containment |
|---|---|
| macOS/Linux baseline | new process group/session; signal negative PGID on POSIX |
| Linux stronger mode | cgroup v2 or transient systemd scope with empty-cgroup proof |
| Windows | Job Object with no breakaway where possible |
| Unsupported/degraded | immediate pid only, blocks autonomous capabilities |

## Liveness model

Only child-originated events advance liveness. Parent polling, projection reads, watch reconnects, and
connection pings are not child progress.

Required event classes:

- `child-session-linked`;
- `child-phase-changed`;
- `child-tool-started`;
- `child-tool-output` with cursor, weak liveness only;
- `child-tool-finished`;
- `child-heartbeat` with explicit source and strength;
- `child-evidence-updated`;
- `approval-requested`;
- `child-terminal` / `child-run-result`.

Use separate timers for startup, idle, no-progress, active tool runtime, approval SLA, decision
consumption, settle, and max story runtime.

## Capability probes

At launch, record the runtime probe in the event log:

- `codex --version`;
- `codex features list`;
- app-server generated protocol method presence;
- MCP elicitation support;
- transport pid availability;
- interrupt/approval/resume capability;
- containment strength.

If a required probe fails, the run must downgrade before launch or stop with a named blocker.

## Degraded modes

| Missing capability | Behavior |
|---|---|
| No app-server | use MCP Phase 0 if elicitation and owned process are available |
| No MCP elicitation | launch only pre-provisioned/no-approval runs |
| No owned process tree | observe-only or manual supervised mode; no auto-merge/recover |
| Session id but no live handle | observe logs and Git/PR state only |
| No structured progress | enforce wall-clock bounds; mark liveness degraded |

## Validation spikes

- Trigger MCP approval with and without elicitation handler.
- Start app-server, capture `threadId`/`turnId`, call `turn/interrupt`, verify terminal event.
- Spawn descendant processes and prove termination empties the containment.
- Compare kit-spawned `codex resume` with human-run `codex resume`.
- Confirm parent polling never refreshes child progress timers.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../../README.md) · **← Prev:** [Codex MCP server provider-neutral capability report](../../../codex-agent-provider/research/codex-mcp-provider-neutral-report.md) · **Next →:** [Approval and provisioning recommendations](./02-approval-provisioning.md)

<!-- /DOCS-NAV -->
