# Tracker Artifact

`execution/tracker.md` records initial story execution state for a later run. It is durable state,
not a command to execute. Its schema is the **canonical tracker schema** defined in
`docs/implementation-authoring/delivery-pipeline/30-plan-delivery.md`; match that schema field for
field and do not introduce a divergent local schema.

## Required Fields

Each tracker row records one story with these fields (the canonical schema):

| field | values / content |
|---|---|
| `status` | lifecycle: `ready` → `in_progress` → `in_review` → (`blocked` \| `approved`) → `merged` |
| `round` | current review round, `1`–`5` (the cap) |
| per-round record | for each round: the implementer's commit hash + the reviewer's verdict (`APPROVE`, or `BLOCKING` with finding refs) |
| `blocked` reason | on cap-exhaustion or escalation: which AC or finding blocked, and the escalation target (architect) |
| `merge` | the track-branch merge-back commit hash |
| `gate` | pointer to the last green `pnpm check` evidence |
| `wave` / `dependencies` | the story's dependency wave and the producer stories it waits on |
| model class + effort | abstract implementer + reviewer routing (model class, effort, reasoning tier, rationale) |
| prompt paths | the implementer + reviewer prompt files projected for the story |
| `notes` | projection trace (source story id + `AC-n` ids) and any routing rationale |

Do not record provider-specific runtime model IDs in routing cells.

## Status Lifecycle

Use only these statuses, in this lifecycle:

- `ready` — selected and dispatchable; the initial state every selected story is written in.
- `in_progress` — the implementer is building the story in its worktree.
- `in_review` — the implementer/reviewer loop is running on a committed round.
- `approved` — the reviewer returned APPROVE on the latest committed round.
- `blocked` — the 5-round cap was hit, or a source-contract blocker stopped the story; escalated to
  the architect with a reason.
- `merged` — the orchestrator merged the story's per-round commits back to the track branch and wrote
  the tracker.

The status lifecycle is the contract between the roles: a story is `in_review` while the
implementer/reviewer loop runs, becomes `approved` when the reviewer returns APPROVE, `blocked` when
the 5-round cap is hit and the story is escalated, and `merged` once the orchestrator merges its
commits back to the track branch.

## Initial State

Initialize every selected ready story as `ready`. Leave `round`, the per-round record, `blocked`
reason, `merge`, and `gate` empty before execution — they are filled by the later execution run. Do
not pre-populate commit hashes; an invented per-round or merge-back hash before execution is a
defect.

## Merged Semantics

A row is `merged` only after all of these are true:

- the reviewer's latest-round verdict is `APPROVE`;
- the `gate` evidence pointer names a green `pnpm check` for that round;
- the implementer's per-round commits exist in the story worktree;
- the orchestrator merged those commits back to the track branch and recorded the `merge` commit
  hash.

Do not treat implemented, reviewed, approved, or approved-but-unmerged work as `merged`.

## Dependency Readiness

A dependency unlocks a dependent only when its row is `merged`: its commits are present on the track
branch and its tracker row records the merge-back. No weaker state unlocks a dependent story.

## Evidence Precedence

When evidence conflicts, prefer git state, check output, and live review truth over worker prose or
stale tracker notes.
