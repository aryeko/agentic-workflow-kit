---
title: kit-vnext - research & provenance (non-normative)
status: reference
---

# Research & provenance

This directory holds **dormant provenance**: prior-art reviews, superseded research, applied-change
records, and historical investigation that informed the frozen design but is **not part of the
normative corpus**. It is deliberately excluded from documentation navigation (the same treatment as
`**/evidence/`), so nothing here is part of the reading flow.

When the frozen design in [`../design/`](../design/) conflicts with anything here, the design wins.
Material is kept for traceability and future reference, not as a source of current obligations.

## Contents

- [`apply/`](apply/) — the design-closure apply report; record of which closure decisions were applied
  to the design corpus, cited as an evidence anchor by the reviews below.
- [`codex-agent-provider/`](codex-agent-provider/) — Agent provider needs/requirements and the Codex
  provider research (app-server / CLI / MCP) that informed the now-frozen Agent provider contract.
  The normative contract lives in
  [`../design/30-domain-reference/providers/agent-execution/`](../design/30-domain-reference/providers/agent-execution/).
- [`langchain-review/`](langchain-review/) — first-pass review of the LangChain ecosystem for kit-vnext.
- [`langchain-leverage/`](langchain-leverage/) — second-pass leverage review (fixtures/patterns and
  post-seam adapter spikes). Both LangChain reviews are a watchlist behind provider seams, not a
  near-term dependency.
- [`history/`](history/) — pre-restructure autopilot-durability research and postmortems cited as
  historical provenance by the Codex provider reports.
