---
title: Linkly PRD
status: approved
owner: "—"
last-reviewed: 2026-06-02
related:
  - ../../references/prd-contract.md
---

# Linkly PRD

**Version 1 · June 2026 · approved**

Linkly is a minimal URL shortener: paste a long URL, get a short code, and see how often it
is visited. This example PRD demonstrates the agentic-workflow-kit PRD contract end to end.

## Document map

| # | Document | Purpose |
| --- | --- | --- |
| 1 | [01-context](./01-context.md) | Problem, opportunity, thesis, non-goals |
| 2 | [02-principles](./02-principles.md) | Operating tenets |
| 3 | [03-domain-model](./03-domain-model.md) | Conceptual model |
| 4 | [04-roles](./04-roles.md) | Personas + capabilities |
| 5 | [05-phases](./05-phases.md) | Phased delivery plan |
| 6 | [06-quality-bars](./06-quality-bars.md) | Cross-cutting quality requirements |
| 7 | [07-success-metrics](./07-success-metrics.md) | How success is measured |
| 8 | [08-acceptance-criteria](./08-acceptance-criteria.md) | Ship checklist |
| 9 | [09-risks-and-open-questions](./09-risks-and-open-questions.md) | Risks + open questions |
| 10 | [10-glossary](./10-glossary.md) | Terms |

## PRD vs technical-design boundary

This PRD owns what/why. How Linkly stores links, generates codes, or scales is technical design,
decided downstream. This small example goes directly to tracker planning; larger products should
add `technical-solution.md` with `/design-technical-solution` first.

## Status & next steps

Approved. Next: run `/plan-delivery-track` to decompose this small PRD into a tracker.
