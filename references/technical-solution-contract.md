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
<prdsDir>/<slug>/technical-solution.md
```

`<prdsDir>` resolves from `paths.prdsDir` in `.workflow/config.yaml`, defaulting to `docs/prds`.

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
status: approved        # draft | approved | archived
owner: <name or "—">
last-reviewed: <YYYY-MM-DD>
related:
  - <path to PRD README>
```

Use `approved` before `plan-delivery-track` consumes the document. Use `draft` while questions are
still blocking.

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
