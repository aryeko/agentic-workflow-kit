---
name: define-product
description: 'Use when a user wants to define a product before technical planning — when they say "write a PRD", "spec the product", "define-product", "define the product requirements", "what are we building and why", or run /define-product. Writes a multi-file PRD under docs/prds/<slug>/ with ID acceptance criteria. Ingests rich context first, shows the flow, drafts from supplied material, asks only blocking questions, records safe assumptions, and recommends the next step: plan-delivery-track for simple features, design-technical-solution for complex technical work, UX/content pass for UI-heavy work, or validation/research for research-heavy work. Idempotent: never clobbers an existing PRD without confirmation.'
argument-hint: "[slug or notes]"
arguments: slug_or_notes
user-invocable: true
---

# define-product

Author a product requirements document (PRD) before technical planning. The PRD defines the
product: the what and why. It can start from notes, brainstorming output, existing docs, or session context; no upstream kit artifact is required. Technical how is decided downstream by
`design-technical-solution` for complex technical work, or by `plan-delivery-track` directly for
simple product work.

## References (read before acting)

- PRD contract (canonical format): `${CLAUDE_PLUGIN_ROOT}/references/prd-contract.md`
- Section templates: `${CLAUDE_PLUGIN_ROOT}/references/templates/prd/` (README.md + 01..10)
- Worked example: `${CLAUDE_PLUGIN_ROOT}/examples/example-prd/`
- Technical solution contract: `${CLAUDE_PLUGIN_ROOT}/references/technical-solution-contract.md`

## Step 0 - Show the flow

Before drafting, show the assumed flow:

```text
I will do: ingest context -> draft assumptions -> ask only blocking questions -> write PRD -> self-review -> suggest next step.
```

Then proceed unless a blocking decision is needed.

## Step 1 — Resolve location and detect

- Read `.workflow/config.yaml` if present. Take:
  - `docs.paths.prdsDir` (default `docs/product/prds`) as the PRD output directory.
    Fall back to `paths.prdsDir` (legacy key, default `docs/prds`) when `docs.paths.prdsDir`
    is absent. `define-product` works even before `/workflow-init` — the default applies.
  - `docs.paths.productDir` (default `docs/product`) as the product pillar root.
  - `docs.style` (default `docs/docs-style.md`) as the repo-owned authoring standard.
- Agree a short kebab-case `<slug>` with the user.
- If `<prdsDir>/<slug>/` already exists, switch to resume/extend mode (see Idempotency).

## Step 2 — Read canonical docs as context

Before drafting, read the current canonical docs to understand what is already known. This
grounds the PRD in accurate, current canon rather than re-deriving product facts from scratch:

- Read `<productDir>/README.md` (product pillar index) if it exists — surfaces, current
  state, positioning.
- Read any existing canonical PRDs under `<prdsDir>/` that are related to this initiative —
  a related or predecessor PRD may pre-fill background, goals, and constraints.
- Read `<architectureDir>/README.md` and `<architectureDir>/guidelines.md` (architecture
  pillar index and guidelines) if they exist — architecture constraints, conventions, and
  the current technical lay of the land that the PRD must respect.
- Read `docs.style` (the repo-owned authoring standard) if it exists; the PRD must conform
  to its frontmatter requirements and status vocabulary.

Summarize what canonical context was found and note which PRD sections it pre-fills or
constrains. Skip this step gracefully when the docs do not yet exist.

## Step 3 — Ingest user-supplied material

If the user has notes, brainstorming output, a brief, a partial PRD, design docs, session
context, or relevant code, read them. Summarize what was found and which PRD sections it
pre-fills. Only interview on the gaps.

## Step 4 — Draft with a context-rich fast path

When the user has provided rich context, use a context-rich fast path:

- Draft all clearly supported PRD sections from the supplied material before asking questions.
- Show the assumed flow and the assumptions you are carrying.
- Ask only blocking questions: questions whose answer would materially change product scope,
  acceptance criteria, roles, phases, success metrics, or launch risk.
- For safe defaults, record safe assumptions instead of interrupting.
- Avoid section-by-section questioning unless the supplied context is thin or contradictory.
- Add an **Assumptions and blockers** pass before writing: list assumptions the PRD will carry, then
  ask only questions that block a coherent PRD.
- Add an **Artifact boundaries** pass: confirm the PRD owns what/why, while technical solution,
  tracker, story brief, detailed technical story spec, implementation plan, and runtime artifacts
  own their downstream responsibilities.

When context is thin, use the guided interview path: walk the contract's section order, asking
focused questions one at a time. Confirm which optional sections apply (`02-principles`,
`03-domain-model` are skippable for small products; `README`, `01-context`,
`08-acceptance-criteria` are always required). Draft each section, show it, get approval, then move
on.

For `08-acceptance-criteria`: group criteria by theme, give each group a short PREFIX, number
criteria `PREFIX-n`, and tag every criterion `[ship blocker]` or `[target]`. These IDs are
what `plan-delivery-track` maps stories to — keep each criterion observable and testable.

## Step 5 — Write the PRD

Write `<prdsDir>/<slug>/` from the bundled templates, filling placeholders. Conform to
`prd-contract.md`: README index with a document map and the PRD-vs-technical-design boundary
note, back-link headers and navigation footers per section, relative cross-links, and
frontmatter `status` from the PRD vocabulary (`draft | approved | shipped | archived`). Do not
use the story-level status vocabulary here. Conform to `docs.style` (the repo-owned authoring
standard) — required frontmatter, one-line TL;DR under the H1, sentence-case headings, and
relative links. If `docs.style` is absent, apply the kit's built-in standard.
Record assumptions and blocking questions in `09-risks-and-open-questions.md`.

After writing, **register the new PRD in the product pillar index** at
`<productDir>/README.md`:

- If the pillar index exists, add a row for the new PRD to the requirements or PRDs table
  (or create that table if absent). Format: `[<slug>](<relative link to slug/README.md>)`
  with the PRD's short title and current status.
- If the pillar index does not exist, note in the summary that it should be created by
  `/workflow-init` and the PRD should be registered once it exists. Do not create the
  pillar index here — that is `workflow-init`'s responsibility.

## Step 6 — Summarize and hand off

Print the files written and the slug, then recommend exactly one next step:

- simple feature -> `plan-delivery-track`
- technical feature -> `design-technical-solution`
- UI-heavy feature -> UX/content pass or `design-technical-solution`, depending on scope
- research-heavy feature -> validation/research first

Use `design-technical-solution` when the PRD implies new backend modules, data/query changes, AI
prompts/triggers/tools, observability, migration/deploy surfaces, security boundaries, or
multi-system integration. Otherwise, use `plan-delivery-track` to decompose the PRD into a tracker.

Do not auto-commit.

## Idempotency

Re-running is safe: detect an existing PRD, report which contract sections are missing or
thin, and offer to fill only those. Never overwrite an existing PRD or section without explicit
user confirmation.
