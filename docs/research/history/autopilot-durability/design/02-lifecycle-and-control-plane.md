---
title: D2 — Child lifecycle & control plane
status: draft
last-reviewed: 2026-06-18
part-of: autopilot-durability
themes: [D, E, F]
builds-on: [00-overview.md]
---

# D2 — Child lifecycle & control plane

Make a live child **observable, controllable, and killable**; make session **linkage an append-only fact**;
make **supervision reflect real child progress**. Themes **D** (control/kill), **E** (linkage), **F** (live
supervision). Builds on the [spine](00-overview.md): the channel, event-sourced state, ownership classes.

## 1. Principle — own the process, never borrow it

The kit **spawns and owns** the child as its own **process group / session leader**, retaining the group id
(not just a single pid). Reliable control is a property of *process ownership*, not of any Codex feature
([runtime findings](notes/codex-runtime-findings.md)). **Ownership is defined by who spawned the process, not
by how the session began:** a child the kit launches via `codex mcp-server`, `app-server`, **or
`codex resume <id>`** is **owned** — controllable and killable — even though `resume` reconstructs prior
session state. **Un-owned** means the kit does not hold the process: the Codex **desktop app**, or a session
the kit **attaches to / observes but did not spawn**. Those are **observe-only**, surfaced as
`not-controllable`, and the control plane refuses to promise interrupt/kill it can't deliver.

## 2. Runtime/protocol target (the deferred fork) — RECOMMENDATION, confirm on review

The [runtime findings](notes/codex-runtime-findings.md) pinned the tradeoff. Both options keep the kit-owned process; they differ on control fidelity and
maturity:

| | `codex mcp-server` v1 + elicitation handler | `codex app-server` v2 (stdio) |
|---|---|---|
| Approval relay | works (add `elicitation/create` handler + capability) | first-class (`item/commandExecution/requestApproval`, per-host `network_policy_amendment`, `PermissionGrantScope`) |
| Graceful interrupt | unreliable (interrupt tool runs on a *separate* server) | protocol-native (verify exact verb) |
| Guaranteed kill | yes — capture `transport.pid`, own it | yes — owned stdio child |
| Maturity | stable, in use today | **experimental; `remote_control` flag churny — pin + probe per version** |

**Recommendation — phased, behind one host-neutral driver contract (§3):**

- **Phase 0 (ship-safe):** `codex mcp-server` + an `elicitation/create` handler + **own the pid**. This makes
  the relay work and makes the child **killable** (the guarantee `auto-merge`/`auto-recover` depend on). It
  advertises `control: degraded` (interrupt best-effort) — honest, and safe because kill is guaranteed.
- **Phase 1 (target):** a `codex app-server` v2 driver for first-class approvals + graceful interrupt,
  gated by a per-version capability probe.

Because the driver contract is host-neutral (P8), both are implementations behind one interface; capability
flags advertise the available control level. **We never block on the experimental path** — Phase 0 is fully
safe on its own. *(This is the one D2 decision to confirm; everything below holds either way.)*

## 3. Driver contract (host-neutral) — the control surface

```
launchStory(req) -> { handle, ownershipClass: owned|unowned, capabilities }   // owns pid when owned
events(handle)   -> async stream of { progress | approval-request | linked | terminal }
controlChild(handle, { kind: interrupt|kill, reason }) -> ControlOutcome        // interrupt best-effort; kill guaranteed when owned
classifyError(err) -> { supervisionLost, recoverable }
```

- `controlChild` returns `requested | applied | unsupported | already-terminal`; `unsupported` is the honest
  answer for an un-owned session, never a silent no-op.
- The driver **retains the `ChildProcess`/pid** for owned children and exposes `kill`. No operation depends
  on a separately-spawned helper process reaching the live session (the v1 mistake).

## 4. Guaranteed termination (Theme D)

**The bug:** every timeout path only `reject()`s; `settleSupervisionLost` journals but issues no signal; no
process handle is retained — so a hung child orphaned for ~94 min (`ChildSupervisor.ts:118-135, 376-390`).

**The fix — two-tier termination on every terminal path** (no-progress, max-runtime, supervision-lost,
operator abort):

```
1. signal AbortSignal + attempt graceful interrupt (best-effort, time-boxed)        // may be unsupported (Phase 0)
2. SIGTERM the **owned process group** (`kill(-pgid)`) → wait grace window
3. SIGKILL the **whole group** if any member survives → wait + reap
4. verify no descendant survives (group is empty); else escalate/alert
```

Termination targets the **process group / session tree**, not a single pid — Codex and tool commands spawn
descendants (`pnpm`, `git`, shells, test servers), and killing only the parent leaves orphans. Because the
kit spawned the child as a **session leader** it owns the whole group, so it can signal and **reap the entire
tree** within a bounded time, independent of any Codex interrupt verb. `settleSupervisionLost` **must
terminate the group**, not just set state. Each step records a `ControlRequest`/`ControlOutcome` event. The
guarantee is **"the owned process group is terminated and reaped, with no surviving descendants"** — and it is
**tested** by asserting zero group members remain after kill. Un-owned children can't be killed; the run
records `not-controllable` and stops (recovery is D4's concern).

## 5. Session linkage as an append-only fact (Theme E)

**The bug:** `RunJournal.updateChildLaunch` rewrites `launch.json` from a stale in-memory record
(`{ ...record, ...fields }`, `:178`), nulling a known-good `sessionId`; control then fails with "no linked
session" (pathway #7).

**The fix (per D0 event-sourcing):** linkage is the **`child-session-linked` event**
`{ storyId, sessionId, sessionLogPath, ownershipClass, at }`, emitted by the driver as soon as the session
exists. The `launch` projection **derives** `sessionId` from the latest linkage event; **nothing overwrites
it from memory.** Linkage is therefore monotonic by construction. All control/abort paths read linkage from
the projection, so once a session is linked it can always be found — the clobber and the "no linked session"
failure both become impossible.

## 6. Live supervision off real progress (Theme F)

**The bug:** subscriptions needed `fswatch`; reported `active` while the child was stale 26 min; woke on
parent `child-supervisor-poll` (not child progress); closing didn't stop stale supervisor writes (pathway
#1-#5).

**The fix:**

- **Staleness is computed from real child progress**, not poll ticks. The `progress` message class carries
  genuine child activity (tool/phase/evidence) with timestamps; "no real progress for N" drives the
  no-progress timeout → termination (§4). A stale child can no longer look `active`.
- **Wake on real events.** The durable wake signal (coordinated with D5/D0) fires on real-progress and
  terminal events only. The kit provides a **host-agnostic wait primitive** (long-poll on the event cursor)
  so an operator can block-wait **without external tooling like `fswatch`**.
- **Terminated runs stop emitting.** Supervisor timers are bound to the run lifecycle (D4); once a run is
  terminal/aborted, no further `child-supervisor-poll` is written — eliminating the stale post-abort writes
  that overwrote the recovery reason.

Supervision states (all projections of the event log): `launching → linked → progressing →
(stalled → terminating) → settled`.

## 7. Capability ties (this domain provides the guarantee)

The **`child is killable (owned process)`** guarantee that `auto-merge` (D3) and `auto-recover` (D4) require
is produced here: true when `ownershipClass == owned` **and** the driver advertises `kill`. Un-owned or
`control: degraded`-without-kill → guarantee false → those capabilities stay disabled (safe by default).

## 8. Open questions

- v2 `app-server` graceful-interrupt verb (`cancel` / turn-interrupt) — verify against the generated schema
  per Codex version; pin the version and capability-probe at startup.
- Wait-primitive shape (long-poll vs OS-signal hint) — finalize with D5's subscription/telemetry design.
- Grace-window durations for SIGTERM→SIGKILL (config, with safe defaults).

## 9. Testability

- **Termination:** fake driver with a hung child → assert no-progress timeout triggers
  interrupt→SIGTERM→SIGKILL and that the pid is reaped (no orphan). Property: every terminal path ends in a
  dead owned process within the bounded window.
- **Linkage:** replay events including stale/out-of-order launch writes → assert the projection's `sessionId`
  is never null after a `child-session-linked` event (monotonic).
- **Supervision:** feed progress with gaps → assert staleness derives from real progress, not polls; assert a
  terminated run emits no further supervisor events.
- **Ownership:** un-owned session → `controlChild` returns `unsupported`; the `killable` guarantee is false →
  `auto-merge` disabled.

## Themes addressed

| Theme | Resolution |
|---|---|
| D | Own the pid; two-tier guaranteed termination on every terminal path; control outcomes recorded; no orphans |
| E | Linkage is an append-only event; the launch projection derives it; clobber and "no linked session" impossible |
| F | Supervision from real child progress; wake on real events; host-agnostic wait (no `fswatch`); terminated runs stop emitting |

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../../README.md) · **← Prev:** [D1 — Execution substrate & provisioning](./01-execution-substrate-and-provisioning.md) · **Next →:** [D3 — Completion, verification & merge safety](./03-completion-verification-and-merge.md)

<!-- /DOCS-NAV -->
