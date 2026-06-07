---
name: plan-track
description: Use after a PRD exists to decompose it into a delivery tracker. For complex technical PRDs, require and consume the technical architecture document produced by plan-architecture before writing tracker stories. Produces a tracker conforming to references/tracker-contract.md plus per-story standalone and delta specs that cite PRD acceptance criteria and relevant architecture sections. If no PRD exists, stop and point at /plan-product. If architecture is required and missing, stop and point at /plan-architecture. Do NOT use for one-shot single-PR work, product definition, or execution.
argument-hint: "[prd-slug or notes]"
arguments: prd_slug_or_notes
user-invocable: true
---

# Decompose a PRD into a delivery tracker

Turn an agreed PRD into the technical decomposition: a tracker of bounded stories, each
self-contained enough for a fresh session to claim cold, with explicit dependencies,
parallelism rules with reasons, validation gates, and a living foundation playbook. This is the
generified form of a methodology proven on multiple production tracks.

## Where this sits

`plan-product` (what/why -> a PRD) -> `plan-architecture` when needed (high-level how) ->
**`plan-track` (delivery slicing -> tracker + specs)** -> `implement-next` (per-story execution)
-> orchestrator (autonomous multi-session). `plan-track` reads the PRD via
`references/prd-contract.md`, reads the architecture via
`references/technical-architecture-contract.md` when required, and emits the tracker via
`references/tracker-contract.md`. The PRD stays the authoritative source of done-ness (stories cite
its `PREFIX-n` acceptance criteria); the architecture is the source for technical sequencing and
section citations; the tracker is the single source of truth for story *state*.

## Bundled references (load before producing each artifact)

Read the relevant file before writing — do not reconstruct shape from memory.

| Reference | Use for | When |
|---|---|---|
| `references/tracker-contract.md` | The tracker's required shape (9 columns, status vocab, graph, prefix registry) | Before Step 5 |
| `references/templates/tracker/tracker-readme-template.md` | The tracker README | Step 5 |
| `references/templates/tracker/standalone-spec-template.md` | Pattern A specs (foundation/pilot/cleanup) | Step 7 |
| `references/templates/tracker/delta-spec-template.md` | Pattern B specs (per-target rollout) | Step 7 |
| `references/prd-contract.md` | The PRD input format + acceptance-criteria IDs | Step 1 |
| `references/technical-architecture-contract.md` | Architecture gate rules and input shape | Step 2 |
| `references/templates/technical-architecture-template.md` | Architecture artifact shape, if one must be created first | Step 2 |

## Config

Read `.workflow/config.yaml` if present; otherwise use defaults. Keys used:
`paths.prdsDir` (default `docs/prds`), `paths.tracksDir` (`docs/tracks`),
`paths.specsDir` (`docs/specs`), `paths.plansDir` (`docs/plans`),
`statuses.*`, and `tracker.idPattern` (default `^[A-Z]{2,}[0-9]+$`). This skill writes no
config; it changes no config.

PRD acceptance criteria (`PREFIX-n`, for example `GI-1`) and tracker story IDs (`PREFIXn`, per
`tracker.idPattern`, for example `GI01`) are deliberately distinct: each story has its own tracker ID
and cites the PRD criteria IDs it satisfies.

## The recipe

Eleven steps. The PRD gate (Step 1), Architecture gate (Step 2), and reality audit (Step 3) are
the most-skipped and most load-bearing; every later step compounds an error there.

### Step 1 — PRD gate (hard)

Resolve `paths.prdsDir` and locate the PRD for this work (`<prdsDir>/<slug>/`, conforming to
`references/prd-contract.md`). **If no conforming PRD exists, stop and tell the user to run
`/plan-product` first** — do not improvise a product definition. When more than one PRD could
apply, confirm which with the user. Read the PRD, especially `08-acceptance-criteria.md` — its
`PREFIX-n` IDs are what every story maps back to.

### Step 2 — Architecture gate (hard for complex technical PRDs)

Classify whether this is a complex technical PRD. Architecture is required when the PRD implies any
new backend modules, shared services, database schema/query changes, AI prompts/triggers/tools,
observability/events/metrics, migration/deploy surfaces, security/privacy boundaries, multi-system
integration, or multiple implementation stories whose sequencing depends on technical design.

If architecture is required and missing, stop and tell the user to run `/plan-architecture` first.
Do not decompose complex technical work directly from the PRD.

If architecture is present, read `<prdsDir>/<slug>/architecture.md` and confirm it conforms to
`references/technical-architecture-contract.md`. Use it as the source for module boundaries, story
sequencing, validation gates, file-contention constraints, and required section citations.

If architecture is not required, say why in the tracker Context section and proceed.

### Step 3 — Audit reality (best-effort)

Read what the repo actually exposes — do not draft from imagination:

- Repo contract docs: `AGENTS.md`, `CLAUDE.md`, any `docs/architecture/*` or `ARCHITECTURE.md`.
  These **win** over the spec; a story that contradicts them is wrong.
- Source roots (detect them; there may be none yet).
- Existing trackers under `paths.tracksDir` — match their style so the new tracker looks native,
  and audit for prefix collisions and file overlap.
- The architecture doc, when present. Repo reality wins if it contradicts the architecture; flag
  the mismatch instead of copying stale design into stories.

Use `Explore` / `general-purpose` subagents in parallel for large surfaces. If little exists
(greenfield repo, no architecture doc), say so honestly in the tracker's Context section and
proceed — the PRD supplies the product context.

### Step 4 — Reserve the ID prefix

Read `<tracksDir>/README.md` for the prefix registry. Pick a 2+-letter prefix that is disjoint
from every reserved prefix and matches `tracker.idPattern`. Avoid prefixes that read like
sequenced sub-IDs.

### Step 5 — Identify stories

A story is "one fresh session can finish it and open one PR." Use the five types:

- **Foundation** (~1-3): docs-only playbook + net-new primitives + tooling. File-disjoint;
  parallel.
- **Pilot** (1): proves the foundation on one real target. Sequential. Updates the playbook with
  lessons learned before the rollout's second story starts.
- **Rollout** (often the bulk): apply the playbook to remaining targets. Sequential by **file
  contention**, not logical coupling.
- **Polish / parallel-side** (0-3): file-disjoint cleanup alongside rollout.
- **Cleanup** (1-3): final passes, legacy removal.

Aim for 5-25 stories (fewer -> tracker overhead doesn't pay; more -> stories too small or scope
too big). Map each story to one or more PRD `PREFIX-n` criteria and relevant architecture sections
when architecture exists.

### Step 6 — Dependency graph + waves + write the tracker README

Draft a Mermaid `flowchart TD` (solid arrows = hard dependencies). Group into waves. Then write
**parallelism rules as prose, each stating its reason** — file-level contention,
need-pilot-first, or shared-doc contention — because the reason tells future sessions when a
constraint can be relaxed.

Write `<tracksDir>/<track>/README.md` by copying `tracker-readme-template.md` and filling it.
Conform to `tracker-contract.md`: the exact 9 columns, statuses from the vocabulary, IDs from
`idPattern`. Keep it an index (< ~250 lines) — detail lives in the specs. Leave the **Plan**
column `—` (the implementing session drafts plans).

The tracker frontmatter `related:` must include the PRD and the architecture doc when one exists.

### Step 7 — Register the track

In the same session, add the new track's row and reserved prefix to `<tracksDir>/README.md`
(the tracks index + prefix registry). A tracker that is not registered is invisible to the
orchestrator and risks a future prefix collision.

### Step 8 — Write per-story specs

Two patterns; copy the matching template.

**Pattern A — Standalone** (foundation, pilot, cleanup):
- Path: `<specsDir>/<YYYY-MM-DD>-<id>-<slug>.md`.
- Template: `standalone-spec-template.md`.

**Pattern B — Delta over a playbook** (rollout stories sharing a foundation):
- Path: `<specsDir>/<track>/<category>/<YYYY-MM-DD>-<id>-<slug>.md` (pick a `<category>` noun
  fitting what the rollout iterates over).
- Template: `delta-spec-template.md`.
- Thin on rules, thick on facts. Always include the **Behavioural changes (forbidden)** section.

Every spec carries doc-lifecycle `status:` and a `related:` pointer to the tracker, the PRD, and
upstream specs. **Do not add a `<track>-status` mirror field** — the tracker matrix is the
single source of truth for status. Cite the PRD acceptance-criteria IDs each story satisfies.
When architecture exists, every spec must cite relevant architecture sections and explain how the
story uses or preserves those boundaries.

Each spec must include PRD acceptance criteria and architecture sections in its contract summary,
for example:

```markdown
**PRD acceptance criteria:** satisfies <PREFIX-n>, <PREFIX-m>.
**Architecture sections:** cites `<architecture heading>` and `<architecture heading>`.
```

### Step 9 — Define the validation gate

Every spec's "Validation gate" section: each item verifiable, specific, bounded. Use the repo's
configured commands (`verify.changed` for the fast/per-task gate, `verify.full` for the full
suite) rather than hardcoded tool names; add project-specific checks only if the repo defines
them. Always include "tracker Status updated in the same PR." Foundation playbooks add a
playbook-update gate.

### Step 10 — Living playbook & cross-track coordination

The foundation playbook is rarely complete on first draft. When the pilot or first rollout
stories surface gaps, update the playbook **in the same PR** as the story that found the gap and
bump the tracker's `last-reviewed`. If other trackers run concurrently and may overlap files,
add a "Coordination with other tracks" section with a file-overlap matrix and explicit gates.

### Step 11 — Summarize & hand off

List every artifact written (tracker README, the `<tracksDir>/README.md` index update, each
spec). Cross-check: every matrix row links a spec (or "playbook + delta"); every spec links back
to the tracker and cites PRD IDs; every spec for architecture-backed work cites relevant
architecture sections. Point the user at `/implement-next` as the next step. Do **not** auto-commit,
and do **not** invoke `writing-plans` or any execution skill — that crosses into the implementer's
altitude.

## Safety & idempotency

- Never overwrite an existing tracker or spec without explicit confirmation.
- Resume/extend mode: if a tracker already exists for the PRD, report which stories/specs are
  missing or thin and offer to add only those — never clobber.
- Always read the prefix registry before reserving; never reuse a prefix.
- Works with defaults when `.workflow/config.yaml` is absent.

## Anti-patterns

- **Drafting without the PRD gate or the audit.** Stories that describe code that doesn't exist
  or contradict the repo's contract docs. Steps 1-2 are mandatory.
- **Skipping the Architecture gate for a complex technical PRD.** If architecture is required and
  missing, stop instead of inventing high-level design inside per-story specs.
- **Adding tracker columns or new statuses.** Hold the `tracker-contract.md` 9-column line and
  the fixed vocabulary.
- **A `<track>-status` mirror in spec frontmatter.** Two sources of truth drift. The matrix wins.
- **Validation gates that say "tests pass."** Name the command and the bar.
- **Logical-only parallelism.** Two stories that "don't logically depend" still collide if they
  edit the same files. Reason about file paths.
- **Skipping the pilot**, or letting rollout stories amend the playbook silently / in a deferred
  follow-up.
- **A tracker README without parallelism reasons**, or one that is not registered in the index.

## Related

- `references/tracker-contract.md` — the output contract
- `references/prd-contract.md` — the input contract
- `references/technical-architecture-contract.md` — the architecture input contract
- `references/templates/tracker/` — the three bundled templates
- `examples/example-tracker/` — a worked example decomposing `examples/example-prd/`
