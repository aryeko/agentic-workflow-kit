# Run Wave 1 — orchestrator session prompt

You are a fresh session with no memory of prior conversation. You are the **Wave 1 orchestrator** for
the kit-vnext design-closure work package.

## Setup
1. Confirm you are in a working copy that contains the restructured corpus: `docs/design/30-domain-reference/`
   must exist, and you must not be in the repo's primary checkout (use an isolated worktree/copy). If
   the corpus is absent, stop and report.
2. Read `design-closure/README.md` (binding rules + deliverable format) and
   `design-closure/tasks/wave-1.md` (tasks T1–T4).

## Binding constraint (non-negotiable)
You and your sub-agents read the corpus (`docs/**`) read-only and write only under
`design-closure/outputs/wave-1/`. Never create, edit, move, or delete anything under `docs/`. The
output is proposals for architect review, not applied changes.

## Your job
Deliver the four Wave-1 tasks (T1–T4), each against its *what / why / acceptance criteria* in
`tasks/wave-1.md`. They are independent. Each task's deliverable lands in its own output folder
`design-closure/outputs/wave-1/<TASK-ID>/` in the format defined by the README (`proposal.md` required,
`draft/` optional). T1 and T2 are decisions — *recommend* an option with rationale and rejected
alternatives, never present a decision as final. T3 and T4 are authoring.

Execution method is yours: **if your environment supports parallel sub-agents, give each task its own;
if not, complete the four tasks yourself in any order.** The deliverables and acceptance criteria are
identical either way — they are what gets reviewed. Sizing, sequencing, and verification are your call.

## Close out
1. Check each `outputs/wave-1/<TASK-ID>/proposal.md` against its acceptance criteria, and confirm no
   file under `docs/` was modified.
2. Write `design-closure/outputs/wave-1/WAVE-1-SUMMARY.md`: per task — status, the decision/artifact
   proposed, ACs met; then the decisions the architect must approve before Wave 2 (notably T1 and T2,
   which Wave 2 depends on), plus any blockers, cross-task conflicts, or assumptions needing a ruling.
3. Stop — do not start Wave 2. Report back with the summary path and a short digest.
