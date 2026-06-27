---
title: kit-vnext — design corpus overview
status: high-level design
last-reviewed: "2026-06-19"
---

# Design

The design is organized as a guided descent. Each layer explains itself and points to the next.
Read the level that answers your question; go deeper only into the domain you are changing.

```txt
00-orientation      Why the system exists, what it must guarantee, and how to read the rest.
10-architecture     How the system works conceptually: runtime model, state, seams, gates, recovery.
20-sdk-and-packaging  How the design maps to packages and which dependencies are permitted.
30-domain-reference Full domain specs, organized by layer (core / foundation / providers / edge).
40-decisions        Accepted design decisions and their rationale.
```

## Recommended first read

1. [Mission and scope](00-orientation/mission-and-scope.md) — what the kit does and why the redesign
   was necessary.
2. [Requirements](00-orientation/requirements.md) — what the system must do and how each requirement
   is verified.
3. [Component model](10-architecture/component-model.md) — the runtime shape and the four provider
   seams.
4. [Package target](20-sdk-and-packaging/package-target.md) — how the design maps to the eight
   packages.

Then go deep only into the domain layer you are changing. Use the
[reading guide](00-orientation/reading-guide.md) to find the minimum path for your task.

## Design rule

A reader must be able to understand the system without opening every domain spec. The orientation and
architecture layers carry the front-door explanation. Domain specs are reference depth, not the
starting point.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [agentic-workflow-kit — documentation home](../README.md) · **← Prev:** [Product layer — status](../product/STATUS.md) · **Next →:** [<Domain name>](./_templates/domain-design-template.md)

**Children:** [<Domain name>](./_templates/domain-design-template.md) · [orientation](./00-orientation/README.md) · [architecture overview](./10-architecture/README.md) · [SDK & packaging overview](./20-sdk-and-packaging/README.md) · [domain reference](./30-domain-reference/README.md) · [decisions layer](./40-decisions/README.md) · [implementation status note](./IMPLEMENTATION_STATUS_NOTE.md)

<!-- /DOCS-NAV -->
