---
title: <Pillar name>
status: approved
owner: <owner>
last-reviewed: <YYYY-MM-DD>
related:
  - <../README.md>
  - <sibling pillar README, e.g. ../architecture/README.md>
---

# <Pillar name>

_<One italic sentence: the question this pillar answers and the kind of reader who should be here.>_

## Context

<Two to three sentences. What does this pillar contain? Why is it organized as a pillar rather than a flat folder? Who reads it and when?>

> **Parameterization note (remove before committing)**
>
> This template works for both the **product** pillar and the **architecture** pillar. Replace `<pillar>` placeholders throughout. Common substitutions:
>
> - Product pillar: "what and why", surfaces, PRDs, product status, positioning.
> - Architecture pillar: "how", guidelines, system overview, domains, decisions, ADRs, topic docs.
>
> Delete this note block after filling in the template.

## Start here

If you are new to this pillar, read these first:

- [`<primary-entry-doc.md>`](<primary-entry-doc.md>) — <one sentence: what it contains and why it is first>.
- [`<secondary-entry-doc.md>`](<secondary-entry-doc.md>) — <one sentence>.
- [`<third-entry-doc.md>`](<third-entry-doc.md>) — <one sentence> (optional; include only if genuinely needed upfront).

## I need to … → read …

| I need to … | Read |
|---|---|
| <Understand the overall product / how the system fits together> | [`<overview-or-system-doc.md>`](<overview-or-system-doc.md>) |
| <Find the authoritative requirements / rulebook> | [`<requirements-or-guidelines.md>`](<requirements-or-guidelines.md>) |
| <Understand a specific surface / layering boundary> | [`<surface-or-layering-doc.md>`](<surface-or-layering-doc.md>) |
| <Understand a domain / find a feature's data model> | [`<domains/README.md or domain-specific.md>`](<domains/README.md>) |
| <Find a past decision and the reasoning behind it> | [`decisions/`](decisions/) |
| <Work on `<specific area>`> | [`<area-specific-doc.md>`](<area-specific-doc.md>) |
| <Add more rows for the lookups that actually occur in your repo> | `<relative link>` |

## <Topic group A, e.g. Foundations / Surfaces / Canonical docs>

Brief one-line description of what this group covers, then the list:

- [`<topic-a.md>`](<topic-a.md>) — <one sentence: what it covers>.
- [`<topic-b.md>`](<topic-b.md>) — <one sentence>.
- [`<topic-c.md>`](<topic-c.md>) — <one sentence>.

## <Topic group B, e.g. Cross-cutting / Deep reference / Requirements>

- [`<topic-d.md>`](<topic-d.md>) — <one sentence>.
- [`<topic-e.md>`](<topic-e.md>) — <one sentence>.

> **Architecture pillar:** typical groups are Foundations, Cross-cutting, Frontend, Contracts, Decisions, Domains.
> **Product pillar:** typical groups are Surfaces, Cross-cutting product docs, Requirements layer (PRDs).
> Adjust, add, or remove groups to match what your pillar actually contains.

## <Topic group C (optional)>

Include only if the pillar has enough docs to warrant a third group. Delete this section if not needed.

- [`<topic-f.md>`](<topic-f.md>) — <one sentence>.

## Related

- [`../README.md`](../README.md) — the full docs map across all pillars
- [`<sibling-pillar/README.md>`](<sibling-pillar/README.md>) — the <other> pillar
- [`<overview-or-contract-doc.md>`](<overview-or-contract-doc.md>) — <one sentence>
