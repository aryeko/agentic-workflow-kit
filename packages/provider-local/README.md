# provider-local

Local execution host provider package. Later stories may place the concrete driver behind SDK-owned
ports here.

## PackageTargetPathset

This package contributes `packages/provider-local`, `packages/provider-local/package.json`,
`packages/provider-local/README.md`, `packages/provider-local/src/`, and `packages/provider-local/tests/`
to the frozen package target.

## WorkspacePackageManifest

| field | value |
|---|---|
| packageId | `provider-local` |
| packageRoot | `packages/provider-local` |
| packageName | `provider-local` |
| role | ExecutionHostProvider driver for local execution |
| moduleType | `module` |
| private | `true` |
| allowedWorkspaceDependencies | `sdk` |

## Skeleton boundary

This package intentionally contains no domain behavior, provider driver logic, credential handling,
network calls, process execution, or forge integration.
