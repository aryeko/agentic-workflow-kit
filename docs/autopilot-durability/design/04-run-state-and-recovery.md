---
title: D4 — Run state, recovery & reconciliation
status: draft
last-reviewed: 2026-06-18
part-of: autopilot-durability
themes: [G, K]
builds-on: [00-overview.md, 02-lifecycle-and-control-plane.md]
---

# D4 — Run state, recovery & reconciliation

One **authoritative, coherent** run state; **in-band recovery** as a first-class stage; duplicate-launch and
reconciliation through **supported controls — zero manual artifact edits.** Themes **G**, **K**. Builds on
the [spine](00-overview.md) (event-sourced projections) and [D2](02-lifecycle-and-control-plane.md)
(lifecycle/termination).

## 1. Principle — state is derived, recovery is in-band

Run state is a **projection** of the append-only log (D0); recovery is a **designed stage** with explicit,
evidence-based decisions — not blind relaunch, not manual artifact surgery (P6 recoverability).

## 2. Coherent state by construction (Theme G)

**The bug:** `state`/`summary`/`metrics`/`launch` were independently authored → diverged (`state: blocked`
vs `metrics: running`, pathway #15); a stale supervisor rewrote state *after* recovery, clobbering the reason
(#5); the recovery guard threw `spawn git ENOENT` after the worktree was removed (#16); two trackers diverged
(F8).

**The fix:**

- **All four are projections of `events.ndjson`** (D0) — they cannot disagree; `workflow_run_status` returns
  the projection, so no nested running-vs-blocked contradiction is possible.
- **Lifecycle-bound timers** (D2 §6): a terminal run emits nothing further → no stale post-abort write can
  overwrite a recovery reason.
- **Defensive recovery guard:** missing worktree/git is **classified as a state** (`worktree-gone`), never an
  uncaught `spawn ENOENT`.
- **Single tracker authority:** config names the one authoritative tracker; validation errors on divergence.
  The `docs/tracks` vs `docs/tracks-kit` split is collapsed/migrated.

## 3. Recovery as a first-class stage (Theme K + P6)

**The bug:** useful work completed only via **manual out-of-band recovery** (`codex resume`, manual pushes,
hand-edited artifacts); the kit had no in-band recovery path.

**The fix — a `RecoveryGuard` stage** that, on any non-clean terminal/stall, **classifies from evidence** and
emits an explicit decision (recorded as events):

| Recoverable state (named) | Typical decision |
|---|---|
| `awaiting-approval` (D1) | resume on decision |
| `failed-verification`, `claim-evidence-mismatch` | operator (or re-run gate) |
| `stale-base`, `merge-conflict` | rebase/recover (auto if safe) |
| `auth-failure`, `review-uncertainty` | operator |
| `child-no-progress`, `supervision-lost` | terminate (D2) + classify |
| `worktree-gone` | mark + operator |

Each decision is `{ auto-recoverable | needs-operator, recommendedAction, evidenceRef }`. When evidence shows
the situation is **safe-to-take-over** (e.g. worktree clean / action reversible), `auto-recover` may proceed —
gated by the capability (run-state coherent + no live un-owned child + evidence safe). Otherwise the run
**stops in a diagnosable recovery state** with evidence + recommended action surfaced. **Never blind relaunch.**

## 4. Duplicate-launch & reconciliation via supported controls (Theme G)

**The bug:** a stale duplicate-active-launch couldn't be cleared by public abort; it required hand-editing
`state.json` then `launch.json` (pathway #13).

**The fix:**

- The duplicate-launch guard stays TOCTOU-safe (per-story claim), but its state is a **projection**; clearing
  a stale active-launch is an **event** appended via a supported control
  (`workflow_run_control { kind: clear-stale-launch }` or the abort path) — **not a file edit**.
- Abort that finds an un-owned/dead child records the terminal event and **releases the claim**, so relaunch
  works without surgery.
- Operator reconciliation (correcting an outcome) is an **appended reconciliation event** with provenance;
  projections recompute. Full audit trail, no silent edits.

## 5. Re-dispatch semantics (on-class learning)

On-class showed re-dispatch **restarted the child from scratch** (new session, lost work). Design:
re-dispatch **resumes the linked session** where the runtime supports it (D2 linkage + `codex resume`/
app-server), else it clearly records that work is **restarted**. The recovery decision states which — no
silent loss. *(Depends on runtime resume support; coordinate with D2.)*

## 6. Decisions-to-confirm (safety-first defaults I've chosen)

- `auto-recover` **ON only for explicitly-safe classes** (e.g. clean-worktree stale-base); every other class
  **stops for the operator** with a recommended action. (Default off for anything ambiguous.) Flag to confirm.

## 7. Open questions

- The exact recoverable-state taxonomy and the auto-vs-operator split per class (the redesign flags this open).
- Resume-vs-restart support per runtime (with D2).
- Tracker-authority migration specifics.

## 8. Testability

- **Projection coherence:** property test — any event log → `state`/`summary`/`metrics` agree (fuzz orderings).
- **Recovery classification:** pure function (evidence → decision) → table tests per state, incl. the
  auto-vs-operator boundary.
- **Duplicate-launch:** simulate a stale active-launch → assert clear-via-control works with **no manual edit**.
- **Stale-write:** terminated run → assert no further writes; recovery reason preserved (regression for #5).
- **worktree-gone:** recovery guard returns a state, not an exception (regression for #16).

## Themes addressed

| Theme | Resolution |
|---|---|
| G | Projections can't diverge; reconciliation/duplicate-clear via events not edits; single tracker authority; defensive recovery guard; lifecycle-bound timers |
| K | In-band recovery as a first-class, evidence-classified stage — manual out-of-band recovery becomes the surfaced exception, not the required path |
