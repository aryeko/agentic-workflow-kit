---
title: <ID> detailed technical story spec
owner: <name or "—">
last-reviewed: <YYYY-MM-DD>
related:
  - <path to tracker README>
  - <path to story brief or legacy spec source>
  - <path to PRD README>
  - <path to technical solution, if present>
---

# <ID> detailed technical story spec

## Source story brief

<Path to story brief, or note that this is a backward-compatible legacy detailed spec.>

## Decisions resolved from the story brief

| Question | Decision | Rationale |
| --- | --- | --- |
| <question> | <decision> | <why this is safe> |

## Exact types/contracts

Define exact exported types, interfaces, API contracts, props, payloads, status values, or command
contracts.

## Exact files/modules

```text
<path>  <exact responsibility/change>
```

## Query/schema/prompt/event/component design

Describe exact query, schema, prompt, event, component, route, worker, or command behavior.

## Tests

List exact test files, scenarios, fixtures, and focused commands.

## Migration/deploy concerns

List migrations, backfills, feature flags, rollout order, rollback, and deploy compatibility.

## Blocking technical questions

This section must say `None` before an implementation plan or code may be written.
