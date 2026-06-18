---
title: Redesign direction and plan
status: paused
owner: arye
last-reviewed: 2026-06-18
---

# Redesign direction and plan

← [Back to handoff index](README.md)

This is the agreed direction for the *next* attempt. It is intentionally smaller than the paused PR. Nothing here is implemented yet — it is the plan for resuming. See the [decisions log](04-decisions-log.md) for the rationale behind each point.

## The new shape of the promote mechanism

- Promote is a **track-level action**, configured by `docs.promote.mode`:
  - `off` — never automatic; `/promote-to-canonical` stays available manually.
  - `prompt` (**default**) — when the producer marks a track's last story done, it detects "all stories complete, not yet promoted" and offers: "promote shipped work into canonical now?" The user confirms or defers.
  - `auto` — runs promotion automatically on track completion (for unattended autopilot).
- A tracker-level **`promoted` marker** (e.g. tracker frontmatter `promoted: <date>`) records that a track has been promoted, so the kit does not re-ask.
- `plan-delivery-track` does **not** emit a promote story. There is no promote row, no `kind` marker, and **no runtime eligibility/dispatch/claim code** — the runtime never has to know about promote at all.

## Slicing — three small, independently-landable PRs

Each PR is its own design → plan → implement → review cycle. Land in order.

### PR 1 — Structure + standard (lowest risk, land first)
- `docs` config block: pillar paths only (`productDir`, `architectureDir`, `designsDir`, `domainsDir`, `decisionsDir`) + `index`, `style`, `templatesDir`, `types`, `preset` (lean default). **One `prdsDir` key** (reuse `paths.prdsDir`; recommend new location via `workflow-init`). **No schema version bump** (additive, optional).
- `docs-style.md` authoring standard; ADR + domain-reference templates + contracts; master/pillar index templates.
- `workflow-init` scaffolding (lean/full, detect-don't-impose).
- No behavior change to produce/implement skills; no promote; no story-model change.

### PR 2 — Producing skills
- `define-product` reads canonical docs + registers the PRD in the product pillar index.
- `design-technical-solution` writes to `architecture/designs/<slug>.md` and includes a lightweight **Canonical impact** note.
- `plan-delivery-track` / `implement-next` read the new doc paths (single `prdsDir` key, `designsDir`). Story model stays the kit's existing brief + detailed-spec.
- Depends on PR 1.

### PR 3 — Promote action
- The configurable track-level promote (`off`/`prompt`/`auto`) + the completion-time prompt wired into `implement-next` / autopilot + the `promoted` marker.
- The `promote-to-canonical` skill, reworked to be invoked by that action (or manually), reading the shipped track + the design's Canonical impact + the merged diff. No story machinery.
- Depends on PR 1 (and benefits from PR 2's Canonical-impact note).

## How to reuse the parked branch

The closed branch `docs/docs-knowledge-base-redesign` holds working implementations of most of PR 1 and PR 2. When resuming, **cherry-pick or copy the foundation commits as reference** (see the commit table on [page 2](02-what-we-built.md)) — do not lift the story-model or promote-loop commits. Re-derive PR 3 from this page, not from the branch.

## The very next action

1. Confirm the **R4 no-version-bump** recommendation (or decide to bump).
2. Run a fresh, *small* design → plan for **PR 1 only**.
3. Implement PR 1, then **trace the cross-skill flow by hand and check the deterministic runtime** before pushing (per process decision P1 on [page 4](04-decisions-log.md)) — not just the gate.
