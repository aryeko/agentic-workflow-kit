---
title: "orchestrated-delivery — charter and evals"
status: draft
last-reviewed: "2026-06-23"
---

# orchestrated-delivery

## Mandate

Execute a `ready_for_implementation` package: dispatch its `ready` stories in dependency-gated waves, run
the implementer/reviewer loop (the implementer commits each round in its story worktree), merge each
approved story's commits back to the track branch, record durable tracker evidence, and open or update PRs
— stopping at the requested boundary. Bind runtime facts; author nothing.

## Why it exists

It is the orchestrator role at runtime: pure coordination. Keeping it execution-only — no scope, prompt,
AC, order, model-class, or effort decisions — is what makes a low-tier-friendly, resumable run possible
and keeps the *what* under the characterization gate rather than under execution pressure. Everything it
needs was decided upstream; its discipline is to bind facts and move work, not to think about the *what*.

## Embodies / operates on

- Role: [orchestrator](../operating-model/orchestrator.md); dispatches
  [implementer](../operating-model/implementer.md) + [reviewer](../operating-model/reviewer.md) (Bucket 2).
- Input: the execution package. It binds runtime/provider facts only.

## Input gate (refuse if unmet)

- An existing package marked `ready_for_implementation`, field- and prompt-complete, with tracker rows
  mapping to the selected stories.

Refuse, and route to the owning planning step, on a missing, incomplete, underspecified, over-risk, or
non-ready package. Structural file presence alone is not readiness.

## Output gate (done means)

- Each approved story's per-round commits **merged back to the track branch** after its gate, with the
  tracker updated durably (status, rounds, per-round commit + verdict, merge-back commit, gate evidence);
  downstream stories unlock only after the merge-back and the tracker update both exist.
- A story whose review loop exhausts the **5-round** cap without APPROVE is **blocked and escalated** to
  the architect, recorded in its tracker row, with no merge-back and no dependent unlock; sibling stories
  keep running.
- Source-contract blockers reported by workers are recorded durably in the affected tracker row, with no
  merge-back, no dependent unlock, and an upstream route-back to the owning planning step.
- PRs opened or updated only when authorized; review waiting is detect-only; merge and cleanup only on
  explicit current instruction. Stop at the requested boundary.

## Binds at runtime (the only things it decides)

Surface capabilities, provider profile, concrete model resolved from the declared class, actual supported
effort, worker cap, completion signal, the track branch and its current `HEAD`, and current dependency
merge-back hashes. These are facts, not decisions about the work.

## Boundaries (never)

- Author or repair scope, prompts, ACs, dependency order, model class, or effort.
- Judge the *what*, re-grade the diff, or improvise scope — reviewer APPROVE is the merge-back trigger.
- Commit story content itself — the implementer commits each round in its story worktree; the
  orchestrator owns only the track-branch merge-back, the tracker, PRs, and worker closure.
- Let workers push, open PRs, merge, or close their own contexts.
- Silently resolve a real logic conflict on merge-back — trigger an implementer rebase for a trivial
  replay; **escalate** a real logic conflict as an upstream same-logic planning defect.

## Evals

| ID | Requirement | Sev | Modality |
|---|---|---|---|
| OD-1 | Triggers only for an existing `ready` package; refuses missing/incomplete/underspecified/over-risk/non-ready; authors nothing. | P1 | P/T |
| OD-2 | Binds runtime/provider facts only (model from class, effort, cap, completion signal, dependency hashes); changes no package decision. | P1 | P |
| OD-3 | Dispatches only `ready` stories in dependency waves; a dependent waits for its producer's track-branch merge-back + tracker update + worker closure. | P1 | E/T |
| OD-4 | Reuses one implementer + one reviewer context per story; all fix/rereview rounds message that persistent pair incrementally; the implementer commits each round in its story worktree; workers never push, open PRs, merge, or close. | P1 | E/T |
| OD-5 | On reviewer APPROVE, the coordinator merges the story's per-round commits back to the track branch and updates the tracker; it commits no story content itself and does not re-grade the diff. | P1 | E/T |
| OD-6 | Durable sequence per story: the implementer's per-round commits, then the orchestrator's track-branch merge-back, then the tracker update; downstream readiness needs the merge-back + tracker. | P1 | E/T |
| OD-7 | PR/merge boundary respected: detect-only review waiting; merge and cleanup only on explicit instruction; stop at the asked boundary. | P1 | E |
| OD-8 | Sparse, separable operator ledger: visible run/story updates use the fixed ledger grammar below, keep raw ids as traceability fields only, surface warning and wait state conservatively, and prove the transcript with a post-run communication audit. | P1 | E |
| OD-9 | Worker-reported source-contract blockers are recorded as planning blockers, not merged as story work or bypassed; dependents remain locked until planning repair. | P1 | E/T |
| OD-10 | A review loop that exhausts the 5-round cap without APPROVE is blocked + escalated to the architect and recorded in the tracker; only the minimal set is blocked and sibling stories keep running. | P1 | E/T |
| OD-11 | Track-branch merge-back: a trivial replay triggers an orchestrator-requested implementer rebase + re-prove, then the track merge; a real logic conflict is escalated as an upstream planning defect, never silently resolved. | P1 | E/T |
| OD-12 | Same-logic concurrency honored: same-wave stories share no logic-bearing file (file-level granularity from owned pathsets, plus any architect override); append-only aggregation points (the SDK barrel) are shared and rebased, not serialized. | P1 | E/T |

### OD-8 operator ledger contract

`orchestrated-delivery` communicates run/story progress as a sparse operator ledger, separable from raw
worker/tool events. Operator-visible updates use these forms:

- `State: ... | next=...` for ordinary state transitions.
- Paired `State:` + `Next:` lines when the next action or awaited event needs more detail than a compact
  `next=` field can carry.
- `Env:` for known diagnostics about the execution environment or expected tool noise.

Raw process ids, worker ids, session ids, command ids, and tool ids are traceability fields only. They may
appear after the operator-facing state, but they must never be the first-line identifier for a story or run
transition.

Warning handling is conservative: collapse only known-benign, allowlisted warnings. Unknown warnings
surface once with the command context that produced them, then later repeats may refer back to that first
surface instead of flooding the ledger.

Waiting is quiet until it changes meaning. The coordinator emits no short-wait filler, updates immediately
on a state change, and emits coarse liveness only after the runtime skill's pinned wait threshold is
crossed.

The run closes with a post-run communication audit over operator-visible updates. The audit verifies that
visible updates used the ledger grammar, warning handling, and wait cadence above, and it records any
deviation as a follow-up defect rather than treating transcript noise as harmless.

The skill's `EVALS.md` (at `.agents/skills/orchestrated-delivery/EVALS.md`) is the implementation-level
test spec for these OD requirements and must be updated before the live skill can claim conformance to
the revised OD-8 contract. Conforming the skill references, evals, and fixtures to the revised OD
requirements is Phase 2 skill work, not part of this design layer.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Delivery pipeline — the skill spec](./README.md) · **← Prev:** [plan-delivery — charter and evals](./30-plan-delivery.md) · **Next →:** [implementation lessons ledger](../lessons-ledger.md)

<!-- /DOCS-NAV -->
