---
"@agentic-workflow-kit/orchestrator": minor
---

Ship the agentic-workflow-kit V1 redesign: one tracker-driven, spec-first delivery pipeline.

- Product-first CLI/MCP API facade with a shared result envelope (`workflow_*` operations) alongside the existing Codex-compatible tool names.
- Agent profiles with model/reasoning/budget policy and conservative launch defaults: explicit `--yes` / `confirmNonDryRun` approval is required before non-dry-run story launches, and `workflow-init` defaults to the conservative `push-only` preset.
- Contract-backed tracker validation and migration; tracker state remains the only completion authority.
- Profile- and budget-aware autonomous runtime: run control/abort, story and track autopilot policy, local pre-PR review-continuity policy, and run-state durability hardened under concurrent claims and partial writes.
- Provider-neutral child-session boundary with `childSession` config, neutral child-control MCP tool aliases, driver-owned error classification, capability downgrades, and a normalized child-session speed policy. Codex MCP is the single shipped V1 driver; existing Codex aliases are preserved.
- GitHub collaboration evidence hardening: auto-merge completion requires parent-verified PR, check, review, merge, and branch-cleanup evidence, with recovery fed from real git/gh state.
- Observability and reporting: run status, streaming, inspect, analyzer, and report/export artifacts, all schema-versioned for later UI/eval consumers.
- Remove the inert `costUsd` budget dimension; configs that set `budget.costUsd` are now rejected by the strict schema.

Known, intentional limitations for this release, surfaced in run evidence rather than hidden: live token telemetry is off (`tokenTelemetryLive: false`), and the structured-output contract is recorded but not enforced (`structuredOutputEnforced: false`).
