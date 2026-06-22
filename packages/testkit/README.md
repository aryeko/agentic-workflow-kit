# testkit

Test-only package. Later stories may place provider mocks, conformance helpers, and incident fixtures
here.

## PackageTargetPathset

This package contributes `packages/testkit`, `packages/testkit/package.json`,
`packages/testkit/README.md`, `packages/testkit/src/`, and `packages/testkit/tests/` to the frozen
package target.

## WorkspacePackageManifest

| field | value |
|---|---|
| packageId | `testkit` |
| packageRoot | `packages/testkit` |
| packageName | `testkit` |
| role | test-only provider mocks, conformance helpers, and incident fixtures |
| moduleType | `module` |
| private | `true` |
| allowedWorkspaceDependencies | `sdk` |

## Epic 0 evidence inventory

### PackageTargetPathset

```txt
packages/cli
packages/mcp
packages/provider-codex
packages/provider-github
packages/provider-local
packages/provider-markdown
packages/sdk
packages/testkit
```

### WorkspacePackageManifest

| packageId | packageRoot | packageName | private | type | workspace dependencies |
|---|---|---|---|---|---|
| `cli` | `packages/cli` | `cli` | `true` | `module` | `provider-codex`, `provider-github`, `provider-local`, `provider-markdown`, `sdk` |
| `mcp` | `packages/mcp` | `mcp` | `true` | `module` | `provider-codex`, `provider-github`, `provider-local`, `provider-markdown`, `sdk` |
| `provider-codex` | `packages/provider-codex` | `provider-codex` | `true` | `module` | `sdk` |
| `provider-github` | `packages/provider-github` | `provider-github` | `true` | `module` | `sdk` |
| `provider-local` | `packages/provider-local` | `provider-local` | `true` | `module` | `sdk` |
| `provider-markdown` | `packages/provider-markdown` | `provider-markdown` | `true` | `module` | `sdk` |
| `sdk` | `packages/sdk` | `sdk` | `true` | `module` | none |
| `testkit` | `packages/testkit` | `testkit` | `true` | `module` | `sdk` |

## Skeleton boundary

This package intentionally contains no domain behavior, provider driver logic, credential handling,
network calls, process execution, or forge integration.
