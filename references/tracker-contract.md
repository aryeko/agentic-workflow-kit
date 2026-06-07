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
- **Spec / Plan / PR** — links or `—`.
- **Spec** — For new trackers, Spec links to the story brief under
  `<tracksDir>/<track>/stories/<ID>.md`; the story brief is not implementation-ready. Existing trackers that link to `docs/superpowers/specs/` remain valid for backward compatibility.
- **Owner** — the claiming session, or `—`/empty when unowned.

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
