# Domain reference contract

A domain reference is the standing architecture document for a bounded context. It records what a domain owns, its public API, the invariants it unconditionally enforces, and the non-obvious gotchas that have caused or could cause bugs. Domain references are canonical, maintained perpetually, and updated by the `promote-to-canonical` skill whenever a shipped track changes a domain's contracts, invariants, or public surface.

Domain references live in the configured domains directory (default `architecture/domains/`), one file per domain. This file is the canonical format contract; it is the domain-reference analog of `prd-contract.md`.

## Filename convention

```
<domain-name>.md
```

- Kebab-case, matching the domain's source folder name (e.g. `training.md` for `src/lib/domains/training/`).
- One file per domain. Do not split a domain reference into multiple files.

## Required sections

The section order is fixed. Sections may be expanded with sub-sections but not reordered or omitted. See `references/templates/domain-reference-template.md` for the full template.

| Section | Required | Purpose |
|---|---|---|
| Frontmatter | Yes | `title`, `status`, `owner`, `last-reviewed`, `related` |
| H1 | Yes | `<Domain name> domain` — matches frontmatter `title` exactly |
| TL;DR | Yes | One italic sentence: what the domain owns and the surface it serves |
| Purpose | Yes | What the domain owns, reads from, and explicitly does not own |
| Public API | Yes | Externally callable surface; links to the source barrel |
| Invariants | Yes | Unconditionally enforced rules; each is falsifiable |
| Gotchas | Yes | Non-obvious behaviors, naming confusions, and sharp edges |
| Related code | Yes | Source paths for services, repos, schemas, routes, adapters |
| Related docs | Yes | Architecture guidelines, sibling domains, PRD, active tracker |

### Purpose section

Must answer three questions explicitly:

1. What the domain owns (entities, tables, surfaces, features).
2. What it reads from but does not own (other domains, external APIs, config).
3. What it explicitly does not own (adjacent concerns that belong elsewhere).

The "does not own" list prevents scope creep and resolves future disputes. It is as important as the "owns" list.

### Public API section

Link to the source barrel (index file) rather than reproducing the export list inline. An inline list becomes stale the moment a function is added or renamed; the source file is always authoritative. Group exports by behavior (e.g. "read operations", "mutations", "event handlers") so a reader can find what they need without scanning every name.

Internal repos or sub-module boundaries that matter to consumers of the domain may be documented here; internal implementation details that do not affect the domain's external contract should not be.

### Invariants section

Each invariant is stated as a falsifiable rule — one that a test can check for violations. Vague invariants ("the domain is always consistent") give no guidance and cannot be enforced. Good invariants name specific fields, tables, or state transitions.

Every invariant must be unconditional. If a rule has exceptions, it is a convention or guideline, not an invariant. Conventions belong in the gotchas or in architecture guidelines.

### Gotchas section

Gotchas document surprises: naming confusions, legacy patterns, non-obvious side effects, scoping hazards. If a behavior has caused a bug once, it belongs here. The purpose is to prevent the same bug from being introduced by a future contributor who was not present when it was first fixed.

Each gotcha should name the specific pattern, explain why it is surprising, and state what to do instead.

## Frontmatter keys

| Key | Required | Notes |
|---|---|---|
| `title` | Yes | `<Domain name> domain` |
| `status` | Yes | One of: `draft`, `approved`, `deprecated` |
| `owner` | Yes | Person accountable for keeping this doc current |
| `last-reviewed` | Yes | `YYYY-MM-DD` — updated when the domain ref is reviewed for accuracy |
| `related` | Recommended | Relative links to guidelines, sibling domains, PRD, tracker |

## Who maintains domain references

The `promote-to-canonical` skill updates domain references when a shipped track changes:

- The public API surface (new or removed exports, changed signatures).
- An invariant (new, relaxed, or strengthened).
- A gotcha (newly discovered or resolved).
- The domain boundary (what it owns or explicitly does not own).

`workflow-init` stubs a minimal domain reference for each domain listed in the `docs.paths.domainsDir` config when running the `full` preset. The stub carries the required sections with placeholder content and `status: draft`. The team fills it out and promotes it to `approved` as a one-time setup task.

## Lifecycle

Domain references do not follow the per-initiative lifecycle (draft → approved → shipped). They follow the canonical lifecycle:

- `draft` — stub or work-in-progress. Not yet authoritative.
- `approved` — accurate, reviewed, and authoritative for the current codebase.
- `deprecated` — the domain has been dissolved or merged. Leave the file in place with a note pointing to its successor(s) to preserve history and avoid broken links.

## Stability and linking

Domain references are canonical and durable. Other docs — architecture guidelines, ADRs, delivery trackers — should link to a domain reference as the authoritative source of the domain's contract. The link target is stable: the file path changes only if the domain is renamed, and that is a rare event.

Do not duplicate an invariant or gotcha in a different doc. Link to the domain reference instead.

## Related

- `references/templates/domain-reference-template.md` — the domain reference template
- `references/templates/docs-style.md` — the authoring standard
- `references/adr-contract.md` — ADR format contract (for decision records that govern a domain)
- `references/prd-contract.md` — PRD format contract
