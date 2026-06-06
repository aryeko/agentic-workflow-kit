# Smoke entry — Codex plugin

Surface-specific runbook for smoking agentic-workflow-kit as a **Codex plugin**. Everything shared lives in
[common-phases.md](./common-phases.md); this file only covers how to load the plugin and invoke its
skills on this surface. Read the [principles](./README.md#principles-apply-to-both-surfaces) first.

Codex's primary path is the **autonomous orchestrator** (`workflow-autopilot` + common Phase 4), so
give that extra attention here; the authoring skills are smoked the same way as on Claude.

## Prerequisites
- `codex` CLI, `pnpm`.
- Plugin source built once: `( cd ~/repos/agentic-workflow-kit && pnpm install && pnpm build )`.

## Load the plugin (local marketplace fixture)
The repo ships a local-only Codex marketplace fixture at `.agents/plugins/marketplace.json` pointing
at the materialized `./plugins/agentic-workflow-kit`. Install it into a **temporary `CODEX_HOME`** so it does
not touch your real Codex config:

```bash
cd ~/repos/agentic-workflow-kit
export CODEX_HOME="$(mktemp -d)"
codex plugin marketplace add .
codex plugin add agentic-workflow-kit@agentic-workflow-kit
codex plugin list                      # confirm installed + skill prompts visible
```

There is also an automated install + prompt-visibility check (not a runtime smoke):

```bash
( cd ~/repos/agentic-workflow-kit && pnpm smoke:codex-plugin )
```

Keep `CODEX_HOME` exported for the whole Codex session, and run that session with **cwd = `$SMOKE`**
(the throwaway repo) so the skills act there.

Confirm the installed plugin cache contains `.mcp.json` and `mcp/server.mjs` (the automated smoke
does this). In the Codex session, prefer the bundled MCP runtime through `workflow-autopilot`; use
the standalone CLI only as a fallback or cross-check.

## Invocation (this surface)
In the Codex session (fixture `CODEX_HOME`, cwd `$SMOKE`), trigger each skill via Codex's skill
mechanism. Each skill's trigger and default prompt live in `skills/<name>/agents/openai.yaml`.

| Skill | Invocation policy |
| --- | --- |
| `workflow-init`, `plan-product`, `plan-track` | implicit invocation allowed (`allow_implicit_invocation: true`) — may surface from a matching request, or invoke explicitly by name / its default prompt |
| `implement-next`, `workflow-autopilot` | **explicit only** (`allow_implicit_invocation: false`) — invoke deliberately by name; they will not auto-trigger |

Invoke explicitly by issuing the skill's `default_prompt` (e.g. for `workflow-init`: "Use agentic-workflow-kit
to initialize tracker-driven delivery in this repo") or by selecting the skill by name.

## Runbook

1. **Setup** — common-phases.md → "Setup & containment" (build + create the no-remote `SMOKE` repo).
2. **Phase 1 (plumbing)** — common-phases.md → Phase 1, run from a terminal (the `wk` alias).
3. **Phase 2 (authoring)** — in the Codex session, invoke `workflow-init`, then `plan-product`, then
   `plan-track`; verify each against common-phases.md → Phase 2 pass criteria. Run the
   **list-stories cross-check** from a terminal.
4. **Phase 3 (side-effectful)** — explicitly invoke `implement-next` on a trivial story; verify
   against common-phases.md → Phase 3 (must stop at "no remote", completion from the tracker row).
5. **Phase 4 (live dispatch)** — explicitly invoke `workflow-autopilot` (Codex's headline
   autonomous path) so it drives the bundled MCP runtime; optionally cross-check with the CLI path
   from common-phases.md. Confirm both reach the same tracker-derived completion/blocking outcome.
6. **Evidence** — record per common-phases.md → Evidence; label the results "Codex plugin".
