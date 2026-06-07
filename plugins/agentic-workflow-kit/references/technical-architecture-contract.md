# Technical architecture contract

A technical architecture document defines the high-level technical "how" for complex product
work after a PRD exists and before a delivery tracker is sliced. It is authored by the
`plan-architecture` skill and consumed by `plan-track`.

Responsibilities stay distinct:

- PRD owns what/why: product goals, phases, roles, success metrics, and acceptance criteria.
- architecture owns high-level how: system shape, module boundaries, data/query design, AI/tooling
  surfaces, observability, migration/deploy surfaces, and testing strategy.
- tracker owns delivery slicing: story IDs, dependencies, status, ownership, plans, and PRs.

`plan-track` must pause for complex technical product work when this document is missing. Simple
features may go from PRD directly to tracker, but complex work needs this gate so story specs do
not invent architecture one story at a time.

## Location

Default path:

```text
<prdsDir>/<slug>/architecture.md
```

`<prdsDir>` resolves from `paths.prdsDir` in `.workflow/config.yaml`, defaulting to `docs/prds`.

## When architecture is required

Require this artifact before `plan-track` when the PRD implies one or more of these surfaces:

- new backend modules, shared services, or cross-module contracts
- database schema, query, migration, or retention changes
- AI prompts, triggers, tools, retrieval, model routing, or evaluation surfaces
- observability events, metrics, alerts, runbooks, or analytics instrumentation
- deploy, rollout, migration, feature-flag, or data-backfill surfaces
- security, privacy, permission, or compliance boundaries
- integration across multiple systems, teams, packages, or runtimes
- more than one implementation story where architecture choices affect sequencing

If no signal applies, `plan-track` may proceed and note why architecture was not required.

## Frontmatter

```yaml
title: <Product name> technical architecture
status: approved        # draft | approved | archived
owner: <name or "—">
last-reviewed: <YYYY-MM-DD>
related:
  - <path to PRD README>
```

Use `approved` before `plan-track` consumes the document. Use `draft` while questions are still
blocking. Use `archived` only when the PRD is superseded or retired.

## Required sections

### Context and existing surfaces

Summarize the relevant PRD scope, acceptance-criteria IDs, current architecture, affected files,
existing docs, and constraints discovered during repo audit.

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
that can be resolved during a pilot story should become tracker/spec inputs instead of blocking
architecture approval.

### Inputs for delivery tracker/per-story specs

Provide the delivery planner with concrete story/spec inputs:

- recommended foundation, pilot, rollout, polish, and cleanup story candidates
- file contention and sequencing constraints
- required PRD acceptance-criteria IDs per story area
- architecture section IDs or headings each story must cite
- validation gates that every downstream spec should inherit

## Conventions

- Ask only blocking questions before writing; record safe assumptions in the document.
- Prefer repo-local docs and source over memory.
- Use headings that future story specs can cite directly.
- Do not duplicate the tracker status matrix or story ownership.
- Do not bury migration, observability, or testing in prose without named sections.
