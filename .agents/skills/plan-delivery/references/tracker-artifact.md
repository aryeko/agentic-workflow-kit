# Tracker Artifact

`execution/tracker.md` records story execution state for a later run. Keep it limited to story
status, dependency readiness, review and gate evidence, blockers, notes, and final commit
provenance. Adjacent responsibilities live in `source-readiness.md`, `package-layout.md`,
`implementer-prompt.md`, `reviewer-prompt.md`, and `model-routing.md`.

## Required Columns

Include at least this schema:

| story id | wave | dependencies | status | implementer model/effort | reviewer model/effort | prompt paths | reviewer verdict | gate evidence | commit hash | blockers | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|

Use the columns this way:

- `story id`: record the exact story identifier.
- `wave`: record the planned dependency wave.
- `dependencies`: record direct dependency story ids, or leave empty when there are none.
- `status`: record one valid tracker status.
- `implementer model/effort`: record the assigned implementer routing.
- `reviewer model/effort`: record the assigned reviewer routing.
- `prompt paths`: record the story's implementer and reviewer prompt paths.
- `reviewer verdict`: record the independent review verdict when it exists.
- `gate evidence`: record the verification evidence when it exists.
- `commit hash`: record only the real later-run commit hash when it exists.
- `blockers`: record current blockers, if any.
- `notes`: record concise tracker notes that do not override evidence.

## Statuses

Use only these statuses:

- `pending`
- `implementing`
- `reviewing`
- `changes_requested`
- `approved_pending_gate`
- `done`
- `blocked`

## Initial State

Initialize every story row as `pending`.

Keep `commit hash` empty until the later execution run records the real hash. Do not use placeholders
that look like hashes.

## Done Semantics

A row is `done` only after all of these are true:

- Implementation is independently approved.
- `reviewer verdict` is `APPROVED`.
- `gate evidence` is recorded.
- The later execution records the approved pathset as a commit.
- `commit hash` records the real commit hash.

Do not treat implemented, reviewed, approved, or approved-but-uncommitted work as `done`.

## Dependency Readiness

Dependency readiness means the dependency row is `done`.

Do not treat `implemented`, `reviewed`, or approved-but-uncommitted dependency work as ready.

## Evidence Precedence

When evidence conflicts, prefer git state, check output, and live review truth over worker prose or
stale tracker notes.

## Resume And Control Meaning

Treat tracker rows as recorded state for a future execution run, not as instructions to execute.
Statuses describe where each story stands; dependencies describe readiness gates; `blockers` and
`notes` preserve context without overriding git, check, or live review evidence.

## Commit Hash Rules

Leave `commit hash` blank until the real commit exists and is recorded by the later execution run.
Never use fake hashes, sample hashes, abbreviated-looking placeholders, or text that can be confused
with a real commit id.
