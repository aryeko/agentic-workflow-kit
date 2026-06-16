---
"@agentic-workflow-kit/orchestrator": minor
---

Add a product-first CLI and MCP API facade with a shared result envelope (`ok`, `operation`, `apiVersion`, `project`, `result`, `artifacts`, `warnings`, `next`) and structured error codes. New `workflow_*` operations cover project inspection, run preview, run status/stream/inspect, run report/export, and run control/abort, exposed as both MCP tools and `agentic-workflow-kit` CLI subcommands. Existing tool names are preserved for compatibility.
