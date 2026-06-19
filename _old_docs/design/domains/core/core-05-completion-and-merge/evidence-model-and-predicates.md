---
title: "Completion, Verification & Merge - evidence model and predicates"
status: approved
last-reviewed: "2026-06-19"
---

# Evidence model and predicates

## Evidence anchoring

Every input is selected from a core-01 replay ending at an immutable cursor:

```ts
// EvidenceEventRef is imported from core-01's Run Lifecycle & Event State contracts.
type CompletionReplayAnchor = {
  runId: string; evaluatedThrough: RunEventCursor; writerEpoch?: number;
  headSha: string; evidenceRefs: EvidenceEventRef[];
};
```

An evidence ref is usable only if it is committed at or before `evaluatedThrough.afterSequence`,
well-formed, exact for `headSha` where applicable, and not superseded by a later same-kind evidence
event at or before the cursor. The decision record stores the cursor and cited event refs; the
envelopes provide immutable sequence, durability, and payload digests.

The candidate head is the single `LocalGitEvidence.headSha` from the latest usable
`LocalGitEvidenceRecorded` for the active WorktreeLease. Ambiguous, missing, or dirty local evidence
fails closed before any Forge write intent.

## Evidence set

`CompletionEvidenceSet` is a deterministic view over replay, not authored state:

```ts
type CompletionEvidenceSet = {
  anchor: CompletionReplayAnchor;
  localGit: EvidenceEventRef;
  verification?: {
    command: EvidenceEventRef;
    preLocalGit: EvidenceEventRef;
    postLocalGit: EvidenceEventRef;
  };
  forge?: EvidenceEventRef;
  capabilityGate?: EvidenceEventRef;
  workerClaim?: EvidenceEventRef;
  protectedPolicySnapshot: EvidenceEventRef;
  recordedOperatorDecision?: EvidenceEventRef;
};
```

Completion evidence is intentionally local to the candidate head: usable Workspace evidence, a clean
post-verify worktree, and runner-owned verification capture. Forge PR, review, thread, check, and
protection evidence are not completion prerequisites; they are merge prerequisites. The only exception
is a worker claim that explicitly asserts merge readiness, in which case missing or negative Forge-side
evidence can produce `claim-evidence-mismatch` for that merge-readiness claim.

Verification is fresh for `headSha` only when the runner-owned `verify` command result is bracketed by
pre- and post-command local git evidence for the same head, the command capture is complete, exit code
is `0`, and the post-command worktree is clean. The verify command identity is prov-04
`CommandResult.commandDigest`; prov-04 exposes no raw argv, so core-05 relies on the digest unless
prov-04 later adds redacted argv. A command failure is a verification failure; incomplete capture or
host failure is `verification-uncertain`.

Forge evidence is fresh only when `ForgeEvidenceCollected.expectedHeadSha`, PR head, branch head, and
all action-observed heads equal `headSha`. If Forge reports a different or unknown head, the evidence
is not usable for merge.

## Protected policy and changed files

Core-05 records or consumes a launch-time `ProtectedPolicySnapshotRecorded` event whose digest binds:
the resolved merge policy ref, verifier command digest, protected CI-definition path set, package
script path set, config path set, and the base `baseSha` from Workspace & Repository. It is a policy
snapshot, not a file reader; Workspace local git evidence later supplies changed paths.

Changed paths from `LocalGitEvidence.changedPaths` are classified deterministically:

| Class | Rule | Gate result |
|---|---|---|
| `allowed-task-change` | Path matches the recorded task/change allowlist for this Run. | May proceed. |
| `protected-policy-change` | Path matches the protected policy snapshot path set. | Requires recorded Operator approval plus fresh verification under the pre-change policy or the explicitly approved new policy. |
| `runner-evidence-change` | Path is a configured runner evidence artifact path and not protected policy. | May publish blocker evidence; merge requires policy to allow it. |
| `outside-allowlist` | Path matches none of the above. | Fail closed as `changed-files-outside-allowlist`. |
| `unclassified` | Required allowlist or protected path set is absent. | Fail closed as `changed-file-policy-absent`. |

A protected policy change without a recorded approval is `protected-policy-change-unapproved`.
Approval alone is not enough: verification, CI, review, and protection evidence must be refreshed for
the approved policy digest and exact head.

## Decision states

```ts
type CompletionDecisionState =
  | "completion-verified"
  | "completion-pending-evidence"
  | "claim-evidence-mismatch"
  | "verification-failed"
  | "verification-uncertain"
  | "workspace-dirty"
  | "head-ambiguous"
  | "changed-file-policy-absent"
  | "changed-files-outside-allowlist"
  | "protected-policy-change-unapproved"
  | "forge-evidence-unavailable"
  | "event-log-unwritable";

type MergeDecisionState =
  | "merge-ready"
  | "merge-policy-disabled"
  | "merge-required-check-missing"
  | "merge-required-check-failed"
  | "merge-review-not-approved"
  | "merge-unresolved-review-threads"
  | "merge-protection-snapshot-stale"
  | "merge-branch-not-fresh"
  | "merge-head-ambiguous"
  | "merge-forge-unavailable"
  | "merge-capability-denied"
  | "merge-intent-unwritable";

type PostMergeOutcomeState =
  | "post-merge-confirmed"
  | "post-merge-retryable-refused"
  | "post-merge-blocked"
  | "post-merge-failed"
  | "post-merge-outcome-ambiguous";
```

`claim-evidence-mismatch` is emitted when a worker claim says "done" but independent Workspace or
verification evidence for the exact head is missing or negative. Missing Forge, review, thread,
check, or protection evidence blocks `merge-ready`, not `completion-verified`, unless the worker claim
explicitly asserts merge readiness. A worker claim with no captured verifier evidence remains
unverified.

## Merge predicate

`mergeAllowed(evidence, policy, gateRecord) = true` only when all conditions hold:

1. The completion state is `completion-verified`.
2. The resolved merge policy permits merge for this Run (`runnerMayMerge = true`) and the selected
   merge method is policy-allowed.
3. Local git evidence is clean, unambiguous, and exact for `headSha`.
4. The changed-file gate has no `outside-allowlist`, unclassified, or unapproved protected-policy
   changes.
5. Required verification evidence is fresh for `headSha`.
6. Forge PR evidence is fresh for `headSha`; branch/head/base freshness is not ambiguous.
7. Every required check from Forge protection/ruleset evidence is present and successful. Missing
   required checks are `merge-required-check-missing`, not ignored.
8. Required review state is approved and required review threads are resolved when policy requires
   `review` or `threads-resolved`.
9. Protection/ruleset evidence is fresh, inspectable, and covered by fresh positive Forge
   `canInspectProtection` and `supportsRulesets` attestations; stale evidence is
   `merge-protection-snapshot-stale`.
10. A committed `CapabilityGateRecord` allows `auto-merge` for the same `headSha`, PR, provider
    scope, policy ref, and evidence refs.
11. The `MergeIntentRecorded` event is appended at `barrier` durability before Forge is asked to act.

Any false, missing, stale, contradictory, ambiguous, or unwritable input returns a named deny state.

## Post-merge outcome mapping

Forge performs the merge, enqueue, and expected-head write operations. Core-05 evaluates the committed
Forge action result and emits `PostMergeOutcomeRecorded`; core-01 owns the
`RunLifecycleTransitioned` event that cites that outcome fact.

| Forge result evidence | Core-05 outcome | Core-01 lifecycle target |
|---|---|---|
| `ForgePullRequestMerged` or successful queue completion proves the PR merged at `expectedHeadSha`, with merge commit or queue evidence bound to the same PR. | `post-merge-confirmed` | From `settling` to `completed`. |
| `ForgeActionRefused` is exact-head and retryable, such as transient rate limit, temporary queue unavailable, or update-branch required while policy allows another evidence refresh. | `post-merge-retryable-refused` | From `settling` back to `merge-waiting` through the recovery-classified retry edge. |
| `ForgeActionRefused` is exact-head but requires Operator or policy action, such as review dismissed, required check newly missing, protected policy stale, merge queue unsupported by policy, auth denied, or branch no longer fresh. | `post-merge-blocked` | From any non-terminal state to `blocked`. |
| Forge reports admin/bypass requirement, impossible method, provider invariant violation, redaction failure, credential misuse, or contradictory exact-head facts. | `post-merge-failed` | From any non-terminal state to `failed`. |
| Forge action result is missing, unwritable, not bound to `expectedHeadSha`, has unknown PR/head state, or cannot prove whether merge happened. | `post-merge-outcome-ambiguous` | From any non-terminal state to `blocked`; recovery may later reconcile with fresh Forge evidence. |

`completed` is recorded only after exact-head merged evidence is durably available and cited by the
lifecycle transition. A refused or ambiguous Forge outcome never records `completed` from prose,
worker claim, or the existence of a merge intent.

## Blocker-evidence PR behavior

If completion or merge is blocked after a safe exact head is known, core-05 may emit a Forge intent to
push/open/update a blocker-evidence PR and publish a runner-authored blocker comment when
`runnerMayPush` and `runnerMayOpenPr` are true. The PR/comment cites recorded failure states and
evidence refs; it does not mark the Task complete and cannot enqueue or merge. No blocker-evidence PR
intent is emitted for `event-log-unwritable`, `head-ambiguous`, or
`changed-files-outside-allowlist`.
