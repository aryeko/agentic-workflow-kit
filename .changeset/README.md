# Changesets

This folder is managed by [Changesets](https://github.com/changesets/changesets). It drives versioning,
changelog generation, and npm publishing for `@agentic-workflow-kit/orchestrator`.

## Adding a changeset

When you make a change that should appear in a release, run:

```bash
pnpm changeset
```

Pick the package(s) and the semver bump (patch / minor / major) and write a short summary. Commit the
generated file under `.changeset/` with your change.

## Releasing (automated)

On merge to `main`, the `release` workflow uses the accumulated changesets to open a "Version Packages"
PR (version bumps + `CHANGELOG.md`). Merging that PR publishes the package to npm. See
[the changesets docs](https://github.com/changesets/changesets/blob/main/docs/intro-to-using-changesets.md).
