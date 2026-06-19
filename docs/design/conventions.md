---
title: kit-vnext — design conventions
status: high-level design (scaffold)
last-reviewed: 2026-06-18
---

# Design conventions

How every domain design is written so all parts fit together, read consistently, and can be
reviewed objectively. A domain design that does not follow these conventions is not done.

## Documentation principles

**Human-readable first, machine-readable second.** Written for a person to understand the system, and
structured so a model can load only the part it needs.

- **High to low.** Each level explains itself and points down: README → architecture → domain
  catalog → domain `README.md` → (if needed) flat aspect files. A reader stops at the depth they
  need.
- **Focused files, not huge ones.** One cohesive subject per file. Soft cap ~200 lines; past that,
  **split — but only with a reason** (a genuinely separate sub-topic), never to hit a number.
- **Retrievable in isolation.** Working on one domain should require that domain's files plus the
  small shared set — not the whole tree, and without filling context.
- **Single source per fact.** State it once and link; do not duplicate (e.g. the domain catalog lives
  in [domains/README.md](domains/README.md)).
- **Sub-directories with reason.** Domain design splits are flat sibling files by default. Add a
  subdirectory only for appendices or generated evidence that genuinely need their own folder.

## Required reading for a domain session

Read **only** these (scoped — no legacy, no full incident history):

1. [README.md](README.md) — mission, identity, working model.
2. [architecture.md](architecture.md) — layers, the Dependency Rule, the capability model, the domain map.
3. [domains/README.md](domains/README.md) — catalog context: layer, slug, dependencies, and build
   order.
4. This file ([conventions.md](conventions.md)).
5. [glossary.md](glossary.md) — use these terms exactly.
6. Your domain's `README.md` (Mandate first, then the design) and any flat sibling aspect files it
   links.
7. Any sibling **contracts** your Mandate names (e.g. a core domain that consumes the Agent contract
   reads `prov-01`'s contract section).

If you find you need something outside `docs/design/`, stop and raise it with the chief architect —
the design should be self-contained. **Exception:** a provider domain may capture external facts
(e.g. a generated Codex/GitHub schema) in a dated **`evidence/` appendix** inside its own folder — see
"Provider evidence & conformance" below.

## Provider evidence & conformance

Provider domains (`prov-*`) depend on real external behavior, so they get two extra obligations:

- **`evidence/` appendix.** Capture the external facts you relied on under
  `domains/<layer>/<id>/evidence/`, dated, with the exact commands run, output hashes, and schema
  snapshots. This keeps the proof inside `docs/design/` (no live re-fetch needed to review) and is
  the source for capability attestation.
- **Conformance suite.** Define the suite every driver of this seam must pass (schema probes,
  real-driver smoke tests, recorded incident replays, and **adversarial mocks** that omit, delay, or
  lie about signals). "Runs on mocks" is only trustworthy if the mocks are held to the same contract as
  the real driver.

## The Dependency Rule (must comply)

> Edge → Control plane → Contracts. Drivers → Contracts. Everything → Foundation.
> **Nothing depends on a concrete driver. Contracts never depend on the core.**

State explicitly in your design which contracts and foundation modules you depend on, and confirm you
introduce no forbidden dependency. (See [architecture.md](architecture.md) §2.)

## Required sections of a domain `README.md`

Use the [template](_templates/domain-design-template.md). Sections, in order:

1. **Frontmatter** — `title, id, layer, status, owner, last-reviewed, depends-on`.
2. **Mandate** — chief-architect-owned responsibility, scope, owned requirements, dependencies,
   required reading, deliverable, and definition of done.
3. **Purpose & boundaries** — restate the Mandate's responsibility; what is explicitly out of scope.
4. **Required reading** — the list above plus any extra contracts you used.
5. **Context diagram** (Mermaid) — where the domain sits: what it depends on, what depends on it.
6. **Design** — the low-level design: data structures, state machines, algorithms, decisions.
7. **Contracts & interfaces** — what the domain exposes and consumes, typed. Provider domains define
   their contract **and** its capability set here, validated against the real driver + the mock.
8. **Events & data** — events emitted/consumed; projections read or contributed to.
9. **Behavior diagram** (Mermaid) — at least one sequence or state diagram for the key flow.
10. **Failure & degraded modes** — what happens when a guarantee can't be met; the named fail-closed
   states; how the capability gates see this domain.
11. **Testing strategy** — how it is verified (mocks only for core; which NFRs it satisfies; property
    tests where relevant). Must show how NFR-TEST is met.
12. **Open questions** — decisions deferred or needing owner input.
13. **Definition of done** — the checklist below, all ticked.

## Keeping a domain `README.md` focused

`README.md` is the domain's entry point and must read well on its own. If the low-level design grows
past a focused size, keep `README.md` as the **high-level index** (Mandate, purpose, context, and a map
of the parts) and move deep sub-topics into flat sibling files such as `capability-registry.md` or
`contracts-and-conformance.md`, each linked from the index. Split by cohesive sub-topic, with a reason
— never just to hit a line count. This keeps the docs human-first (read the index, then only the part
you need) and model-friendly (load one aspect without the rest).

## Diagram conventions

- Mermaid only, fenced ` ```mermaid ` blocks, inline in the markdown.
- Reuse the component names from [architecture.md](architecture.md) (Control plane, Agent contract,
  Forge, Work Source, Foundation, etc.) so diagrams compose across domains.
- Every domain has at least a **context diagram** and one **behavior diagram**.

## Naming conventions

- String-literal state, reason, and error tokens are kebab-case. Event `type` discriminators are
  kebab-case unless the owning domain's approved contract defines stable canonical names in another
  casing. Existing canonical run event names such as `RunLifecycleTransitioned`,
  `ApprovalDecisionRecorded`, and `CapabilityGateRecord` must be cited verbatim where used.
- Each domain owns event `type` strings under its own `domain` namespace. There is no central core-01
  registry of every event type string. Foundation and provider domains that do not import core return
  structural append intents with `domain`, `type`, `occurredAt`, durability, and payload for the
  owning core domain to append.

## Definition of done (per domain design)

- [ ] Follows the template; all sections present.
- [ ] Files are focused (~≤200 lines); a large design is an index + flat sibling files split with
      reason, not one huge file.
- [ ] Complies with the Dependency Rule; dependencies listed and justified.
- [ ] Uses glossary vocabulary; introduces no synonym for an existing term.
- [ ] States which requirements (FR/NFR ids) it satisfies and how NFR-TEST is met.
- [ ] Defines its failure/degraded modes and how capability gates treat them (fail-closed).
- [ ] Provider domains: contract validated against the real driver **and** a mock.
- [ ] Diagrams present and consistent with architecture.md naming.
- [ ] Open questions captured, not silently resolved.

## Review & approval flow

1. Engineer updates the domain `README.md` from the template, adding flat aspect files only when a
   cohesive sub-topic needs its own focused file.
2. Chief architect reviews against the **Mandate** (scope/requirements) and these **conventions**.
3. Feedback is technical; the engineer iterates. Approval flips the design's frontmatter `status` to
   `approved`. Cross-domain contract changes are reconciled with the affected sibling domains.

## File layout per domain

```
domains/<layer>/<id>-<name>/
  README.md      # Mandate first, then the domain design
  <aspect>.md    # optional focused flat aspect file, linked from README.md
  evidence/      # provider-only dated external evidence appendix, when needed
```
