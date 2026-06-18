---
title: D3 — Completion, verification & merge safety
status: draft
last-reviewed: 2026-06-18
part-of: autopilot-durability
themes: [H, A]
builds-on: [00-overview.md, 02-lifecycle-and-control-plane.md]
---

# D3 — Completion, verification & merge safety

Decide **"done" and "merge" from independently-verified evidence + explicit policy** — never child prose
or ad-hoc human judgment — and gate irreversible actions behind proven guarantees. Theme **H** (+ the
verify-gate facet of **A**). Builds on the [spine](00-overview.md) (P5 evidence-over-prose, capability
gates, structured `child-run-result`) and [D2](02-lifecycle-and-control-plane.md) (the `killable` guarantee).

## 1. Principle — evidence + policy, not prose

Completion and merge are decided by **independently-gathered evidence** and **explicit repo policy**. The
child's self-report is a *hint*, not the authority. This fixes **Theme H** (raw RR3 F3 — on-class RV01 returned `done` with no
gate run — it would have cleared the old gate; only RV03's honesty saved the run) and **#19** (pathway's
merge-while-blocked was a coherent but *implicit, operator-improvised* decision).

## 2. Independent inspectors (the kit gathers evidence, not the child)

**The bug:** `CompletionGate.evaluate` blocks on the child's **returned status**; CI/PR evidence is consulted
only *after* the child already claims complete (`CompletionGate.ts:59-141`). Authority is the self-label.

**The fix:** completion is evaluated from evidence gathered by inspectors the **runner** runs:

| Inspector | Evidence |
|---|---|
| **GitInspector** | branch exists; commits present; base current / ancestry ok |
| **CollaborationInspector** (GitHub) | PR exists + state; CI checks status; required reviews satisfied; unresolved bot/review findings; branch state |
| **VerificationInspector** | the verify-gate **command, exit code, and output captured by the driver / tool wrapper (observed, not child-declared)**; if unavailable, the runner **re-runs the verify command** or reads the **CI artifact**. The `child-run-result` claim is only a hint, cross-checked against captured/CI evidence |

The child's returned status is recorded as a hint and **reconciled** against evidence. A mismatch
(claims `done`, evidence absent) → recoverable **`claim-evidence-mismatch`** state — never silent acceptance.

**Verification authority rule:** a child-declared green gate with **no driver-captured or CI evidence** is
treated as **unverified** and satisfies neither the completion nor the `auto-merge` gate. Verification must be
*observed* (tool-wrapper capture of command/exit/output), *re-run* by the runner, or *CI-derived* — never
merely asserted by the child.

## 3. Completion gate logic

`CompletionDecision ∈ { complete | blocked | failed | needs-recovery }`, derived from evidence with the
evidence that justified it attached (an event). The prompt line *"the tracker row status is the only
completion authority"* is **removed**; the tracker is **updated from** the evidence-based decision, not the
reverse. `returnedComplete:false` becomes meaningful — a hint that must reconcile with evidence.

## 4. Merge policy made explicit (Theme H, pathway #19)

The pathway run merged an evidence-only blocker PR and kept the story `blocked` — coherent, but decided by
the operator on the fly. We make it a **declared policy** the runner evaluates:

- **`mergePolicy`** (config): the conditions under which the runner may merge — e.g. CI green + required
  reviews satisfied + no unresolved bot/review findings + verify gate passed.
- **`mergeBlockerEvidence`** (config, default **off**): may a PR that *records a blocker* be merged while the
  story stays `blocked`? When on, such a merge is allowed **and does not mark the story complete**. This makes
  the pathway outcome a *declared* behavior, not an improvisation.

The applied policy and its evidence are recorded as a `MergePolicyDecision` event.

## 5. Who performs the merge — RECOMMENDATION, confirm on review

Merge is irreversible and its key evidence (CI, reviews) usually completes **after** the child's turn ends.
So by default the **runner performs the merge as a gated settle step**, once the merge capability gate (§6)
passes. This is consistent with "child is the actor" (D1): the child does the *implementation* (code, verify,
PR); **merge is a gated supervisory action**, not implementation labor — exactly the boundary the incidents
respected (the child opened the PR and explicitly did not merge). *Option:* config may let the child perform
the merge when it can satisfy the gate within its own turn. Recommend runner-performs-after-gate; flag to confirm.

## 6. Irreversible-action safety (capability gating)

The `auto-merge` capability (D0) is unlocked **only when all hold**:

```
CI green (CollaborationInspector)  ∧  required reviews satisfied  ∧  no unresolved bot/review findings
∧  verify gate passed              ∧  child is killable (D2)       ∧  run-state coherent (D4)
∧  mergePolicy permits
```

- **Why `killable` gates merge:** you must be able to stop a child before it takes an irreversible action
  unattended — so the Run-1 posture (auto-merge while the child couldn't be killed) is **unreachable**.
- **Default `auto-merge` OFF** (conservative); operator opts in per repo, and even then it stays gated.
- **Fail-closed:** if an inspector can't run (`gh`/GitHub unavailable), the gate **fails → park recoverable**
  (a named state), never assume success. (Fixes the on-class instinct that *did* hold the line — now it's by
  design, not luck.)

## 7. Decisions-to-confirm (safety-first defaults I've chosen)

- `auto-merge` default **off**; when enabled requires the full §6 conjunction.
- `mergeBlockerEvidence` default **off** (blocker PRs are not auto-merged unless opted in).
- Merge performed by the **runner** after the gate (vs child-in-turn).

## 8. Open questions

- Bot-findings detection: distinguishing a clean approval from "CI green but the Codex bot left findings"
  (both on-class PRs hit this) — CollaborationInspector rule set.
- Review-uncertainty handling: required-reviews vs optional, and how `rerequestAfterFix` interacts.

## 9. Testability

- Gate is a **pure function over evidence** → table tests (evidence combinations → decision).
- `claim-evidence-mismatch` asserted (child says done, no PR/CI).
- **Fail-closed** asserted: inspector unavailable → park, not complete.
- Merge policy: each `(mergePolicy, mergeBlockerEvidence, evidence)` → merge / withhold / merge-but-stay-blocked.

## Themes addressed

| Theme | Resolution |
|---|---|
| H | Completion + merge decided by independent evidence + declared policy; prose is a hint; merge policy explicit and recorded; irreversible actions gated (incl. on `killable`) |
| A (verify-gate facet) | Verify evidence gathered/cross-checked independently; the gate **fails closed** when it can't run, parking recoverable instead of guessing |
