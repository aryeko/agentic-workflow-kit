# Tracker contract

A tracker is a markdown file at `<tracksDir>/<name>/README.md`. It is the single
source of truth for what work exists, what is claimed, what is done, and what is
unblocked. Automation never infers state from code — it reads the tracker.

## Frontmatter

```yaml
title: <Track display name> tracker
status: approved        # draft | approved | archived
owner: <name or "—">
last-reviewed: <YYYY-MM-DD>
related:
  - <path to PRD / architecture / sibling trackers>
```

## Status matrix

A markdown table with these columns, in order:

| ID | Name | Depends on | Wave | Status | Spec | Plan | Owner | PR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

- **ID** — matches `tracker.idPattern` (default `^[A-Z]{2,}[0-9]+$`), e.g. `PC06`.
- **Depends on** — comma/semicolon-separated IDs, or `—`.
- **Wave** — grouping for parallelism.
- **Status** — a term from the vocabulary below.
- **Spec** — links or `—`. For new trackers, Spec links to the story file under
  `<tracksDir>/<track>/stories/<ID>.md`; at brief-level the story is not implementation-ready.
  Existing trackers that link a detailed spec directly remain valid for backward compatibility.
- **Plan / PR** — links or `—`.
- **Owner** — the claiming session, or `—`/empty when unowned.

## Terminal promote story

Every tracker produced by `plan-delivery-track` must include a terminal promote story in its final
wave. The promote story:

- has `Depends on` set to the full set of implementation story IDs in the tracker,
- is placed in the final wave (after all implementation stories),
- links its own story file as Spec,
- runs `promote-to-canonical` when executed.

The track is not complete until the promote story reaches a `statuses.complete` status
(`done` or `verified`). This is an exit-bar rule: the tracker (and its PRD) cannot be marked
complete while the promote story is unfinished.

## Dependency graph

A Mermaid `flowchart TD` with solid arrows for hard dependencies, plus a short
"reading the graph" note.

## Parallelism rules

Prose, per wave, each stating *why* the constraint exists: file-level contention,
need-a-pilot-first, or shared-doc contention.

## ID-prefix registry

Each track reserves a two-or-more-letter prefix, listed in `<tracksDir>/README.md`.
Reserved prefixes are never reused.

## Status vocabulary

`specced` → `plan-approved` → `implementing` → `done` → `verified`, plus the terminal
states `blocked`, `canceled`, `deferred`, and `superseded`.

These map to the three automation buckets in `config.yaml`:
- `statuses.eligible` (default `specced`, `plan-approved`) — pickable.
- `statuses.inProgress` (default `implementing`) — claimed.
- `statuses.complete` (default `done`, `verified`) — finished / satisfies a dependency.

## Eligibility rule

A story is **eligible** to be picked if and only if:

1. its **Status** is in `statuses.eligible`, **and**
2. its **Owner** is empty or `—`, **and**
3. every story in its **Depends on** list has a Status in `statuses.complete`.

If any condition fails the story is blocked, with the failing condition as the reason.

## Validation diagnostics

Runtime execution must validate a tracker before dispatch. The validation report is structured and
actionable:

```json
{
  "ok": false,
  "trackerPath": "docs/tracks/example/README.md",
  "diagnostics": [
    {
      "code": "STATUS_INVALID",
      "severity": "error",
      "message": "WK2 uses invalid status todo.",
      "line": 42,
      "storyId": "WK2",
      "sourceValue": "todo"
    }
  ],
  "summary": {
    "storyCount": 4,
    "errorCount": 1,
    "warningCount": 0
  }
}
```

Initial diagnostic codes:

| Code | Severity | Meaning |
| --- | --- | --- |
| `MISSING_CONTRACT_COLUMNS` | error | The status matrix is absent or does not use the required columns in order. |
| `STORY_ID_INVALID` | error | A story ID does not match `tracker.idPattern`. |
| `STORY_ID_DUPLICATE` | error | A story ID appears more than once in the matrix. |
| `STATUS_INVALID` | error | A row uses a status outside the configured/contract vocabulary. |
| `DEPENDENCY_TOKEN_INVALID` | error | A dependency cell contains a token that does not match `tracker.idPattern`. |
| `DEPENDENCY_UNKNOWN` | error | A dependency refers to an ID that is not present in the same matrix. |
| `ID_PREFIX_MISMATCH` | error | A row uses a different reserved prefix than the rest of the track. |
| `OWNER_CONFLICT` | warning | A row is owned while not in the configured in-progress status. |
| `STORY_BRIEF_MISSING` | warning | The Spec cell is empty or does not point to an expected story brief. |

Errors block runtime execution. Warnings should be shown to the user but do not make an otherwise
valid tracker non-executable.

## Migration report

Migration/import converts existing markdown backlog tables into draft kit trackers. It must not
mutate the source backlog in place. The output is a draft tracker markdown document plus a report:

```json
{
  "ok": true,
  "trackId": "example",
  "diagnostics": [
    {
      "code": "STATUS_MAPPED",
      "severity": "warning",
      "message": "Mapped source status todo to specced.",
      "line": 7,
      "storyId": "WK2",
      "sourceValue": "todo"
    }
  ],
  "summary": {
    "sourceRows": 2,
    "importedRows": 2,
    "generatedStoryBriefCount": 2,
    "errorCount": 0,
    "warningCount": 1
  }
}
```

Migration drafts use the same status matrix columns as normal trackers. Unknown or custom statuses
are mapped to the closest kit status when safe, otherwise to `specced` with a warning. Source IDs
may be normalized to `tracker.idPattern`; dependencies are normalized through the same ID mapping.
Users must review the draft tracker, generated story-brief links, and diagnostics before runtime
execution.

## Runtime claim safety

For `git.strategy: branch`, runtime row claims update the markdown tracker in place. The
orchestrator serializes each tracker file's read-modify-write claim operation with a local lock and
then re-reads the row to verify the expected owner and in-progress status. This prevents concurrent
claims in the same tracker from overwriting each other while preserving the tracker as the
completion authority.
