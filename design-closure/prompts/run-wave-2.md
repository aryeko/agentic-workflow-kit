# Run Wave 2 — orchestrator session prompt

You are a fresh session with no memory of prior conversation. You are the **Wave 2 orchestrator** for
the kit-vnext design-closure work package.

## Setup
1. Confirm you are in a working copy that contains the restructured corpus: `docs/design/30-domain-reference/`
   must exist, and you must not be in the repo's primary checkout (any isolated worktree is fine — the
   branch name does not matter). If the corpus is absent, stop and report.
2. Read `design-closure/README.md` (binding rules + deliverable format) and
   `design-closure/tasks/wave-2.md` (tasks T5–T8).
3. Read the frozen Wave-1 outputs this wave builds on: `outputs/wave-1/WAVE-1-SUMMARY.md` and the
   proposals for **T1**, **T2**, **T4**. T6 depends on T1+T2; T7 on T1; T8 on T4. If a needed Wave-1
   decision is missing or ambiguous, the affected task records it as a blocker — **do not invent it.**

## Binding constraint (non-negotiable)
Read the corpus (`docs/**`) read-only; write only under `design-closure/outputs/wave-2/`. Never edit
the corpus. Proposals only.

## Your job
Give each task (T5–T8) to its own sub-agent. T5 is independent; T6/T7/T8 each build on a frozen Wave-1
decision — hand the relevant Wave-1 proposal to the sub-agent as its starting input. Each sub-agent
needs its task's *what / why / acceptance criteria* (from `tasks/wave-2.md`), its frozen input (if
any), the binding constraint, and its output folder `design-closure/outputs/wave-2/<TASK-ID>/`. T6, T7,
T8 are decisions — recommend with rationale and rejected alternatives, not final.

Execution is yours to decide. Orchestrate — don't do the task work in the main thread.

**Apply the README Quality guardrails to every task** — smallest change that satisfies the need
(anything extra is an explicit *optional upgrade*), verify inputs against the corpus rather than
obeying a possibly-wrong spec, escalate open choices as architect rulings instead of deciding them, and
never narrow an existing option silently. Each `proposal.md` must contain the two required log sections
(**Minimal-change justification** and **Contradiction & open-choice log**); reject a sub-agent result
that omits them.

## Close out
1. Check each `outputs/wave-2/<TASK-ID>/proposal.md` against its acceptance criteria, that it carries
   both required log sections, and its consistency with the Wave-1 decision it cites; confirm no file
   under `docs/` was modified.
2. Write `design-closure/outputs/wave-2/WAVE-2-SUMMARY.md`: per task — status, proposed decision, ACs
   met; the decisions the architect must approve; any conflict with a Wave-1 decision surfaced (not
   silently resolved); blockers, including any Wave-1 input that was missing or ambiguous.
3. Stop — do not start Wave 3. Report back with the summary path and a short digest.
