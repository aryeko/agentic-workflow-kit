# Documentation

This is the root of the kit-vnext documentation tree.

## What lives here now

| Path | Contents |
|---|---|
| `roadmap.md` | High-level rebuild tracker — branches, ownership, step status |
| `foundation/` | Foundation infrastructure docs: verify gate, test lanes, dependency enforcement, tooling, CI, and scaffold record |

## What arrives later

The architecture, decision records (AD-* series), domain designs, and postmortems
currently live on the `design/autopilot-durability` branch. They arrive in `docs/`
via a later PR (roadmap Step 3 + Step 4) once the design corpus is finished,
adversarially reviewed, and approved. At that point the `kit-vnext/` path qualifier
used on the design branch is dropped and the docs are placed directly at `docs/`.

Until then, the files in this directory describe only the package-agnostic
infrastructure that was laid down in the foundation pass.
