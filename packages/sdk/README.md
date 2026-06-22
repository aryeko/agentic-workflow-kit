# sdk

Core runtime library package. Later stories may place provider interfaces, storage ports, and
deterministic SDK runtime code here.

## PackageTargetPathset

This package contributes `packages/sdk`, `packages/sdk/package.json`, `packages/sdk/README.md`,
`packages/sdk/src/`, and `packages/sdk/tests/` to the frozen package target.

## WorkspacePackageManifest

| field | value |
|---|---|
| packageId | `sdk` |
| packageRoot | `packages/sdk` |
| packageName | `sdk` |
| role | core runtime library; provider interfaces; storage ports and defaults |
| moduleType | `module` |
| private | `true` |
| allowedWorkspaceDependencies | none |

## Skeleton boundary

This package intentionally contains no domain behavior, provider driver logic, credential handling,
network calls, process execution, or forge integration.
