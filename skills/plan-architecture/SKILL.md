---
name: plan-architecture
description: "Use after a PRD exists and before tracker decomposition when product work has meaningful technical complexity: new modules, data/query changes, AI prompts/tools/triggers, observability, migrations/deploy surfaces, security boundaries, or multi-system integration. Writes a technical architecture document under the PRD directory for plan-track to consume. Ingests rich context first, shows the flow, asks only blocking questions, and records safe assumptions."
argument-hint: "[prd-slug or architecture notes]"
arguments: prd_slug_or_notes
user-invocable: true
---

# plan-architecture

Author the technical architecture gate between `plan-product` and `plan-track`. This skill defines
the high-level technical "how" for complex product work before delivery stories are sliced.

## References (read before acting)

- Technical architecture contract: `${CLAUDE_PLUGIN_ROOT}/references/technical-architecture-contract.md`
- Technical architecture template: `${CLAUDE_PLUGIN_ROOT}/references/templates/technical-architecture-template.md`
- PRD contract: `${CLAUDE_PLUGIN_ROOT}/references/prd-contract.md`
- Tracker contract: `${CLAUDE_PLUGIN_ROOT}/references/tracker-contract.md`

## Step 0 - Show the flow

Before doing the work, show the user the exact flow:

```text
I will do: ingest PRD/context -> audit existing technical surfaces -> draft assumptions -> ask only blocking questions -> write architecture -> self-review -> suggest /plan-track.
```

Then proceed unless a blocking decision is needed.

## Step 1 - Resolve PRD and architecture location

- Read `.workflow/config.yaml` if present and take `paths.prdsDir` (default `docs/prds`).
- Locate the PRD at `<prdsDir>/<slug>/` and verify it conforms to `prd-contract.md`.
- If no conforming PRD exists, stop and point the user at `/plan-product`.
- Write the architecture at `<prdsDir>/<slug>/architecture.md`.
- If that file already exists, switch to resume/extend mode. Never overwrite it without explicit
  confirmation.

## Step 2 - Ingest context before asking

Read the PRD, supplied notes, relevant repo docs, existing architecture docs, and source surfaces
before interviewing. Summarize the material found and list the assumptions it supports.

Ask only blocking questions: questions whose answer would materially change module boundaries,
data/query design, AI prompts/triggers/tools, migration/deploy surfaces, observability, security
boundaries, or test strategy. For safe defaults, record safe assumptions in the document instead of
interrupting the user.

## Step 3 - Draft the technical architecture

Copy `references/templates/technical-architecture-template.md` and fill every required section:

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
- Inputs for delivery tracker/per-story specs

The architecture must cite PRD acceptance-criteria IDs from `08-acceptance-criteria.md`. It must
include concrete inputs for `plan-track`, including candidate story areas, sequencing constraints,
file contention, validation gates, and architecture headings that per-story specs should cite.

## Step 4 - Self-review

Before writing, check:

- Every ship-blocker PRD acceptance criterion has a technical requirement or an explicit
  non-technical reason it does not need one.
- Migration/deploy, observability, testing, and data/query sections are present even when the
  answer is "not in scope."
- Open questions are truly blocking. Move pilot-resolvable questions into tracker/spec inputs.
- The document does not duplicate tracker status, owner, plan, or PR fields.

## Step 5 - Write and hand off

Write `<prdsDir>/<slug>/architecture.md`, list the file written, and suggest `/plan-track` as the
next step. `plan-track` consumes this architecture plus the PRD; it owns tracker rows and per-story
specs.

Do not auto-commit.

## Idempotency

Re-running is safe: detect an existing architecture doc, report missing or thin sections, and offer
to fill only those sections. Do not clobber an existing document without confirmation.
