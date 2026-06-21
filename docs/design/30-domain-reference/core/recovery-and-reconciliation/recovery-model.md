---
title: "Recovery, Reconciliation & Coordination - recovery model"
status: approved
last-reviewed: "2026-06-19"
---

# Recovery model

This file holds the detailed classifier, action-safety matrix, repo-level lease rules, and
resume-versus-restart semantics for `core-06`.

## Classifier types

```ts
type ActionSafetyClass = "auto-safe" | "operator-required" | "forbidden";
type RecoveryAction =
  | "none" | "resume-owned-session" | "retry-evidence-refresh" | "request-termination"
  | "restart-from-cleared-state" | "clear-stale-launch" | "park-for-operator"
  | "block-run" | "fail-run";
type RecoveryState =
  | "clean-terminal" | "owned-session-resumable" | "evidence-refresh-retryable"
  | "owned-worker-stale-terminable" | "safe-empty-restartable" | "stale-launch-clearable"
  | "operator-approval-needed" | "lease-unavailable" | "log-unwritable"
  | "log-corrupt" | "launch-duplicate-active" | "owner-ambiguous"
  | "termination-ambiguous" | "supervision-stale-ambiguous" | "merge-outcome-ambiguous"
  | "provider-evidence-gap" | "manual-edits-forbidden" | "terminal-no-recovery";
// EvidenceEventRef is imported from core-01's Run Lifecycle & Event State contracts.
interface RecoveryEvidenceSnapshot {
  runId: string;
  evaluatedThrough: RunEventCursor;
  observedAt: string;
  state: RunStateProjection;
  launch: RunLaunchProjection;
  liveness?: LivenessProjection;
  // LeaseSnapshot and StorageHealth are the fnd-02 storage port types.
  leases: { runWriter?: LeaseSnapshot; storyLaunch?: LeaseSnapshot; leaseHealth: StorageHealth };
  evidenceRefs: EvidenceEventRef[];
  providerGaps: string[];
  completion?: { latestDecisionState?: string; postMergeOutcome?: string };
}
interface RecoveryClassification {
  state: RecoveryState;
  actionSafety: ActionSafetyClass;
  recommendedAction: RecoveryAction;
  reason: string;
  requiredGate?: "auto-recover";
  evidenceRefs: EvidenceEventRef[];
}
```

The snapshot is built before classification from committed events and fnd-02 lease snapshots. The
classifier receives no provider clients, filesystem handles, process ids, wall-clock reader, or
mutable projection state.

## Stable rule order

1. Clean terminal lifecycle (`completed`, `blocked`, `failed`, `canceled`) returns
   `clean-terminal`/`forbidden`/`none`, except ambiguous post-terminal summaries are
   `terminal-no-recovery`.
2. Unusable replay or append health returns `log-corrupt` or `log-unwritable`.
3. Missing, stale, or degraded lease guarantees returns `lease-unavailable`.
4. Active `story-launch` for the same Task held by another non-expired holder returns
   `launch-duplicate-active`.
5. Unknown or ambiguous session linkage returns `owner-ambiguous`.
6. A current non-superseded owned Agent session with positive resume evidence and no conflicting
   terminal evidence returns `owned-session-resumable`.
7. A stale owned worker with known linkage, positive termination capability, and no ambiguous
   terminal evidence returns `owned-worker-stale-terminable`.
8. Retryable core-05 evidence states such as `merge-forge-unavailable`,
   `post-merge-retryable-refused`, or exact-head evidence gaps return `evidence-refresh-retryable`.
9. An expired `story-launch` with no current Run writer, no current owner, and a recorded stale-launch
   probe returns `stale-launch-clearable`.
10. Restart is allowed only when no current owner exists, no unverified termination exists, stale
    launch has been cleared by event, and Work Source claim/state evidence is empty or explicitly
    released. That returns `safe-empty-restartable`.
11. Any missing provider evidence needed to distinguish the above returns `provider-evidence-gap`,
    `termination-ambiguous`, `supervision-stale-ambiguous`, or `merge-outcome-ambiguous`.

## Action-safety matrix

| Recovery state | Safety class | Recommended action |
|---|---|---|
| `owned-session-resumable` | `auto-safe` only after `auto-recover`; otherwise `operator-required` | `resume-owned-session` |
| `evidence-refresh-retryable` | `auto-safe` only after `auto-recover`; otherwise `operator-required` | `retry-evidence-refresh` |
| `owned-worker-stale-terminable` | `auto-safe` only after `auto-recover`; otherwise `operator-required` | `request-termination` |
| `stale-launch-clearable` | `auto-safe` only after `auto-recover`; otherwise `operator-required` | `clear-stale-launch` |
| `safe-empty-restartable` | `auto-safe` only after `auto-recover`; otherwise `operator-required` | `restart-from-cleared-state` |
| `operator-approval-needed` | `operator-required` | `park-for-operator` |
| `lease-unavailable`, `log-unwritable`, `provider-evidence-gap`, `supervision-stale-ambiguous`, `merge-outcome-ambiguous` | `operator-required` | `park-for-operator` or `block-run` |
| `clean-terminal`, `log-corrupt`, `launch-duplicate-active`, `owner-ambiguous`, `termination-ambiguous`, `manual-edits-forbidden`, `terminal-no-recovery` | `forbidden` | `none`, `block-run`, or `fail-run` |

`auto-safe` means only that the classifier sees a deterministic safe action candidate. It does not
authorize execution. The caller must append `RecoveryClassified`, request a core-02 `auto-recover`
gate, append `RecoveryActionPlanned`, perform the supported control through the provider seam, and
append `RecoveryActionApplied` or `ReconciliationBlocked`.

## Lease coordination

`run-writer:<runId>` is the core-01 append lease. Core-06 never writes around it. A stale writer is
fenced by fnd-02 epoch/token checks before bytes are appended. Releasing a lease is optional cleanup,
not evidence that the Run is safe to restart.

`story-launch:<workSourceId>:<trackId>:<taskId>` is acquired after Run creation and before Work Source
claim or worker launch. It is repo-wide for one configured project/repo and prevents separate local
processes from launching the same Task. The holder string may include `runId`, `operationId`, and a
diagnostic `processRef`, but process liveness is never a safety input.

Duplicate launch flow:

1. Open the new Run writer.
2. Acquire `story-launch` for the Task.
3. Append `StoryLaunchLeaseAcquired` with lease epoch and Task key.
4. If a live same-Task lease already exists, append `DuplicateLaunchBlocked` when a writer exists, or
   return a start refusal before launch side effects.

Stale launch clearing flow:

1. Observe an expired `story-launch` through `LeaseStore.read`.
2. Build a snapshot proving no current writer, owner session, process tree, pending approval, or Work
   Source claim might still belong to the prior holder.
3. Acquire the next lease epoch through fnd-02.
4. Append `StaleLaunchClearanceRequested`.
5. Classify as `stale-launch-clearable`, pass `auto-recover` when unattended, and append
   `StoryLaunchLeaseCleared`.

If any evidence is absent or ambiguous, clearing is forbidden or operator-required; manual deletion of
lease files, event frames, projections, or Work Source claim blocks is never a supported control.

## Resume versus restart

Resume reconnects to the current non-superseded owned session in the core-01 launch projection. It
requires known linkage, positive Agent `canResumeOwned` when the Agent session is involved, coherent
liveness evidence, and no conflicting terminal event. The provider returns resume evidence through
the Agent contract before core-01 records a recovery `SessionLinked` fact.

Restart launches a new worker. It is allowed only from `safe-empty-restartable`: no active
`story-launch`, no current `run-writer` holder that can append, no owned session, no unverified
termination, no pending approval channel, and Work Source claim state empty or released through the
Work Source contract. There is no blind relaunch and no claim is cleared after unverified
termination.

Supported controls can add evidence: Agent resume, Execution Host termination, Forge evidence
refresh, Work Source release/status write, and fnd-02 lease acquire/renew/release. They cannot rewrite
history; reconciliation is always an appended event through core-01.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Recovery, Reconciliation & Coordination](./README.md) · **← Prev:** [Recovery, Reconciliation & Coordination](./README.md) · **Next →:** [Observability & Analysis](../observability-and-analysis/README.md)

<!-- /DOCS-NAV -->
