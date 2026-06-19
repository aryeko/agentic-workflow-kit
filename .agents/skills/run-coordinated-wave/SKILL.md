---
name: run-coordinated-wave
description: Run or start orchestrating a READY docs/coordinated-waves plan from the active Codex thread with bounded task-implementer and task-reviewer agents. Use when a user asks to execute, continue, resume, orchestrate, or verify a coordinated wave plan from repo docs.
---

# Run Coordinated Wave

## Purpose

Execute one `READY TO RUN` wave plan. The coordinator may be the main session or
the optional `wave-coordinator` agent. Keep durable state in the wave README and
optional run notes, not in conversation memory.

## Startup

Before spawning any agent:

1. Read the wave README.
2. Read run notes if the README points to them.
3. Re-run the readiness rubric from the README.
4. Rebuild the dependency plan from unit sections.
5. Print the execution plan and the units ready to start.

Stop if the plan is not `READY TO RUN`, dependency state is ambiguous, git state
is unsafe for scoped commits, or the user request conflicts with the wave rules.

## Execution Loop

Run only units whose hard dependencies are approved or complete. Keep active
implementers at or below the wave cap, defaulting to four.

For each ready unit:

1. Spawn `task-implementer` with only that unit's objective, allowed reads,
   forbidden reads, write scope, required outputs, acceptance criteria, review
   criteria, verification, and stop conditions.
2. On handoff, sanity-check changed paths, required outputs, verification
   result, and obvious scope violations.
3. Spawn `task-reviewer` only after the sanity check passes.
4. If the reviewer returns `CHANGES-NEEDED`, send those findings to the same
   implementer.
5. Send the fix back to the same reviewer for incremental review.
6. Stop the unit after five review rounds.
7. On `APPROVE`, run the unit verification command from the coordinator.
8. Stage only the unit write scope and commit only that approved unit.
9. Update the wave README status table and run notes if present.
10. Close completed agents promptly.

## Review Rules

- The reviewer must return exactly `APPROVE` or `CHANGES-NEEDED`.
- Treat malformed review output as a blocker after one clarification.
- Do not approve when a negative approval rule is triggered.
- Do not use a different implementer for fixes unless the original implementer is unavailable and the wave README records the handoff.
- Do not use a different reviewer for incremental review unless the original reviewer is unavailable and the wave README records the handoff.

## Failure Rules

Stop instead of guessing when:

- a worker edits outside scope
- verification fails outside unit scope
- a required output is missing
- a forbidden input appears to have influenced the result
- dependency state changes while the unit is active
- git staging cannot be limited to the approved write scope
- compaction or resume loses track of the next action

## Compaction And Resume

After compaction or thread resume, read the wave README and run notes before
acting. Reconstruct active units, review rounds, blockers, and next action from
disk. If disk state is insufficient, stop and ask for operator direction.

## Handoff

End each coordinator update with:

- wave path
- unit states
- commits created
- blockers
- exact next action
