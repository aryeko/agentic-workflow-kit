---
name: promote-to-canonical
description: "Use after a delivery track ships to fold durable knowledge back into the canonical knowledge base. Trigger phrases: promote to canonical, update canonical docs, run the promote story, or invoke directly as /promote-to-canonical. Reads the shipped track and its per-story canonical-impact breadcrumbs, updates product narrative and architecture docs, mints ADRs for real decisions, flips the PRD to shipped, archives the design doc, and refreshes pillar indexes. Required as the terminal story in every tracker produced by plan-delivery-track."
argument-hint: "[track or prd-slug]"
disable-model-invocation: true
user-invocable: true
---

# Promote a shipped track to canonical

Synthesize the durable knowledge from a shipped delivery track into the repo's canonical knowledge
base. This skill is the feedback edge that keeps canon current: each initiative leaves the canonical
docs more accurate than it found them.

## Where this sits

`define-product` (PRD) -> `design-technical-solution` (technical design) ->
`plan-delivery-track` (tracker + stories) -> `implement-next` (code + PR) ->
**`promote-to-canonical` (terminal story — canonical updated)** -> `define-product` reads updated canon.

The loop closes because `define-product` reads current canonical docs as context for the next
initiative, so each track starts from accurate canon rather than re-deriving it.

## Bundled references (load before producing each artifact)

| Reference | Use for |
|---|---|
| `references/promote-contract.md` | Inputs, outputs, gate, and immutability rules for the promote step |
| `references/tracker-contract.md` | Terminal promote story rule and exit-bar gate |
| `references/adr-contract.md` | ADR format, numbering, immutability, and status vocabulary |
| `references/domain-reference-contract.md` | Domain reference format and update rules |
| `references/prd-contract.md` | PRD status vocabulary (`shipped`) |
| `references/technical-solution-contract.md` | Design doc status (`archived`) and Canonical impact section |
| `${CLAUDE_PLUGIN_ROOT}/references/templates/adr-template.md` | ADR template |
| `${CLAUDE_PLUGIN_ROOT}/references/templates/domain-reference-template.md` | Domain reference template |

## Config

Read `.workflow/config.yaml` if present; otherwise use defaults. Keys used:

- `docs.paths.productDir` (default `docs/product`)
- `docs.paths.prdsDir` (default `docs/product/prds`)
- `docs.paths.architectureDir` (default `docs/architecture`)
- `docs.paths.designsDir` (default `docs/architecture/designs`)
- `docs.paths.domainsDir` (default `docs/architecture/domains`)
- `docs.paths.decisionsDir` (default `docs/architecture/decisions`)
- `docs.style` (default `docs/docs-style.md`) — the repo-owned authoring standard
- `docs.templatesDir` (default `.workflow/templates`) — repo template overrides
- `docs.promote.strategy` (default `terminal-story`)
- `docs.promote.gate` (default `track-complete`)
- `docs.promote.breadcrumbs` (default `required`)
- `paths.prdsDir` (legacy fallback) — read when `docs.paths.prdsDir` is absent

Template resolution per type: `<docs.templatesDir>/<type>.md` → preset → kit built-in at
`${CLAUDE_PLUGIN_ROOT}/references/templates/`.

This skill writes no config. It reads config and repo-owned files at runtime and never hardcodes
the authoring standard, templates, or doc paths.

## The recipe

### Step 1 — Load context and claim the promote story

Resolve the track. If an argument is supplied, treat it as the track directory basename or PRD slug;
otherwise discover the most recently completed track. A track is ready for promotion when:

1. every implementation story row has a Status in `statuses.complete`, **and**
2. the terminal promote story row's Status is in `statuses.eligible` (new run), or is already in
   `statuses.inProgress` owned by this session (resume after partial failure).

If either condition fails, stop and report which stories are incomplete. Do not partially promote.

After confirming readiness, **claim the promote story row** before reading or writing any canonical
files:

- Set the promote story row's **Status** to `statuses.inProgress` and **Owner** to a clear session
  label.

```bash
git add <tracker README>
git commit -m "chore(<promote-story-id>): claim promote story"
```

Read in order:

1. The tracker README (`<tracksDir>/<track>/README.md`) — status matrix, dependency graph, all
   story IDs, and the terminal promote story's `Depends on` list.
2. The PRD at `<docs.paths.prdsDir>/<slug>/` (or `<paths.prdsDir>/<slug>/` for legacy layout) —
   confirm the PRD slug and current `status`.
3. The technical design at `<docs.paths.designsDir>/<slug>.md` — read the **Canonical impact**
   section which lists every canonical doc this track will create or change. If the design doc is
   absent or has no Canonical impact section, reconstruct intent from the per-story breadcrumbs and
   the merged diff. Log a warning when reconstruction was needed.
4. All story files under `<tracksDir>/<track>/stories/` — extract each story's **Canonical impact**
   breadcrumb line.
5. The repo-owned authoring standard at `<docs.style>` (default `docs/docs-style.md`). If the file
   is absent, fall back to the kit built-in standard at
   `${CLAUDE_PLUGIN_ROOT}/references/templates/docs-style.md` and note the fallback.
6. If available, the merged diff for all implementation PRs. Use it to verify breadcrumb claims and
   to discover undocumented decisions.

Produce a **promotion plan** listing every canonical action the skill intends to take: doc path,
action type (`create`, `update`, `new-adr`, `archive`), and one-line description. Show the plan to
the user and confirm before writing any files. Stop if the tracker is not promotion-ready (any
implementation story is not in `statuses.complete`).

### Step 2 — Update product narrative

Read the current product canonical docs under `<docs.paths.productDir>/`. For each product surface,
positioning statement, or status entry that the shipped track changes, update the corresponding
canonical file.

Rules:

- One fact, one place. Do not duplicate content already in the PRD or design doc; write a pointer
  instead.
- Conform to the repo-owned authoring standard.
- Update `last-reviewed` frontmatter to today's date on every file touched.
- Do not alter sections whose content has not changed.

When the PRD describes a new product surface not yet in the product pillar, add a stub entry to
`<docs.paths.productDir>/README.md` under the appropriate heading.

### Step 3 — Update architecture topic docs and domain references

For each domain reference and topic doc named in the design's Canonical impact section and story
breadcrumbs:

#### Domain references (`<docs.paths.domainsDir>/<domain>.md`)

Update when the shipped track changes:

- The **Public API** section (new or removed exports, changed signatures).
- An **Invariants** entry (new, relaxed, or strengthened).
- A **Gotchas** entry (newly discovered or resolved).
- The **Purpose** section (boundary change: what the domain now owns or explicitly does not own).

If a domain reference does not exist yet and the track creates a new domain, create the file from
the domain reference template. Resolve the template from `<docs.templatesDir>/domain-reference.md`,
then the kit built-in at `${CLAUDE_PLUGIN_ROOT}/references/templates/domain-reference-template.md`.

Update `last-reviewed` on every domain reference touched.

#### Architecture topic docs (`<docs.paths.architectureDir>/<topic>.md`)

Update when the track introduces a new architectural rule, changes an existing rule, or changes the
system overview. Common files: `guidelines.md`, `system-overview.md`. Keep updates minimal: add the
new rule, extend the relevant section, or update the affected heading. Do not restructure unrelated
sections.

### Step 4 — Mint ADRs for real decisions

For each real decision identified in the design's Canonical impact section or the story breadcrumbs,
decide whether it meets the ADR bar: a decision is worth an ADR when it fixes a significant
architectural constraint, changes an invariant that other docs or teams depend on, or rejects a
plausible alternative that might otherwise be attempted again.

For each qualifying decision:

1. Determine the next sequence number by reading all existing ADR files under
   `<docs.paths.decisionsDir>/` and taking `max(existing numbers) + 1`, zero-padded to four digits.
   If the directory is absent or empty, start at `0001`.
2. Write the ADR file at `<docs.paths.decisionsDir>/NNNN-<kebab-title>.md` using the ADR template.
   Resolve the template from `<docs.templatesDir>/adr.md`, then the kit built-in at
   `${CLAUDE_PLUGIN_ROOT}/references/templates/adr-template.md`.
3. Set `status: proposed`. The human reviewer promotes to `accepted`.
4. Populate all required sections: Context, Decision, Consequences (positive/negative/neutral),
   Alternatives considered, Related.

Once a number is assigned — even at `proposed` — it is reserved and must not be reassigned. If you
discover mid-promotion that a decision does not clear the bar, abandon the draft rather than
publishing a weak ADR.

### Step 5 — Flip the PRD to `shipped`

In `<docs.paths.prdsDir>/<slug>/README.md`, update the frontmatter `status` to `shipped`. Update
the **Status and next steps** section to reference the terminal promote story and the date of
promotion. Do not alter acceptance-criteria content or other section files.

### Step 6 — Archive the design doc

In `<docs.paths.designsDir>/<slug>.md`, flip the frontmatter `status` to `archived`. Add a short
note in the document (or existing **Status and next steps** section) pointing to the minted ADRs and
updated domain references that carry the durable content forward.

If the design doc does not exist (no complex technical work was needed for this track), skip this
step and note the skip.

### Step 7 — Refresh pillar indexes

Update the following index files to reflect the canonical state after promotion:

- `<docs.paths.architectureDir>/README.md` — add or update rows for any new or changed topic docs,
  domain references, and ADRs. Do not restructure unrelated rows.
- `<docs.paths.productDir>/README.md` — update the product surface list or PRD status entry for
  the shipped product.
- `docs/README.md` (master index) — update the "recent canonical changes" entry if the standard
  or index includes one.

If an index file does not exist, create a minimal stub with the required frontmatter and an H1
heading before adding the row.

### Step 8 — Mark the promote story complete

Re-read the tracker README. The promote story row should be `statuses.inProgress` owned by this
session (claimed in Step 1). Set the terminal promote story row's Status to the first value in
`statuses.complete` (default `done`). Update `last-reviewed` on the tracker README frontmatter.
The promote story lifecycle is `eligible → implementing → done`, identical to every other story.

```bash
git add <tracker README>
git commit -m "chore(<promote-story-id>): mark promote story done"
```

The track is now complete. A human reviewer who is satisfied with the minted ADRs may advance each
ADR's `status` to `accepted` separately; that step is outside the skill's scope.

### Step 9 — Summarize and hand off

Report:

- Files created or updated (with action type).
- ADRs minted (number, title, status `proposed`).
- Domain references updated.
- PRD flipped to `shipped`.
- Design doc archived (or skipped with reason).
- Tracker promote story marked done.
- Any warnings (missing design doc, missing breadcrumbs, fallback to kit templates, etc.).
- Next manual step: human review of minted ADRs and promotion to `accepted`.

Do not auto-commit canonical doc changes in a single bulk commit unless the repo policy in
`.workflow/config.yaml` explicitly permits it. Prefer one logical commit per output type (one for
docs updates, one for ADRs, one for PRD/design-doc status flips, one for tracker close-out) so the
history is reviewable.

## Lean-preset repos

Lean-preset repos (`docs.preset: lean`) do not pre-scaffold `decisions/` or `domains/` directories.
`promote-to-canonical` creates them on demand when a real ADR or domain change occurs during
promotion, and always respects `docs.types.*.enabled` flags before creating or updating those doc
types.

## Hard rules

- Never overwrite a file whose content has not changed. Idempotency matters: if the skill is re-run
  after a partial failure it must pick up cleanly from where it left off.
- Never alter ADR content once `status: accepted`. Only a superseding ADR changes an accepted record.
- ADR sequence numbers are immutable once assigned. If a draft is abandoned, leave the number
  reserved (mark it with a note in Context rather than deleting it).
- The authoring standard (`docs.style`) and templates are read from the repo's own copies at
  runtime. Never hardcode the standard's rules or templates into skill logic.
- If the design doc's Canonical impact section lists a doc that does not exist, create it rather
  than skipping it silently.
- Stop and report clearly if the tracker is not promotion-ready (any implementation story incomplete).
- Do not write implementation code, implementation plans, or tracker rows for future stories. This
  skill's scope is confined to canonical doc synthesis.

## Anti-patterns

- Running promote-to-canonical before all implementation stories are `done` or `verified`.
- Promoting per story or per wave (correct cadence: per track — one promote per ship event).
- Hardcoding canonical doc paths or the authoring standard rules.
- Minting ADRs for obvious or locally-scoped implementation choices.
- Modifying accepted ADRs in place instead of superseding them.
- Skipping the design doc archive step.
- Leaving the pillar indexes stale after canonical changes.
- Treating the promote story as optional or deferrable.
