---
title: Motivation, goals, requirements
status: paused
owner: arye
last-reviewed: 2026-06-18
---

# Motivation, goals, requirements

← [Back to handoff index](README.md)

## The problem

agentic-workflow-kit's workflow skills produced **per-initiative leaf docs** — a PRD, a technical solution, a tracker, story briefs — but nothing behind them. There was:

- no standing **canonical knowledge base** (no master index, no product/architecture pillars, no rulebook, no per-domain references, no decision records);
- no **authoring standard** (quality guidance was scattered across skill prompts, not a repo-owned file);
- no **promote-to-canonical loop** (nothing folded a shipped initiative's durable decisions back into canonical docs, so canon went stale or never existed);
- diagrams were mandated but not **crafted** (no guidance on type choice or prose pairing).

The reference model the user considers high quality is the OnClass repo's `docs/` tree (`/Users/aryekogan/repos/on-class-web/docs/`): a master `README.md` map, `product/` and `architecture/` pillars, `architecture/{guidelines,system-overview,domains/,decisions/}`, a `docs-style.md` standard, and a clear separation between canonical docs and per-change working docs.

## Goal

The kit should produce **and maintain** a self-maintaining knowledge base: each initiative starts from accurate canon and leaves canon more accurate than it found it. Reader-friendly (high-level index + dive-in sub-pages), with good diagrams where they help.

## Hard requirements (these shaped — and constrain — every design)

- **Configurable-first.** Every path, doc type, status word, template, and the authoring standard itself must be overridable. The kit serves many repos; it *recommends*, it does not *impose*.
- **Presets are recommendations**, not mandates.
- **`workflow-init` detects, it does not impose** — it maps config onto an existing docs layout rather than reshuffling.
- **Repo-owned, runtime-read standard/templates** — skills read the repo's `docs-style.md` and templates at runtime; built-ins are seed + fallback.
- **Mirror parity** — the kit ships a materialized `plugins/agentic-workflow-kit/` copy that must stay byte-identical to the root sources (enforced by tests).
- **English only; no emojis; conventional commits; `pnpm check` is the gate.**

## What "good" looks like

- A repo can `workflow-init` and get an indexed knowledge base scaffold (lean by default, full preset available), every path overridable.
- A full initiative produces docs that conform to the repo-owned standard and link into the pillar indexes.
- Durable decisions from shipped work land in canonical docs (product narrative, architecture topic docs, domain references, ADRs) — without rotting.
