---
title: "Delivery-model reform + barrel simplification — self-contained remediation plan"
status: "plan: active"
created: "2026-06-25"
updated: "2026-06-25"
owner: architect
---

# Delivery-model reform + barrel simplification (self-contained)

This runbook is executable cold. It reforms the delivery model in the **design/authoring** layer,
then conforms the **skills**, then re-plans **Epic 4** — three ordered phases: **DESIGN → SKILLS →
EPIC**. Read top to bottom. Do not skip the Environment and Background sections — they hold everything
a fresh session needs.

> **Supersedes** the earlier "barrel co-ownership + additive-merge" direction. That direction is
> **dropped** (see §1). The barrel work now *shrinks*; a new commit/loop/track/rebase/tracker model is
> *added*.

---

## 0. Environment & resume facts

- **Repo:** `/Users/aryekogan/repos/workflow-kit` (git remote `aryeko/agentic-workflow-kit`). Mainline
  branch is `v-next` (protected — never push directly; open PRs with base `v-next`).
- **Work branch / worktree (Phases 1–2):** `closure-safeguards-wiring` at
  `/Users/aryekogan/repos/workflow-kit/.worktrees/closure-safeguards-wiring`, cut from `v-next` @
  `ffe4cfb`. Carries `c368aa9` (systemic agent's producer-closure + barrel wiring) + the plan commit.
  **Resume by `cd`-ing into that worktree path.**
- **Epic 4 worktree/PR (Phase 3):** branch `codex/epic4-phase-b-plan`, PR
  [#153](https://github.com/aryeko/agentic-workflow-kit/pull/153), base `v-next`, local worktree
  `/Users/aryekogan/repos/workflow-kit/.worktrees/epic4-phase-b-plan`.
- **Worktree discipline (mandatory):** before any commit, run `git rev-parse --show-toplevel` and
  confirm it is the intended worktree, NOT the main checkout. Sub-agents have committed to the main
  checkout by mistake — the check is not optional.
- **Verify gate:** `pnpm check` (Turbo; expect "8 successful, 8 total" + "Nav up to date"). Run from the
  worktree root. Show its output as evidence; do not assert success.
- **Reference docs:** [closure audit](./2026-06-25-producer-consumer-closure-audit.md) ·
  [closure remediation plan](./2026-06-25-closure-remediation-plan.md). Memory:
  `~/.claude/projects/-Users-aryekogan-repos-workflow-kit/memory/` →
  `kit-vnext-barrel-coownership-decision.md` (**now superseded — update it when Phase 1 lands**),
  `kit-vnext-epic4-replan-defect-diagnosis.md`, `kit-vnext-closure-audit.md`.

---

## 1. Background — why this work exists (cold-start context)

Epic 4 delivery blocked twice on a recurring "producer↔consumer closure" defect class (a contract
declares a required output with no reachable producer). Phase A (merged) amended the design and added a
producer-closure Gate-1 check; Epic R1 (merged) fixed delivered code. Epic 4 was re-planned (PR #153);
a re-review found it **reproduced** two defect classes: every story owned the SDK barrel
(`packages/sdk/src/index.ts`), and two events were consumed but produced by no story. Root cause (4
mechanisms): **M1** design↔authoring drift; **M2** safeguards were prose, never wired into the
artifacts the planner runs; **M3** no whole-graph producer reconciliation; **M4** gates check AC→design
but never design→AC.

**Why the direction changed.** Two things surfaced while planning the fix:

1. **The barrel hardness was an artifact of a shared-worktree era.** Each story now gets its own
   worktree, so the strict "disjoint pathsets / barrel co-ownership / additive-merge" machinery is
   over-engineered. The simpler, correct model: **each story owns its feature end-to-end, including its
   own `index.ts` export line**; concurrency is planned like a normal backlog; trivial conflicts rebase.
2. **The skill is the *more-specified* layer and it encodes the model we're replacing.** The
   `orchestrated-delivery` skill (`EVALS.md` R8/R15/R17/R18, OD-4/OD-5) fully specifies a
   *coordinator-commits-once, workers-never-commit, reviewer-advisory* model **and a tracker schema the
   design never absorbed**. That skill-over-specifies-design gap is itself the M1/M2 drift this effort
   exists to kill. So the design must become the source of truth, and the skill conform to it.

**The new delivery model (the substance of this reform).** Implementer commits **each round** (so
reviewer-driven changes are visible history); the review loop is **capped at 5** then **blocks +
escalates that story** (siblings continue); the orchestrator stays **pure coordination** — it merges
each approved story's commits back to a named **track branch**, triggers an **implementer rebase** on
merge-back conflict, writes the **tracker**, and closes the worker pair + cleans the tree. Concurrency
is governed by a **same-logic rule** (below), not pathset disjointness.

### Layering principle (the reason for the phase order)

`docs/design/**` is the product source of truth; `docs/implementation-authoring/**` is the **design of
the authoring/delivery method**. The skills (`.agents/skills/*`) **implement** that design. Epic 4
**applies** the skills. Fix the design first, make the skills satisfy it, then apply to the epic. Never
patch a lower layer to compensate for an unfixed upper layer.

---

## 2. The decisions (locked)

1. **Commit cadence flips.** The implementer commits each round in its story worktree (impl-done commit
   + one commit per fix round, gate-green before each, round trailer). The orchestrator no longer
   commits story content — only the track merge-back + tracker write.
2. **Review loop capped at 5.** On exhaustion → **block + escalate that story** to the architect;
   sibling stories keep running; block only the minimal set.
3. **Track branch.** A named collection branch holds the delivery's stories. Model: story worktree →
   merge-back to **track branch** → later PR track → `v-next`. (The skill's existing "delivery worktree"
   is this concept; the design must name it.)
4. **Rebase = orchestrator-triggered, implementer-executed.** Orchestrator attempts merge-back; on
   conflict it messages the persistent implementer to rebase onto track `HEAD` + re-prove (gate), then
   the orchestrator commits the track merge. A *real logic* conflict (not a trivial replay) means the
   same-logic rule was violated upstream → **escalate**, do not silently resolve.
5. **Concurrency = the same-logic rule.**
   > Two stories may run concurrently iff neither depends on the other **and** they don't both modify
   > the same *logic-bearing* unit. Append-only aggregation points — the SDK barrel, registries,
   > manifests, index/aggregator files — are **not** logic-bearing; share them freely, rebase resolves
   > them.
   **Granularity: file-level (default)**, mechanically checkable from owned pathsets, with an
   **architect override + one-line rationale** when file-level over-serializes two stories that touch
   different logic in one file.
6. **Tracker.** Name tracker-update an explicit orchestrator duty, and lift the skill's R8 field set
   into the design as the **canonical schema**:

   | field | values / content |
   |---|---|
   | `status` | `ready` → `in_progress` → `in_review` → (`blocked` \| `approved`) → `merged` |
   | `round` | 1–5 (current review round) |
   | per-round record | implementer commit hash + reviewer verdict (APPROVE / BLOCKING + finding refs) |
   | `blocked` reason | on cap/escalation: which AC or finding, escalation target (architect) |
   | `merge` | track-branch merge commit hash |
   | `gate` | pointer to last green `pnpm check` evidence |
   | also (from R8) | wave, dependencies, model class + effort, prompt paths, notes |

7. **Barrel = a normal owned file.** Each public-symbol story owns its own `index.ts` export line
   end-to-end (export + public-import test). **No** dedicated owner, **no** "unowned/ad-hoc," **no**
   co-ownership invariant, **no** additive-merge driver, **no** `.gitattributes` change.

**Anti-drift discipline:** every rule has **one canonical home**; other files *reference* it, never
restate. Canonical homes: same-logic rule → `authoring-standard/40-story-dag.md`; tracker schema →
`delivery-pipeline/30-plan-delivery.md`; commit/loop/track/rebase model → `operating-model/` role specs.

---

## 3. Keep vs revert/redo vs add on this branch (`closure-safeguards-wiring`)

The systemic agent's **producer-closure** wiring is correct — keep it. Only the **barrel** direction is
wrong, and a new **delivery-model** layer is added.

| KEEP (correct, do not touch) | REVERT / REDO to the new direction | ADD (did not exist before) |
|---|---|---|
| produced-obligations matrix in `_templates/story-contract.md` | barrel "no owner / ad-hoc" wording (→ "each story owns its own export line") | per-round implementer commits (operating-model) |
| DAG-level producer reconciliation (`40-story-dag.md`; PE-12) | "No `index.ts` in pathset" lines (template, SKILL, plan-epic) | 5-round cap → block + escalate |
| design→AC completeness pass (`characterization-review.md`; PE-14) | PE-17 barrel-disjointness (→ same-logic concurrency) | named track branch + merge-back |
| sweep-vocabulary check (`characterization-review.md`; PE-15) | planned I6 "barrel" invariant (drop — wrong altitude) | orchestrator-triggered implementer rebase |
| failure-row→AC eval (PE-16) | LSN-08 / LSN-25 wording | canonical tracker schema (lifted from skill R8) |
| producer-closure SKILL step + Gate-4 checkbox (PE-13) | `sdk-boundary.md` "not owned by any story" | same-logic concurrency rule + override |

---

## 4. PHASE 1 — DESIGN / AUTHORING (do first; STOP for architect review before Phase 2)

Work in the `closure-safeguards-wiring` worktree. 15 files. Skill changes are **Phase 2**, not here.
After all edits: `pnpm check`, commit, STOP.

### `docs/design/`
1. **`20-sdk-and-packaging/sdk-boundary.md`** — rewrite "Public entrypoint ownership": each story owns
   its own `index.ts` export line end-to-end (export + public-import test); the barrel is a *normal
   owned file*. Delete "not owned by any story," dedicated-owner, and all co-ownership / additive-merge
   language.

### `operating-model/` (canonical home for the commit/loop/track/rebase model)
2. **`orchestrator.md`** *(the big one)* — remove the "commit the approved pathset" duty. Add duties:
   merge each approved story's per-round commits back to the **track branch**; on conflict, message the
   persistent implementer to rebase + re-prove, then merge; **write the tracker**; enforce the **5-round
   cap → block + escalate** (siblings continue); close the worker pair + clean the story tree. Reconcile
   concurrency from "serialize unmergeable file" → "same-logic stories never run concurrently (planning
   guarantees it); trivial conflicts rebase; a real logic conflict escalates."
3. **`implementer.md`** — add: **commit each round** in the story worktree (impl-done + one per fix
   round, gate-green before each, round trailer); **rebase on orchestrator request** + re-prove +
   re-commit. Replace "never commit / touch shared files" with "owned pathset only" (now includes its
   own `index.ts` line).
4. **`reviewer.md`** — light: reviews the latest **committed** round (not a stash/draft); still never
   fixes/commits; note the 5-round cap hand-off to the orchestrator.
5. **`README.md`** — update the incremental-loop summary: per-round implementer commits, orchestrator
   track-commits at APPROVE, the 5-round cap + block/escalate.
6. **`architect.md`** — add the concurrency-characterization duty: the architect decides same-wave
   eligibility via the same-logic rule (reference `40-story-dag.md`, do not restate).
7. **`characterization-review.md`** — **no change** (keep the producer-closure / design→AC / sweep
   additions already wired).

### `delivery-pipeline/` (the charter the skill implements)
8. **`40-orchestrated-delivery.md`** — replace OD-4 / OD-5 commit semantics (per-round implementer
   commits; orchestrator does merge-back + tracker only; drop "advisory review → coordinator inspects
   diff → commits"). Add evals for the 5-round cap, track-branch merge-back + orch-triggered rebase, and
   same-logic concurrency. Drop the planned barrel OD-10 / additive-merge (now moot).
9. **`30-plan-delivery.md`** *(canonical tracker schema)* — lift R8's fields + status lifecycle
   (`ready→in_progress→in_review→blocked|approved→merged`), per-round commit hash + verdict, gate
   evidence, blockers, merge commit, notes.
10. **`20-plan-epic.md`** — replace PE-17 (barrel disjointness) with the same-logic concurrency rule;
    delete the "No `index.ts` in pathset" output-gate bullet; keep PE-12…PE-16 (producer closure).
11. **`10-pipeline-and-invariants.md`** — **revert the planned "I6 barrel" invariant** (wrong
    altitude); leave the five invariants as-is.

### `authoring-standard/` (how stories are authored)
12. **`40-story-dag.md`** *(canonical home for the same-logic rule)* — barrel: "each public-symbol
    story owns its own `index.ts` export line." Concurrency: replace pathset-disjointness with the
    same-logic rule + exemptions + override. Keep DAG-level producer reconciliation.
13. **`50-story-contract.md`** — Gate-4 public-exposure checkbox: names import path + public-import test
    AND includes its own `index.ts` export line in the pathset (drop "barrel must NOT be in pathset").
    Keep the substrate-by-construction clause.
14. **`_templates/story-contract.md`** — remove the "No `index.ts` in any pathset" line; keep the
    produced-obligations (producer-closure) matrix.
15. **`lessons-ledger.md`** — reframe LSN-08 (each story owns its barrel export; concurrency =
    same-logic; orch rebases trivial conflicts) and LSN-25 (defect was the missing per-round-commit +
    track-merge-back + concurrency model, not `index.ts` inclusion); fold LSN-25 into LSN-08 if cleaner.

### Phase 1 verification
- `pnpm check` green.
- `grep -rn "not owned by any\|dedicated.*owner\|co-own\|additive\|No .packages/sdk/src/index.ts\|disjoint pathset" docs/design docs/implementation-authoring` → returns nothing (all old-direction wording gone).
- `grep -rn "owns its own .*index.ts\|same-logic\|track branch\|5-round\|in_review" docs/design docs/implementation-authoring` → present in the expected files.
- Commit (worktree-checked): `docs: reform delivery model (per-round commits, track branch, 5-round cap, same-logic concurrency) + simplify barrel to per-story ownership`.
- **STOP. Architect reviews the design reads as intended before Phase 2.**

---

## 5. PHASE 2 — SKILLS (make the skills satisfy the Phase-1 design + verify/eval; same branch)

Goal: conform `.agents/skills/*` to the Phase-1 design, then verify and eval. The skill is currently the
*more-specified* layer encoding the OLD model — this is a real rewrite, not a touch-up.

- **`.agents/skills/orchestrated-delivery/`** — the heaviest. Rewrite the commit/loop contract:
  - `EVALS.md` OD-4/OD-5 + R15/R16/R17/R18: per-round implementer commits; orchestrator = merge-back +
    tracker write only; drop reviewer-advisory + coordinator-inspects-diff-then-commits.
  - Add evals/cases: 5-round cap → block + escalate; track-branch merge-back + orchestrator-triggered
    implementer rebase; same-logic concurrency (file-level + exemptions + override).
  - `references/`: `commit-tracker.md` (per-round commit + final track commit + tracker write per the
    canonical schema), `worker-lifecycle.md` (cap → block/escalate; close pair), `story-worktrees.md`
    (drop pathset-disjointness/barrel machinery → same-logic + rebase-on-advance), `pr-merge.md`
    (track→`v-next` boundary). Keep `SKILL.md` a router.
  - Remove any barrel co-ownership / additive-merge / `.gitattributes` references.
- **`.agents/skills/plan-epic/`** — `SKILL.md` + `references/stage-contract.md` + `EVALS.md`: barrel =
  per-story export ownership; PE-17 = same-logic concurrency; keep producer-closure step (PE-12…PE-16).
- **`.agents/skills/plan-delivery/`** — tracker template/fields match the canonical schema (§2.6).
- **Verify:** `pnpm check` green; run each skill's evals; confirm no contradictory prompt/tracker/scope
  policy remains (their own static-integrity eval, e.g. orchestrated-delivery TC-20).
- Commit (worktree-checked): `feat(skills): conform delivery skills to reformed design + re-eval`.
- Open PR base `v-next`, head `closure-safeguards-wiring` (design + skills together). **STOP for review.**

---

## 6. PHASE 3 — EPIC 4 (only after the Phase-1/2 PR is merged or design is final)

Use the **updated `plan-epic` skill** to bring Epic 4's plan into line with the new design — not a
hand-patch. PR [#153](https://github.com/aryeko/agentic-workflow-kit/pull/153), branch
`codex/epic4-phase-b-plan`, dir `docs/implementation/epics/epic-4-human-control-and-liveness-loop/`.

- **Re-run `plan-epic` on Epic 4** against the reformed authoring standard. Expected deltas vs current
  #153: each story re-includes its own `index.ts` export line (per-story ownership); concurrency
  expressed via the same-logic rule (Epic 4 bands already keep parallel stories on disjoint source dirs,
  so this should hold without DAG restructuring); drop any "export-aggregation owner" references.
- **Already fixed on #153 (verified READY — do NOT redo):** producers for `ApprovalRiskClassified` +
  `ApprovalDecisionRecorded` (`core-03-s2`); C1 resume attestations (`core-03-s3`); C2 containment
  sweep (`core-04-s4`); A4 minted ids; A5 failure-row→AC (s2); A6 binding required-iff (s1/s2). Two
  pre-merge minors (s2 decision-recording scope entry; s2 AC-sizing justification) — let Codex land.
- **Then** re-run the Gate-1 closure/producer/concurrency review; on READY → `plan-delivery`.

### Phase 3 verification
- Epic 4 story contracts each include their own `index.ts` export line; no "export-aggregation owner"
  references remain.
- Concurrency reads as the same-logic rule; CI `check` green on #153; Gate-1 re-review → READY.

---

## 7. Session summary (origin context)

- **Task.** Diagnose why Epic 4's re-plan (PR #153) reproduced defects despite Phase A; fix the
  generative cause; reform the delivery model and barrel handling in the design layer; plan skills +
  Epic 4 to follow.
- **Done/how.** Root cause = prevention was prose-only + design↔authoring (and skill-over-design) drift.
  Decided to **drop** the barrel co-ownership/additive-merge direction (a shared-worktree artifact) for
  **per-story barrel ownership**, and to reform the delivery model: per-round implementer commits,
  5-round cap + block/escalate, named track branch, orchestrator-triggered rebase, lifted tracker
  schema, same-logic concurrency. Confirmed the skill currently encodes the OLD model (R8/R15/R17/R18,
  OD-4/OD-5) → must conform in Phase 2.
- **Why.** Make the safeguards generative (in the design the skills implement), with a delivery model
  that fits per-story worktrees and gives visible per-round history.
- **State.** `closure-safeguards-wiring` carries correct producer-closure wiring + wrong barrel
  direction (Phase 1 fixes it) + this runbook. Phase 1 not yet started. PR #153 = closure fixed/verified,
  2 minors pending Codex, barrel/concurrency pending Phase-3 re-plan.
- **Next.** Phase 1 (design/authoring) → checkpoint → Phase 2 (skills + eval) → PR → Phase 3 (re-plan
  Epic 4 with updated skill) → re-review → plan-delivery.

## 8. Open risks
- **Same-logic enforceability.** File-level disjointness-of-logic must be checkable at plan-epic time
  from owned pathsets (PE-17's new form), not just prose — and the architect override must require a
  rationale, or it becomes an escape hatch that reintroduces collisions.
- **Skill rewrite scope.** The commit/review contract inversion (OD-4/OD-5, R15/R17/R18) is broad; the
  skills' own evals (e.g. TC-20 static integrity) are the backstop against a half-converted contract.
- **Rebase semantics.** Orchestrator must distinguish a trivial replay (resolve) from a real logic
  conflict (escalate); if it cannot, default to escalate.
- **Memory drift.** `kit-vnext-barrel-coownership-decision.md` is now superseded — update it when
  Phase 1 lands so the next session doesn't resurrect co-ownership.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../README.md) · **← Prev:** [Product layer — authoring plan (cross-session playbook)](../product/authoring-plan.md) · **Next →:** [Closure-Defect Remediation — Durable Execution Plan](./2026-06-25-closure-remediation-plan.md)

<!-- /DOCS-NAV -->
