# provider-codex

Codex agent provider package. Later stories may place the concrete driver behind SDK-owned ports here.

## PackageTargetPathset

This package contributes `packages/provider-codex`, `packages/provider-codex/package.json`,
`packages/provider-codex/README.md`, `packages/provider-codex/src/`, and
`packages/provider-codex/tests/` to the frozen package target.

## WorkspacePackageManifest

| field | value |
|---|---|
| packageId | `provider-codex` |
| packageRoot | `packages/provider-codex` |
| packageName | `provider-codex` |
| role | AgentProvider driver for the Codex protocol |
| moduleType | `module` |
| private | `true` |
| allowedWorkspaceDependencies | `sdk` |

## Skeleton boundary

This package intentionally contains no domain behavior, provider driver logic, credential handling,
network calls, process execution, or forge integration.
