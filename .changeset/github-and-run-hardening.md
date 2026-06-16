---
"@agentic-workflow-kit/orchestrator": patch
---

Harden collaboration and runtime durability:

- GitHub auto-merge completion requires parent-verified PR, check, review, merge, and branch-cleanup evidence, with recovery driven by real git/`gh` state.
- Run-state writes are atomic and safe under concurrent tracker claims; malformed artifacts are tolerated on read.
- API errors carry typed, structured error codes.

Two intentional limitations are recorded in run evidence rather than hidden: live token telemetry is off (`tokenTelemetryLive: false`), and the structured-output contract is recorded but not enforced (`structuredOutputEnforced: false`).
