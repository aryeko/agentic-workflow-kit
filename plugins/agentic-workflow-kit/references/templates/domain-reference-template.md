---
title: <Domain name> domain
status: draft
owner: <owner>
last-reviewed: <YYYY-MM-DD>
related:
  - <relative path to architecture guidelines>
  - <relative path to related domain references>
  - <relative path to the product PRD that governs this domain>
  - <relative path to the active delivery tracker for this domain>
---

# <Domain name> domain

_<One italic sentence: what this domain owns and the surface or capability it delivers.>_

## Purpose

<Two to four paragraphs describing the bounded context. Answer three questions:>

1. **What does this domain own?** List the entities, tables, or modules that live here. Name the surfaces or features it is responsible for.
2. **What does it read from but not own?** Name the external sources (other domains, external APIs, config) it depends on for input data.
3. **What does it explicitly not own?** Name the adjacent concerns that might seem related but belong elsewhere. Being explicit here prevents scope creep and resolves future disputes before they happen.

## Public API

<Describe the externally callable surface of this domain: the service functions, exported types, or public module entry points other domains may import. Link to the source barrel file rather than listing every export — the code is authoritative and a copied export list will drift.>

The canonical barrel is [`<path to index.ts or equivalent>`](<relative link to source file>). Import from it; do not import from domain internals.

Exports group by behavior:

- **<Group A>:** `functionA`, `functionB`, `functionC`
- **<Group B>:** `functionD`, `functionE`

<If the domain has important internal contracts — repo interfaces, key types, or sub-module boundaries — describe them here.>

## Invariants

_Invariants are rules that the domain enforces unconditionally. A violation is always a bug, never a valid state._

- <Every query or write to a multi-tenant table includes the `<tenantId>` scope. Omitting it is always a bug.>
- <`<EntityId>` means `<canonical table>.id` — do not substitute a different identity column.>
- <State transitions follow `<A>` → `<B>` → `<C>`. The domain rejects skipped transitions.>
- <`<Field>` is stored as `<representation>` (e.g. integer minor units). Float arithmetic is never applied.>

<Add the invariants specific to this domain. Be precise: vague invariants ("things are always consistent") give no guidance. A good invariant is falsifiable: you can write a test that detects a violation.>

## Gotchas

_Gotchas are non-obvious behaviors, naming confusions, and sharp edges that have caused or could cause bugs. Document them once here so they are not rediscovered by each contributor._

- **<Naming confusion>:** `<OldName>` in routes and helpers is a compatibility name that carries `<NewEntity>.id`, not `<OtherEntity>.id`. Treat it as a compatibility name; rename on next touch.
- **<State side effect>:** Writing to `<TableA>` must be preceded by a read of `<TableB>` to enforce `<constraint>` — the constraint is not enforced at the database layer.
- **<Scoping hazard>:** The `<helperFunction>` returns results for all tenants if `<condition>`. Always pass `<tenantId>` explicitly.
- **<Legacy pattern>:** `<OldPattern>` was removed in `<initiative>`. If you encounter it in old code, replace it with `<NewPattern>` on next touch.

## Related code

- `<source/domain/path>/` — services, repos, types, schemas
- `<source/db/schema/domain>/` — database tables and constraints
- `<source/app/surface/**>` — primary UI route surface
- `<source/adapters/domain>/` — external-provider adapter(s)

## Related docs

- `<relative link to architecture guidelines or layering doc>`
- `<relative link to related domain reference(s)>`
- `<relative link to product PRD governing this domain>`
- `<relative link to the active delivery tracker>`
