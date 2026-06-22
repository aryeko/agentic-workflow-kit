---
title: "kit-vnext — implementation lessons ledger"
status: draft
last-reviewed: "2026-06-22"
---

# Implementation lessons ledger

> **Audience** — the architect authoring the next epic; the reviewer who runs the before-next-wave gate.
> **Job** — the single home for recurring defect classes. Each lesson maps to the **gate, dimension, or
> role responsibility that covers it**; a lesson with no cover is an **open gap** to close before the next
> epic is authored.

This keeps the [authoring standard](authoring-standard/README.md) and the
[operating model](operating-model/README.md) *checkable and short*: the rule lives there as a gate box or
a role responsibility; its provenance and coverage status live here.

## What counts as a lesson

A **recurring defect class** — a kind of "what" or process failure a gate or role can prevent (a missing
public export, an unconstructable contract, a fail-open safety path, a stash-race). **Not** one-off
implementation bugs against a clear spec (a single TOCTOU race, a forgotten cleanup); those are the
reviewer's standing job ("Bucket 2"), not ledger entries.

## How to use it

1. **After each implementation** (epic or wave) retro, add a row for every distinct defect class it
   surfaced.
2. **Map it to a cover** — name the gate box / dimension (in the authoring standard) or the role
   responsibility (in the operating model). If none exists, the row is `OPEN`: encode a cover, or record
   an explicit accepted-risk rationale.
3. **Verify before authoring the next epic:** scan this ledger — every row is `covered`, `conditional`
   with its precondition named, or `OPEN` with an accepted-risk note. No silent `OPEN`. This is the
   "lessons land before the next wave" gate.

Status values: `covered` (a checkable gate/role prevents it) · `conditional` (covered only if a named
precondition holds — a tightening is pending) · `OPEN` (no cover yet).

## Ledger

### Foundational (Epic 0 and early epics)

| ID | Source | Lesson | Covered by | Status |
|----|--------|--------|-----------|--------|
| LSN-01 | early epics | Coherent charters still seeded ambiguous stories; the domain-layer fix is boundary crispness + signal traceability, not ACs. | Gate 1 (boundary crisp; signals trace) — [authoring-standard/20-domain-charter.md](authoring-standard/20-domain-charter.md) | covered |
| LSN-02 | Epic 2 | The epic charter must make the milestone reviewable and bound its stories — not inflate into a spec or deflate into adjectives. | Gate 2 — [authoring-standard/30-epic-charter.md](authoring-standard/30-epic-charter.md) | covered |
| LSN-03 | — | Slice before you spec: the story DAG makes the signal→story partition and shared-contract producers reviewable before contracts are written. | Layer 3 / Gate 3 — [authoring-standard/40-story-dag.md](authoring-standard/40-story-dag.md) | covered |
| LSN-04 | Epic 0 | Runtime-shaped manifests made pure config stories unbuildable; fix = validated-artifacts manifest + negative fixtures. | R1 substrate/config rule; Gate 4 (validation-failure table) — [authoring-standard/50-story-contract.md](authoring-standard/50-story-contract.md) | covered |
| LSN-05 | Epic 0 | A green `tsc -b` / tool exit does not prove negatives; negative claims require negative evidence. | R2; Gate 4 negative-fixture box; Gate 5 — [authoring-standard/50-story-contract.md](authoring-standard/50-story-contract.md) | covered |
| LSN-06 | Epic 0 | A high baseline counted integration helpers outside the instrumented command; coverage must measure the claimed scope. | R3; Gate 4 coverage box — [authoring-standard/50-story-contract.md](authoring-standard/50-story-contract.md) | covered |
| LSN-07 | Epic 0 | A frozen Biome `--check` flag a version bump rejected; freeze the behavior contract, not the flag spelling. | R4; Gate 4 frozen-command box — [authoring-standard/50-story-contract.md](authoring-standard/50-story-contract.md) | covered |

### Epic 1 retro (PRs #127 / #128)

| ID | Source | Lesson | Covered by | Status |
|----|--------|--------|-----------|--------|
| LSN-08 | #127 | Root-barrel "ownership void": public shapes never exposed on the SDK surface. | Public-exposure dimension (R3, Quality bar, Gate 4) — [authoring-standard/50-story-contract.md](authoring-standard/50-story-contract.md) | covered |
| LSN-09 | fnd-03 s2→s3 | A producer never exposed the interface its consumer imports (worst churn case). | Gate 3 "Seams importable" + producer public-exposure AC + phase-readiness — [authoring-standard/40-story-dag.md](authoring-standard/40-story-dag.md) | covered |
| LSN-10 | fnd-03 s2→s3 | Self-contradictory seam signature (`recordLocalGitEvidence(leaseId)` vs `{epoch, fenceToken}`). | Gate 3 "consumer cites producer shape verbatim" — [authoring-standard/40-story-dag.md](authoring-standard/40-story-dag.md) | conditional — needs signature-level verbatim + a single authoritative design source (tightening pending) |
| LSN-11 | fnd-01-s1 | An unconstructable type intersection (`ConfigurationPolicy`) that no value can satisfy. | Gate 4 "Constructability" (a fixture constructs each public shape) — [authoring-standard/50-story-contract.md](authoring-standard/50-story-contract.md) | covered |
| LSN-12 | fnd-04-s1 | Fail-open credential release when `egressPolicy` is omitted / has zero attesters. | Gate 4 "Fail-closed by construction" — [authoring-standard/50-story-contract.md](authoring-standard/50-story-contract.md) | conditional — needs the domain charter to tag safety-critical invariants; structural fix is the deferred B-heavy contract amendment |
| LSN-13 | fnd-03 | A curated/narrow sweep passed review while policy types leaked on the public surface. | Executable sweep recipe (R5, Gate 4, Gate 5) — [authoring-standard/50-story-contract.md](authoring-standard/50-story-contract.md) | covered |
| LSN-14 | Epic 1 | Adjectival file-size ("stay focused") let oversized files ship. | Numeric file-size budget (R3, Quality bar, Gate 4) — [authoring-standard/50-story-contract.md](authoring-standard/50-story-contract.md) | covered |
| LSN-15 | Epic 1 | Per-AC evidence as a prose category was not re-runnable. | Per-AC evidence = exact test id/command + result (AC template, Gate 4/5) — [authoring-standard/50-story-contract.md](authoring-standard/50-story-contract.md) | covered |
| LSN-16 | Epic 1 | Validator stories missed per-input-shape negative cases. | Gate 4 "negative-case matrix" — [authoring-standard/50-story-contract.md](authoring-standard/50-story-contract.md) | covered |
| LSN-17 | Phase 1 | Parallel workers collided on shared files (stash races, lost edits). | Orchestrator "owns shared-file non-collision" — [operating-model/orchestrator.md](operating-model/orchestrator.md) | covered |
| LSN-18 | Phase 1 | Reviewing stashed trees produced false "file absent" findings. | Orchestrator "review isolated drafts, never stashed trees" — [operating-model/orchestrator.md](operating-model/orchestrator.md) | covered |
| LSN-19 | Epic 1 | A public-producer story ran on the cheap model tier. | Gate 3 requires a suggested tier on every public-exposure node + orchestrator honors it as the floor ([authoring-standard/40-story-dag.md](authoring-standard/40-story-dag.md), [operating-model/orchestrator.md](operating-model/orchestrator.md)) | covered |
| LSN-20 | Epic 1 | Greedy dispatch starved reviewer/readdress slots → close/resume churn. | Orchestrator capacity planning — [operating-model/orchestrator.md](operating-model/orchestrator.md) | conditional — role requirement only; the `orchestrated-delivery` skill change that reserves slots is deferred |

## Open items

- **LSN-10, LSN-12** are `conditional`. Two guide tightenings convert them to `covered`: (a) seam-verbatim
  must include the call signature and name the single authoritative design source; (b) the domain charter
  must tag safety-critical invariants and the fail-closed test keys off that tag. Track LSN-12's structural
  fix as the deferred **B-heavy** credential/egress contract amendment.
- **LSN-20** is `conditional`: the capacity rule is recorded as a role responsibility, but the
  `orchestrated-delivery` skill change that reserves reviewer/re-address slots is deferred (the
  precondition) and out of this worktree's scope.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Implementation planning — authoring standard](./README.md) · **← Prev:** [Role — reviewer](./operating-model/reviewer.md) · **Next →:** [Engineering Policy Index](../engineering/README.md)

<!-- /DOCS-NAV -->
