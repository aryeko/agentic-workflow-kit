---
"@agentic-workflow-kit/orchestrator": minor
---

Add runtime and workflow config schema version surfaces across the CLI and MCP runtime. The CLI now reports package/runtime metadata and can inspect or explicitly upgrade workflow config schema versions, while the MCP server advertises the package version and exposes runtime/config status and upgrade tools. Legacy `version: 1` workflow configs remain readable and can be upgraded to the semver schema version `0.6.0`; unsupported older or newer semver configs now fail with actionable compatibility messages.
