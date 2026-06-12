---
"@agentic-workflow-kit/orchestrator": patch
---

Fix autopilot supervision and analysis for merged child runs by separating supervisor polls from child progress, refreshing completion authority from the base tracker after merged PR evidence, returning MCP run_eligible launch receipts quickly, and reporting stale parent snapshots with per-story merge/review/verification evidence.
