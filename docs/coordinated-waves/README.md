---
title: Coordinated waves
status: local development workflow
last-reviewed: 2026-06-19
---

# Coordinated Waves

Coordinated waves are repo-local Codex workflow artifacts for splitting a
large implementation goal into bounded units that can be implemented and
reviewed by subagents. They are local development infrastructure, not the
v1 runtime control plane, not a public plugin surface, and not a replacement
for the kit-vnext architecture.

Related documents:

- [workflow-report.md](workflow-report.md) explains what made the inspected
  coordinated sessions work and what remains unproven.
- [design-spec.md](design-spec.md) records the implemented local v1 design and
  the deliberate simplifications.
- [usage.md](usage.md) explains how to use the repo-local skills and custom
  agents from the Codex app or CLI.

Use this directory for human-readable wave plans:

```text
docs/coordinated-waves/<wave-id>/
  README.md
  units/<unit-id>.md     optional, only when a unit is too large for README.md
  runs/<run-id>.md       optional, only for long resume/debug notes
```

Do not add schemas, generated prompt folders, event logs, hooks, or a local
orchestrator package for v1 of this workflow.

## Wave README Contract

Each wave README must contain these sections:

```markdown
# <Wave Title>

## Goal
What this wave must accomplish.

## Global Rules
- No push.
- Commit approved units one at a time.
- Review cap: 5 rounds per unit.
- Active implementer cap: 4.
- Coordinator edits only workflow metadata/status unless explicitly approved.

## Source Inputs
Authoritative files the coordinator may use to run the wave.

## Units

### <unit-id>: <title>
Kind: code | design | docs | test | migration | evidence | cleanup | mixed
Risk: low | medium | high | critical
Implementer effort: low | medium | high | xhigh
Reviewer effort: low | medium | high | xhigh

Objective:
- ...

Allowed reads:
- path - reason

Forbidden reads:
- path - reason

Write scope:
- path - reason

Required outputs:
- path - description

Dependencies:
- <unit-id> - hard | soft | vocabulary-only | final-approval-only - reason

Acceptance criteria:
- ...

Review criteria:
- ...

Do not approve if:
- ...

Verification:
- command

Stop conditions:
- ...

## Dependency Plan
- Stage 1: ...
- Stage 2 after Stage 1 approved: ...

## Coordinator Checklist
- Validate plan readiness.
- Spawn implementers only for ready units.
- Sanity-check outputs before review.
- Use independent reviewers.
- Route fixes back to the same implementer.
- Reuse the same reviewer for incremental review.
- Commit approved units one at a time.

## Readiness Verdict
READY TO RUN | NOT READY
```

## Readiness Rubric

The plan is runnable only when every unit has:

- a specific objective
- exact allowed reads
- exact write scope
- required outputs
- typed dependencies
- acceptance criteria
- review criteria
- negative approval rules for medium, high, and critical risk units
- verification command, or an explicit reason none is possible
- stop conditions
- implementer and reviewer reasoning effort

Wave-level checks:

- no duplicate unit ids
- no hard dependency cycles
- no missing hard dependency target
- no overlapping write scopes among units intended to run in parallel
- no unit depends on draft output unless its dependency type allows that
- reviewer inputs are not broader than necessary

If any check fails, the plan is `NOT READY` and `run-coordinated-wave` must not
start it.

## Running Rules

The coordinator starts from the wave README, re-runs the readiness rubric, and
prints the execution plan before spawning agents.

For each ready unit:

1. Spawn `task-implementer`.
2. Sanity-check the handoff against write scope and required outputs.
3. Spawn `task-reviewer`.
4. Route `CHANGES-NEEDED` findings back to the same implementer.
5. Send fixes back to the same reviewer for incremental review.
6. Stop after five review rounds.
7. Run verification from the coordinator.
8. Stage and commit only the approved unit scope.
9. Update wave status and optional run notes.

Stop instead of guessing if plan readiness, dependency state, review output,
verification, or scoped git staging becomes ambiguous.
