# Foundation Infrastructure

This directory documents the package-agnostic infrastructure laid down during
the foundation pass (roadmap Step 1). All files here describe tooling, gates,
and constraints that apply across the entire monorepo, regardless of which
packages design owners later add.

**Scope boundary:** these docs cover infra only. The package decomposition
(what packages exist, what they are named, how they are layered) is
design-owned and will be decided when the domain designs are finalised
(roadmap Step 2). Nothing in this directory presupposes or recommends a
particular package structure.

## Index

| File | Contents |
|---|---|
| `decisions.md` | Foundation infra ADRs (FD-1 through FD-7) — what was decided and why |
| `check-gate.md` | The verify gate: step composition, ordering rationale, local vs CI split |
| `test-lanes.md` | The four Vitest lanes, the zero-real-process guard, and how NFR-TEST is met |
| `dependency-rule-enforcement.md` | The Dependency Rule, two enforcement guards, committed baseline, and the layer-rule template for design owners |
| `tooling-and-ci.md` | Toolchain, TypeScript config layout, build strategy, and GitHub Actions workflows |
| `scaffold-record.md` | Durable record of exactly what the foundation pass dropped, kept, and built |
