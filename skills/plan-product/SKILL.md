---
name: plan-product
description: 'Use when a user wants to define a product before any technical work — when they say "write a PRD", "spec the product", "plan-product", "define the product requirements", "what are we building and why", or run /plan-product. Runs a guided, section-by-section interview and writes a multi-file PRD under docs/prds/<slug>/ with ID acceptance criteria. Ingests existing notes first and asks only about gaps. It defines WHAT/WHY; it does NOT do technical decomposition — hand off to plan-track for that. Idempotent: never clobbers an existing PRD without confirmation.'
argument-hint: "[slug or notes]"
arguments: slug_or_notes
user-invocable: true
---

# plan-product

Author a product requirements document (PRD) through a guided interview, before any technical
decomposition. The PRD defines the product — the *what* and *why*. Technical *how* is decided
downstream by `plan-track`, which consumes this PRD's acceptance criteria.

## References (read before acting)

- PRD contract (canonical format): `${CLAUDE_PLUGIN_ROOT}/references/prd-contract.md`
- Section templates: `${CLAUDE_PLUGIN_ROOT}/references/templates/prd/` (README.md + 01..10)
- Worked example: `${CLAUDE_PLUGIN_ROOT}/examples/example-prd/`

## Step 1 — Resolve location and detect

- Read `.workflow/config.yaml` if present and take `paths.prdsDir` (default `docs/prds`).
  `plan-product` works even before `/workflow-init` — the default applies.
- Agree a short kebab-case `<slug>` with the user.
- If `<prdsDir>/<slug>/` already exists, switch to resume/extend mode (see Idempotency).

## Step 2 — Ingest existing material

If the user has notes, a brief, a partial PRD, design docs, or relevant code, read them first.
Summarize what was found and which PRD sections it pre-fills. Only interview on the gaps.

## Step 3 — Interview section by section

Walk the contract's section order, asking focused questions one at a time. Confirm which
optional sections apply (`02-principles`, `03-domain-model` are skippable for small products;
`README`, `01-context`, `08-acceptance-criteria` are always required). Draft each section,
show it, get approval, then move on.

For `08-acceptance-criteria`: group criteria by theme, give each group a short PREFIX, number
criteria `PREFIX-n`, and tag every criterion `[ship blocker]` or `[target]`. These IDs are
what `plan-track` maps stories to — keep each criterion observable and testable.

## Step 4 — Write the PRD

Write `<prdsDir>/<slug>/` from the bundled templates, filling placeholders. Conform to
`prd-contract.md`: README index with a document map and the PRD-vs-technical-design boundary
note, back-link headers and navigation footers per section, relative cross-links, and
frontmatter `status` from the PRD vocabulary (`draft | approved | shipped | archived`). Do not
use the story-level status vocabulary here.

## Step 5 — Summarize and hand off

Print the files written and the slug, then point at the next step: run `/plan-track` to
decompose this PRD into a tracker. Do not auto-commit (leave writes for the user). Do not
invoke technical-design or planning skills — that crosses into `plan-track`'s job.

## Idempotency

Re-running is safe: detect an existing PRD, report which contract sections are missing or
thin, and offer to fill only those. Never overwrite an existing PRD or section without explicit
user confirmation.
