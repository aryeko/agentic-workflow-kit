---
title: "Story DAG template"
status: draft
last-reviewed: "2026-06-22"
---

# Story DAG template

Copy the block below for each epic's story DAG. The DAG owns structure and order, not DONE detail — the story contracts own the WHAT.

````markdown
---
title: "Epic <n> - story DAG"
epic: <n>
status: "story-dag: draft"
last-reviewed: "<YYYY-MM-DD>"
---

# Epic <n> Story DAG

<One paragraph: what this epic turns into dispatch-ready story contracts; each node owns one coherent
surface and each edge names the shared type, event, port, or evidence shape that creates the dependency.>

## Sources

- <this epic's charter (`README.md`)>
- <`../../epic-dag.md`>
- <the domain charters this epic includes>
- <the normative design READMEs the included domains derive from>
- <engineering policies that constrain delivery (testing, lanes, dependency, check gate)>

## Reading rules

- Node = one story contract and one reviewable implementation scope for a later delivery run.
- Edge = an intra-epic dependency because a consumer story uses a shared shape produced by another
  story.
- Every `Story Group Signal` the epic owns maps to exactly one story node.
- Consumers cite `<producer-story>/<type>` for shared shapes; they do not redeclare shape fields.
- <Any epic-specific scope boundary; e.g. payloads owned here vs out of scope for this epic.>

## Story nodes

| story id | one-line job | domain(s) | claimed signals covered | owned pathset | suggested tier |
|---|---|---|---|---|---|
| `<story-id>` | <one-line job> | `<domain-id>` | <signal(s) this node covers> | `<globs the implementer may create or modify>` | <light / standard / elevated> |

## Dependency table

| story | depends on | shared contract creating the edge |
|---|---|---|
| `<story-id>` | `<producer story id>` / none | <the shared type/event/port/evidence shape that creates the edge> |

## Story graph

```mermaid
flowchart TB
  <NODE_ID>["<story-id>"]
  <NODE_ID> -->|"<shared shape on the edge>"| <NODE_ID>
```

## Topological bands

| band | stories | delivery note |
|---|---|---|
| 1 | `<story-id>`, ... | <delivery wave note> |
````
