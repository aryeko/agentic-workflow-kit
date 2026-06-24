---
title: kit-vnext — protected policy gate
status: high-level design
last-reviewed: "2026-06-19"
---

# Protected policy gate

A worker must not weaken the rules that gates will be evaluated against and then pass those
weakened gates. The protected-policy gate closes this anti-gaming vector by snapshotting the
policy context at launch and requiring human approval plus re-verification whenever a worker
changes a protected path.

## How it works

```mermaid
flowchart TB
  Launch["Run launch"] --> Snapshot["ProtectedPolicySnapshotRecorded\n(barrier event — records protected path digests)"]
  WorkerChanges["Worker-changed file paths"] --> Compare["Compare against protected snapshot\n(Workspace & Repository changedPaths)"]
  Snapshot --> Compare
  Compare -->|no protected paths changed| Verify["Verify normally"]
  Compare -->|protected paths changed| ApprovalRequired["Require human approval\n(ApprovalDecisionRecorded for protected-policy-change)"]
  ApprovalRequired --> Reverify["Re-verify under pre-change policy\n(or explicitly approved new policy)"]
  Reverify --> Gate["Completion / merge gate"]
  Verify --> Gate
```

## Protected path classes

The implementation must define protected path sets covering at minimum:

- workflow-kit configuration and policy files
- verification command definitions
- CI definitions (e.g. `.github/workflows/`)
- package scripts and lockfiles
- provider conformance policy files
- any file that controls merge requirements or gate predicates

## Snapshot record

At launch, the Control plane appends a `ProtectedPolicySnapshotRecorded` event at barrier
durability. It contains the policy digest, the base commit SHA, the verifier command digest, and the
digests of the protected path set. The verifier digest is the prov-04 canonical `commandDigest`
precomputed from the runner-owned verify `HostCommandRequest`; later captured verify evidence must
match it. All subsequent changed-file checks reference this record.

## Approval binding

A protected-policy-change approval must bind to specific evidence. The
`ApprovalDecisionRecorded` event for `ApprovalSubject = "protected-policy-change"` carries the slim
`ProtectedPolicyApprovalBinding` plus the operator decision event id:

| Field | Content |
|---|---|
| run id | The run being approved (`runId`) |
| candidate head SHA | The exact head the approval covers (`candidateHeadSha`) |
| protected policy snapshot event id | Reference to the core-05 `ProtectedPolicySnapshotRecorded` the approval is bound to (`protectedPolicySnapshotEventId`) |
| new policy digest | The approved new policy, when applicable (`newPolicyDigest?`) |
| operator decision event id | The recorded human decision authorizing this change |

The binding deliberately does not duplicate the old policy digest or the concrete changed
protected paths inline on the approval event. The gate obtains the **old policy digest** by
reference from the `ProtectedPolicySnapshotRecorded` named by `protectedPolicySnapshotEventId`,
and the **concrete changed protected paths** by reference from Workspace `LocalGitEvidence` — those
remain authoritative on the snapshot and the workspace evidence, not on the approval event.

The `candidateHeadSha` is the post-change candidate head, so it is validated against the **current
Workspace `LocalGitEvidence` head**, not compared to the snapshot. `ProtectedPolicySnapshotRecorded`
is a launch-time record validated only for matching run / policy / base identity (it supplies the old
policy digest and base SHA, not the candidate head).

Without a committed binding, or when the referenced `ProtectedPolicySnapshotRecorded` is missing,
its run/policy/base identity does not match, or `candidateHeadSha` does not match the current
Workspace `LocalGitEvidence` head, the gate returns `protected-policy-change-unapproved` and fails
closed.

## Authoritative references

The evidence model, the `ProtectedPolicySnapshotRecorded` event schema, the changed-file
predicate, and the full fail-closed state catalog are in:

- [Completion, Verification & Merge](../30-domain-reference/core/completion-and-merge/README.md)
  (core-05) — owns the protected-policy gate logic
- [Forge / Collaboration](../30-domain-reference/providers/forge-collaboration/README.md)
  (prov-02) — Forge evidence the gate consumes

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [architecture overview](./README.md) · **← Prev:** [launch coordination](./launch-coordination.md) · **Next →:** [high-level architecture](./architecture.md)

<!-- /DOCS-NAV -->
