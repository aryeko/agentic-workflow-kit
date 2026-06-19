---
title: "Work Source — charter"
id: "prov-03"
layer: "providers"
status: "charter: ready"
last-reviewed: 2026-06-18
---

# Work Source — charter

**Purpose.** The Work Source contract — the provider of tasks and the **task status authority** — with
the in-repo **Markdown** driver and a **mock**.

## Responsibilities (in scope)
- The host-neutral **Work Source contract**: enumerate tasks and their grouping (**tracks**); report
  **eligibility**; **claim / release** a task race-safely, emitting a **TaskSnapshot** at claim (fields, spec refs, content digests, source commit); **read and write task status** (the status
  authority); provide each task's **spec** (inline text and/or **references** to PRD/design docs); and
  the **capability attestation** (`supportsClaim`, `supportsStatusWrite`, `supportsTracks`,
  `supportsDependencies`).
- The task model: id, track, status, spec refs, and a `target/project` field (so multi-project is a
  later routing layer, not baked out).
- The **Markdown driver**: in-repo markdown tracker; tracker-file locking; race-safe claim metadata.
- The **mock**: scripted backlog for offline tests.

## Out of scope
- Storing/authoring PRDs or designs (references only — **not a document store**).
- Run activity (the event log, core-01) and cross-repo routing (future).

## Requirements owned
FR-1 (task intake), FR-11 (status authority, separate from the event log), NFR-EXT, NFR-TEST.

## Dependencies (Dependency Rule)
- Depends on: nothing above Foundation (uses fnd-02 file primitives for locking). Implements the
  Work Source contract.
- Must NOT: depend on the control plane.

## Required reading
Standard set + the two-authorities note in [architecture.md](../../architecture.md) §5.

## Deliverable
`design.md` defining: the Work Source contract + capability set + task model (validated against
markdown **and** the mock); the Markdown mapping (parsing, locking, claim); eligibility rules; the
mock surface.

## Definition of done (domain-specific)
- The contract is satisfiable by the markdown driver AND the mock.
- Task status authority is cleanly separate from the run event log (no cross-writes).
- Claim is race-safe (TOCTOU) under concurrent runs.

## Open questions
- Inter-task dependency model; how expressive eligibility should be.
