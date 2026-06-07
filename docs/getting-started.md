# Getting started

A guided walkthrough of the agentic-workflow-kit pipeline, using the worked **Linkly** example shipped in
[`examples/`](../examples/). Linkly is a minimal URL shortener; the example takes it from PRD to a
sequenced tracker so you can see the shape before running the tools on your own repo.

> Install commands are live for v0.1.0 — see [Project status](../README.md#project-status).
> The local checkout commands below remain useful for development and smoke validation.

## Prerequisites

```bash
pnpm install
pnpm check        # Biome lint + typecheck + Vitest — should be green
```

The plugin install includes a bundled MCP runtime for `workflow-autopilot`. The standalone
orchestrator CLI is available locally as:

```bash
pnpm agentic-workflow-kit -- --help
```

## The pipeline at a glance

```mermaid
flowchart LR
  A["/workflow-init"] --> B["/define-product"] --> C["/plan-delivery-track"] --> D["/implement-next<br/>or orchestrator"]
  B --> E["/design-technical-solution<br/>(when needed)"] --> C
```

Each step writes into the shared contract (`.workflow/config.yaml` + a markdown tracker) that the
next step reads. See [architecture.md](./architecture.md) for the full picture.

## 1. Initialize a repo

In a target repo, run the skill:

```text
/workflow-init
```

It detects your package manager, CI, default branch, and branch protection, picks a PR/merge
preset, writes `.workflow/config.yaml`, and scaffolds a tracks index plus an example tracker. It is
idempotent — re-running reconciles missing keys and never overwrites an existing config or tracker
without confirmation.

Pick the preset that matches your repo (you can change it later by editing the `pr:` block):

| Preset | Use when |
| --- | --- |
| `push-and-merge` | You ship fast: open a PR, best-effort local checks, auto-squash-merge. |
| `gated-automerge` | You have CI + a bot reviewer: wait on both, then auto-merge. |
| `push-only` | Humans gate merges: open a PR and stop. |

## 2. Author a PRD

```text
/define-product
```

A guided interview produces a multi-file PRD under `<prdsDir>/<slug>/`. The worked result looks
like [examples/example-prd/](../examples/example-prd/README.md): a `README.md` index with a document
map, then numbered sections (`01-context`, `08-acceptance-criteria`, and so on). The PRD owns
*what/why*; it carries ID'd acceptance criteria (e.g. `L-1`, `A-1`) that the tracker links back to.

## 3. Plan technical solution when needed

```text
/design-technical-solution
```

For simple products, `define-product` can recommend going straight to `plan-delivery-track`. For complex
technical work - new modules, data/query changes, AI prompts/tools, observability, migrations,
security boundaries, or multi-system integration - `design-technical-solution` writes
`<prdsDir>/<slug>/technical-solution.md` before tracker decomposition.

## 4. Decompose into a tracker

```text
/plan-delivery-track
```

`plan-delivery-track` reads the PRD, requires a technical solution for complex technical PRDs, and emits a tracker
plus lightweight story briefs. The worked result is
[examples/example-tracker/](../examples/example-tracker/README.md):

- a **dependency graph** (Mermaid) showing hard dependencies,
- a **status matrix** table — one row per story (`LK01`, `LK02`, `LK03`), each mapping back to a
  PRD acceptance-criteria ID,
- **story briefs** under `stories/`, which are not implementation-ready,
- **parallelism rules** explaining why each wave is ordered the way it is.

Validate that a tracker actually parses by pointing the orchestrator at it:

```bash
pnpm agentic-workflow-kit -- list-stories --tracks-dir examples --config presets/push-only.yaml
pnpm agentic-workflow-kit -- list-eligible --tracks-dir examples --config presets/push-only.yaml
```

agentic-workflow-kit's own repo ships no `.workflow/config.yaml`, so we point the orchestrator at the
`push-only` preset (a safe read/no-merge config); in a real consumer repo that ran `/workflow-init`,
the config is auto-discovered and the flag is unnecessary.

`list-eligible` applies the eligibility rule (status is pickable, unowned, all dependencies
complete) — see the decision diagram in [architecture.md](./architecture.md#eligibility).

## 5. Implement

Two ways to drive the same tracker:

**Interactive — one story at a time:**

```text
/implement-next
```

Takes the next eligible story end-to-end: isolate (worktree/branch) → spec review → plan →
implement → review → verify → mark done → ship under your `pr:` policy.

**Autonomous — fan out:**

When installed as a Claude Code or Codex plugin, invoke `workflow-autopilot` and prefer the bundled
MCP tools. Use the standalone CLI when developing this repo, running CI checks, or troubleshooting
outside a plugin session:

```bash
pnpm agentic-workflow-kit -- mcp check                 # verify the Codex MCP tool schema
pnpm agentic-workflow-kit -- run-eligible --dry-run --tracks-dir examples --config presets/push-only.yaml    # show what would dispatch, no side effects
pnpm agentic-workflow-kit -- run-eligible --tracks-dir examples --config presets/push-only.yaml              # launch child sessions (needs the Codex CLI)
```

The orchestrator launches up to `orchestrator.maxParallel` child sessions, re-reads the tracker
after each returns, and treats the tracker row — not the child's prose — as the completion
authority. Run artifacts land under `.codex/agentic-workflow-kit/runs/<runId>/`; inspect them with:

```bash
pnpm agentic-workflow-kit -- analyze-run .codex/agentic-workflow-kit/runs/<runId>
```

## 6. Ship and repeat

Each story ships under the declarative `pr:` policy from step 1. Repeat steps 4–5 until the tracker
is drained. Switch ship behavior at any time by editing the `pr:` block in `.workflow/config.yaml`
— no skill changes required.

## Next

- [architecture.md](./architecture.md) — how the pieces fit and the runtime flow
- [../references/config-schema.md](../references/config-schema.md) — tune `.workflow/config.yaml`
- [../references/tracker-contract.md](../references/tracker-contract.md) — the tracker format in full
