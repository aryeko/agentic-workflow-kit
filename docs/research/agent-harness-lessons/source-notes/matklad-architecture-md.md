# Matklad `ARCHITECTURE.md`

Source: <https://matklad.github.io/2021/02/06/ARCHITECTURE.md.html>
Author/date: Aleksey Kladov, 2021-02-06
Access date: 2026-06-22
Scope used: contributor-facing architecture notes for medium-sized open-source projects.

## Main Guidelines

- Add an `ARCHITECTURE` document next to the repo's onboarding documents when a project is large
  enough that contributors cannot infer its physical structure cheaply.
- Optimize it for the contributor's missing mental map: the hard part is often not writing the
  patch, but finding the right place to make the change.
- Keep it short because every recurring contributor should read it and because shorter guidance
  is less likely to rot.
- Describe stable facts, not implementation details that change frequently.
- Treat the document as a periodically revisited map, not a file that must be synchronized with
  every code change.
- Start with a bird's-eye statement of the problem the project solves.
- Follow with a codemap: coarse modules, their responsibilities, and how they relate.
- Make the codemap answer two navigation questions: where does behavior X live, and what does
  this unfamiliar module do?
- Pull detailed mechanics into focused docs or inline comments; the architecture map should not
  become a deep implementation manual.
- Name important files, modules, and types, but avoid making the architecture map depend on many
  fragile direct links.
- Use the exercise to test whether the physical tree matches the conceptual map.
- Explicitly call out architectural invariants, especially negative invariants that are hard to
  discover by reading code.
- Make boundaries visible: boundaries carry important implementation constraints, but are hard
  to infer from random file browsing.
- Add cross-cutting concerns after the codemap.

## Assumptions And Operating Model

- The project is medium-sized: large enough that "read the code" is expensive, but small enough
  that one concise architecture map can still orient a contributor.
- The main reader is an occasional contributor or new recurring contributor, not a long-time core
  maintainer.
- Core developers already carry a mental physical map of the codebase; the document externalizes
  enough of that map to reduce contributor search cost.
- The useful abstraction is physical architecture: directories, modules, important types, and
  layer boundaries, not only product intent or abstract design rationale.
- The doc's maintenance model is deliberately low ceremony: update it a few times a year or when
  the stable project shape changes materially.
- Search and symbol lookup are assumed to be available, so the map can name stable entities without
  maintaining a fragile link graph.

## Failure Modes And Anti-Patterns

- Writing "more docs" without a navigation purpose. The source argues for one specific missing
  artifact, not indiscriminate documentation growth.
- Producing an atlas instead of a map: too much module-internal detail makes the file long, brittle,
  and less likely to be read.
- Letting the document chase every code movement. That turns a low-effort orientation file into a
  high-maintenance synchronization burden.
- Describing only positive responsibilities. Important constraints often take the form "this layer
  must not depend on that layer," which is invisible unless stated.
- Hiding boundaries in prose or code shape. Boundaries are sparse and easy to miss, so contributors
  need them called out directly.
- Naming concepts that do not correspond to adjacent physical files or directories. If the codemap
  and `tree .` disagree, contributor navigation still fails.
- Overusing direct links to code. Links go stale; stable names plus symbol search age better.

## Practices Worth Copying

- Maintain a short contributor-facing physical architecture map separate from deep design docs.
- Begin with the project problem and then quickly switch to "where things live."
- Make every major directory/module entry answer "what it owns" and "what depends on it."
- Include a small invariant section for dependency rules, forbidden imports, credential boundaries,
  event-log ownership, and other negative constraints.
- Include a boundary section for seams between control plane, provider contracts, drivers,
  foundation, and external systems.
- Include cross-cutting concerns that span many files: configuration, storage, credentials,
  telemetry, test lanes, and generated evidence.
- Prefer stable names over detailed path links where the repo's symbol search can do the lookup.
- Revisit the map on a calendar cadence and after large structural changes, rather than turning it
  into a per-PR checklist.

## Relevance To Kit-Vnext

- Kit-vnext already has strong logical architecture docs: layers, the Dependency Rule, capability
  attestation, seams, event-log authority, and the 16-domain map live in `docs/design/`.
- Matklad's advice complements those docs by emphasizing the physical contributor map: when a
  developer asks "where should I change this?", the answer must map design concepts to directories,
  packages, modules, and stable type names.
- This is especially relevant because kit-vnext intentionally separates the deterministic control
  plane from agent workers, provider contracts, drivers, and foundation modules. A contributor can
  understand the rule abstractly and still fail to locate the right file.
- The future package layout should therefore get a concise physical architecture entry point once
  packages are populated. It should not repeat each domain design; it should point from stable
  physical locations back to their owning design docs.
- The existing design conventions already align with the source: high-to-low reading paths, focused
  files, single-source facts, Mermaid diagrams, required context diagrams, and explicit failure modes.
- The missing artifact is not another spec. It is a stable "repo map" that explains how the
  design-owned domains appear in the working tree and what names to search for.
- The map should make kit-vnext's negative invariants legible to contributors: foundation imports
  nothing above it, core never imports concrete drivers, workers do not hold Forge credentials,
  task status and run activity have separate authorities, and evidence beats prose.
- For agent-harness work, this would reduce wrong-file edits and over-broad patches by giving
  workers a compact navigation layer before they load domain-specific files.

## Source-Backed Caveats

- The source is scoped to open-source projects around 10k-200k lines of code; it is a fit heuristic,
  not proof that every repo needs the same artifact.
- The recommendation is for a short physical architecture map, not a replacement for kit-vnext's
  source-of-truth design corpus.
- The article explicitly favors stable content over constant synchronization, so the map should not
  promise complete file-level accuracy.
- Direct code links should be used sparingly. Kit-vnext can still link to stable documentation, but
  physical code references should lean on names that search can find.
- Deep implementation behavior belongs in domain docs, contracts, tests, and inline comments, not
  in the architecture overview.
- A physical map should be added only when the tree has enough stable structure to map. While
  package decomposition remains design-owned and intentionally incomplete, the research finding is
  a future practice rather than an immediate repo-wide rewrite.
