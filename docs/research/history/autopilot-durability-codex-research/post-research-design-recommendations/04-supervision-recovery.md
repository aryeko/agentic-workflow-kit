---
title: Supervision and recovery recommendations
status: post-research recommendation draft
last-reviewed: 2026-06-18
sources: [R6, R7, R1, R2, R5, R12]
---

# Supervision and recovery

## Problem

The parent could poll and write artifacts while the child was stale. Recovery could require manual edits,
manual `codex resume`, or blind relaunch. That is unsafe because the old child may still be alive, the
worktree may contain useful work, or the branch/PR may already have durable state.

## Recommendation

Use event-cursor supervision and an evidence-classified recovery state machine.

Supervision answers: is the child really making progress?

Recovery answers: given the actual evidence, which action is safe?

Sources: [R6](../research-reports/R6-worker-supervision-liveness.md),
[R7](../research-reports/R7-recovery-resume-relaunch.md),
[R1](../research-reports/R1-codex-runtime-control.md),
[R2](../research-reports/R2-process-ownership-termination.md),
[R5](../research-reports/R5-event-sourced-run-state.md),
[R12](../research-reports/R12-coordination-concurrency.md).

## Wait primitive

Expose a host-neutral wait API over event sequence numbers:

```text
waitRunEvents(runId, { afterSeq, until, includeSnapshot, timeoutMs })
  -> { snapshot?, events, nextSeq, timedOut, terminal }
```

The cursor is the event sequence, not a timestamp or file mtime. Keepalive/bookmark responses may prove
the wait channel is open, but they do not advance child liveness.

## Liveness projection

Derive these fields from child-originated events:

- `lastChildEventAt`;
- `lastStrongProgressAt`;
- `lastWeakHeartbeatAt`;
- `activePhase`;
- `activeTool`;
- `activeApprovalRequest`;
- `idleForMs`;
- `noProgressForMs`;
- `stateTimerForMs`;
- `livenessState`;
- per-metric availability with unavailable reasons.

Parent events such as `supervisor-poll`, `projection-read`, `watch-opened`, and `connection-ping-ok`
do not refresh progress.

## Recovery classifier

Recovery must acquire writer/story authority, rebuild projections, inspect live process/lease/tracker/Git/PR
state, and then emit `recovery-classified` before acting.

Recommended states:

| State | Default action |
|---|---|
| `awaiting-approval` | resume same handle after decision; no relaunch |
| `approval-decision-not-consumed` | operator unless same handle can be controlled |
| `child-progress-stalled-owned` | terminate/reap, then reclassify |
| `child-progress-stalled-unowned` | observe-only/operator |
| `process-dead-session-resumable` | kit-owned resume if Git/PR/claim checks pass |
| `process-dead-no-session` | relaunch only from empty safe state |
| `termination-unverified` | operator-required; no clear/relaunch/merge |
| `worktree-dirty` | operator or kit-owned resume with evidence handoff |
| `worktree-gone` | inspect branch/PR before cleanup |
| `branch-pr-exists` | observe/update/verify; no duplicate launch |
| `manual-intervention-observed` | observe-only until operator takeover |
| `claim-without-launch` | auto-clear only if same-run empty claim |
| `orphan-launch-reservation` | auto-clear only if never spawned/no work |
| `already-merged` | reconcile/close run |
| `log-corrupt` | operator-required |

## Resume semantics

`codex resume` has two different meanings:

- **kit-owned resume:** the kit starts the resumed process or app-server turn, records containment and
  session/turn ids, owns the writer/story lease, and proves no duplicate live child exists;
- **observe-only resume:** a human or Codex Desktop/App resumes a session outside the kit. The kit may read
  logs and inspect Git/PR/tracker state, but cannot claim interrupt, kill, approval delivery, or auto-recover.

A session id alone is never ownership.

## Action safety classes

| Action | Class | Required evidence |
|---|---|---|
| rebuild projections | auto-safe | valid log prefix |
| read logs/Git/PR/tracker/leases | auto-safe | read-only inspectors |
| append recovery classification | auto-safe | writer lease and coherent projection |
| resume same live approval handle | auto-safe | same owned handle and persisted request |
| kit-spawned app-server/CLI resume | safe only for selected states | no live prior child, session linked, leases held, Git/PR/tracker match |
| terminate owned stale child | auto-safe when policy allows | verified containment identity and stale child evidence |
| relaunch clean state | auto-safe only for no-work states | containment empty, clean/absent worktree, no branch/PR work |
| resume dirty worktree | operator-required by default | explicit operator choice |
| relaunch over existing branch/PR | operator-required | exact-head plan and no duplicate child |
| relaunch while prior child may be alive | forbidden | unsafe duplicate work |
| clear claim after unverified termination | forbidden | could hide surviving child |

## Degraded modes

| Missing evidence/capability | Behavior |
|---|---|
| no reliable process-tree containment | no auto-recover/relaunch/merge |
| no session id | relaunch only from empty safe state |
| session id but no live handle | observe-only unless kit starts owned resume and checks pass |
| missing worktree | inspect branch/PR; operator if durable work exists |
| remote branch or PR unknown | block auto-recovery |
| event log corrupt | read-only report/operator repair |
| manual recovery observed | record evidence and rerun inspectors; do not claim control |

## Validation spikes

- Kit-owned resume versus human-run resume contrast.
- Duplicate-live prevention after stale lease expiry.
- Process-death relaunch matrix: clean, dirty, branch, PR, unknown PR.
- Missing/moved/pruned worktree matrix.
- Lease-fencing stale writer replay.
- Approval recovery across parent restart.
- Legacy 0.7.0 incident import.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../../README.md) · **← Prev:** [State and coordination recommendations](./03-state-coordination.md) · **Next →:** [Completion and merge recommendations](./05-completion-merge.md)

<!-- /DOCS-NAV -->
