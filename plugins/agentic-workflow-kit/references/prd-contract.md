# PRD contract

A PRD (product requirements document) defines a product — the *what* and *why* — before
any technical decomposition. It can be authored from notes, brainstorming, existing docs, or session context; no prior kit artifact is required. It is authored by the `define-product` skill and consumed
by `design-technical-solution` for complex technical work and `plan-delivery-track`, which maps
tracker stories back to the PRD's acceptance criteria. This file is the canonical format; it is the
PRD analog of `tracker-contract.md`.

## Layout

A PRD is a directory `<prdsDir>/<slug>/` (`<prdsDir>` resolves from `docs.paths.prdsDir`,
default `docs/product/prds`; legacy fallback: `paths.prdsDir`, default `docs/prds`) containing a
README index and numbered section files:

```
<prdsDir>/<slug>/
  README.md                       index: frontmatter, version line, TL;DR, document map, boundary note, status & next steps
  01-context.md                   problem, opportunity, product thesis, non-goals
  02-principles.md                operating tenets (OPTIONAL)
  03-domain-model.md              conceptual entities & relationships (not schemas) (OPTIONAL)
  04-roles.md                     personas + capability matrix
  05-phases.md                    phasing rationale, per-phase goal/scope/exit-bar, dependency diagram
  06-quality-bars.md              ID-keyed cross-cutting quality requirements
  07-success-metrics.md           north-star, metric tables, anti-metrics
  08-acceptance-criteria.md       grouped, ID'd ship checklist (the downstream linkage)
  09-risks-and-open-questions.md  assumptions, risk register, blocking questions, and open questions
  10-glossary.md                  term definitions
```

`05-phases.md` may expand into a `05-phases/` subdirectory for large products; the default
is a single file.

## Required vs optional sections

- **Always required:** `README.md`, `01-context.md`, `08-acceptance-criteria.md`.
- **Recommended, skippable for small products:** `02-principles.md`, `03-domain-model.md`.
- **Standard:** the remainder.

## README index

Frontmatter keys: `title`, `status`, `owner`, `last-reviewed`, `related`. Body: a bold
`Version · Date · Status` line, a TL;DR, an optional system-at-a-glance diagram, a
**document map** table linking every section file, a short **PRD vs technical-design
boundary** note (the PRD owns what/why; the technical solution owns high-level how for complex
work), and a
**Status & next steps** section linking to the technical solution doc and tracker once downstream
planning creates them. The boundary note distinguishes all downstream artifacts: PRD owns what/why,
technical solution owns high-level how, delivery tracker owns sequencing/status, story brief owns
lightweight story-local scope, detailed technical story spec owns exact implementation design,
implementation plan owns execution steps, and runtime artifacts own execution evidence.

## Acceptance-criteria format

`08-acceptance-criteria.md` groups criteria by theme. Each group has a short **prefix** (a
1-3 letter code the author chooses, e.g. `L`, `A`, `SEC`); criteria are numbered `PREFIX-n`.
Each criterion is one table row carrying a **designation**: `[ship blocker]` or `[target]`.
A closing ship-blocker summary states that all `[ship blocker]` items must be met before the
product ships; `[target]` items may be deferred with a documented workaround.

`plan-delivery-track` references these IDs from tracker stories and story briefs, making the PRD
the authoritative source of done-ness rather than duplicating criteria.

## PRD status vocabulary

PRD frontmatter `status` uses one of: `draft`, `approved`, `shipped`, `archived`.

This is the **product-level** lifecycle and is deliberately distinct from the **story-level**
status vocabulary in `tracker-contract.md` (`specced` -> `plan-approved` -> `implementing` ->
`done` -> `verified`, plus terminal states). Do not conflate the two.

## Assumptions and blocking questions

`define-product` should ask only blocking questions before writing: questions whose answer would
materially change product scope, acceptance criteria, roles, phases, success metrics, or launch
risk. Safe assumptions belong in `09-risks-and-open-questions.md` under **Assumptions** instead of
interrupting the user. Questions that block a coherent PRD belong under **Blocking questions** and
must be resolved before marking the PRD `approved`; non-blocking follow-ups can remain under
**Open questions** with a recommended default.

## Conventions

Each section file opens with a back-link header (`← Back to README`) and closes with a
navigation footer (`Previous / Next / Up`). Cross-links are relative paths. Use Mermaid where
it helps (system overview, phase dependencies, risk heatmap). The PRD is markdown only.
