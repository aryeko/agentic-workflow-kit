# packages/

This directory is intentionally empty.

The package decomposition — which packages exist, where their boundaries are, and
which Dependency-Rule edges they carry — is DESIGN-OWNED. The design owners add
packages here in a later step, alongside the full architecture and domain designs that
will be repopulated into `docs/`.

Do not create packages or package boundaries outside of that design process.
The active package map is documented in `docs/implementation/package-map.md`.

---

## Role of this directory

`packages/` is the pnpm workspace slot declared in `pnpm-workspace.yaml`:

```yaml
packages:
  - packages/*
```

Any subdirectory added here is automatically picked up by pnpm as a workspace package.

---

## Requirements for packages added here

When the design owners add packages, each package must:

1. Carry its own `package.json` with a scoped name, version, and correct
   `exports`/`types` fields.
2. Carry its own `tsconfig.json` that extends `../../tsconfig.base.json`, sets
   `composite: true`, and declares its `references` to other packages it depends on
   (following the Dependency Rule — see `AGENTS.md`). Contracts may depend on
   foundation and sibling contracts; foundation packages may depend only on sibling
   foundation packages.
3. Be wired into the root `tsconfig.json` solution file as a new entry in
   `references`.
4. Be covered by the dependency-cruiser rules in `.dependency-cruiser.cjs`. Any
   import that violates the Dependency Rule is a CI failure.
5. Follow all conventions in `AGENTS.md`: focused files, immutability, no hardcoded
   secrets, no emojis, TDD, conventional commits.
