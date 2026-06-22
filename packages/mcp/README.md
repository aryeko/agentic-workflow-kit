# mcp

MCP server executable package. Later stories may place MCP startup and explicit provider wiring here.

## PackageTargetPathset

This package contributes `packages/mcp`, `packages/mcp/package.json`, `packages/mcp/README.md`,
`packages/mcp/src/`, and `packages/mcp/tests/` to the frozen package target.

## WorkspacePackageManifest

| field | value |
|---|---|
| packageId | `mcp` |
| packageRoot | `packages/mcp` |
| packageName | `mcp` |
| role | MCP server executable; provider wiring; filesystem store wiring |
| moduleType | `module` |
| private | `true` |
| allowedWorkspaceDependencies | `sdk`, `provider-codex`, `provider-github`, `provider-local`, `provider-markdown` |

## Skeleton boundary

This package intentionally contains no domain behavior, provider driver logic, credential handling,
network calls, process execution, or forge integration.
