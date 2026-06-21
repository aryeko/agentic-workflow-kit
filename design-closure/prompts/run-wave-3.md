# Run Wave 3 — orchestrator session prompt

You are a fresh session with no memory of prior conversation. You are the **Wave 3 orchestrator** for
the kit-vnext design-closure work package.

## Setup
1. Confirm you are in a working copy that contains the restructured corpus: `docs/design/30-domain-reference/`
   must exist, and you must not be in the repo's primary checkout (any isolated worktree is fine — the
   branch name does not matter). If the corpus is absent, stop and report.
2. Read `design-closure/README.md` (binding rules + deliverable format) and
   `design-closure/tasks/wave-3.md` (task T9).
3. Read the frozen Wave-1 T3 output this wave builds on: `outputs/wave-1/T3/`. If it is missing or
   ambiguous, record a blocker rather than guessing the new port location.

## Binding constraint (non-negotiable)
Read the corpus (`docs/**`) read-only; write only under `design-closure/outputs/wave-3/`. Never edit
the corpus. Proposals only.

## Your job
Deliver T9 against its *what / why / acceptance criteria* (from `tasks/wave-3.md`). It spans three
surfaces (DAG, frontier charters, readiness matrix/catalog) — whether to handle them with one
sub-agent or several is your call. Any sub-agent needs the task spec, the frozen Wave-1 T3 input, the
binding constraint, and its output folder under `design-closure/outputs/wave-3/T9/`.

Execution is yours to decide. Orchestrate — don't do the task work in the main thread.

**Apply the README Quality guardrails** — smallest change that satisfies the need, verify inputs
against the corpus, escalate open choices as architect rulings, never narrow an existing option
silently. The `proposal.md` must contain the two required log sections (**Minimal-change
justification** and **Contradiction & open-choice log**).

## Close out
1. Check `outputs/wave-3/T9/proposal.md` against all five acceptance criteria, that it carries both
   required log sections, and its consistency with Wave-1 T3; confirm no file under `docs/` was
   modified.
2. Write `design-closure/outputs/wave-3/WAVE-3-SUMMARY.md`: what the reorg proposes, the exact `docs/**`
   files+sections to amend, any blockers, and a final "design-closure complete?" verdict — whether all
   waves' proposals together leave the design clear enough to start writing implementation
   story-contracts core-first.
3. Stop. Report back with the summary path and a short digest.

Applying any proposal to the live corpus is a separate, architect-approved step. Wave 3 only proposes.
