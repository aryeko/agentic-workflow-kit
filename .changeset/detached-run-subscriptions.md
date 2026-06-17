---
"@agentic-workflow-kit/orchestrator": minor
---

Add detached run-event subscriptions across the CLI and MCP product API. Hosts can now create durable
subscription records with stored filters and cursor state, watch wake signal artifacts, poll with
acknowledged `events.ndjson:<lineCount>` cursors, and close subscriptions without changing the
workflow config schema.
