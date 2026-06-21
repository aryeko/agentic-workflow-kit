---
title: "Frontier 5 charter - completion and recovery"
frontier: 5
status: draft
last-reviewed: "2026-06-20"
included-domains:
  - core-05-completion-and-merge
  - core-06-recovery-and-reconciliation
---

# Frontier 5 charter - completion and recovery

## Purpose

Frontier 5 defines the implementation contract for deciding done, publishing or merging only from
independent evidence, and recovering non-clean states in-band. It consumes the run-control,
capability, liveness, provider-evidence, and analysis surfaces established by earlier frontiers.

This charter defines what the frontier must deliver. It does not define execution workflow.

## Included domains

| Domain | Role in this frontier | Spec basis |
|---|---|---|
| `core-05` Completion, Verification & Merge | Evaluate completion, merge readiness, protected policy changes, Forge intents, and post-merge outcomes. | `docs/design/30-domain-reference/core/completion-and-merge/` |
| `core-06` Recovery, Reconciliation & Coordination | Classify non-clean evidence, coordinate duplicate launches, and plan safe recovery actions. | `docs/design/30-domain-reference/core/recovery-and-reconciliation/` |

Package target: core evaluation and event contracts belong in `packages/sdk`; provider-specific raw
Forge, Host, Agent, and Work Source operations remain outside these core domains.

## Why this frontier exists

The system cannot be trusted to land work until completion and recovery are evidence-owned. Frontier 5
establishes the boundary between "a worker says done" and "the Run is complete," and between "a Run
looks stuck" and "a supported recovery action is safe."

The frontier exists after Frontier 4 because completion consumes approval and supervision records, and
recovery consumes liveness and completion/merge outcome records.

## Dependencies and frozen inputs

Frozen inputs for Frontier 5:

- approved `core-01` event log, lifecycle, cursor, projection, and legal transition contracts;
- approved `core-02` `auto-merge` and `auto-recover` capability gates;
- approved `core-03` protected-policy approval records;
- approved `core-04` liveness, stale, termination, and supervision-lost facts;
- approved Workspace local git evidence, Execution Host runner-command capture, Forge evidence/action
  events, Work Source evidence, and fnd-02 lease primitives;
- approved `fnd-01` merge/change policy and task allowed-change paths.

The frontier must not gather raw local git, CI, PR, review, or process data itself. It evaluates committed
evidence from seams and records decisions/intents.

## Outputs

Frontier 5 must produce implementation artifacts equivalent to:

- exact-head completion evidence selection from local git and runner-owned verification captures;
- protected policy snapshot and changed-file gate evaluation;
- `CompletionDecisionRecorded`, `MergeDecisionRecorded`, `ForgeOperationIntentRecorded`,
  `MergeIntentRecorded`, and `PostMergeOutcomeRecorded` payloads;
- fail-closed merge predicate bound to exact PR/head/policy/evidence/gate scope;
- blocker-evidence PR intent contract that does not imply completion or merge;
- recovery classifier, action-safety matrix, stable rule ordering, and provider-control plan records;
- `story-launch` lease naming, duplicate-launch blocking, stale-launch clearing, and restart rules;
- tests proving completion, merge, and recovery decisions are pure replay results and reject
  self-report-only evidence.

## Scope Boundaries

In scope:

- pure evaluation of committed Workspace, Host, Forge, Work Source, approval, liveness, capability,
  and lease evidence;
- exact-head completion, merge, post-merge, and recovery decision records;
- fail-closed blocker states and safe recovery classifications;
- repo-level duplicate launch coordination using fnd-02 leases.

Out of scope:

- executing verify commands, reading git directly, pushing branches, opening PRs, merging PRs,
  killing workers, resuming Agent sessions, or writing Work Source records;
- operator UI, notifications, or explanation rendering;
- manual artifact edits, lease-file deletion as recovery, or log/projection rewrites.

STOP if a story requires core-05 or core-06 to call a concrete provider driver, clear a claim after
unverified termination, treat worker prose as completion, or record completed without exact-head merge
evidence.

## Per-domain responsibilities

### core-05 Completion, Verification & Merge

Deliver completion and merge decisions as pure functions over replay through an immutable cursor.
The candidate head is the latest usable clean Workspace head for the active worktree lease.
Verification is fresh only when runner-owned command capture is bracketed by clean pre/post local git
evidence for the same head.

Merge readiness requires completion verified, allowed merge policy, clean exact head, changed-file
gate pass, fresh verification, fresh Forge evidence, required checks, required review/thread state,
fresh protection/ruleset evidence and attestations, committed `auto-merge` gate, and barrier merge
intent. Missing or ambiguous inputs return named deny states.

Protected policy changes require a launch-time snapshot, recorded Operator approval for
`protected-policy-change`, and refreshed verification under the valid policy. Outside-allowlist
changes fail closed.

Post-merge outcome records must distinguish confirmed merge, retryable refusal, blocked refusal,
failed invariant, and ambiguous outcome. Core-01 owns lifecycle transition after the outcome fact.

### core-06 Recovery, Reconciliation & Coordination

Deliver recovery classification as a pure function over replay/projections, lease snapshots,
liveness, completion/merge facts, provider evidence, and explicit `observedAt`. Output must name a
recovery state, safety class, recommended action, reason, gate requirement, and evidence refs.

`auto-safe` is not authorization. The action still requires a committed `auto-recover` gate for the
exact action scope before provider control can be attempted.

Duplicate-launch prevention uses `story-launch:<workSourceId>:<trackId>:<taskId>` leases plus event
evidence. Restart is allowed only from `safe-empty-restartable`, with no current owner, no
unverified termination, no pending approval, cleared stale launch, and Work Source claim empty or
released through the Work Source contract.

Recovery is always appended events through supported controls. Manual edits to logs, projections,
leases, artifacts, or Work Source records are forbidden.

## Failure and degraded outcome contract

| Condition | Required outcome |
|---|---|
| Candidate head missing, dirty, ambiguous, or mismatched. | No Forge write; completion/merge decision fails closed. |
| Verify capture missing, failed, incomplete, or not bracketed by clean same-head git evidence. | `verification-failed` or `verification-uncertain`; no completion verified. |
| Worker says done without independent evidence. | `claim-evidence-mismatch` or pending evidence; no completion verified. |
| Required Forge check, review, thread, protection, ruleset, or exact-head evidence missing. | Merge deny state; no merge intent. |
| Protected policy change lacks recorded approval or refreshed verification. | `protected-policy-change-unapproved`; no merge-ready. |
| Merge result is missing, not exact-head, or contradictory. | `post-merge-outcome-ambiguous`; core-01 must not record completed. |
| Lease, owner, termination, supervision, provider, or merge evidence is ambiguous. | Recovery is operator-required or forbidden; no blind relaunch. |
| Stale launch clearing lacks proof of no writer, owner, process, approval, or Work Source claim. | Clearing forbidden or operator-required; no manual deletion. |

## Evidence expectations

Each story must include:

- spec-surface manifest naming every evidence record, decision payload, state, lease, and provider
  control touched;
- falsifiable acceptance criteria for completion states, merge states, post-merge states, recovery
  states, safety classes, and duplicate-launch behavior;
- failure/degraded outcome table for missing exact-head evidence, dirty workspace, stale Forge state,
  unapproved protected changes, ambiguous post-merge result, stale leases, owner ambiguity, and
  provider evidence gaps;
- required evidence from replay tests, property tests, mock provider events, and adversarial fixtures;
- explicit boundaries proving no raw provider operations occur inside core evaluators.

## Readiness criteria

Frontier 5 is ready for Frontier 6 when:

- completion and merge decisions are replay-deterministic and exact-head-bound;
- blocker-evidence PR intent is separate from completion and merge intent;
- protected policy and outside-allowlist changed files fail closed;
- post-merge completion requires exact-head merged evidence;
- recovery classification has stable rule ordering and cannot blind-relaunch;
- duplicate launch prevention works across local processes via fnd-02 lease semantics;
- every autonomous merge or recovery action cites a committed core-02 gate record for the exact
  action scope.

## Expected story files to author next

- `docs/implementation/frontiers/frontier-5-completion-and-recovery/stories/core-05-completion-evidence.md`
- `docs/implementation/frontiers/frontier-5-completion-and-recovery/stories/core-05-changed-file-gate.md`
- `docs/implementation/frontiers/frontier-5-completion-and-recovery/stories/core-05-merge-predicate.md`
- `docs/implementation/frontiers/frontier-5-completion-and-recovery/stories/core-05-post-merge-outcome.md`
- `docs/implementation/frontiers/frontier-5-completion-and-recovery/stories/core-06-recovery-classifier.md`
- `docs/implementation/frontiers/frontier-5-completion-and-recovery/stories/core-06-story-launch-lease.md`
- `docs/implementation/frontiers/frontier-5-completion-and-recovery/stories/core-06-resume-restart-rules.md`

## Deferred work

- Operator controls for recovery requests, explanations, and attention are Frontier 6.
- Scheduler/admission machinery beyond repo-wide `story-launch` lease coordination is deferred.
- Trusted-check source configuration remains Forge/policy-owned until those stories bind it.
- External status dashboards and analysis presentation are deferred to the operator surface.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [implementation contract](../../README.md) · **← Prev:** [Frontier 4 charter - run control](../frontier-4-run-control/charter.md) · **Next →:** [Frontier 6 charter - operator surface](../frontier-6-operator-surface/charter.md)

<!-- /DOCS-NAV -->
