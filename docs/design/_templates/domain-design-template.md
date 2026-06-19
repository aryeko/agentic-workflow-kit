---
title: "<Domain name> — design"
id: "<layer-NN-name>"
layer: "<edge | core | providers | foundation>"
status: draft            # draft | in-review | approved
owner: "<engineer>"
last-reviewed: "<YYYY-MM-DD>"
depends-on: []           # contracts/foundation modules this design depends on
---

# <Domain name> — design

> Produced from `charter.md` following [conventions.md](../conventions.md). Delete the guidance
> notes (in blockquotes) before submitting for review.

## 1. Purpose & boundaries

> Restate the charter's responsibility in your own words. List what is explicitly **out of scope**
> for this domain (and which sibling domain owns it instead).

## 2. Required reading

> The standard set (README, architecture, conventions, glossary, this charter) plus any sibling
> contracts you used. Nothing outside `docs/design/`.

## 3. Context diagram

> Mermaid. Where this domain sits: what it depends on (contracts/foundation), what depends on it.
> Reuse architecture.md component names.

```mermaid
flowchart LR
  %% replace with this domain's context
```

## 4. Design

> The low-level design: data structures, state machines, algorithms, the decisions and why.
> This is the bulk of the document.
>
> Keep it focused (~≤200 lines). If it grows large, keep this file as the high-level index and move
> deep sub-topics into `design/<aspect>.md` in this domain folder, linked from here — split by
> cohesive sub-topic, with a reason.

## 5. Contracts & interfaces

> What this domain exposes and consumes, typed. Provider domains: define the contract AND its
> capability set here, and show it is satisfiable by the real driver AND the mock.

## 6. Events & data

> Events emitted/consumed; projections read or contributed to. Keep names consistent across domains.

## 7. Behavior diagram

> Mermaid. At least one sequence or state diagram for the key flow.

```mermaid
sequenceDiagram
  %% replace with this domain's key flow
```

## 8. Failure & degraded modes

> What happens when a guarantee cannot be met. The named fail-closed states. How the capability gates
> treat this domain. No optimistic guesses.

## 9. Testing strategy

> How this is verified. For core domains: mocks only, zero real processes (NFR-TEST). Property tests
> where the logic is a pure function of evidence (NFR-DET). Which FR/NFR ids this satisfies.

## 10. Open questions

> Decisions deferred or needing owner input. Do not silently resolve.

## 11. Definition of done

- [ ] All sections complete; guidance notes removed.
- [ ] Files are focused; a large design is an index + sub-files split with reason, not one huge file.
- [ ] Complies with the Dependency Rule; dependencies listed and justified.
- [ ] Uses glossary vocabulary.
- [ ] States the FR/NFR ids satisfied; shows how NFR-TEST is met.
- [ ] Failure/degraded modes defined (fail-closed).
- [ ] Provider domains: contract validated against real driver + mock.
- [ ] Diagrams present and consistent with architecture.md naming.
