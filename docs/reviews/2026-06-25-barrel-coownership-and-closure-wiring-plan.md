---
title: "Barrel co-ownership + closure-wiring — self-contained remediation plan"
status: "plan: active"
created: "2026-06-25"
owner: architect
---

# Barrel co-ownership + closure-wiring remediation plan (self-contained)

This runbook is executable cold. It finishes the Epic-4-triggered prevention work in three ordered
phases: **DESIGN → SKILLS → EPIC**. Read top to bottom. Do not skip the Environment and Background
sections — they contain everything a fresh session needs.

---

## 0. Environment & resume facts

- **Repo:** `/Users/aryekogan/repos/workflow-kit` (git remote `aryeko/agentic-workflow-kit`). Mainline
  branch is `v-next` (protected — never push to it directly; open PRs with base `v-next`).
- **Work branch / worktree (Phases 1–2):** `closure-safeguards-wiring` at
  `/Users/aryekogan/repos/workflow-kit/.worktrees/closure-safeguards-wiring`, branch HEAD `c368aa9`,
  cut from `v-next` @ `ffe4cfb`. **Resume by `cd`-ing into that worktree path.**
- **Epic 4 worktree/PR (Phase 3):** branch `codex/epic4-phase-b-plan`, PR
  [#153](https://github.com/aryeko/agentic-workflow-kit/pull/153), base `v-next`, local worktree
  `/Users/aryekogan/repos/workflow-kit/.worktrees/epic4-phase-b-plan`. (Owned by Codex; coordinate via
  PR comments — see Phase 3.)
- **Worktree discipline (mandatory):** before any commit, run `git rev-parse --show-toplevel` and
  confirm it is the intended worktree, NOT the main checkout `/Users/aryekogan/repos/workflow-kit`.
  Sub-agents have committed to the main checkout by mistake — the check is not optional.
- **Verify gate:** `pnpm check` (Turbo; expect "8 successful, 8 total" + "Nav up to date"). Run from the
  worktree root. Show its output as evidence; do not assert success.
- **Reference docs:** [closure audit](./2026-06-25-producer-consumer-closure-audit.md) ·
  [closure remediation plan](./2026-06-25-closure-remediation-plan.md). Memory:
  `~/.claude/projects/-Users-aryekogan-repos-workflow-kit/memory/` →
  `kit-vnext-barrel-coownership-decision.md`, `kit-vnext-epic4-replan-defect-diagnosis.md`,
  `kit-vnext-closure-audit.md`.

---

## 1. Background — why this work exists (cold-start context)

Epic 4 delivery blocked twice on a recurring "producer↔consumer closure" defect class (a contract
declares a required output with no reachable producer). Phase A (merged) amended the design and added a
producer-closure Gate-1 check; Epic R1 (merged) fixed delivered code. Epic 4 was then re-planned
(PR #153). A re-review found the re-plan **reproduced** two defect classes despite Phase A:

1. **Barrel:** every story owned `packages/sdk/src/index.ts` (the rejected serialize-on-one-file model).
2. **Missing producer:** `ApprovalDecisionRecorded` / `ApprovalRiskClassified` consumed but produced by
   no story.

Root cause (4 mechanisms): **M1** design↔authoring drift; **M2** safeguards were prose, never wired
into the artifacts the planner runs (skill steps, matrix template, evals); **M3** no whole-graph
event-producer reconciliation; **M4** gates check AC→design but never design→AC. See the diagnosis
memory for the full attribution.

Two parallel fixes were started and **diverged on the barrel model**:
- Codex fixed PR #153's 8 findings but routed the barrel through a "dedicated export-aggregation owner."
- A systemic agent (this branch, `c368aa9`) wired the closure checks correctly **but** reconciled the
  barrel to "no owner / ad-hoc" and edited frozen design.

**Architect decision** resolved the divergence → the canonical rule below. Both the Phase-A "dedicated
owner" wording and the systemic agent's "ad-hoc" wording are wrong and get replaced.

### Layering principle (the reason for the phase order)

`docs/implementation-authoring/**` is the **design** of the authoring/delivery method. The skills
(`.agents/skills/plan-epic`, `.agents/skills/orchestrated-delivery`) **implement** that design. Epic 4
**applies** the skills. Fix the design first, then make the skills satisfy it, then apply to the epic.
Never patch a lower layer to compensate for an unfixed upper layer.

---

## 2. The decision (canonical barrel rule) + why

> Every story that exposes public SDK symbols **includes `packages/sdk/src/index.ts` in its owned
> pathset** and delivers its own export line(s) plus a public-import test. There is **no dedicated
> owner story** and **no unowned/ad-hoc file**. Concurrent (same-wave) stories may overlap **only** on
> the barrel — every other path disjoint. The orchestrator **auto-resolves additive barrel merges**
> (both sides only appended exports) and re-runs the gate; any non-additive barrel conflict or any
> non-barrel overlap **stops** and routes to the implementer. Sequential (dependent) stories need no
> special handling — each branches from the post-merge delivery `HEAD`.

**Why (grounded in verified orchestrator mechanics):**
- Orchestrator commits **only the declared pathset** — `.agents/skills/orchestrated-delivery/EVALS.md`
  OD-5/R17/TC-15 and `delivery-pipeline/40-orchestrated-delivery.md` OD-5. So a barrel edit outside
  every pathset is **dropped** → the ad-hoc/no-owner model is mechanically broken. `index.ts` must be in
  *some* pathset.
- Merge-back is `git merge --ff-only`, rebases on advance, and **stops on any conflict**;
  concurrency today requires **non-overlapping pathsets** —
  `.agents/skills/orchestrated-delivery/references/story-worktrees.md` "Merge Back" + "Concurrency".
  To co-own the barrel, the orchestrator must permit barrel-only overlap and additive-merge it.
- A dedicated owner would work but is a phantom node + serialization point + frozen-DAG churn.
  Co-ownership + additive-merge matches the barrel's append-only nature and needs no new story.

---

## 3. Keep vs revert on this branch (`closure-safeguards-wiring`)

The systemic agent's closure-wiring is **correct — keep it**. Only the barrel direction is wrong.

| KEEP (correct, do not touch) | REVERT / REDO to the canonical rule |
|---|---|
| produced-obligations matrix in `_templates/story-contract.md` | `sdk-boundary.md` "no owner / ad-hoc" rewrite |
| DAG-level producer reconciliation (`40-story-dag.md`; PE-12) | `40-story-dag.md` "barrel not owned by any story" para |
| design→AC completeness pass (`characterization-review.md`; PE-14) | `SKILL.md` + `stage-contract.md` "do not include index.ts" |
| sweep-vocabulary check (`characterization-review.md`; PE-15) | `EVALS.md` + `20-plan-epic.md` PE-17 (invert) |
| failure-row→AC eval (PE-16) | `lessons-ledger.md` LSN-08 wording + LSN-25 |
| producer-closure SKILL step + Gate-4 checkbox (PE-13) | `_templates/story-contract.md` "No index.ts in pathset" line |

---

## 4. PHASE 1 — DESIGN (do first; STOP for architect review before Phase 2)

Work in the `closure-safeguards-wiring` worktree. After all edits: `pnpm check`, commit, STOP.

### 4a. Product design — `docs/design/20-sdk-and-packaging/sdk-boundary.md`
Replace the entire "## Public entrypoint ownership" section (currently the agent's "not owned by any
story" text) with:

```
## Public entrypoint ownership

The SDK public entrypoint (`packages/sdk/src/index.ts`) is **co-owned**: every story that exposes a
public symbol includes `packages/sdk/src/index.ts` in its owned pathset and contributes its own
`export` lines, plus a public-import test proving the symbol resolves from `sdk`. There is no dedicated
aggregation owner and no unowned/ad-hoc file.

Because the barrel is append-only, concurrent stories can share it safely. Stories dispatched in the
same delivery wave may overlap **only** on `packages/sdk/src/index.ts` — every other path in their
pathsets must be disjoint. The delivery orchestrator merges concurrent barrel additions automatically
(additive union) and re-runs the gate; any non-additive barrel conflict, or any overlap on a non-barrel
file, stops finalization and routes back to the implementer. Sequential stories need no special
handling — each branches from the post-merge delivery `HEAD` and sees the prior exports.
```

### 4b. `docs/implementation-authoring/authoring-standard/40-story-dag.md`
Find the barrel bullet (currently begins "**The SDK barrel (`packages/sdk/src/index.ts`) is not owned
by any behavior or contract story.**"). Replace that bullet + its follow-on lines with:

```
- **The SDK barrel (`packages/sdk/src/index.ts`) is co-owned.** Every story that exposes a public
  symbol includes the barrel in its owned pathset and adds its own export lines (+ a public-import
  test). Do not assign a single dedicated barrel owner, and do not leave the barrel out of every
  pathset. Concurrent same-wave stories may overlap **only** on the barrel; all other pathsets must be
  disjoint. The orchestrator additive-merges concurrent barrel changes and re-runs the gate (see
  `delivery-pipeline/40-orchestrated-delivery.md`); sequential stories see prior exports via the
  post-merge delivery `HEAD`.
```
Keep the "One ownership scope per node" bullet and the DAG-level producer-reconciliation Gate-3 box.

### 4c. `docs/implementation-authoring/authoring-standard/50-story-contract.md` (line ~101)
Extend the Gate-4 "Public exposure" checkbox to require the barrel in the pathset:

```
- [ ] Public exposure: each public SDK shape names its import path (export + barrel + `exports`) and a
      public-import test, AND the story includes `packages/sdk/src/index.ts` in its owned pathset for
      its own export lines; or the story states it exposes none — **substrate/config stories that
      expose no SDK surface satisfy this by construction.**
```

### 4d. `docs/implementation-authoring/authoring-standard/_templates/story-contract.md`
Remove the agent-added line "No `packages/sdk/src/index.ts` in any story's owned pathset." (under the
boundary/quality section). **Keep** the "Produced obligations (producer-closure)" matrix section.

### 4e. `docs/implementation-authoring/delivery-pipeline/40-orchestrated-delivery.md`
This is the **charter** the orchestrated-delivery skill implements. Add to "## Output gate (done
means)" (near line 38) a bullet, and add an eval to the table (next id after OD-9 → OD-10):

- Output-gate bullet:
  `- Concurrent stories overlap only on the SDK barrel; additive barrel merges are coordinator-resolved (union) with a gate re-run; any other conflict or any non-barrel overlap stops and routes back.`
- Eval row:
  `| OD-10 | Concurrent stories may overlap only on \`packages/sdk/src/index.ts\`; the coordinator additive-merges barrel-only additive conflicts and re-runs the gate; non-additive barrel conflicts and non-barrel overlaps stop and route to the implementer. | P1 | E/T |`

### 4f. `docs/implementation-authoring/delivery-pipeline/10-pipeline-and-invariants.md` (section "## The five invariants", line ~46)
Add a sixth invariant (and update the heading count to six):

```
6. **Barrel co-ownership.** Public-symbol stories own their own export lines on
   `packages/sdk/src/index.ts`; same-wave stories overlap only there; the orchestrator additive-merges
   concurrent barrel changes and re-runs the gate. A dedicated owner and an unowned barrel are both
   defects.
```

### 4g. `docs/implementation-authoring/delivery-pipeline/20-plan-epic.md`
- Line ~54: delete the output-gate bullet "No `packages/sdk/src/index.ts` in any story's owned pathset."
- Line ~86: replace PE-17 with:
  `| PE-17 | Every public-symbol story includes \`packages/sdk/src/index.ts\` in its owned pathset (co-ownership); concurrent same-wave stories overlap on no non-barrel path. | P1 | S |`
- Keep PE-12…PE-16 and the "PE-1…PE-17" count line.

### 4h. `docs/implementation-authoring/lessons-ledger.md`
- LSN-08: change the resolution clause to: "Reconciled barrel model: public-symbol stories include
  `packages/sdk/src/index.ts` in their pathset and add their own export lines (+ public-import test);
  same-wave stories overlap only on the barrel; the orchestrator additive-merges concurrent barrel
  changes. Neither a dedicated owner nor an unowned barrel is correct."
- LSN-25: reframe — the defect was the **missing orchestrator concurrent-barrel-merge rule + missing
  "overlap only on barrel" invariant + design↔authoring drift**, NOT the inclusion of `index.ts`. (Or
  fold into LSN-08 and delete LSN-25.)

### 4i. `docs/implementation-authoring/operating-model/characterization-review.md`
No change — the agent's design→AC + producer-closure + sweep-vocabulary additions are correct. (If
`operating-model/orchestrator.md` enumerates merge handling, add the barrel-overlap + additive-merge
note there too.)

### Phase 1 verification
- `pnpm check` green.
- `grep -rn "not owned by any\|dedicated export-aggregation owner\|do not include .*index.ts\|ad-hoc" docs/design docs/implementation-authoring` → returns nothing (all wrong-direction wording gone).
- `grep -rn "co-owned\|overlap only on the barrel\|additive" docs/design/20-sdk-and-packaging/sdk-boundary.md docs/implementation-authoring/authoring-standard/40-story-dag.md` → present.
- Commit (worktree-checked): `docs: reconcile SDK barrel to co-ownership + additive-merge across design`.
- **STOP. Architect reviews the design reads as intended before Phase 2.**

---

## 5. PHASE 2 — SKILLS (make skills satisfy the Phase-1 design; same branch)

### 5a. `.agents/skills/plan-epic/SKILL.md` + `references/stage-contract.md`
- Remove the "Do not include `packages/sdk/src/index.ts` in any story's owned pathset" lines (SKILL
  step 4; stage-contract "Barrel ownership" block). Replace with: "Public-symbol stories include
  `packages/sdk/src/index.ts` in their owned pathset; concurrent same-wave stories may overlap only on
  the barrel — all other pathsets disjoint." **Keep** step 6's producer-closure coverage line.

### 5b. `.agents/skills/plan-epic/EVALS.md`
- Invert PE-17 to match §4g. Keep PE-12…PE-16. Keep the "PE-1…PE-17" scope line.

### 5c. `.agents/skills/orchestrated-delivery/references/story-worktrees.md` (the substantive work)
- "## Concurrency" (line ~90): change "non-overlapping pathsets" to:
  `Independent stories may run concurrently only in separate story worktrees whose pathsets are non-overlapping **except** for the SDK barrel \`packages/sdk/src/index.ts\`, which public-symbol stories co-own. Final merge-back uses a single coordinator commit lock.`
- "## Merge Back" (after the conflict paragraph, lines ~63–67): add:
  `If a rebase or merge-back conflicts only on \`packages/sdk/src/index.ts\` and both sides only *added* export lines (no edits to existing lines), the coordinator resolves by union of both additions and re-runs the required gate (typecheck + public-import test) before finalizing. For any other conflict — including non-additive barrel edits or conflicts on a non-barrel file — stop finalization, keep the story worktree, and route to the existing implementer context.`

### 5d. `.gitattributes` (repo root, on the work branch)
Add: `packages/sdk/src/index.ts merge=union` so git auto-unions concurrent export additions during
rebase/merge. The gate re-run (§5c) is the backstop against union mis-ordering/dupes.

### 5e. `.agents/skills/orchestrated-delivery/EVALS.md`
Add eval case(s) mirroring OD-10 (§4e): barrel-only concurrent overlap is allowed; additive barrel
conflict is coordinator-resolved + gate-rerun; non-barrel overlap and non-additive barrel conflict
stop. Keep "commit only the pathset" (index.ts is now *in* the pathset).

### Phase 2 verification + PR
- `pnpm check` green; eval files consistent.
- Commit (worktree-checked): `feat(skills): implement barrel co-ownership + additive-merge per design`.
- Open PR base `v-next`, head `closure-safeguards-wiring` (design + skills together). **STOP for review.**

---

## 6. PHASE 3 — EPIC 4 (only after the Phase-1/2 PR is merged or design is final)

PR [#153](https://github.com/aryeko/agentic-workflow-kit/pull/153), branch `codex/epic4-phase-b-plan`.

**Already fixed on #153 (verified READY — do NOT redo):** producer for `ApprovalRiskClassified` +
`ApprovalDecisionRecorded` (assigned to `core-03-s2`, barrier durability, `protectedPolicyBinding`
required-iff); C1 resume capability attestations (`core-03-s3`); C2 containment boundary sweep
(`core-04-s4`); A4 minted ids (`decision-model.md` + s2/s4); A5 failure-row→AC (s2); A6 binding
required-iff (s1/s2). Two pre-merge minors requested (s2 decision-recording scope-decision entry;
s2 AC-sizing justification) — let Codex land these.

**The barrel revert (the only Phase-3 change):** Codex removed `packages/sdk/src/index.ts` from all 8
pathsets and routed through "the export-aggregation owner." Under the canonical rule, reverse that in
`docs/implementation/epics/epic-4-human-control-and-liveness-loop/`:
- `story-dag.md`: re-add `packages/sdk/src/index.ts` to all 8 owned-pathset cells; restore the Reading
  Rule to co-ownership + "concurrent stories overlap only on the barrel"; drop "via export-aggregation
  owner" from the Shared Shapes table and the topological notes.
- Each story (`core-03-s1..s4`, `core-04-s1..s4`): change the predicate-closure "public symbols" row
  back to include `packages/sdk/src/index.ts`; remove the "Shared entrypoint ownership: … belongs to
  the export-aggregation owner" quality-bar line.
- Sanity: Epic 4 bands already pair one approval + one supervision story per wave (disjoint source
  dirs, share only the barrel) → the "concurrent overlap only on barrel" invariant already holds; no
  DAG restructuring.

**How to drive it:** post a PR comment to Codex specifying the revert (with `@codex address that
feedback`), keeping all other fixes + the 2 minors. Then re-run the Gate-1 closure/barrel/producer
review; on READY, proceed to `plan-delivery`.

### Phase 3 verification
- `grep -c "src/index.ts" docs/implementation/epics/epic-4*/story-dag.md` → 8 pathset cells include it.
- No "export-aggregation owner" references remain in the Epic 4 dir.
- CI `check` green on #153. Gate-1 re-review → READY.

---

## 7. Session summary (origin context)

- **Task.** Explain why Epic 4's re-plan (PR #153) was full of issues despite Phase A; attribute each to
  design/authoring/skill/process; fix; then decide the barrel model and plan the full remediation.
- **Done/how.** Diagnosed via sub-agent sweeps (root cause = prevention was prose-only; design↔authoring
  contradiction; 4 mechanisms). Codex fixed all 8 #153 findings → verified READY. Posted 2 minors.
  Spawned a systemic agent (this branch) — correct closure-wiring, wrong barrel direction. Established
  orchestrator mechanics; architect decided co-ownership + additive-merge.
- **Why.** Make the safeguards generative (in the design the skills implement) so the closure + barrel
  defect classes can't recur on Epic 5+, with a barrel model that fits the orchestrator.
- **State.** PR #153 = closure fixed/verified, 2 minors pending Codex, barrel pending Phase-3 revert.
  `closure-safeguards-wiring` (`c368aa9`) = correct closure-wiring + wrong barrel (Phase 1/2 fixes it),
  not yet PR'd. This plan committed as the durable runbook.
- **Next.** Phase 1 (design) → checkpoint → Phase 2 (skills) → PR → Phase 3 (Epic 4 revert) → re-review
  → plan-delivery.

## 8. Open risks
- Additive-merge correctness: union can duplicate/mis-order exports → the gate (typecheck +
  public-import test) is the backstop; ensure the orchestrator re-runs it after any auto-resolved barrel
  merge.
- "Concurrent overlap only on barrel" must be enforceable at plan-epic time (same-wave non-barrel
  pathsets disjoint) — that is PE-17's second clause, not just prose.
- Future epics whose same-wave stories share a non-barrel surface violate the invariant; band structure
  must keep parallel stories on disjoint source dirs (Epic 4 already does).
