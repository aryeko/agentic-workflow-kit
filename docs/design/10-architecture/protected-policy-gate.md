# Protected policy gate

This file captures the protected-policy anti-gaming fix required by the review.

## Goal

A worker must not weaken verification, CI, policy, or package scripts and then satisfy gates under the weakened rules.

## Gate model

```mermaid
flowchart TB
  Launch["Launch"] --> Snapshot["ProtectedPolicySnapshotRecorded"]
  WorkerChanges["Worker changed files"] --> Compare["Compare changed paths to protected snapshot"]
  Snapshot --> Compare
  Compare -->|no protected changes| Verify["Verify normally"]
  Compare -->|protected changes| Approval["Require human approval"]
  Approval --> Reverify["Re-verify under old or approved-new policy"]
  Reverify --> Gate["Completion / merge gate"]
```

## Protected policy classes

The implementation must explicitly define protected path sets for:

- workflow-kit config and policy files;
- verification command definitions;
- CI definitions;
- package scripts and lockfiles;
- provider/conformance policy;
- any file that controls merge requirements.

## Required binding

A protected-policy approval must bind to:

```txt
run id
candidate head SHA
changed protected path set
old policy digest
new policy digest when approved
operator decision event id
```
