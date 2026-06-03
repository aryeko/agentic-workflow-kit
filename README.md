<p align="center">
  <img src="assets/branding/rail-contract/hero-1280x400.png" alt="agentic-workflow-kit — one tracker, two drivers" width="100%" />
</p>

[![CI](https://github.com/aryeko/agentic-workflow-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/aryeko/agentic-workflow-kit/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) [![Node >=24](https://img.shields.io/badge/node-%3E%3D24-brightgreen)](https://nodejs.org)

A generic, OSS Claude Code plugin (plus an optional orchestrator) that turns any repo into a
**tracker-driven, spec-first delivery pipeline** — and makes the per-repo differences (most
notably PR/merge gating) **declarative config** rather than forked skills.

The core idea: one **markdown tracker** (a status matrix + dependency graph) plus one
**`.workflow/config.yaml`** form a single contract that two interchangeable drivers read — an
**interactive** "one story at a time" skill and an **autonomous** multi-session orchestrator.

## Architecture

```mermaid
flowchart LR
  subgraph Author["Author (skills)"]
    PP[plan-product] --> PT[plan-track]
  end
  WI[workflow-init] --> CFG
  PT --> TRK
  subgraph Contract["Shared contract (the spine)"]
    CFG[".workflow/config.yaml"]
    TRK["markdown trackers"]
  end
  CFG --> IN["implement-next<br/>(interactive)"]
  TRK --> IN
  CFG --> OR["orchestrator<br/>(autonomous)"]
  TRK --> OR
  OR --> CODEX["Codex MCP child sessions"]
  CODEX -. update .-> TRK
```

`workflow-init` scaffolds the config; `plan-product` and `plan-track` produce the PRD and tracker.
That config + tracker is the single contract both drivers consume. Completion authority is always
the tracker row — never a child session's prose. Full detail and more diagrams in
[docs/architecture.md](docs/architecture.md).

## How it works

```mermaid
flowchart LR
  A["/workflow-init<br/>config + scaffolding<br/><i>(once per repo)</i>"] --> B["/plan-product<br/>author PRD"]
  B --> C["/plan-track<br/>PRD → tracker + specs"]
  C --> D{Drive how?}
  D -->|interactive| E["/implement-next<br/>one story end-to-end"]
  D -->|autonomous| F["orchestrator run-eligible<br/>fan out child sessions"]
  E --> G["ship per pr: policy<br/>(create / CI / review / merge)"]
  F --> G
  G --> H{More eligible<br/>stories?}
  H -->|yes| D
  H -->|no| I["track complete"]
```

1. **Set up once** — `/workflow-init` detects your package manager, CI, default branch, and branch
   protection, picks a PR/merge preset, writes `.workflow/config.yaml`, and scaffolds a tracks
   index plus an example tracker.
2. **Plan the product** — `/plan-product` runs a guided interview into a multi-file PRD.
3. **Decompose into a tracker** — `/plan-track` turns the PRD into a tracker plus per-story specs.
4. **Implement** — `/implement-next` takes one eligible story end-to-end (isolate → spec review →
   plan → implement → review → verify → ship), or the optional orchestrator fans eligible stories
   out to Codex child sessions autonomously.
5. **Ship** — under the declarative `pr:` policy (open a PR, wait on CI/review, auto-merge — or
   not), then repeat until the tracker is drained.

## PR/merge presets

The one block that genuinely differs between repos is `pr:`. Pick a preset and go:

| Preset | Waits on CI | Waits on review | Auto-merge | Mirrors |
| --- | --- | --- | --- | --- |
| `push-and-merge` | no | no | yes (squash) | a repo that ships fast |
| `gated-automerge` | yes | bot (e.g. codex) | yes (squash) | a repo with CI + bot review |
| `push-only` | no | no | no (open PR, stop) | a repo with human review gates |

Switch behavior by editing the `pr:` block in `.workflow/config.yaml`. See
[references/config-schema.md](references/config-schema.md).

## Documentation

- [docs/README.md](docs/README.md) — documentation hub (using vs developing)
- [docs/architecture.md](docs/architecture.md) — architecture, flows, and runtime diagrams
- [docs/getting-started.md](docs/getting-started.md) — a guided walkthrough using the Linkly example
- [references/config-schema.md](references/config-schema.md) — the `.workflow/config.yaml` reference
- [references/tracker-contract.md](references/tracker-contract.md) — the tracker format + status vocabulary
- [references/prd-contract.md](references/prd-contract.md) — the PRD format
- [examples/](examples/) — a worked PRD and tracker (Linkly)
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to develop and contribute
- [docs/brand.md](docs/brand.md) — the visual identity (logo, color, type, social/SEO kit)

## Install

Install commands are **planned**, not live — see [Project status](#project-status).

### Claude Code plugin

```text
/plugin marketplace add aryeko/agentic-workflow-kit
/plugin install agentic-workflow-kit@agentic-workflow-kit
```

### Codex plugin

Use the Codex plugin marketplace entry once agentic-workflow-kit is published. The exact public install
command stays deferred until the marketplace submission is real.

### Optional orchestrator package

```text
pnpm add -D @agentic-workflow-kit/orchestrator
```

## Local development

```bash
pnpm install
pnpm check
pnpm agentic-workflow-kit -- --help
```

Optional local Codex plugin smoke requires the Codex CLI. It is intentionally outside `pnpm check`
so the default development gate works on machines that only have the package toolchain installed.

## Local plugin testing

The repository includes local-only plugin metadata for pre-publish testing:

- Claude Code: load this repo with `claude --plugin-dir ./`, then invoke namespaced skills such as
  `/agentic-workflow-kit:workflow-init`.
- Codex: use `.agents/plugins/marketplace.json` as the local marketplace fixture. It points to the
  materialized repository-contained fixture at `./plugins/agentic-workflow-kit` and does not imply public
  availability.

```bash
tmp_home="$(mktemp -d)"
CODEX_HOME="$tmp_home" codex plugin marketplace add .
CODEX_HOME="$tmp_home" codex plugin list
CODEX_HOME="$tmp_home" codex plugin add agentic-workflow-kit@agentic-workflow-kit-local
CODEX_HOME="$tmp_home" codex plugin list
```

The same Codex install and prompt-visibility check is available as:

```bash
pnpm smoke:codex-plugin
```

Keep manual plugin smokes pending until they are run in the relevant tool environment.

## Layout

- `skills/` — the plugin's instructions and slash-command entry points.
- `references/` — the config schema (human + machine), the tracker contract, the PRD contract, and templates.
- `presets/` — the three starter configs.
- `examples/` — a worked PRD and tracker.
- `packages/orchestrator/` — the optional TypeScript runtime: the config schema, loader, and presets plus the autonomous multi-session orchestrator and CLI.
- `docs/` — architecture, the docs hub, and the getting-started guide.

## Project status

agentic-workflow-kit is **feature-complete locally**: the five skills (`workflow-init`, `plan-product`,
`plan-track`, `implement-next`, `workflow-autopilot`), the contracts, the three presets, the worked
examples, and the optional `@agentic-workflow-kit/orchestrator` package are implemented and covered by the
test suite (`pnpm check`).

It has **not** been published. Treat all marketplace and npm install commands above as planned, not
live, until the repository is pushed and published with explicit approval. The agent-driven skills
and a live orchestrator dispatch still need end-to-end smoke runs before broad reliance.
