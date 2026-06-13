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

- Read `.workflow/config.yaml` if present and take `paths.prdsDir` (default `docs/prds`).
  `define-product` works even before `/workflow-init` — the default applies.
- Agree a short kebab-case `<slug>` with the user.
- If `<prdsDir>/<slug>/` already exists, switch to resume/extend mode (see Idempotency).

## Step 2 — Ingest existing material

If the user has notes, brainstorming output, existing docs, a brief, a partial PRD, design docs,
session context, or relevant code, read them first. Summarize what was found and which PRD sections
it pre-fills. Only interview on the gaps.

## Step 3 — Draft with a context-rich fast path

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

## Step 4 — Write the PRD

Write `<prdsDir>/<slug>/` from the bundled templates, filling placeholders. Conform to
`prd-contract.md`: README index with a document map and the PRD-vs-technical-design boundary
note, back-link headers and navigation footers per section, relative cross-links, and
frontmatter `status` from the PRD vocabulary (`draft | approved | shipped | archived`). Do not
use the story-level status vocabulary here.
Record assumptions and blocking questions in `09-risks-and-open-questions.md`.

## Step 5 — Summarize and hand off

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
