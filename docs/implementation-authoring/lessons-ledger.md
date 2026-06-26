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
| LSN-08 | #127 | Root-barrel gap: public shapes never exposed on the SDK surface. Reformed barrel model: the barrel is a **normal owned file** — each public-symbol story **owns its own `index.ts` export line** (export + import path + public-import test) in its owned pathset. Concurrent stories share the append-only barrel and resolve any line-level overlap by rebase under the same-logic concurrency rule. | Public-exposure dimension (R3, Quality bar, Gate 4) — [authoring-standard/50-story-contract.md](authoring-standard/50-story-contract.md); barrel + same-logic concurrency rule — [authoring-standard/40-story-dag.md](authoring-standard/40-story-dag.md) | covered |
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
| LSN-21 | Epic 3 / `core-02-s2` | A ready story required policy and scope decisions that were not evaluable from its declared inputs (`policyRef` without resolved policy values; approved-parent scope with no approved-parent source). | R6 predicate-input coverage + Gate 4 predicate-input box — [authoring-standard/50-story-contract.md](authoring-standard/50-story-contract.md); plan-delivery self-blocking contract preflight — [delivery-pipeline/30-plan-delivery.md](delivery-pipeline/30-plan-delivery.md) | covered |
| LSN-22 | Epic 3 / PR #144 | AC proof not re-run by the standing gate: negative `tsconfig.negative.json` fixtures encoded "this shape is rejected at compile time" but no project referenced them in the `tsc -b` graph and vitest ran typecheck off, so `pnpm check` never compiled them — the proofs silently rot and a union-widening regression passes CI. | `type:fixtures` gate lane compiles every negative/public fixture ([engineering/check-gate.md](../engineering/check-gate.md)) + Gate 4 negative-fixture box now requires a named gate lane + Gate 5 "not gradable without a standing-gate lane" — [authoring-standard/50-story-contract.md](authoring-standard/50-story-contract.md) + reviewer must name the `pnpm check` step that re-proves each AC — [operating-model/reviewer.md](operating-model/reviewer.md) | covered |
| LSN-23 | Epic 3 / `edge-01-s2` | A cross-surface parity AC compared a byte-identical implementation file (`packages/cli/src/operator-smoke/shared.ts`) against its MCP copy — the assertion is tautological and can never fail. | Cross-surface parity rule + Gate 4 non-tautological-parity box — [authoring-standard/50-story-contract.md](authoring-standard/50-story-contract.md) | covered |

### Epic 4 re-plan (PR #153) — prose-only safeguards reproduced known defects

| ID | Source | Lesson | Covered by | Status |
|----|--------|--------|-----------|--------|
| LSN-24 | Epic 4 re-plan / `ApprovalDecisionRecorded` | An event consumed by multiple stories was produced by none. Per-story closure cannot catch this: if no story claims production, each story's own check passes. Requires a whole-graph reconciliation at the DAG level before freeze. | Gate 3 whole-graph event/record producer reconciliation — [authoring-standard/40-story-dag.md](authoring-standard/40-story-dag.md); PE-12 eval — [delivery-pipeline/20-plan-epic.md](delivery-pipeline/20-plan-epic.md) | covered |
| LSN-25 | Epic 4 re-plan / delivery model | The barrel-pathset alarm was a symptom, not the defect: stories rightly own their own `index.ts` export line; what was missing was a delivery model to run them safely — per-round implementer commits, a track-branch merge-back, and a same-logic concurrency rule. Reform: the implementer commits each round in its story worktree; the orchestrator merges approved stories back to the track branch (rebasing trivial barrel overlaps; escalating a real logic conflict), capped at the 5-round loop → block + escalate. | Commit/loop/track/rebase model — [operating-model/orchestrator.md](operating-model/orchestrator.md), [implementer.md](operating-model/implementer.md), [reviewer.md](operating-model/reviewer.md); same-logic concurrency — [authoring-standard/40-story-dag.md](authoring-standard/40-story-dag.md); canonical tracker schema — [delivery-pipeline/30-plan-delivery.md](delivery-pipeline/30-plan-delivery.md); PE-17 eval; updated LSN-08. | covered |
| LSN-26 | Epic 4 re-plan / dropped resume invariant | A resume must re-check fresh `canResumeOwned`/`canRelayApproval` (design: `park-resume-and-failures.md:36-39`) but no AC asserted this. Gates only checked AC→design (nothing invented), never design→AC (nothing dropped). | Design→AC completeness pass in [operating-model/characterization-review.md](operating-model/characterization-review.md); PE-14 eval; contract gates in [plan-epic/references/stage-contract.md](../.agents/skills/plan-epic/references/stage-contract.md). | covered |
| LSN-27 | Epic 4 re-plan / `containment` sweep defect | A boundary sweep forbade `containment` while AC-6 required asserting `proof.containmentEmpty`. An over-broad sweep that bans tokens from the story's own design vocabulary is a defect, not safety. | Sweep-vocabulary rule in stage-contract and Gate 4; PE-15 eval. | covered |
| LSN-28 | Epic 4 re-plan / failure-row AC mismatch | A failure table row cited an AC that proved only the happy path, not the row's trigger and behavior. | Failure-row AC assertion rule in stage-contract Gate 4; PE-16 eval. | covered |

### Epic 4 delivery (proof-substrate + predicate-input blockers)

| ID | Source | Lesson | Covered by | Status |
|----|--------|--------|-----------|--------|
| LSN-29 | Epic 4 / `core-04-s1` | A type-only contract producer carried a `95% statements/branches` bar with no runtime substrate: `type`/`interface` erase → V8 sees `0/0` → 100% ≥ 95%, vacuously green; the `core-03-s1` sibling passed only by an `as const` coin-flip. Explicit **generalization of LSN-04** from config-only stories to **all** erased-type producers. | **Proof-substrate match** Gate-4 box + generalized Substrate/config variant — [authoring-standard/50-story-contract.md](authoring-standard/50-story-contract.md); proof-substrate invariant + `as const` catalog convention — [engineering/testing-policy.md](../engineering/testing-policy.md); plan-delivery substrate-presence preflight — [delivery-pipeline/30-plan-delivery.md](delivery-pipeline/30-plan-delivery.md); principle *Readiness is reconstructed, not asserted* — [authoring-standard/10-principles.md](authoring-standard/10-principles.md) | covered |
| LSN-30 | Epic 4 / `core-03-s2` | A relational safety predicate ("cwd **inside the workspace**") declared only one of two operands as a frozen input — the workspace-root operand was unsourced, so the predicate is undecidable; a tests-passing approximation (`cwd` as its own root) silently **failed open** (spoofable bypass of the sibling AC-3 high-risk rule). Explicit **granularity-strengthening of LSN-21** from per-AC to **per-sub-predicate**, with relational **two-operand** sourcing and **field-not-category** closure rows. | **Predicate-input closure — relational & compound** Gate-4 box + strengthened R6 (relational two-operand · compound-AC decomposition · `Producer/Type.field` · generic STOP) — [authoring-standard/50-story-contract.md](authoring-standard/50-story-contract.md); plan-delivery predicate-input preflight — [delivery-pipeline/30-plan-delivery.md](delivery-pipeline/30-plan-delivery.md); principle *Readiness is reconstructed, not asserted* — [authoring-standard/10-principles.md](authoring-standard/10-principles.md) | covered |
| LSN-31 | Epic 4 / PR #163 / `core-03-s3` | A consumer story used `approval-resume-capability-missing` while the producer `ApprovalFailureState` catalog/design omitted it. Consumer failure tables cannot invent tokens; shared failure / degraded / validation vocabulary must close against exactly one producer catalog before packaging. | Failure-token/catalog closure rule + Gate 4 box - [authoring-standard/50-story-contract.md](authoring-standard/50-story-contract.md); Gate 3 whole-graph failure-token/catalog reconciliation - [authoring-standard/40-story-dag.md](authoring-standard/40-story-dag.md); plan-delivery failure-token/catalog closure preflight - [delivery-pipeline/30-plan-delivery.md](delivery-pipeline/30-plan-delivery.md); characterization-review closure pass - [operating-model/characterization-review.md](operating-model/characterization-review.md) | covered |

## Open items

- **LSN-10, LSN-12** are `conditional`. Two guide tightenings convert them to `covered`: (a) seam-verbatim
  must include the call signature and name the single authoritative design source; (b) the domain charter
  must tag safety-critical invariants and the fail-closed test keys off that tag. Track LSN-12's structural
  fix as the deferred **B-heavy** credential/egress contract amendment.
- **LSN-20** is `conditional`: the capacity rule is recorded as a role responsibility, but the
  `orchestrated-delivery` skill change that reserves reviewer/re-address slots is deferred (the
  precondition) and out of this worktree's scope.
- **LSN-30 — defect-class covered; story-instance repair is a separate track.** The strengthened R6 /
  **Predicate-input closure — relational & compound** box covers the *defect class* (it makes `core-03-s2`
  a Gate-4 failure if re-graded). The `core-03-s2` *story* itself awaits a **design-led seam** routing a
  trusted workspace root (`RepositoryIdentity.repoRoot`) into approval risk classification — a `docs/design`
  decision out of scope for this machinery batch; sequence design-seam → `plan-epic` amend → `plan-delivery`
  re-project. The merged AC-3 boundary (cwd-as-workspace) is a **P1 fail-open** to fix when the seam lands.
- **core-03-s1 bar wording (non-blocking).** `core-03-s1` merged under the same vacuous coverage bar as
  `core-04-s1`; under LSN-29 it reclassifies cleanly as a runtime-catalog story (its lane is legitimate —
  it emitted `as const`), so the new rules do **not** retroactively break it. Restate its quality-bar
  wording for precedent consistency with the **Proof-substrate match** box. Non-blocking; do not gate the
  next epic on it.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Implementation planning — authoring standard](./README.md) · **← Prev:** [orchestrated-delivery — charter and evals](./delivery-pipeline/40-orchestrated-delivery.md) · **Next →:** [Engineering Policy Index](../engineering/README.md)

<!-- /DOCS-NAV -->
