# Tracker Artifact

`execution/tracker.md` records initial story execution state for a later run. It is durable state,
not a command to execute.

## Required Columns

Use at least this schema:

| story id | source AC ids | wave | dependencies | status | implementer routing | reviewer routing | prompt paths | reviewer verdict | gate evidence | commit hash | blockers | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

Column meaning:

- `story id`: exact source story id.
- `source AC ids`: ordered `AC-n` ids projected by this row.
- `wave`: topological wave from the DAG.
- `dependencies`: direct dependency story ids, empty when none.
- `status`: one valid tracker status.
- `implementer routing`: provider profile, model class, effort, reasoning tier, rationale.
- `reviewer routing`: provider profile, model class, effort, reasoning tier, rationale.
- `prompt paths`: implementer and reviewer prompt paths for this story.
- `reviewer verdict`: empty until the later execution run records a verdict.
- `gate evidence`: empty until the later execution run records verification evidence.
- `commit hash`: empty until the later execution run records the real commit.
- `blockers`: current blockers, if any.
- `notes`: concise notes that do not override evidence.

Do not record provider-specific runtime model IDs in routing cells.

## Statuses

Use only:

- `pending`
- `implementing`
- `reviewing`
- `changes_requested`
- `approved_pending_gate`
- `done`
- `blocked`

## Initial State

Initialize every selected ready story as `pending`. Leave `reviewer verdict`, `gate evidence`, and
`commit hash` empty before execution.

## Done Semantics

A row is `done` only after all of these are true:

- implementation is independently approved;
- `reviewer verdict` is `APPROVED`;
- `gate evidence` is recorded;
- the execution run commits the approved pathset;
- `commit hash` records the real commit hash.

Do not treat implemented, reviewed, approved, or approved-but-uncommitted work as `done`.

## Dependency Readiness

Dependency readiness means the dependency row is `done`. No weaker state unlocks a dependent story.

## Evidence Precedence

When evidence conflicts, prefer git state, check output, and live review truth over worker prose or
stale tracker notes.
