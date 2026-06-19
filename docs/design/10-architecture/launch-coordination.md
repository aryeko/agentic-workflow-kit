# Launch coordination

This file captures the launch-order fix required by the review.

## Problem

The design has both Work Source claim locking and a repo-wide `story-launch` lease. Both are necessary, but their ordering must be explicit.

## Normative launch sequence

```mermaid
sequenceDiagram
  participant SDK as SDK core
  participant Lease as Lease store
  participant WS as Work Source provider
  participant Log as Run event log

  SDK->>Lease: acquire story-launch lease
  SDK->>WS: nextEligible
  WS-->>SDK: TaskView
  SDK->>WS: claim task with expected digest
  WS-->>SDK: ClaimResult + TaskSnapshot ref
  SDK->>Log: append TaskSnapshotRecorded + lifecycle transition
  alt failure before append
    SDK->>WS: release claim when supported
    SDK->>Log: record recovery / blocked fact when writer exists
  end
```

## Rules

- `story-launch` prevents duplicate run starts across processes.
- Work Source claim protects task status authority.
- TaskSnapshot must be durable before the run treats the task as snapshotted.
- Recovery clears stale launch state only through supported controls.
