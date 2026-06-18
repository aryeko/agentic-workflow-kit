---
title: Docs knowledge-base initiative — handoff
status: paused
owner: arye
last-reviewed: 2026-06-18
---

# Docs knowledge-base initiative — handoff

_A paused initiative to make agentic-workflow-kit produce and maintain a canonical docs knowledge base (not just per-initiative leaf docs). The first full attempt was implemented, reviewed hard, and deliberately parked to redesign in smaller phases. This folder is the cold-start record: why, what, what happened, what we decided, and what's next._

## Status

**Paused / parked.** PR [#104](https://github.com/aryeko/agentic-workflow-kit/pull/104) was **closed without merging**; the branch `docs/docs-knowledge-base-redesign` is **kept** so the work is not thrown away. The implementation on that branch was gate-green throughout (last commit `e6157dd`) but accumulated review findings that pointed to a design problem (see [what happened](03-what-happened-and-lessons.md)). We chose to redesign before landing anything.

## Read this folder in order

| # | Page | What it covers |
|---|---|---|
| 1 | [Motivation, goals, requirements](01-motivation-goals-requirements.md) | Why this exists, what "good" looks like, the hard requirements |
| 2 | [What we built](02-what-we-built.md) | The attempted design + what was implemented on the branch (with commit pointers) |
| 3 | [What happened and the lessons](03-what-happened-and-lessons.md) | The review saga, the root-cause lessons, why we paused |
| 4 | [Decisions log](04-decisions-log.md) | Every locked decision — original and the redesign |
| 5 | [Redesign direction and plan](05-redesign-direction-and-plan.md) | The agreed new approach + the small-PR slicing + the next action |

## Current state in one screen

- **What's sound and reusable:** the docs *structure* (pillars + indexes), the authoring standard (`docs-style.md`), the new canonical doc types (ADRs, domain references), the `docs` config block, `workflow-init` scaffolding. These stayed quiet in review.
- **What caused the pain:** the canonical-**promote** mechanism (modeled as a gated terminal tracker *story*) and the config back-compat surface.
- **The decision:** promote becomes a configurable **track-level action**, not a story; the story-model change is reverted; config compat is minimized; land it as **three small PRs**. See [page 5](05-redesign-direction-and-plan.md).

## Next action when resuming

Do **not** reopen PR #104. Start fresh and small: design + plan **PR 1 (structure + standard)** only, reusing the foundation commits on the kept branch as reference. Details in [page 5](05-redesign-direction-and-plan.md).
