---
title: Decisions log
status: paused
owner: arye
last-reviewed: 2026-06-18
---

# Decisions log

← [Back to handoff index](README.md)

Decisions are grouped into the **original** set (locked during the first design, mostly still good) and the **redesign** set (the changes made when we paused). Where a redesign decision supersedes an original one, it says so.

## Original decisions (still good unless superseded)

- **D1 — Two pillars.** `product/` and `architecture/`, each with a canonical (durable) zone and a per-initiative (retired-after-ship) zone. _Kept._
- **D2 — Designs are staging.** Per-PRD technical design lives at `architecture/designs/<slug>.md`, status-tracked, archived on promotion. _Kept._
- **D3 — ADRs + domain references are first-class** canonical doc types (immutable numbered MADR; Purpose/Public API/Invariants/Gotchas). _Kept._
- **D4 — Authoring standard is repo-owned.** `docs-style.md` is seeded by the kit, then authoritative; skills read it at runtime; supports `extends: built-in/recommended`. _Kept._
- **D5 — Everything configurable.** `.workflow/config.yaml` `docs` block; presets recommend, not mandate; `workflow-init` is lean-default / full-preset and detects-don't-imposes. _Kept._
- **D6 — `docs.preset` defaults to `lean`.** _Kept._
- **D7 — Diagram craft** belongs in `docs-style.md` (type-picker + preamble→diagram→takeaway; Mermaid in committed docs). _Kept._
- **D8 (SUPERSEDED) — promote per track via a gated, dependency-terminal tracker *story* + per-story canonical-impact breadcrumbs, NOT per wave.** The per-track-not-per-wave reasoning was right (in the kit, a track is the ship unit; waves are parallelism groupings). But modeling promote as a *story* was wrong → superseded by R1.
- **D9 (SUPERSEDED) — grow-in-place story spec** (one file: brief → implementation-ready). Added churn and a status-lifecycle P1 → superseded by R2.

## Redesign decisions (made at the pause)

- **R1 — Promote is a configurable track-level ACTION, not a story.** `docs.promote.mode`: `off` / `prompt` (default) / `auto`. At track completion the producer detects "all stories done, not yet promoted" and, per mode, offers or runs `/promote-to-canonical`. A tracker-level `promoted` marker prevents re-asking. **No tracker story, no `kind` marker, no runtime eligibility/dispatch/claim code.** Supersedes D8. This deletes the entire P1 class from [page 3](03-what-happened-and-lessons.md).
- **R2 — Revert the story-model change.** Keep the kit's existing brief + separate detailed-spec model. No grow-in-place. Supersedes D9. ("Better stories" can be a separate future effort.)
- **R3 — One `prdsDir` key, no coexistence.** Do not add a second `docs.paths.prdsDir`. Reuse the existing `paths.prdsDir`; `workflow-init` writes the recommended `docs/product/prds` for new repos; existing repos keep their value (detect-don't-impose). The `docs` block holds only genuinely-new pillar paths. Eliminates the legacy-coexistence findings.
- **R4 — Recommend NO schema version bump.** The `docs` block is additive and optional (defaults applied), so existing `0.6.0` configs stay valid as-is — eliminating the whole config-version finding class (patch versions, JSON-schema range, supported-stale upgrade). Trade-off: less "honest" semver signaling. A minor bump remains possible but reintroduces range handling; given the de-risk priority, skip it. _(Flagged for confirmation when PR 1 is planned.)_
- **R5 — Land as three small, independently-reviewable PRs.** See [page 5](05-redesign-direction-and-plan.md).
- **R6 — Close PR #104, keep the branch.** Do not merge; do not delete the branch. It is the reference for the foundation work and the full review history.

## Process decision

- **P1 — For prompt-driven changes, trace the cross-skill flow + check spec compliance manually before pushing; do not rely on the gate. And enforce rules in the deterministic runtime, not only in prompts.** (Direct consequence of the lessons on [page 3](03-what-happened-and-lessons.md).)
