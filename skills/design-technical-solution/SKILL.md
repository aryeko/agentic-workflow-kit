---
name: design-technical-solution
description: "Use after a PRD exists and before delivery-track planning when product work has meaningful technical complexity: new modules, data/query changes, AI prompts/tools/triggers, observability, migrations/deploy surfaces, security boundaries, or multi-system integration. Writes a high-level technical solution document under the PRD directory for plan-delivery-track to consume. Ingests rich context first, shows the flow, asks only blocking questions, and records safe assumptions."
argument-hint: "[prd-slug or technical notes]"
arguments: prd_slug_or_notes
user-invocable: true
---

# design-technical-solution

Author the technical solution gate between `define-product` and `plan-delivery-track`. This skill
defines the high-level technical "how" for complex product work before delivery stories are sliced
into lightweight briefs.

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

- Read `.workflow/config.yaml` if present and take `paths.prdsDir` (default `docs/prds`).
- Locate the PRD at `<prdsDir>/<slug>/` and verify it conforms to `prd-contract.md`.
- If no conforming PRD exists, stop and point the user at `/define-product`.
- Write the technical solution at `<prdsDir>/<slug>/technical-solution.md`.
- If that file already exists, switch to resume/extend mode. Never overwrite it without explicit
  confirmation.

## Step 2 - Ingest context before asking

Read the PRD, supplied notes, relevant repo docs, existing solution/design docs, and source
surfaces before interviewing. Summarize the material found and list the assumptions it supports.

Ask only blocking questions: questions whose answer would materially change module boundaries,
data/query design, AI prompts/triggers/tools, migration/deploy surfaces, observability, security
boundaries, or test strategy. For safe defaults, record safe assumptions in the document instead of
interrupting the user.

## Step 3 - Draft the technical solution

Copy `references/templates/technical-solution-template.md` and fill every required section:

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
- Inputs for delivery tracker/story briefs

The technical solution must cite PRD acceptance-criteria IDs from `08-acceptance-criteria.md`. It
must include concrete inputs for `plan-delivery-track`: candidate story areas, sequencing
constraints, file contention, validation expectations, and technical solution headings that story
briefs should cite.

## Step 4 - Self-review

Before writing, check:

- Every ship-blocker PRD acceptance criterion has a technical requirement or an explicit
  non-technical reason it does not need one.
- Migration/deploy, observability, testing, and data/query sections are present even when the
  answer is "not in scope."
- Open questions are truly blocking. Move implementer-resolvable questions into story-brief inputs.
- The document does not duplicate tracker status, owner, plan, PR fields, or detailed story-spec
  implementation decisions.

## Step 5 - Write and hand off

Write `<prdsDir>/<slug>/technical-solution.md`, list the file written, and suggest `/plan-delivery-track`
as the next step. `plan-delivery-track` consumes this technical solution plus
the PRD; it owns tracker rows and lightweight story briefs.

Do not auto-commit.

## Idempotency

Re-running is safe: detect an existing technical solution document, report missing or thin
sections, and offer to fill only those sections. Do not clobber an existing document without
confirmation.
