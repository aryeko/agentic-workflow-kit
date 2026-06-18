---
name: plan-delivery-track
description: Use to decompose product or design context into a delivery tracker and grow-in-place story files. Accepts a PRD plus technical solution, a technical solution alone, or explicit backlog/design context when enough scope, outcomes, sequencing, and validation expectations exist. For complex technical work, require a technical solution or equivalent external design context before writing tracker stories. Produces docs/tracks/<track>/README.md plus docs/tracks/<track>/stories/<ID>.md story files (brief-level) that cite PRD criteria or context-derived outcomes and technical solution sections or external context labels, plus a terminal promote story. Story files are not implementation-ready until enriched by implement-next to plan-approved.
argument-hint: "[prd-slug or notes]"
arguments: prd_slug_or_notes
user-invocable: true
---

# Plan a delivery tracker

Turn agreed product/design input into delivery sequencing: a tracker of bounded stories and
grow-in-place story files. The input can be a PRD plus technical solution, a technical solution alone, or explicit backlog/design context when enough scope exists. This skill does not enrich
story files to implementation-ready and does not write implementation plans.

## Where this sits

`define-product` (PRD) -> `design-technical-solution` (high-level technical solution when needed)
-> **`plan-delivery-track` (tracker + story briefs)** -> `implement-next` (detailed technical story
spec -> implementation plan -> code) -> `workflow-autopilot` or human-driven story execution.

The workflow altitude is:

```text
PRD -> Technical solution -> Delivery tracker + story briefs -> Detailed story spec -> Implementation plan -> Code
```

## Bundled references (load before producing each artifact)

| Reference | Use for |
|---|---|
| `references/prd-contract.md` | PRD input and acceptance-criteria IDs |
| `references/technical-solution-contract.md` | Technical solution gate and required input shape |
| `references/tracker-contract.md` | Tracker README contract, 9-column status matrix, and terminal promote story rule |
| `references/story-brief-contract.md` | Story file contract (brief-level sections) |
| `references/templates/tracker/tracker-readme-template.md` | Tracker README template |
| `references/templates/story-brief-template.md` | Story file template (brief-level) |

## Config

Read `.workflow/config.yaml` if present; otherwise use defaults. Keys used:
`docs.paths.prdsDir` (default `docs/product/prds`; fall back to `paths.prdsDir`, default
`docs/prds`), `docs.paths.designsDir` (default `docs/architecture/designs`),
`paths.tracksDir` (`docs/tracks`), `statuses.*`, and
`tracker.idPattern` (default `^[A-Z]{2,}[0-9]+$`). This skill writes no config.

## The recipe

### Step 1 - Source context gate

Resolve `docs.paths.prdsDir` (default `docs/product/prds`); fall back to `paths.prdsDir`
(default `docs/prds`) when `docs.paths.prdsDir` is absent. Call the resolved value `<prdsDir>`.
Locate the PRD for this work (`<prdsDir>/<slug>/`, conforming to
`references/prd-contract.md`) when a PRD slug or path is supplied. Read `08-acceptance-criteria.md`;
every story brief maps to one or more PRD criteria when PRD criteria exist.

If no conforming PRD exists, continue only when the user supplied a technical solution alone or
explicit backlog/design context with enough product scope, acceptance outcomes, sequencing
constraints, and validation expectations to create responsible tracker rows. Record that assumption
in the tracker and each story brief. If that context is missing or contradictory, stop and tell the
user to run `/define-product` first.

### Step 2 - Technical solution gate

Classify whether this is a complex technical PRD. Technical solution is required when the PRD
implies any new backend modules, shared services, database schema/query changes,
AI prompts/triggers/tools, observability/events/metrics, migration/deploy surfaces,
security/privacy boundaries, multi-system integration, or multiple implementation stories whose
sequencing depends on technical design.

If technical solution is required and missing, stop and tell the user to run
`/design-technical-solution` first unless explicit external design context already covers the same
high-level how. Do not decompose complex technical work directly from a thin PRD.

If the technical solution is present, resolve `docs.paths.designsDir` (default
`docs/architecture/designs`; fall back to `docs/architecture/designs` when absent). Read the
technical design at `<docs.paths.designsDir>/<slug>.md` first; if that file is absent, fall back to
the legacy `<prdsDir>/<slug>/technical-solution.md`. Confirm the located document conforms to
`references/technical-solution-contract.md`. Use it as the source for story boundaries,
sequencing, validation expectations, file-contention constraints, and required section citations.
For technical-solution-only or backlog/design-context planning, cite the supplied document headings
or context labels in the story brief's technical solution sections.

### Step 3 - Audit reality

Read repo contract docs (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, architecture docs), source roots,
and existing trackers under `paths.tracksDir`. Repo reality wins if it contradicts the PRD or
technical solution; flag the mismatch rather than copying stale assumptions into story briefs.

### Step 4 - Reserve the ID prefix

Read `<tracksDir>/README.md` for the prefix registry. Pick a 2+-letter prefix that is disjoint from
every reserved prefix and matches `tracker.idPattern`.

### Step 5 - Identify stories

A story is one future `implement-next` session that can enrich the story file to implementation-ready,
write an implementation plan, code, verify, and open one PR. Aim for 5-25 implementation stories,
plus one terminal promote story.

For each implementation story, define PRD criteria and technical solution sections, dependencies,
scope boundary, candidate surfaces, validation expectations, open technical questions, and a one-line
canonical impact breadcrumb.

Add an **Assumptions and blockers** pass before writing: record safe assumptions and ask only
questions that block a valid tracker or story file. Add an **Artifact boundaries** pass: confirm the
tracker owns delivery slicing and status, story files are lightweight and not implementation-ready
until enriched by implement-next, implementation plans own execution steps, and runtime artifacts own
execution evidence.

Add a **terminal promote story** as the final story: its `Depends on` is the full set of
implementation story IDs, it is placed in the final wave, and its job is to run `promote-to-canonical`
once all implementation stories are complete. The track is not complete until this promote story
reaches a `statuses.complete` status (`done` or `verified`).

### Step 6 - Write tracker README

Write `<tracksDir>/<track>/README.md` from `tracker-readme-template.md`. Keep the 9-column status
matrix exactly. For new trackers, the **Spec** column links to the story brief, for example
`[brief](./stories/<ID>.md)`. Leave **Plan** as `—`; `implement-next` creates the implementation
plan later.

### Step 7 - Write story files (brief-level)

Write one grow-in-place story file per implementation tracker row at:

```text
<tracksDir>/<track>/stories/<ID>.md
```

Use `references/templates/story-brief-template.md`. Each story file must include PRD criteria or
context-derived outcomes, technical solution sections or external context citations, dependencies,
scope boundary, assumptions and blockers, artifact boundaries, canonical impact, candidate surfaces,
validation expectations, open technical questions, and the exact note:

```text
brief-level — not implementation-ready until enriched to plan-approved
```

Also write a story file for the terminal promote story. Its canonical impact line names all
implementation stories whose decisions it will canonicalize.

Remember: story files are brief-level and not implementation-ready. Do not enrich story files
to implementation-ready or write implementation plans from this skill.

### Step 8 - Register the track

Add the new track row and reserved prefix to `<tracksDir>/README.md`. A tracker that is not
registered is invisible to orchestrated selection and risks prefix collision.

### Step 9 - Summarize and hand off

List the tracker README and story files written. Cross-check that every matrix row links a story
file and every story file links back to the tracker, PRD, and technical solution when present.
Confirm the terminal promote story is in the final wave with `Depends on` = all implementation
story IDs. Point the user at `/implement-next` for story enrichment, implementation planning, and code.

Do not auto-commit and do not invoke implementation skills.

## Backward compatibility

Existing trackers that link a detailed spec directly (rather than a story file) remain valid. New
trackers should link grow-in-place story files under `<tracksDir>/<track>/stories/`.

## Anti-patterns

- Enriching story files to implementation-ready in `plan-delivery-track`.
- Writing implementation plans before `implement-next`.
- Treating a brief-level story file as implementation-ready.
- Adding tracker columns or statuses.
- Skipping the Technical solution gate for complex technical work.
- Omitting the terminal promote story from the tracker.
