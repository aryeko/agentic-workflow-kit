---
title: "Supervision & Liveness — charter"
id: "core-04"
layer: "core"
status: "charter: ready"
last-reviewed: 2026-06-18
---

# Supervision & Liveness — charter

**Purpose.** Know whether a worker is *really* making progress, from real worker events — and drive
termination when it is not.

## Responsibilities (in scope)
- Liveness derived from real worker events (progress / tool / phase), explicitly **not** from parent
  polling, watch reconnects, or projection reads.
- The timer set (startup, idle, no-progress, per-tool, approval-SLA, max-runtime) and the liveness
  projection/states.
- The host-neutral **wait primitive** over the event cursor (long-poll on sequence), so an operator
  can block-wait without external tooling.

## Out of scope
- The actual interrupt/kill mechanics and containment (Execution Host, prov-04).
- Emission of the worker events themselves (the Agent driver emits; this consumes).

## Requirements owned
FR-5 (live supervision), NFR-OBS, NFR-DET.

## Dependencies (Dependency Rule)
- Depends on: core-01 (event cursor), the **Agent contract** (progress events), and **Execution Host** (termination).
- Must NOT: depend on the Codex driver.

## Required reading
Standard set + [core-01](../core-01-run-lifecycle-and-state/charter.md) and the Agent contract in
[prov-01](../prov-01-agent-execution/charter.md).

## Deliverable
`design.md` defining: which event classes advance liveness (and which never do); the timers + proposed
defaults; the `waitRunEvents` primitive; the liveness states.

## Definition of done (domain-specific)
- Staleness derives from real progress; a stale worker can never look active.
- Parent polls never refresh liveness; a terminated run stops emitting supervisor events.

## Open questions
- Concrete timeout defaults; the "decision delivered but not consumed" gap.
