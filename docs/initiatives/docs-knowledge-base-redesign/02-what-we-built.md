---
title: What we built (the paused attempt)
status: paused
owner: arye
last-reviewed: 2026-06-18
---

# What we built (the paused attempt)

← [Back to handoff index](README.md)

All of this lives on branch `docs/docs-knowledge-base-redesign` (PR [#104](https://github.com/aryeko/agentic-workflow-kit/pull/104), now closed). ~30 commits; `pnpm check` was green throughout. Commit hashes below are pointers for a future dev reading the branch.

## The design we attempted

A five-part knowledge base, all configurable:

1. **Two pillars** — `product/` (current-state narrative) and `architecture/` (rulebook, system overview, topic docs, `domains/` references, `decisions/` ADRs), each split into a canonical zone (durable) and a per-initiative zone (retired after ship).
2. **Authoring standard** `docs-style.md` — required frontmatter, closed per-family status vocab, one-fact-one-place, diagram type-picker + preamble→diagram→takeaway, `extends: built-in/recommended`.
3. **New canonical doc types** — ADRs (immutable numbered MADR) and per-domain references (Purpose / Public API / Invariants / Gotchas), with templates + contracts.
4. **A configurable `docs` config block** in the Zod schema, plus `workflow-init` scaffolding (lean default / full preset, detect-don't-impose).
5. **A promote-to-canonical loop** — this is the part that went wrong (see [page 3](03-what-happened-and-lessons.md)).

The original design spec and implementation plan were authored at `docs/superpowers/specs/2026-06-17-docs-knowledge-base-redesign-design.md` and `docs/superpowers/plans/2026-06-18-docs-knowledge-base-redesign.md`, then deleted from the branch per the kit's "canonical docs only on main" policy. They remain viewable in PR #104's history (commits `5fe6332` and `34f3366`).

## What was implemented, by area

| Area | What landed | Key commits |
|---|---|---|
| Config foundation | `docs` block in `ConfigSchema`; schema bumped `0.6.0`→`0.7.0`; `.strict()` on `docs.*`; lean default | `6cb0364`, `bdd0af0` |
| Authoring standard + doc types | `docs-style.md`, ADR + domain-reference templates/contracts, master/pillar index templates | `60ed3ed`, `a2b374f`, `51ddc46`, `c7b418a` |
| Producing skills | `workflow-init` scaffolding; `define-product` reads canonical + registers PRD; `design-technical-solution` → `architecture/designs/<slug>.md` + Canonical impact | `af4f85e`, `1781940`, `db06b98` |
| Story model | grow-in-place story spec (replaced brief + separate detailed spec) | `3a7e6b0`, `d193390`, `7c991f3` |
| Promote loop | terminal promote *story*; `promote-to-canonical` skill; runtime `kind: promote` exclusion | `8ac3028`, `763c8df`, `99a3d3a` |

## Reusability verdict

The **config foundation, authoring standard, doc types, and `workflow-init` scaffolding are sound and reusable** — they were quiet in review. The **story model and the promote loop are the parts being redesigned** (see [page 5](05-redesign-direction-and-plan.md)); don't lift them as-is.
