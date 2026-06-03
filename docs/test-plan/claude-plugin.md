# Smoke entry — Claude Code plugin

Surface-specific runbook for smoking agentic-workflow-kit as a **Claude Code plugin**. Everything shared
lives in [common-phases.md](./common-phases.md); this file only covers how to load the plugin and
invoke its skills on this surface. Read the [principles](./README.md#principles-apply-to-both-surfaces) first.

Claude's primary path is **interactive** (one story per session via `implement-next`); the
orchestrator (common Phase 4) is the optional autonomous add-on.

## Prerequisites
- `claude` CLI, `codex` CLI (for common Phases 1 & 4), `pnpm`.
- Plugin source built once: `( cd ~/repos/agentic-workflow-kit && pnpm install && pnpm build )`.

## Load the plugin
Start Claude Code with the repo loaded as a plugin, **from inside the throwaway `SMOKE` repo** so the
skills act there:

```bash
cd "$SMOKE"
claude --plugin-dir ~/repos/agentic-workflow-kit
```

The skills are namespaced under `agentic-workflow-kit`. Confirm they are visible (e.g. type `/agentic-workflow-kit:`
and check the five skills list: `workflow-init`, `plan-product`, `plan-track`, `implement-next`,
`workflow-autopilot`).

## Invocation syntax (this surface)

| Skill | Invoke | Notes |
| --- | --- | --- |
| `workflow-init` | `/agentic-workflow-kit:workflow-init` | scaffolds config + trackers |
| `plan-product` | `/agentic-workflow-kit:plan-product <slug or notes>` | writes a PRD |
| `plan-track` | `/agentic-workflow-kit:plan-track <prd slug or notes>` | needs a PRD first |
| `implement-next` | `/agentic-workflow-kit:implement-next [story id]` | **explicit-invocation only** (`disable-model-invocation`) |
| `workflow-autopilot` | `/agentic-workflow-kit:workflow-autopilot <command>` | **explicit only**; drives the orchestrator |

## Runbook

1. **Setup** — common-phases.md → "Setup & containment" (build + create the no-remote `SMOKE` repo).
2. **Phase 1 (plumbing)** — common-phases.md → Phase 1, run from a terminal (the `wk` alias).
3. **Phase 2 (authoring)** — in the `claude --plugin-dir` session, invoke `workflow-init`, then
   `plan-product`, then `plan-track` using the syntax above; verify each against common-phases.md →
   Phase 2 pass criteria. Run the **list-stories cross-check** from a terminal.
4. **Phase 3 (side-effectful)** — invoke `implement-next` on a trivial story; verify against
   common-phases.md → Phase 3 (must stop at "no remote", completion from the tracker row).
5. **Phase 4 (live dispatch)** — common-phases.md → Phase 4, from a terminal. Optionally also invoke
   `/agentic-workflow-kit:workflow-autopilot` to smoke the skill-level wrapper over the same orchestrator run.
   Because `implement-next` and `workflow-autopilot` are explicit-invocation-only, dispatched/headless
   Claude can validate their instructions by hand-executing `SKILL.md`, but only an interactive
   Claude session validates the skill invocation path.
6. **Evidence** — record per common-phases.md → Evidence; label the results "Claude Code plugin".
