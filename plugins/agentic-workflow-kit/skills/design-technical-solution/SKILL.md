---
name: design-technical-solution
description: "Use before delivery-track planning when product or design context has meaningful technical complexity: new modules, data/query changes, AI prompts/tools/triggers, observability, migrations/deploy surfaces, security boundaries, or multi-system integration. Can start from a PRD, existing design docs, technical notes, or session context when enough scope exists. Writes a high-level technical solution document for plan-delivery-track to consume. Ingests rich context first, shows the flow, asks only blocking questions, and records safe assumptions."
argument-hint: "[prd-slug or technical notes]"
arguments: prd_slug_or_notes
user-invocable: true
---

# design-technical-solution

Author the technical solution gate between product intent and delivery-track planning. This skill
defines the high-level technical "how" for complex product work before delivery stories are sliced
into lightweight briefs. It can start from a PRD, existing design docs, technical notes, or session context when the supplied material is enough to identify scope, requirements, and technical boundaries.

## References (read before acting)

- Technical solution contract: `${CLAUDE_PLUGIN_ROOT}/references/technical-solution-contract.md`
- Technical solution template: `${CLAUDE_PLUGIN_ROOT}/references/templates/technical-solution-template.md`
- PRD contract: `${CLAUDE_PLUGIN_ROOT}/references/prd-contract.md`
- Story brief contract: `${CLAUDE_PLUGIN_ROOT}/references/story-brief-contract.md`

## Step 0 - Show the flow

Before doing the work, show the user the exact flow:

```text
I will do: ingest PRD/context -> audit existing technical surfaces -> draft assumptions -> ask only blocking questions -> write technical solution -> self-review -> suggest /plan-delivery-track.
```

Then proceed unless a blocking decision is needed.

## Step 1 - Resolve PRD and solution location

- Read `.workflow/config.yaml` if present. Take:
  - `docs.paths.designsDir` (default `docs/architecture/designs`) as the primary output
    location for new technical designs.
  - `docs.paths.prdsDir` (default `docs/product/prds`; fall back to `paths.prdsDir` →
    `docs/prds` for legacy configs) to locate the source PRD.
  - `docs.style` (default `docs/docs-style.md`) as the repo-owned authoring standard.
- Locate the PRD at `<prdsDir>/<slug>/` when a PRD slug or path is supplied, and verify it
  conforms to `prd-contract.md`.
- If no conforming PRD exists but the user supplied explicit design docs, technical notes, or
  session context with enough product scope and acceptance outcomes, derive a short kebab-case
  `<slug>` from the product/work name or ask the user to confirm one before writing. Continue
  only after the slug is known, and record the source material as assumptions. If neither a
  PRD nor sufficient context exists, stop and point the user at `/define-product`.
- **Output location** — write the technical design at `<designsDir>/<slug>.md`. This is a
  staging doc (`status: draft` → `approved`) under the architecture pillar; it is archived
  after promotion to canonical.
- **Back-compat** — if `<prdsDir>/<slug>/technical-solution.md` already exists, read it as
  input and offer to migrate it to `<designsDir>/<slug>.md`. Never silently drop the old
  file; surface the migration as an explicit action for the user to confirm.
- If the target file at `<designsDir>/<slug>.md` already exists, switch to resume/extend
  mode. Never overwrite it without explicit confirmation.

## Step 2 - Ingest context before asking

Read the PRD, existing design docs, technical notes, session context, relevant repo docs, existing
solution/design docs, and source surfaces before interviewing. Summarize the material found and list
the assumptions it supports.

Ask only blocking questions: questions whose answer would materially change module boundaries,
data/query design, AI prompts/triggers/tools, migration/deploy surfaces, observability, security
boundaries, or test strategy. For safe defaults, record safe assumptions in the document instead of
interrupting the user.

Add an **Assumptions and blockers** pass: list safe assumptions first, then ask only questions that
block a coherent high-level technical solution. Add an **Artifact boundaries** pass: confirm the
technical solution owns high-level how, while tracker, story brief, detailed technical story spec,
implementation plan, and runtime artifacts own downstream detail and evidence.

## Step 3 - Draft the technical solution

Copy `${CLAUDE_PLUGIN_ROOT}/references/templates/technical-solution-template.md` and fill every
required section:

- Context and existing surfaces
- Technical requirements
- System architecture diagram
- Proposed modules/components
- Data/query design
- AI prompts/triggers/tools
- Observability/events/metrics
- Migration/deploy surfaces
- Testing strategy
- Open technical questions
- **Canonical impact** ← required new section (see below)
- Inputs for delivery tracker/story briefs

The technical solution must cite PRD acceptance-criteria IDs from `08-acceptance-criteria.md`. It
must include concrete inputs for `plan-delivery-track`: candidate story areas, sequencing
constraints, file contention, validation expectations, and technical solution headings that story
briefs should cite.
When there is no PRD, cite equivalent product outcomes from the supplied external context and mark
the PRD criteria column as context-derived until a PRD is created.

### Canonical impact section

The **Canonical impact** section enumerates every canonical doc this design will create or change
when it is promoted at track completion. It seeds the terminal promote story so the promote step
does not have to reconstruct intent from diffs alone.

For each item, state:

| Doc | Action | Notes |
|---|---|---|
| `<canonical doc path>` | `create` \| `update` \| `new-adr` \| `archive` | One-line description of the change |

Common entries:

- `architecture/guidelines.md` — update if the design introduces a new architectural rule.
- `architecture/domains/<domain>.md` — update invariants, public API, or gotchas; or `create`
  if this is a new domain.
- `architecture/decisions/NNNN-<slug>.md` — `new-adr` for each real, durable decision
  captured in this design.
- `product/<surface>.md` or `product/README.md` — update if product surfaces or status
  descriptions change.
- `<prdsDir>/<slug>/README.md` — flip `status` to `shipped` on promotion.
- `<designsDir>/<slug>.md` — `archive` (flip `status` to `archived`) on promotion.

If no canonical doc changes are expected, say so explicitly: "No canonical doc changes —
this design is self-contained and leaves no durable decisions." A missing or empty section
is a signal to `plan-delivery-track` to ask before accepting the design.

Conform the document to `docs.style` (repo-owned authoring standard): required frontmatter
(`title`, `status: draft`, `owner`, `last-reviewed`, `related`), one-line italic TL;DR
under the H1, and relative links. If `docs.style` is absent, apply the kit's built-in
standard.

## Step 4 - Self-review

Before writing, check:

- Every ship-blocker PRD acceptance criterion has a technical requirement or an explicit
  non-technical reason it does not need one.
- Migration/deploy, observability, testing, and data/query sections are present even when the
  answer is "not in scope."
- Open questions are truly blocking. Move implementer-resolvable questions into story-brief inputs.
- The document does not duplicate tracker status, owner, plan, PR fields, or detailed story-spec
  implementation decisions.
- The **Canonical impact** section is present and non-empty, or contains an explicit
  "no canonical changes" statement. An empty or absent section will prompt `plan-delivery-track`
  to ask for clarification before proceeding.

## Step 5 - Write and hand off

Write `<designsDir>/<slug>.md` (resolved from `docs.paths.designsDir`), list the file
written, and suggest `/plan-delivery-track` as the next step. `plan-delivery-track`
consumes this technical design plus the PRD; it owns tracker rows and lightweight story
briefs. Note the Canonical impact items in the summary so the planner can wire them into
the terminal promote story.

Do not auto-commit.

## Idempotency

Re-running is safe: detect an existing technical solution document, report missing or thin
sections, and offer to fill only those sections. Do not clobber an existing document without
confirmation.
