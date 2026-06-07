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
| <PREFIX-n> | <observable outcome this story contributes to> |

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
