# Superpowers working artifacts

This directory holds the **transient** spec and plan a story produces while it is being implemented:

```text
docs/superpowers/specs/<date>-<slug>-design.md   the design/spec for the story in flight
docs/superpowers/plans/<date>-<slug>.md          the step-by-step implementation plan
```

These are working artifacts, not canonical documentation. They exist to drive one story to
completion and must not accumulate in the repo.

## Lifecycle

1. **First commit of a story** adds the spec and plan here.
2. Implementation proceeds against the plan (commit by commit).
3. **Final commit of the story** deletes the spec and plan and folds their durable content into the
   canonical docs (see the map in [../README.md](../README.md)) — typically
   [architecture.md](../architecture.md), [getting-started.md](../getting-started.md),
   [../../README.md](../../README.md), the [references](../../references/), and the
   [test plan](../test-plan/).

The result: `main` always reflects the current repo state through canonical docs, with no per-story
spec/plan left behind.

## What counts as "durable" (keep) vs "transient" (drop)

- **Keep** (fold into canonical docs): architecture decisions, contracts, runtime/data flow, tool
  surfaces, build/verification steps, lasting "why".
- **Drop**: task breakdowns, step sequencing, review-finding logs, dates, phase narration. Git
  history on these files preserves them if ever needed.

## Enforcement

This is a documented standard, not an automated gate. **Maintainers verify on review** that a story
PR's final state contains no `specs/*` or `plans/*` story files and that the canonical docs were
updated in the same PR. See the "Documentation standard" section in
[../../CONTRIBUTING.md](../../CONTRIBUTING.md).
