---
"@agentic-workflow-kit/orchestrator": minor
---

Add a docs knowledge-base layer so the kit produces and maintains canonical docs, not just per-initiative leaf docs.

Introduces a configurable `docs` config block (config schema version `0.7.0`, additive and backward compatible with `0.6.0`) covering pillar paths, a `lean`/`full` preset, doc-type toggles, and promote settings. Adds an `architecture/designs/` staging location for technical designs with a Canonical impact section; ADR and domain-reference doc types with templates and contracts; a repo-owned, overridable `docs-style.md` authoring standard with diagram-craft guidance; a grow-in-place story spec that replaces the separate brief plus detailed spec; a dependency-terminal promote story gated at track completion; and a new `promote-to-canonical` skill that folds shipped work back into canonical docs. `workflow-init` now scaffolds the knowledge base (lean default, full preset) and detects an existing docs layout instead of imposing one.
