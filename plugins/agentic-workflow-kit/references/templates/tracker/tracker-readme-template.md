# Tracker README template

Copy this skeleton verbatim into `<tracksDir>/<track>/README.md` and fill the bracketed
sections. Every section listed here is mandatory unless marked `(optional)`. Resolve
`<tracksDir>`, `<specsDir>`, `<plansDir>`, and the status vocabulary from `.workflow/config.yaml`
(`paths.*`, `statuses.*`, `tracker.idPattern`). The output must conform to
`references/tracker-contract.md` — in particular the status-matrix columns and the status
vocabulary are fixed by that contract; do not add columns or invent statuses.

The tracker is the **index** for the work, not the work itself. New trackers link lightweight story
briefs under `./stories/<ID>.md`; `implement-next` creates the detailed technical story spec and
implementation plan later. Keep this file under ~250 lines.

---

```markdown
---
title: <Track display name> tracker
status: approved
owner: <name or "—">
last-reviewed: <YYYY-MM-DD>
related:
  - <path to the PRD this track decomposes, e.g. ../../prds/<slug>/README.md>
  - <path to repo contract docs if any: AGENTS.md / CLAUDE.md / docs/architecture/*>
  - <path to the technical solution this track decomposes, if present>
  - <paths to sibling trackers, if any>
---

# <Track display name> tracker

*One-paragraph italicized summary. What the track delivers, who it affects, what shape the
artifacts take, and the boundary: "The PRD owns what/why; the technical solution owns high-level
how; this doc owns sequencing and parallelism. Each story (<PREFIX>n) has a lightweight brief; the
detailed story spec and implementation plan are created by implement-next."*

## Context

Three short paragraphs maximum:

1. **Why this track exists.** The PRD it decomposes and the state it moves the repo toward.
2. **Audit findings.** What the reality audit found in this repo (contract docs, source roots,
   existing trackers). If little exists, say so honestly — do not fabricate.
3. **What this tracker covers.** Restate the boundary: status, ordering, parallelism. Per-story
   delivery context lives in each story brief; implementation detail comes later.

## Dependency graph

\`\`\`mermaid
flowchart TD
  <PREFIX>01[<PREFIX>01 Title<br/>short subtitle]
  <PREFIX>02[<PREFIX>02 Title]
  <PREFIX>03[<PREFIX>03 Title]

  <PREFIX>01 --> <PREFIX>02
  <PREFIX>02 --> <PREFIX>03
\`\`\`

**Reading the graph:** every solid arrow is a hard dependency — the source story must be in a
`statuses.complete` state before the target starts. Nodes with no inbound edge can start
immediately. (If you distinguish soft dependencies, use dotted arrows and say so here.)

## Status matrix

Statuses come from `references/tracker-contract.md`:
`specced` → `plan-approved` → `implementing` → `done` → `verified`, plus terminal
`blocked` / `canceled` / `deferred` / `superseded`. IDs match `tracker.idPattern`.

| ID | Name | Depends on | Wave | Status | Spec | Plan | Owner | PR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <PREFIX>01 | <Short name> | — | W1 | specced | [brief](./stories/<PREFIX>01.md) | — | — | — |
| <PREFIX>02 | <Short name> | <PREFIX>01 | W2 | specced | [brief](./stories/<PREFIX>02.md) | — | — | — |
| <PREFIX>03 | <Short name> | <PREFIX>02 | W3 | specced | [brief](./stories/<PREFIX>03.md) | — | — | — |

Keep the **Status** column current. Leave **Plan** as `—` — the implementing session drafts the
plan after creating the detailed technical story spec. For new trackers, **Spec** links to the
story brief. Existing trackers that link a detailed spec directly remain valid. Each story maps
to one or more PRD acceptance-criteria IDs (cite them in the story brief, not as a new column).

## Parallelism rules

State each wave's rule and **the reason** behind it — the reason tells future sessions when the
constraint can be relaxed.

**Wave 1 — <name> (N-way parallel | sequential):** <IDs> touch disjoint surfaces.
- <PREFIX>01 edits <paths>.

N concurrent sessions safe.

**Wave 2 — Pilot (sequential):** <pilot-id> runs alone. It proves <foundation> end-to-end on a
real target. Do not start the rollout until <pilot-id> is `done` and the playbook is updated.

**Wave 3 — Rollout (sequential only):** the reason for serial execution is **file-level
contention**, not logical coupling — all rollout stories edit <shared paths>.

## Coordination with other tracks (optional)

Include only if other concurrent tracks may overlap. Use a green/red/yellow file-overlap matrix
and state explicit gates ("Do not start <X> until <Y> is `done`") plus the fallback if a gate
must be violated.

## ID-prefix registry

This track reserves the prefix **`<PREFIX>`**. It is recorded in `<tracksDir>/README.md` and is
never reused by another track.

## How to pick up a story

1. Find a row whose **Depends on** are all in a `statuses.complete` state and whose **Status**
   is in `statuses.eligible`.
2. Claim it (set **Owner**; isolate per `git.strategy`) and flip **Status** to
   `statuses.inProgress`.
3. Read the linked story brief.
4. Create/refine the detailed technical story spec under `<specsDir>` (default `docs/specs`).
5. If no plan exists, draft one under `<plansDir>` (default `docs/plans`).
6. Execute. Before opening the PR, flip **Status** to `done` in this table in the same change.
7. Fill the **PR** column once the PR exists.

## Ground rules

- **One story per PR.** Do not bundle.
- **One ID prefix per track.** `<PREFIX>` is reserved here.
- **The repo's contract docs win.** If a spec contradicts AGENTS.md/CLAUDE.md/architecture docs,
  fix the spec.
- **The tracker is the single source of truth for status** — never infer completion from prose
  elsewhere.
- **When the story brief is wrong, update it in the same PR** as the detailed spec or code that
  surfaced the gap.
- **<Track-specific rule(s)>** — 1–3 unique to this track.

## Related

- `<path to the PRD this track decomposes>`
- `<path to repo contract docs>`
- `./stories/` — story briefs
```
