---
title: "Epic charter template"
status: draft
last-reviewed: "2026-06-22"
---

# Epic charter template

Copy the block below for each epic. Keep it to the epic frame; per-story detail belongs in story contracts. The charter owns the WHAT, not HOW.

```markdown
---
title: "Epic <n> - <epic name>"
epic: <n>
status: "epic: draft"
depends-on-epics: [<...>]
---

# Epic <n> - <epic name>

## Purpose

<What this epic makes possible.>

## Included domains

| Domain | Role in this epic | Primary spec surface |
|---|---|---|

## Why this epic exists

<Why these domains become eligible together and what later epic they unblock.>

## Frozen inputs

- <Prior epic outputs and design sources consumed by this epic.>

## Outputs

- <Contract surfaces, packages, modules, tests, or evidence this epic must leave behind.>

## Scope boundaries

- In:
- Out:
- STOP when:

## Per-domain expectations

For each included domain, list **only the `Story Group Signals` this epic owns** and their disposition.
Every owned signal maps to exactly one story (filled `TBD` until the story DAG is frozen), or carries a
`deferred(<why>, <until>)` row when no epic owns it in v1. Signals owned by another epic are **absent
here** (partition) and tracked in `coverage.md` — do not add `deferred` rows for them.

### `<domain-id>` - <name>

| Story Group Signal (from charter) | Owning story | Disposition |
|---|---|---|
| <signal text> | <story id / TBD> | covered / deferred(<why>, <until>) |

- Evidence expectation:

## Epic readiness

- <Conditions that make the next epic safe to author or dispatch.>

## Deferred work

- <Work intentionally left to later epics, named by owning domain or epic.>
```
