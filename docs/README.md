# agentic-workflow-kit documentation

Start here. This hub separates **using** agentic-workflow-kit from **developing** it.

## Using agentic-workflow-kit

| Doc | What it covers |
| --- | --- |
| [../README.md](../README.md) | What it is, the architecture and end-to-end flow, presets, install |
| [getting-started.md](./getting-started.md) | A guided walkthrough using the worked Linkly example |
| [architecture.md](./architecture.md) | Architecture, story lifecycle, eligibility, bundled MCP runtime, standalone CLI, and orchestrator flow (with diagrams) |
| [../references/config-schema.md](../references/config-schema.md) | The `.workflow/config.yaml` reference (every field, default, meaning) |
| [../references/tracker-contract.md](../references/tracker-contract.md) | The tracker format + status vocabulary + eligibility rule |
| [../references/prd-contract.md](../references/prd-contract.md) | The PRD format consumed by `plan-architecture` and `plan-track` |
| [../references/technical-architecture-contract.md](../references/technical-architecture-contract.md) | The architecture gate format consumed by `plan-track` for complex technical work |
| [../examples/example-prd/README.md](../examples/example-prd/README.md) | A full worked PRD (Linkly) |
| [../examples/example-tracker/README.md](../examples/example-tracker/README.md) | A worked tracker with a dependency graph |
| [../presets/](../presets/) | The three starter `pr:` configs |

## Developing agentic-workflow-kit

| Doc | What it covers |
| --- | --- |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | How to build, test, and contribute |
| [../AGENTS.md](../AGENTS.md) | Guidance for AI agents working in the repo |
| [superpowers/README.md](./superpowers/README.md) | Per-story spec/plan lifecycle: transient working artifacts, consumed into canonical docs before merge |

## Conventions

- No emojis in code, comments, docs, or commit messages.
- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`); no AI attribution.
- Immutable data, small focused files.
- Canonical docs only on `main`; a story's spec/plan are transient working artifacts (see [superpowers/README.md](./superpowers/README.md)).
- `pnpm check` (Biome lint + typecheck + Vitest) is the gate before any change is considered done.
