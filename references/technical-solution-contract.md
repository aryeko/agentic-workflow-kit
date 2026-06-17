# Technical solution contract

A technical solution document defines the high-level technical "how" for complex product work before
a delivery tracker is sliced. It is usually authored from a PRD, but may also start from a PRD, existing design docs, technical notes, or session context when the supplied material is sufficient to
identify scope, requirements, and technical boundaries. It is authored by
`design-technical-solution` and consumed by `plan-delivery-track`.

Responsibilities stay distinct:

- PRD owns what/why: product goals, phases, roles, success metrics, and acceptance criteria.
- technical solution owns high-level how: system shape, module boundaries, data/query design,
  AI/tooling surfaces, observability, migration/deploy surfaces, and testing strategy.
- delivery tracker owns delivery slicing: story IDs, dependencies, status, ownership, plans, and PRs.
- story brief is not implementation-ready; it names story boundaries and inputs for the detailed spec.
- detailed technical story spec owns exact implementation design for one story.
- implementation plan owns execution steps after the detailed spec is ready.

`plan-delivery-track` must pause for complex technical product work when this document is missing.
Simple features may go from PRD directly to tracker, but complex work needs this gate so story
briefs do not invent high-level design one story at a time.

## Location

Default path:

```text
<designsDir>/<slug>.md
```

`<designsDir>` resolves from `docs.paths.designsDir` in `.workflow/config.yaml`, defaulting to
`docs/architecture/designs`. This is a staging area under the architecture pillar: the document
carries a tracked `status` (`draft` → `approved` → `archived`) and is archived after promotion
to canonical at track completion.

**Back-compat:** the legacy location `<prdsDir>/<slug>/technical-solution.md` (where `<prdsDir>`
resolves from `paths.prdsDir`, default `docs/prds`) remains readable. When `design-technical-solution`
detects an existing file at the legacy path, it reads it as input and surfaces a migration action
(write to `<designsDir>/<slug>.md`, confirm before proceeding). Downstream consumers
(`plan-delivery-track`) should check both locations when the design is not found at the primary path.

## When a technical solution is required

Require this artifact before `plan-delivery-track` when the PRD implies one or more of these
surfaces:

- new backend modules, shared services, or cross-module contracts
- database schema, query, migration, or retention changes
- AI prompts, triggers, tools, retrieval, model routing, or evaluation surfaces
- observability events, metrics, alerts, runbooks, or analytics instrumentation
- deploy, rollout, migration, feature-flag, or data-backfill surfaces
- security, privacy, permission, or compliance boundaries
- integration across multiple systems, teams, packages, or runtimes
- more than one implementation story where technical choices affect sequencing

If no signal applies, `plan-delivery-track` may proceed and note why the technical solution was not
required.

## Frontmatter

```yaml
title: <Product name> technical solution
status: approved        # draft | approved | shipped | archived
owner: <name or "—">
last-reviewed: <YYYY-MM-DD>
related:
  - <path to PRD README>
```

Use `draft` while blocking questions remain. Use `approved` before `plan-delivery-track` consumes
the document. `plan-delivery-track` will not accept a design with `status: draft` without explicit
confirmation. The promote step flips `status` to `archived` after canonical promotion completes.

## Required sections

### Context and existing surfaces

Summarize the relevant PRD scope, acceptance-criteria IDs, current architecture, affected files,
existing docs, safe assumptions, and constraints discovered during repo audit.

### Technical requirements

Translate PRD acceptance criteria into technical requirements. Keep every requirement observable
and traceable to one or more PRD acceptance-criteria IDs.

### System architecture diagram

Include a Mermaid diagram for the proposed system shape. The diagram should show major modules,
data flow, external systems, AI/tool surfaces when relevant, and important control-flow triggers.

### Proposed modules/components

List each proposed module, component, package, service, route, worker, command, or shared helper.
For each, state responsibility, inputs, outputs, ownership boundary, and dependencies.

### Data/query design

Describe schemas, migrations, query patterns, indexes, caches, retention, consistency model, and
backfill/sync behavior. If no data change exists, say so explicitly.

### AI prompts/triggers/tools

Describe prompts, prompt variables, retrieval context, model/tool calls, trigger points, safety
checks, evaluation hooks, and fallback behavior. If AI is not in scope, say so explicitly.

### Observability/events/metrics

Define events, metrics, logs, traces, dashboards, alerts, audit trails, and success/failure signals
needed to operate the feature.

### Migration/deploy surfaces

Describe rollout sequencing, feature flags, migrations, data backfills, compatibility windows,
deployment ordering, rollback, and cleanup.

### Testing strategy

Map requirements to unit, integration, E2E, smoke, migration, contract, prompt/eval, and manual
checks. Name repo-configured verification commands when known.

### Open technical questions

List only genuinely blocking questions. Include a recommended default when one is safe. Questions
that can be resolved during detailed story-spec work should become story-brief inputs instead of
blocking solution approval.

### Assumptions

List safe assumptions carried from the PRD, existing design docs, technical notes, or session
context. Assumptions must be specific enough for `plan-delivery-track` to preserve or challenge
them in story briefs.

### Canonical impact

Enumerate every canonical doc this design will create or change when it is promoted at track
completion. This list is read by the terminal promote story (`promote-to-canonical`) so promotion
does not have to reconstruct intent from the merged diff alone.

For each item, provide the canonical doc path, the action (`create`, `update`, `new-adr`, or
`archive`), and a one-line description of the change. Common entries:

- `architecture/guidelines.md` — update when the design introduces a new architectural rule.
- `architecture/domains/<domain>.md` — update invariants, public API, or gotchas; or `create`
  if this is a new domain.
- `architecture/decisions/NNNN-<slug>.md` — `new-adr` for each real, durable decision
  captured in this design.
- `product/<surface>.md` or `product/README.md` — update if product surfaces or status change.
- `<prdsDir>/<slug>/README.md` — flip `status` to `shipped` on promotion.
- `<designsDir>/<slug>.md` — `archive` (flip `status` to `archived`) on promotion.

If no canonical doc changes are expected, state that explicitly. An empty or absent section
signals to `plan-delivery-track` to ask for clarification before accepting the design.

### Inputs for delivery tracker/story briefs

Provide the delivery planner with concrete story brief inputs:

- recommended foundation, pilot, rollout, polish, and cleanup story candidates
- file contention and sequencing constraints
- required PRD acceptance-criteria IDs per story area
- technical solution section IDs or headings each story brief must cite
- validation expectations that downstream detailed story specs should inherit

## Conventions

- Ask only blocking questions before writing; record safe assumptions in the document.
- Keep **Blocking technical questions** distinct from safe assumptions and non-blocking follow-ups.
- Prefer repo-local docs and source over memory.
- Use headings that future story briefs can cite directly.
- Do not duplicate the tracker status matrix or story ownership.
- Do not bury migration, observability, or testing in prose without named sections.
