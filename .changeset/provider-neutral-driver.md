---
"@agentic-workflow-kit/orchestrator": minor
---

Add a provider-neutral child-session driver boundary: a `childSession` config namespace, neutral child-control MCP tool aliases (`workflow_child_reply`, `workflow_child_interrupt`, `workflow_driver_check`), driver-owned error classification and capability downgrades, and a normalized child-session speed policy (`derive` | `fast` | `standard`). Codex MCP is the single shipped V1 driver; existing `codex_*` aliases and the Codex artifact layout are preserved.
