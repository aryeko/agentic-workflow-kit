---
name: plan-delivery-track
description: Use after a PRD exists to decompose it into a delivery tracker and lightweight story briefs. For complex technical PRDs, require and consume the technical solution document produced by design-technical-solution before writing tracker stories. Produces docs/tracks/<track>/README.md plus docs/tracks/<track>/stories/<ID>.md briefs that cite PRD criteria and technical solution sections. Story briefs are not implementation-ready; implement-next creates the detailed technical story spec and implementation plan before code. If no PRD exists, stop and point at /define-product. If technical solution is required and missing, stop and point at /design-technical-solution.
argument-hint: "[prd-slug or notes]"
arguments: prd_slug_or_notes
user-invocable: true
---

# Plan a delivery tracker

Turn an agreed PRD, plus a technical solution when needed, into delivery sequencing: a tracker of
bounded stories and lightweight story briefs. This skill does not write detailed technical story
specs and does not write implementation plans.

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
| `references/tracker-contract.md` | Tracker README contract and 9-column status matrix |
| `references/story-brief-contract.md` | Story brief contract |
| `references/templates/tracker/tracker-readme-template.md` | Tracker README template |
| `references/templates/story-brief-template.md` | Story brief template |

## Config

Read `.workflow/config.yaml` if present; otherwise use defaults. Keys used:
`paths.prdsDir` (default `docs/prds`), `paths.tracksDir` (`docs/tracks`), `statuses.*`, and
`tracker.idPattern` (default `^[A-Z]{2,}[0-9]+$`). This skill writes no config.

## The recipe

### Step 1 - PRD gate

Resolve `paths.prdsDir` and locate the PRD for this work (`<prdsDir>/<slug>/`, conforming to
`references/prd-contract.md`). If no conforming PRD exists, stop and tell the user to run
`/define-product` first. Read `08-acceptance-criteria.md`; every story brief maps to one or more
PRD criteria.

### Step 2 - Technical solution gate

Classify whether this is a complex technical PRD. Technical solution is required when the PRD
implies any new backend modules, shared services, database schema/query changes,
AI prompts/triggers/tools, observability/events/metrics, migration/deploy surfaces,
security/privacy boundaries, multi-system integration, or multiple implementation stories whose
sequencing depends on technical design.

If technical solution is required and missing, stop and tell the user to run
`/design-technical-solution` first. Do not decompose complex technical work directly from the PRD.

If the technical solution is present, read `<prdsDir>/<slug>/technical-solution.md` and confirm it
conforms to `references/technical-solution-contract.md`. Use it as the source for story boundaries,
sequencing, validation expectations, file-contention constraints, and required section citations.

### Step 3 - Audit reality

Read repo contract docs (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, architecture docs), source roots,
and existing trackers under `paths.tracksDir`. Repo reality wins if it contradicts the PRD or
technical solution; flag the mismatch rather than copying stale assumptions into story briefs.

### Step 4 - Reserve the ID prefix

Read `<tracksDir>/README.md` for the prefix registry. Pick a 2+-letter prefix that is disjoint from
every reserved prefix and matches `tracker.idPattern`.

### Step 5 - Identify stories

A story is one future `implement-next` session that can create a detailed technical story spec,
write an implementation plan, code, verify, and open one PR. Aim for 5-25 stories.

For each story, define PRD criteria and technical solution sections, dependencies, scope boundary,
candidate surfaces, validation expectations, and open technical questions that the detailed spec
must resolve.

### Step 6 - Write tracker README

Write `<tracksDir>/<track>/README.md` from `tracker-readme-template.md`. Keep the 9-column status
matrix exactly. For new trackers, the **Spec** column links to the story brief, for example
`[brief](./stories/<ID>.md)`. Leave **Plan** as `—`; `implement-next` creates the implementation
plan later.

### Step 7 - Write story briefs

Write one lightweight story brief per tracker row at:

```text
<tracksDir>/<track>/stories/<ID>.md
```

Use `references/templates/story-brief-template.md`. Each brief must include PRD criteria,
technical solution sections, dependencies, scope boundary, candidate surfaces, validation
expectations, open technical questions, and the exact note:

```text
not implementation-ready; create a detailed technical story spec before plan/code
```

Remember: story briefs are not implementation-ready. Do not write detailed technical story specs or
implementation plans from this skill.

### Step 8 - Register the track

Add the new track row and reserved prefix to `<tracksDir>/README.md`. A tracker that is not
registered is invisible to orchestrated selection and risks prefix collision.

### Step 9 - Summarize and hand off

List the tracker README and story briefs written. Cross-check that every matrix row links a story
brief and every brief links back to the tracker, PRD, and technical solution when present. Point the
user at `/implement-next` for detailed story-spec creation, implementation planning, and code.

Do not auto-commit and do not invoke implementation skills.

## Backward compatibility

Existing trackers that link a detailed spec directly (rather than a story brief) remain valid. New
trackers should link story briefs under `<tracksDir>/<track>/stories/`.

## Anti-patterns

- Writing detailed technical story specs in `plan-delivery-track`.
- Writing implementation plans before `implement-next`.
- Treating a story brief as implementation-ready.
- Adding tracker columns or statuses.
- Skipping the Technical solution gate for complex technical work.
