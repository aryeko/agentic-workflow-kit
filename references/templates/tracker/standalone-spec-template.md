# Standalone story spec template (Pattern A)

Use for foundation stories (playbooks, primitives, tooling), pilot stories, and cleanup
stories — anything that is not a per-target delta.

Save at `<specsDir>/<YYYY-MM-DD>-<id>-<slug>.md` (`<specsDir>` resolves from `paths.specsDir`,
default `docs/specs`).

The spec is the **contract** between the planning session and the implementing session. A
future model with no memory of the planning conversation must be able to execute it without
asking questions.

Target length: 150–250 lines for foundation/pilot; 80–150 for cleanup.

---

```markdown
---
title: <ID> — <Short story name>
status: approved
owner: <name or "—">
last-reviewed: <YYYY-MM-DD>
related:
  - <path to tracker README>
  - <path to the PRD section(s) this story satisfies>
  - <paths to upstream specs this depends on>
---

# <ID> — <Short story name>

*One-paragraph italicized summary. What the story delivers and why it exists in the track. If
this is a playbook downstream stories follow, say so.*

**PRD acceptance criteria:** satisfies <PREFIX-n>, <PREFIX-m> (from
`<prdsDir>/<slug>/08-acceptance-criteria.md`). The PRD remains the authoritative source of
done-ness; this spec describes how those criteria are met.

## Goal

One short paragraph. Concrete outcome: "Every X ends up with the same Y, consuming Z, validated
by gate W."

## Non-goals

Explicit exclusions — prevents scope creep.

- <Out-of-scope item>. <Where it goes instead, if anywhere.>
- <Considered and deferred — state the rationale.>

## Files to create / change

Enumerate every file. The implementer must not have to guess.

\`\`\`
<path/to/new-folder>/
  file1.ext                 ← what's in it
  __tests__/file1.test.ext
<path/to/existing-file>     ← what changes here
\`\`\`

Document any new conventions (folder layout, file naming) here so the implementer applies them
consistently.

## <Per-area details>

The story-specific content, as H2 sections per logical area. Be concrete — code blocks for
signatures/SQL/config, tables for mappings, inline path references. If a decision depends on a
previous story's outcome, list it under "Open questions" rather than baking in an assumption.

## Validation gate

Numbered, each item **verifiable**, **specific**, **bounded**. Prefer the repo's configured
commands over hardcoded tool names.

1. **Fast gate** — `<verify.changed command, or the repo's per-task gate>` passes on touched files.
2. **Full gate** — `<verify.full command, or the repo's full suite>` passes.
3. **<Project-specific check>** — only if the repo defines one.
4. **No regressions** — list specific behaviours that must remain.
5. **Tracker updated** — Status flipped in the tracker matrix in the same PR.

For foundation playbooks, **add a playbook-update gate**: list every open question the pilot
resolves; the pilot's gate item is "playbook updated with concrete answers".

## Open questions for <pilot-id> to resolve (foundation/playbook specs only)

1. **<Question>.** <What the pilot must decide.> <Recommended default, if any.>

Each becomes a one-paragraph "Resolved during <pilot-id>" entry before the pilot closes.

## Risks and mitigations

- **<Risk>.** What can go wrong. **Mitigation:** how to prevent/detect. **Fallback:** what to do
  if it happens anyway.

## Estimated blast radius

S / M / L plus a one-line file-count and net-LoC estimate.
- **S** — under 10 files, under 500 LoC incl. tests.
- **M** — 10–30 files, 500–1500 LoC.
- **L** — 30+ files, 1500+ LoC.

## Related

- `<path to tracker README>`
- `<path to the PRD>`
- `<paths to upstream specs>`
```
