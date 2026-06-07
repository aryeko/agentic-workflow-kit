# Detailed technical story spec contract

A detailed technical story spec is created or refined by `implement-next` after it claims one
tracker row and before it writes an implementation plan or code.

Default location:

```text
docs/superpowers/specs/<YYYY-MM-DD>-<id-lc>-<slug>-design.md
```

Existing trackers that already link detailed specs under `docs/superpowers/specs/` remain valid.
New trackers produced by `plan-delivery-track` link story briefs; `implement-next` expands those
briefs into this detailed spec.

## Required content

- exact types/contracts
- exact files/modules
- query/schema/prompt/event/component design
- tests
- migration/deploy concerns
- decisions resolved from the story brief

The detailed spec must resolve or explicitly block on every blocking technical question in the
story brief. No implementation plan or code may be written while the detailed spec is missing or
has blocking technical questions.
