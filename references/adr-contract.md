# ADR contract

An Architecture Decision Record (ADR) captures a significant architectural or design decision — the context that forced it, the decision itself, its consequences, and the alternatives that were considered and rejected. ADRs are canonical, immutable, and stably numbered so any other doc can cite "ADR 0004" and survive title renames.

ADRs are authored by the `promote-to-canonical` skill when a shipped track introduces a real decision. They live in the configured decisions directory (default `architecture/decisions/`). This file is the canonical format contract; it is the ADR analog of `prd-contract.md`.

## Filename convention

```
NNNN-kebab-title.md
```

- `NNNN` is a zero-padded four-digit sequence number assigned sequentially starting at `0001`.
- The kebab title is a short, lowercase, hyphen-separated summary of the decision subject, e.g. `0003-feature-first-modules.md`.
- Numbers are assigned at creation and **never change**. Titles may change; numbers cannot. Cross-references use numbers, not titles, so they survive renames.

## Immutability rule

Once an ADR is merged with `status: accepted`, its content is immutable except for:

1. Adding a `superseded by NNNN` status when a later ADR overturns it.
2. Fixing factual errors in the prose that do not change the decision (typos, broken links, updated related-doc paths).

The original reasoning and decision text must survive as the permanent record of what was decided and why, even when superseded. Superseding an ADR means authoring a new ADR with the revised decision and updating the original's `status` to `superseded by NNNN`. Do not delete or rewrite the original.

## Status vocabulary

| Value | Meaning |
|---|---|
| `proposed` | Drafted; under review; not yet accepted. |
| `accepted` | Decision is in effect. Codebase follows this rule. |
| `superseded by NNNN` | Overturned by ADR `NNNN`. The original record is retained. |

Do not use `draft`, `deprecated`, `archived`, or any other value.

## Required sections

The section order is fixed and must not be reordered or omitted. See `references/templates/adr-template.md` for the full template.

| Section | Required | Purpose |
|---|---|---|
| Frontmatter | Yes | `title`, `status`, `date`, `deciders`, `related` |
| H1 | Yes | `NNNN — <title>` — matches frontmatter `title` exactly |
| TL;DR | Yes | One italic sentence: the decision and its primary consequence |
| Context | Yes | The situation and constraint that forced a decision |
| Decision | Yes | What was chosen and what it means in practice |
| Consequences (Positive, Negative, Neutral) | Yes | All three subsections, even if sparse |
| Alternatives considered | Yes | Table of rejected options with one-line rejection rationale |
| Related | Yes | Links to topic docs, superseded ADRs, or follow-up ADRs |

## Frontmatter keys

| Key | Required | Notes |
|---|---|---|
| `title` | Yes | `NNNN — <Decision title in sentence case>` |
| `status` | Yes | One of: `proposed`, `accepted`, `superseded by NNNN` |
| `date` | Yes | `YYYY-MM-DD` — date the ADR was accepted (or proposed) |
| `deciders` | Yes | List of names of people involved in the decision |
| `related` | Recommended | Relative links to topic docs and sibling ADRs |

## Who authors ADRs

The `promote-to-canonical` skill mints ADRs for real decisions introduced by a shipped track. A "real decision" is one that:

- Fixes a significant architectural constraint (e.g. "all tenant reads go through a GUC transaction").
- Changes an invariant that other docs or teams depend on.
- Rejects a plausible alternative that might otherwise be attempted again.

Documenting obvious or locally-scoped implementation choices as ADRs dilutes the record and adds noise. When in doubt, ask: "Would a future contributor reasonably try the rejected alternative without this record?" If yes, mint the ADR.

## Lifecycle: proposed → accepted

`promote-to-canonical` writes the ADR with `status: proposed`. The human reviewer approves it to `accepted` when satisfied the decision is correctly described. A gate check on the promote story may require all minted ADRs to reach `accepted` before the story is `verified`.

## Stability guarantee

Once a number is assigned to an ADR — even `proposed` — that number is reserved. If the ADR is abandoned, set `status` to a note (e.g. `superseded by 0000`) or simply leave it as `proposed` with a note in Context. Do not reassign the number to a different decision.

## Related

- `references/templates/adr-template.md` — the MADR template
- `references/templates/docs-style.md` — the authoring standard (status vocabulary, frontmatter rules)
- `references/prd-contract.md` — PRD format contract (parallel doc for the product layer)
