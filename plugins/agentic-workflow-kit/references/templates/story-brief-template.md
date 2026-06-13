---
title: <ID> story brief
owner: <name or "—">
last-reviewed: <YYYY-MM-DD>
related:
  - <path to tracker README>
  - <path to PRD README>
  - <path to technical solution, if present>
---

# <ID> story brief

not implementation-ready; create a detailed technical story spec before plan/code

## PRD criteria

| Criterion | Product outcome |
| --- | --- |
| <PREFIX-n or context-derived outcome label> | <observable outcome this story contributes to, with source context when no PRD exists> |

## Technical solution sections

| Section | Relevance |
| --- | --- |
| <technical solution section heading or ID> | <how this story relates> |

If no technical solution was required, state the reason here.

## Dependencies

| Dependency | Reason |
| --- | --- |
| <ID or upstream artifact> | <why it must happen first> |

## Scope boundary

**In scope**

- <story responsibility>

**Out of scope**

- <deferred or forbidden work>

## Assumptions and blockers

| Type | Item | Evidence or resolution path |
| --- | --- | --- |
| Assumption | <safe assumption> | <source context or why safe> |
| Blocking question | <question> | <how implement-next must resolve it> |

## Artifact boundaries

- PRD owns what/why and acceptance criteria.
- Technical solution owns high-level how when required.
- Tracker owns sequencing, status, owner, plan, and PR fields.
- Story brief owns lightweight story-local scope and citations.
- Detailed technical story spec owns exact implementation design.
- Implementation plan owns execution steps.
- Runtime artifacts own execution evidence.

## Candidate surfaces

- **Files/modules:** <candidate paths or modules>
- **Queries/schema:** <candidate data surfaces or "none expected">
- **Prompts/tools:** <candidate AI surfaces or "none expected">
- **Events/metrics:** <candidate observability surfaces or "none expected">
- **Components/routes:** <candidate UI/API surfaces or "none expected">

## Validation expectations

- <verification layer or configured gate the detailed spec must make concrete>

## Open technical questions

| Question | Blocking? | Resolution expected in detailed spec |
| --- | --- | --- |
| <question> | <yes/no> | <decision needed before implementation plan/code> |
