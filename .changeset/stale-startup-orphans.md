---
"@agentic-workflow-kit/orchestrator": patch
---

Harden workflow-autopilot child startup supervision with a short startup acknowledgement timeout, explicit requested/launched/startup-failed launch states, stale startup duplicate recovery, tracker claim release for unacknowledged startup failures, and analyzer reporting for startup-pending and startup-stale children.
