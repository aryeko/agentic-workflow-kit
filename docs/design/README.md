# Design

The design is organized as a guided descent:

```txt
00-orientation
  Why the system exists and what it must guarantee.

10-architecture
  How the system works conceptually.

20-sdk-and-packaging
  How the design is packaged for vNext implementation.

30-domain-reference
  Full low-level domain specs and provider evidence.

40-decisions
  Accepted design decisions and rationale.
```

## First read

Start with:

- [Mission and scope](00-orientation/mission-and-scope.md)
- [Requirements](00-orientation/requirements.md)
- [Component model](10-architecture/component-model.md)
- [Package target](20-sdk-and-packaging/package-target.md)

Then go deep only into the domain you are changing.

## Design rule

A reader should be able to understand the system without opening every domain spec. Domain specs are reference depth, not the front door. Humanity has suffered enough from documentation that starts at the basement.
