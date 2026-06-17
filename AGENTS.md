# AGENTS.md

Guidance for AI agents (and humans) working in this repo. For the full contributor guide see
[CONTRIBUTING.md](CONTRIBUTING.md); for how the system fits together see
[docs/architecture.md](docs/architecture.md).

## Project purpose

agentic-workflow-kit is a generic, OSS Claude Code + Codex plugin with a package-backed MCP runtime plus an
optional standalone TypeScript orchestrator CLI.
It turns a repo into a tracker-driven, spec-first delivery pipeline where per-repo policy —
especially PR and merge gating — lives in `.workflow/config.yaml` rather than forked skills.

The shared contract:

- `.workflow/config.yaml` defines paths, status buckets, verification commands, git strategy, and
  PR/merge policy.
- Markdown trackers under `<tracksDir>/<track>/README.md` are the only source of truth for story
  state, dependencies, ownership, and completion.
- Plugin skills and the orchestrator read the same config and tracker contract.

## Repository layout

- `.claude-plugin/` contains the Claude Code plugin and marketplace manifests; root `.mcp.json` wires
  the package-backed MCP runtime for Claude Code plugin installs.
- `.codex-plugin/` contains Codex plugin metadata; `.agents/plugins/marketplace.json` and the
  materialized `plugins/agentic-workflow-kit/` copy provide the local Codex marketplace fixture. Keep that
  fixture byte-in-sync with `.codex-plugin/`, `skills/`, `references/`, `presets/`, and `examples/`;
  keep its surface-specific `.mcp.json` materialized.
- `skills/` contains the shared plugin skills: `workflow-init`, `define-product`, `design-technical-solution`, `plan-delivery-track`, `implement-next`, and `workflow-autopilot`. These also provide the slash-command entry points; there is no separate `commands/` layer.
- `references/` contains the canonical config schema, tracker contract, PRD contract, technical solution contract, and templates.
  Keep the human and machine schema docs in sync.
- `presets/` contains the three starter configs.
- `examples/` contains worked PRD and tracker examples.
- `packages/orchestrator/` contains the TypeScript orchestrator source, MCP server adapter, and CLI, including the shared config schema (Zod), loader, presets, and JSON Schema generation.
- `test/` validates manifests, schemas, presets, tracker docs, examples, and shared TypeScript.
- `docs/` contains the architecture, the docs hub, and the getting-started guide.
- `docs/superpowers/` holds a story's **transient** spec and plan; they are not canonical docs (see
  the Conventions section).

## Build and verification

Use pnpm 11.5.1 (pinned by `packageManager`).

```bash
pnpm install
pnpm check
```

`pnpm check` (Biome lint + typecheck + Vitest) is the required gate before reporting work as
complete. For targeted edits, run the nearest focused test first, then `pnpm check` before final
handoff. Report any skipped or failed verification with the exact reason.

## Config and tracker contract rules

- Treat `references/config.schema.json` as the machine-readable contract; it is generated from the
  Zod schema in `packages/orchestrator/src/config/schema.ts` and pinned byte-for-byte by a drift test.
- Treat `references/config-schema.md` as the human mirror; update it and the sync tests when the
  schema changes.
- Treat `references/tracker-contract.md` as the canonical tracker format.
- Keep preset YAML files fully populated and schema-valid.
- Keep automation-significant statuses mapped through `statuses.eligible`, `statuses.inProgress`,
  and `statuses.complete`.
- Never infer story completion from a child session's prose. Completion comes from tracker state.

## Plugin authoring rules

- Skills are instruction-first; add scripts only when deterministic behavior or repeated mechanical
  work justifies them.
- Skill descriptions must be concise and trigger-specific so agents invoke the right skill.
- Plugin metadata belongs in `.claude-plugin/` and `.codex-plugin/`; MCP plugin wiring belongs in
  root `.mcp.json` for Claude and `.codex-plugin/.mcp.json` for Codex; reusable workflow
  instructions belong in `skills/<name>/SKILL.md`; durable contracts belong in `references/`.
- Side-effectful skills (`implement-next`, `workflow-autopilot`) are explicit-invocation-only on
  both the Claude and Codex surfaces.
- `workflow-init` must remain idempotent: it may reconcile missing config keys and report drift, but
  it must not overwrite an existing config or tracker without explicit confirmation.

## Conventions

- No emojis in code, comments, docs, manifests, or commit messages.
- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`); no AI attribution.
- Pull request title and body are a contract, not freeform. Title is one Conventional Commit line.
  Body follows [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md): `## What`
  (change and why; link the tracker story or issue), `## How` (decisions a reviewer needs),
  `## Test plan` (commands run and their real result), then `## Type of change` / `## Checklist`.
  Base the summary on the full diff (`git diff main...HEAD`), not the last commit. PR/merge **gating**
  (CI wait, review bot, merge method) stays in `.workflow/config.yaml`, not here.
- Prefer immutable data and small, focused files.
- If a change alters public behavior, update the relevant docs, schemas, presets, examples, and
  tests in the same change.
- Canonical docs only on `main`. A story's spec/plan live under `docs/superpowers/` as working
  artifacts: add them in the story's first commit, then in the **final commit delete them and fold
  the durable content into the canonical docs**. See
  [docs/superpowers/README.md](docs/superpowers/README.md).

## Status

agentic-workflow-kit plugin and package manifests are versioned together. The current plugin ships
the six skills, package-backed MCP runtime wiring, shared contracts, presets, and worked examples.
The `@agentic-workflow-kit/orchestrator` package remains the CLI and MCP runtime source. Local
plugin fixtures and smoke tests remain the development validation path for changes to the Claude Code
and Codex plugin surfaces.
