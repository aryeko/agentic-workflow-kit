---
title: What happened, and the lessons
status: paused
owner: arye
last-reviewed: 2026-06-18
---

# What happened, and the lessons

← [Back to handoff index](README.md)

## The review saga

The branch was implemented phase-by-phase (Sonnet sub-agents implementing, Opus orchestrating + verifying), gate-green at every step. It was opened as PR #104 and reviewed by Codex across **roughly five rounds**. Each round surfaced new findings; several were **P1**. The author addressed each round (fix → reply → resolve → re-trigger), but new P1s kept appearing — which is the signal that prompted the pause.

The findings clustered into two areas:

- **The promote loop** (most of the P1s): planner reading the wrong paths; a claimed story's status reverting so completion never fired; the terminal promote story having no coherent execution path; and — the deepest one — the `kind: promote` hand-off existing only in a *skill prompt* while the deterministic **runtime** still dispatched the promote row.
- **Config back-compat** (the recurring P2s): the JSON schema rejecting supported versions, supported-stale configs advertising an upgrade that wrote nothing, a custom legacy `paths.prdsDir` not carried into the resolved config.

## Root-cause lessons (the important part)

1. **The kit's skills are prompt markdown that no test executes — so `pnpm check` green ≠ correct.** A logical contradiction *between* skills (skill A writes path X, skill B reads path Y; or a status lifecycle that two phases disagree on) passes every test. These are only caught by **tracing the end-to-end flow across skills + contracts + runtime by hand.** Gate + per-file spot-reads are not enough; that's how P1s slipped past internal review twice.

2. **A prompt-level guard is not enough — the deterministic TypeScript runtime must enforce the same rule.** The promote story's "don't auto-run me" lived in the `implement-next` prompt, but `run-eligible`/the scheduler compute eligibility from the matrix in code and never read the prompt or the story frontmatter. The rule has to exist where the deterministic decision is made.

3. **The promote mechanism was modeled at the wrong altitude.** "Promote" is a **track-level action**, but it was modeled as a **tracker story**. That forced ~five exceptions to make a non-implementable thing live in a "story" slot (a `kind` marker, runtime eligibility exclusion, a separate claim step, a completion gate that reads status-not-eligible, an implement-next hand-off). Every round we patched one assumption and hit the next. That entanglement — not any single bug — is why we paused.

## Why we paused (rather than pushing through)

The rate of new P1s was not clearly falling, and they all traced to one over-modeled mechanism in a change that had grown to ~108 files. The risk was concentrated, not spread: most of the change was sound, but the promote loop kept generating defects. Pushing a large, defect-prone change to merge was the wrong trade. Stepping back to re-model the one bad part — and to land the sound parts as small PRs — is cheaper and safer than continuing to whack-a-mole.
