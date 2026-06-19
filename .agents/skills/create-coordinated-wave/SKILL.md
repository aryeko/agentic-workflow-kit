---
name: create-coordinated-wave
description: Create a docs/coordinated-waves plan for parallel bounded agent work and verify whether it is READY TO RUN. Use when a user wants to turn a goal, design, tracker, PRD, or source artifact set into coordinated implementer/reviewer units without executing the work.
---

# Create Coordinated Wave

## Purpose

Create one durable wave plan under `docs/coordinated-waves/<wave-id>/`. Do not
run the plan, spawn agents, edit product/runtime code, or create commits.

## Inputs

Start from the user's goal and the source artifacts they name. If the user does
not provide enough input paths, inspect the repo for likely PRDs, designs,
trackers, or docs before asking. Ask only when missing information would change
unit boundaries, dependencies, write scope, or safety.

## Plan Shape

Write or update `docs/coordinated-waves/<wave-id>/README.md` with:

- goal
- global rules
- authoritative source inputs
- unit sections
- dependency plan
- coordinator checklist
- readiness verdict

Each unit must define:

- unit id and title
- kind, risk, implementer effort, reviewer effort
- objective
- allowed reads, with reasons
- forbidden reads, when relevant
- write scope, with reasons
- required outputs
- typed dependencies: hard, soft, vocabulary-only, or final-approval-only
- acceptance criteria
- review criteria
- negative approval rules
- verification command, or explicit reason none is possible
- stop conditions

Use `units/<unit-id>.md` only when a unit section would make the README hard to
scan.

## Readiness Rubric

Mark the plan `READY TO RUN` only when:

- every unit has all required fields
- unit ids are unique
- hard dependency targets exist
- hard dependencies have no cycles
- units intended to run together have disjoint write scopes
- no unit depends on draft output unless its dependency type allows that
- reviewer inputs are no broader than needed
- medium, high, and critical risk units include at least one negative approval rule
- implementer and reviewer reasoning effort are explicit

If any check fails, mark `NOT READY`, list the missing or unsafe items, and stop.
Do not soften required fields to get a ready verdict.

## Effort Policy

- Use `low` for mechanical cleanup, formatting-only work, or simple evidence refresh.
- Use `medium` for ordinary bounded implementation or focused docs/tests.
- Use `high` for cross-file behavior, public APIs, data integrity, auth,
  permissions, concurrency, or reviewers by default.
- Use `xhigh` for architecture, security boundaries, recovery semantics,
  irreversible migrations, or high-blast-radius contracts.

Reviewer effort should usually be at least `high` for medium or higher risk.

## Handoff

End with:

- wave path
- readiness verdict
- units and dependency stages
- blockers, if any
- exact next action for `run-coordinated-wave`
