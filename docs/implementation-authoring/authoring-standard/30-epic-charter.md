---
title: "Epic charter — Layer 2"
status: draft
last-reviewed: "2026-06-22"
---

# Epic charter (Layer 2)

> **Audience** — architect (authoring) · characterization reviewer (grading).
> **Job** — the work-item milestone altitude. One epic charter frames a **reviewable capability band** over
> a set of domains: what becomes possible when they land together, what later epic it unblocks, and the
> scope that bounds its stories. It bounds the stories; it does **not** pre-write them. No story-level
> detail leaks up.
> **To author one** — copy [`_templates/epic-charter.md`](_templates/epic-charter.md), fill the required
> sections, then tick every box in [Gate 2](#gate-2--planning-ready).

## Required sections

Keep each to the epic frame; per-story detail belongs in story contracts.

| Section | Holds |
|---|---|
| **Purpose** | what this epic makes possible |
| **Included domains** | table: `domain · role in this epic · primary spec surface` |
| **Why this epic exists** | why these domains become eligible together and the later epic they unblock |
| **Frozen inputs** | prior epic outputs and design sources this epic consumes |
| **Outputs** | the contract surfaces / packages / modules / tests / evidence this epic must leave behind |
| **Scope boundaries** | `In:` · `Out:` · `STOP when:` |
| **Per-domain expectations** | per domain, **only the `Story Group Signals` this epic owns** + disposition: each owned signal maps to exactly one story (`TBD` until the story DAG freezes) or carries a `deferred(<why>, <until>)` row; signals owned by another epic are **absent here** (partition), tracked in `coverage.md` — no `deferred` rows for them. Each domain block ends with an **Evidence expectation** |
| **Epic readiness** | the conditions that make the next epic safe to author or dispatch |
| **Deferred work** | work intentionally left to later epics, named by owning domain or epic |

## Gate 2 — planning-ready

An epic charter is planning-ready only when all five hold; an empty box means not ready, and its story DAG
must not be authored.

- [ ] **Domains map down.** Every included domain has a frozen domain charter, and its role here is
      consistent with that charter's `What` and `Downstream Epics`.
- [ ] **Coverage table present and traceable.** `Per-domain expectations` lists only the signals this epic
      owns; every one traces to that charter; partitioned signals owned by other epics are absent (not
      `deferred`); and no signal this epic owns is also `covered` by another epic in `coverage.md`
      (exactly-once).
- [ ] **Outputs are concrete.** Each output names a contract surface, package, module, test lane, or
      evidence artifact — not an adjective like "robust" or "complete".
- [ ] **Readiness names the unblock.** `Epic readiness` states the conditions that make the next epic safe
      to author or dispatch, in terms a later author can check.
- [ ] **Edges match the DAG.** `depends-on-epics` and dependency prose agree with [`epic-dag.md`](../../implementation/epic-dag.md);
      no edge rationale the DAG owns is re-argued.
- [ ] **No story detail leaks up.** No acceptance criteria, DTO field lists, event payloads, test
      catalogues, or file layouts appear; those are story surface.
