# cli

Terminal executable package. Later stories may place CLI startup and explicit provider wiring here.

## PackageTargetPathset

This package contributes `packages/cli`, `packages/cli/package.json`, `packages/cli/README.md`,
`packages/cli/src/`, and `packages/cli/tests/` to the frozen package target.

## WorkspacePackageManifest

| field | value |
|---|---|
| packageId | `cli` |
| packageRoot | `packages/cli` |
| packageName | `cli` |
| role | terminal executable; provider wiring; filesystem store wiring |
| moduleType | `module` |
| private | `true` |
| allowedWorkspaceDependencies | `sdk`, `provider-codex`, `provider-github`, `provider-local`, `provider-markdown` |

## Skeleton boundary

This package intentionally contains no domain behavior, provider driver logic, credential handling,
network calls, process execution, or forge integration.
