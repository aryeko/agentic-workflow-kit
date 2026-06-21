---
title: D5 — Observability & analysis
status: draft
last-reviewed: 2026-06-18
part-of: autopilot-durability
themes: [I, J]
builds-on: [00-overview.md, 02-lifecycle-and-control-plane.md]
---

# D5 — Observability & analysis

**Structured telemetry** at the source, and **analysis that auto-fires on terminal/block and correlates** the
evidence. Themes **I**, **J**. Builds on the [spine](00-overview.md) (event log, `child-run-result`) and
[D2](02-lifecycle-and-control-plane.md) (progress/linkage events).

## 1. Principle — structured, not parsed; automatic, not manual

All evidence/telemetry is **structured at the source**; analysis fires **automatically** on terminal/block and
**correlates** the event log. (Fixes **I** free-text parsing and **J** manual + blind analyzer.)

## 2. Structured evidence & telemetry (Theme I)

**The bug:** the free-text evidence parser set `command` to the first backtick pair → bogus values
(`@base-ui/react` as a "command"), recorded the real reviewer as `reviewer: null` (`evidenceParser.ts`); and
nested `spawn_agent` work was absent (`subagentCounts: {}`).

**The fix:**

- **`child-run-result` is structured** (D0): `changedFiles`, `verification {command, exitCode, outputRef}`,
  `prRefs`, `blockers`, `reviewerFindings [{reviewer, severity, detail}]` — typed, no prose parsing. The
  free-text `evidenceParser` is **retired as an authority**.
- **Nested-agent telemetry:** the child reports spawned sub-agents (pre-PR reviewers like Cicero/Euler)
  **structurally** — counts + findings — via `child-run-result` + progress events, so their findings become
  first-class, not transcript-only.
- **Honest metrics:** explicit fields (wall, phase durations, real-progress gaps, tool calls total/by-tool/
  failed, tokens input/output/reasoning/cache) that are **nullable with an `unavailableReason`** when the
  runtime can't supply them live — never faked. (Reconciles the redesign's honest-telemetry goal.)

## 3. Auto-firing, correlating analysis (Theme J)

**The bug:** `analyze_run` is manual (on-class Run 1 produced no `analysis.json`/`report.md`); when it *did*
run (pathway) it returned `issues: []` despite obvious evidence (lost linkage, stale child, an unanswered
escalation).

**The fix:**

- **Auto-fire:** every terminal/`blocked`/`supervision-lost` transition **automatically** produces
  `analysis.json` + `report.md` (an event-driven step, not an operator call). **Analysis never blocks
  terminalization:** if the analyzer itself fails, the run **still terminalizes** and emits an
  **`analysis-failed`** event (error + evidence refs) plus a stub report. The invariant is *"every terminal run
  has an analysis **or** an `analysis-failed` record"* — never a hang, never a silent gap.
- **Correlate:** the analyzer consumes the event log + projections + inspector evidence and **emits issues by
  correlating facts**, e.g.:
  - linkage event present but a projection lacks it → flag *(would have caught **E**)*;
  - last real progress stale **and** last action was an unanswered approval request → flag "stuck on
    approval" *(would have caught the pathway stall)*;
  - a capability gate denied with evidence → explain *why* an action didn't happen;
  - `claim-evidence-mismatch`, fail-closed parks, stale-write attempts.
- The analyzer is a **pure function over the event log** → deterministic, testable; every issue carries
  evidence refs. It surfaces **diagnostic session candidates** from linkage/transcripts even when a projection
  is incomplete (fixes pathway #17's empty `diagnosticSessionCandidates`).

## 4. Operator surfaces

`workflow_run_status` / `inspect` / `report` return projections + analysis. "Why did/didn't X happen?" is
always answerable from the **capability-gate records** (D0) + the analysis — the inspectability the spine
promised.

## 5. Open questions

- Which Codex token fields are reliably **live** vs transcript-post-processed (redesign open question; drives
  which metrics are `unavailableReason` by default).
- The analysis `issue` taxonomy/schema.

## 6. Testability

- **Regression-test the analyzer against the real incidents:** replay the captured on-class and pathway run
  artifacts as event-log fixtures and **assert the analyzer flags the actual failures** (linkage clobber,
  approval stall, stale child, lost linkage). This turns the two postmortems into a permanent test oracle.
- **Structured evidence:** `child-run-result` schema validation; assert no prose parsing path remains.
- **Auto-fire:** terminal transition → assert an analysis artifact exists.

## Themes addressed

| Theme | Resolution |
|---|---|
| I | Structured `child-run-result` + nested-agent telemetry + honest nullable metrics; free-text `evidenceParser` retired |
| J | Analysis auto-fires on terminal/block and correlates the event log; regression-tested against the two real incidents |

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../../README.md) · **← Prev:** [D4 — Run state, recovery & reconciliation](./04-run-state-and-recovery.md) · **Next →:** [Codex runtime findings — controllability & approval protocol](./notes/codex-runtime-findings.md)

<!-- /DOCS-NAV -->
