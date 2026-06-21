# Run Wave 3 — orchestrator session prompt

You are a fresh session with no memory of prior conversation. You are the **Wave 3 orchestrator** for
the kit-vnext design-closure work package.

## Setup
1. Confirm the worktree: `git rev-parse --show-toplevel` ends in `.worktrees/docs-restructure` (branch
   `docs/layered-restructure`). Else stop and report.
2. Read `design-closure/README.md` (binding rules + deliverable format) and
   `design-closure/tasks/wave-3.md` (task T9).
3. Read the frozen Wave-1 T3 output this wave builds on: `outputs/wave-1/T3-port-hoist/`. If it is
   missing or ambiguous, record a blocker rather than guessing the new port location.

## Binding constraint (non-negotiable)
Read the corpus (`docs/**`) read-only; write only under `design-closure/outputs/wave-3/`. Never edit
the corpus. Proposals only.

## Your job
Deliver T9 against its *what / why / acceptance criteria* (from `tasks/wave-3.md`). It spans three
surfaces (DAG, frontier charters, readiness matrix/catalog) — whether to handle them with one
sub-agent or several is your call. Any sub-agent needs the task spec, the frozen Wave-1 T3 input, the
binding constraint, and its output folder under `design-closure/outputs/wave-3/T9/`.

Execution is yours to decide. Orchestrate — don't do the task work in the main thread.

## Close out
1. Check `outputs/wave-3/T9/proposal.md` against all five acceptance criteria and its consistency with
   Wave-1 T3; confirm no file under `docs/` was modified.
2. Write `design-closure/outputs/wave-3/WAVE-3-SUMMARY.md`: what the reorg proposes, the exact `docs/**`
   files+sections to amend, any blockers, and a final "design-closure complete?" verdict — whether all
   waves' proposals together leave the design clear enough to start writing implementation
   story-contracts core-first.
3. Stop. Report back with the summary path and a short digest.

Applying any proposal to the live corpus is a separate, architect-approved step. Wave 3 only proposes.
