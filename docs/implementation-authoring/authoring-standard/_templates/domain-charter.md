---
title: "Domain charter template"
status: draft
last-reviewed: "2026-06-22"
---

# Domain charter template

Copy the block below for each domain. The charter owns the WHAT, not HOW — it carries no acceptance criteria.

```markdown
---
id: "<domain-id>"
layer: "<foundation|providers|core|edge>"
status: "domain-charter: draft"
source-design: "<path to the normative design-domain README>"
last-reviewed: "<YYYY-MM-DD>"
---

# <domain-id> - <name>

## What

<The implementation-planning responsibility in plain language. Names the spec surface the domain owns,
using the design's own type/event/token names where it helps a later story author.>

## Why

<Why the domain matters to the rebuild sequence and what it unblocks.>

## Does Not Own

<Nearby concerns that belong elsewhere, each attributed to the owning domain, epic, or story group by id.
This boundary is load-bearing: every story under the domain inherits it.>

- <excluded concern> - owned by <owner id>.

## Inputs And Dependencies

- `source-design`: <the normative design README this charter derives from>.
- Direct domain dependencies: <domain ids, or `none`>.
- Ordering artifacts: <the planning artifacts that order the work; e.g. `domain-dag.md`, `epic-dag.md`>.
- <Layer-specific lines are expected and allowed: provider charters split SDK vs testkit inputs; core
  charters name their implementation DAG band.>

## Downstream Epics

- <milestone epics that consume this domain.>

## Story Group Signals

- <likely story group this domain will shape, without acceptance criteria or implementation HOW.>
```

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Authoring standard — Pillar 1](../README.md) · **← Prev:** [Coverage — exactly-once ownership](../60-coverage.md) · **Next →:** [Epic charter template](./epic-charter.md)

<!-- /DOCS-NAV -->
