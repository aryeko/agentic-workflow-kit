# provider-github

GitHub forge provider package. Later stories may place the concrete driver behind SDK-owned ports here.

## PackageTargetPathset

This package contributes `packages/provider-github`, `packages/provider-github/package.json`,
`packages/provider-github/README.md`, `packages/provider-github/src/`, and
`packages/provider-github/tests/` to the frozen package target.

## WorkspacePackageManifest

| field | value |
|---|---|
| packageId | `provider-github` |
| packageRoot | `packages/provider-github` |
| packageName | `provider-github` |
| role | ForgeProvider driver for GitHub push, pull request, and merge operations |
| moduleType | `module` |
| private | `true` |
| allowedWorkspaceDependencies | `sdk` |

## Skeleton boundary

This package intentionally contains no domain behavior, provider driver logic, credential handling,
network calls, process execution, or forge integration.
