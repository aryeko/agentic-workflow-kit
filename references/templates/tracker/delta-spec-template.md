# Delta story spec template (Pattern B)

Use for rollout stories that share a common foundation playbook — typically per-target work
where the playbook owns the rules and the delta only enumerates what is specific to this target.

Save at `<specsDir>/<track>/<category>/<YYYY-MM-DD>-<id>-<slug>.md`, where `<category>` is a noun
that fits what the rollout iterates over (`endpoints/`, `screens/`, `services/`, …).

The delta is **thin on rules and thick on facts**. Rules belong in the playbook. The delta lists
what already exists, what should exist after, and what cannot change.

Target length: 50–120 lines.

---

```markdown
---
title: <Target name> <track-noun> delta
status: approved
owner: <name or "—">
last-reviewed: <YYYY-MM-DD>
related:
  - <path to tracker README>
  - <path to the foundation playbook spec>
  - <path to the PRD section(s) this story satisfies>
---

# <Target name> <track-noun> delta

*Optional one-paragraph italicized summary if the target has notable scope (largest in the
wave, first with a server component, blocks <ID>, …).*

**PRD acceptance criteria:** satisfies <PREFIX-n>.

## Story identifier

| ID | Depends on | Blocks | Wave |
| --- | --- | --- | --- |
| <ID> | <previous-ID> | <next-ID> | W3 |

## Current files

Enumerate every existing file the story touches — list, do not summarize.

- **Entry points:** `<path>`
- **Modules:** `<path>` — role
- **Tests:** N files at `<pattern>`.

If the audit did not fully enumerate the tree, say so: the implementer's first step is to read
`<path>` and update this delta with the actual file list before starting.

## Target files

Post-change tree, with comments for net-new files:

\`\`\`
<path/to/folder>/
  <module>.ext          ← role
  __tests__/<module>.test.ext
\`\`\`

## Patterns to apply

Which playbook primitives/patterns this target consumes. Be specific.

- **<Primitive A>** for <use case>.
- If the target has a *unique* pattern not in the playbook, flag it as a candidate playbook
  update: "if a second target needs the same shape, promote to the playbook."

## Behavioural changes (deliberate)

What changes for the user after the change. Bullet list.

- <Change>.

## Behavioural changes (forbidden)

**The most important section.** Without it, changes silently alter contracts.

- <Behaviour> must remain identical (e.g. "response shape unchanged").
- <Behaviour> must remain identical (e.g. "log/event payloads unchanged").

## Gotchas

3–6 bullets of target-specific friction the implementer should know up front.

- **<Gotcha>.** Why it matters. How to handle it.

## Estimated blast radius

S / M / L plus a one-line file-count estimate.

## Related

- `<path to tracker README>` — the tracker
- `<path to the playbook spec>` — the rules
```
