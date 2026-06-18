# Promote-to-canonical contract

The promote-to-canonical step is the feedback edge that keeps the canonical knowledge base current.
It is performed by the terminal story in every tracker produced by `plan-delivery-track`. This file
defines the step's inputs, outputs, gate, and immutability rules. It is the promote analog of
`tracker-contract.md` and `prd-contract.md`.

## Role in the lifecycle

The lifecycle runs in one direction until promotion closes the loop:

```
PRD (define-product)
  -> technical design (design-technical-solution)
    -> tracker + stories (plan-delivery-track)
      -> code + PRs (implement-next)
        -> promote-to-canonical (terminal story)
          -> canonical updated
            -> feeds next initiative (define-product reads updated canon)
```

Promotion is **per track** (one promote per ship event), not per story and not per wave. The track
is the ship unit: promoting per story would canonicalize intermediate states, promoting per wave
would canonicalize parallelism groupings. Each track gets exactly one terminal promote story whose
`Depends on` is the full set of implementation story IDs.

## Track-complete gate

The track (and its PRD) cannot reach a `complete` status until the terminal promote story is
`verified`. This is a structural exit-bar rule, not a convention:

- `plan-delivery-track` always emits the terminal promote story.
- The tracker README records the promote story as the last wave entry with `Depends on` = all
  implementation story IDs.
- No story or PRD may be marked complete while the promote story's Status is not in
  `statuses.complete`.

This gate is stated in `tracker-contract.md` "Terminal promote story" section. This contract adds
the promote-side perspective.

## Inputs

| Input | Source | Required |
|---|---|---|
| Tracker README | `<tracksDir>/<track>/README.md` | Yes — must be promotion-ready (all implementation stories complete) |
| PRD | `<docs.paths.prdsDir>/<slug>/` | Yes — slug and current `status` |
| Technical design doc | `<docs.paths.designsDir>/<slug>.md` | Recommended — **Canonical impact** section lists all planned canonical changes; absence triggers breadcrumb-only reconstruction with a warning |
| Per-story canonical-impact breadcrumbs | Each `<tracksDir>/<track>/stories/<ID>.md` | Required when `docs.promote.breadcrumbs: required` (the default) |
| Merged diff | PR diff for all implementation stories | Recommended — used to verify breadcrumb claims and surface undocumented decisions |
| Repo authoring standard | `<docs.style>` (default `docs/docs-style.md`) | Yes — read at runtime; falls back to kit built-in if absent |
| Repo templates | `<docs.templatesDir>/` (default `.workflow/templates/`) | Recommended — resolved before kit built-ins |

### Canonical impact section (design doc)

The technical design's **Canonical impact** section (defined in `technical-solution-contract.md`)
enumerates every canonical doc this design will create or change on promotion. Each entry carries:

- canonical doc path,
- action: `create`, `update`, `new-adr`, or `archive`,
- one-line description of the change.

`promote-to-canonical` reads this section as its primary action list. When the section is absent,
it falls back to breadcrumb reconstruction and notes the limitation.

### Per-story canonical-impact breadcrumbs

Each story file (`<tracksDir>/<track>/stories/<ID>.md`) carries a one-line **Canonical impact**
breadcrumb (defined in `story-brief-contract.md`) stating whether the story changes an invariant,
introduces a decision, or changes product behavior. `promote-to-canonical` aggregates these
breadcrumbs to verify the design's Canonical impact list and to catch undocumented decisions.

The breadcrumb value `none` means the story has no durable canonical impact and can be skipped
during aggregation.

## Outputs

| Output | Location | Action |
|---|---|---|
| Product narrative updates | `<docs.paths.productDir>/` | `update` relevant canonical product files |
| Architecture topic doc updates | `<docs.paths.architectureDir>/<topic>.md` | `update` affected topic docs (guidelines, system-overview, etc.) |
| Domain reference updates or creation | `<docs.paths.domainsDir>/<domain>.md` | `update` existing or `create` new domain refs for changed domains |
| ADR(s) | `<docs.paths.decisionsDir>/NNNN-<slug>.md` | `new-adr` — one per real decision; minted with `status: proposed` |
| PRD status flip | `<docs.paths.prdsDir>/<slug>/README.md` | `update` frontmatter `status` to `shipped` |
| Design doc archive | `<docs.paths.designsDir>/<slug>.md` | `archive` — flip frontmatter `status` to `archived` |
| Pillar index refreshes | `<docs.paths.architectureDir>/README.md`, `<docs.paths.productDir>/README.md`, `docs/README.md` | `update` index rows for new/changed docs |
| Terminal promote story status | Tracker README | `done` (first `statuses.complete` value) |

### ADR immutability

ADRs are canonical and immutable once `status: accepted`. The promote step mints ADRs at
`status: proposed`. A human reviewer advances each to `accepted`. Once accepted:

- Content is immutable except for adding `superseded by NNNN` status or fixing factual errors
  (typos, broken links) that do not change the decision.
- A superseding ADR is a new file. The original record is updated only to change its `status` to
  `superseded by NNNN`.
- ADR sequence numbers are permanently reserved once assigned, even if the draft is abandoned.
  Do not delete or reassign a number.

See `references/adr-contract.md` for the full format and lifecycle rules.

### Domain reference update rules

`promote-to-canonical` updates a domain reference when the shipped track changes:

- The **Public API** (new/removed exports, changed signatures).
- An **Invariant** (new, relaxed, or strengthened).
- A **Gotcha** (newly discovered or resolved).
- The **Purpose** boundary (what the domain owns or does not own).

New domains created by the shipped track get a new domain reference file created from the template.
`last-reviewed` is updated on every domain reference touched. See
`references/domain-reference-contract.md` for the full format rules.

## What promote-to-canonical does NOT do

- Write implementation code or implementation plans.
- Add new tracker rows for future stories.
- Claim or advance the status of implementation stories (those are done by `implement-next`).
- Make judgments about product strategy or technical architecture beyond recording what the shipped
  track decided.
- Merge PRs or interact with CI.
- Overwrite accepted ADR content.
- Remove or move canonical docs (deprecate via `status: deprecated` instead).

## Promotion-readiness check and claim

Before writing any canonical output, `promote-to-canonical` confirms that:

1. Every implementation story row in the tracker has Status in `statuses.complete`.
2. The terminal promote story row's `Depends on` is satisfied (all IDs are in `statuses.complete`).
3. The terminal promote story row's Status is in `statuses.eligible` (new run) OR is already in
   `statuses.inProgress` owned by this session (resume after partial failure).

If any check fails, the skill stops and reports which stories are incomplete. It does not partially
promote: canonical docs are not left in an intermediate state where some stories' changes are folded
in and others are not.

After confirming readiness, the skill claims the promote story row (Status → `statuses.inProgress`,
Owner → session label) before writing any canonical files. On completion (Step 8), the row advances
to `statuses.complete[0]` (`done`). The promote story lifecycle is `eligible → implementing → done`,
identical to every other story in the tracker.

## Idempotency

`promote-to-canonical` is idempotent. If re-run after a partial failure:

- Already-written canonical doc changes are detected (content match) and skipped.
- Already-minted ADRs are detected by sequence number and skipped.
- Already-flipped PRD and design doc statuses are detected and skipped.
- Already-updated index rows are detected and skipped.
- The promote story status update is safe to repeat.

The skill reports which outputs were already present and skipped rather than silently overwriting
them.

## Config keys used

| Key | Default | Purpose |
|---|---|---|
| `docs.paths.productDir` | `docs/product` | Product canonical docs root |
| `docs.paths.prdsDir` | `docs/product/prds` | PRD root |
| `docs.paths.architectureDir` | `docs/architecture` | Architecture canonical docs root |
| `docs.paths.designsDir` | `docs/architecture/designs` | Technical design staging area |
| `docs.paths.domainsDir` | `docs/architecture/domains` | Domain reference files |
| `docs.paths.decisionsDir` | `docs/architecture/decisions` | ADR files |
| `docs.style` | `docs/docs-style.md` | Repo-owned authoring standard |
| `docs.templatesDir` | `.workflow/templates` | Repo template overrides |
| `docs.promote.strategy` | `terminal-story` | How promotion is triggered |
| `docs.promote.gate` | `track-complete` | Completion gate for the track |
| `docs.promote.breadcrumbs` | `required` | Whether per-story breadcrumbs are required |
| `paths.tracksDir` | `docs/tracks` | Tracker root |
| `statuses.complete` | `[done, verified]` | Statuses that satisfy completion and dependency checks |

## Related

- `references/tracker-contract.md` — terminal promote story rule and exit-bar gate
- `references/adr-contract.md` — ADR format, numbering, immutability, and lifecycle
- `references/domain-reference-contract.md` — domain reference format and update rules
- `references/prd-contract.md` — PRD status vocabulary
- `references/technical-solution-contract.md` — design doc location, status vocabulary, and Canonical impact section
- `references/story-brief-contract.md` — per-story canonical-impact breadcrumb
- `references/config-schema.md` — full config key reference including `docs.*` block
- `references/templates/adr-template.md` — ADR file template
- `references/templates/domain-reference-template.md` — domain reference template
- `references/templates/docs-style.md` — kit built-in authoring standard (seed and fallback)
