# provider-markdown

Markdown work source provider package. Later stories may place the concrete driver behind SDK-owned
ports here.

## PackageTargetPathset

This package contributes `packages/provider-markdown`, `packages/provider-markdown/package.json`,
`packages/provider-markdown/README.md`, `packages/provider-markdown/src/`, and
`packages/provider-markdown/tests/` to the frozen package target.

## WorkspacePackageManifest

| field | value |
|---|---|
| packageId | `provider-markdown` |
| packageRoot | `packages/provider-markdown` |
| packageName | `provider-markdown` |
| role | WorkSourceProvider driver for Markdown task tracking |
| moduleType | `module` |
| private | `true` |
| allowedWorkspaceDependencies | `sdk` |

## Skeleton boundary

This package intentionally contains no domain behavior, provider driver logic, credential handling,
network calls, process execution, or forge integration.
