# agentic-workflow-kit — behavioral smoke test plan

Manual smoke plan for a fresh session (human or agent) to follow. The automated suite is the
required development gate, but the **agent-driven workflows and live autonomous dispatch** still
need tool-environment smokes before each plugin/runtime release.

## How this plan is organized

Two delivery surfaces share most of the work, so the steps are split to avoid duplication:

| File | What it holds |
| --- | --- |
| [common-phases.md](./common-phases.md) | The surface-agnostic steps: setup + containment, shared runtime phases, and the **pass criteria** for each skill (what to verify, independent of how it is invoked). |
| [claude-plugin.md](./claude-plugin.md) | **Entry point for the Claude Code plugin** — how to load it and invoke each skill, then a runbook that references the common phases. |
| [codex-plugin.md](./codex-plugin.md) | **Entry point for the Codex plugin** — how to load it and invoke each skill, then a runbook that references the common phases. |

**Pick your surface entry and start there.** It tells you what is specific to that surface and
points you into `common-phases.md` for everything shared.

## Principles (apply to both surfaces)

- **Throwaway repo, no git remote.** Run in a fresh scratch repo with no `origin`. The side-effectful
  steps (`implement-next`, orchestrator `run-story`) will try to push/PR/merge, hit "no remote," and
  stop — the harness that keeps a smoke contained. Never run smokes inside `~/repos/agentic-workflow-kit`;
  keep its clean single commit pristine.
- **Least → most side-effectful.** Plumbing checks first, the live Codex dispatch last.
- **Judge against the contract, not exact output.** These are agent-driven and non-deterministic.
  Pass = "did it honor the contract" (idempotent, completion-from-tracker, parses, blocks correctly),
  not "did it print exactly this."
- **MCP first, CLI fallback.** Plugin sessions should use the bundled MCP runtime. The standalone CLI
  is the fallback for development, CI, and troubleshooting.
- **Capture evidence.** Save each transcript / command output (see common-phases.md → Evidence).

## Status

Record outcomes wherever you keep release evidence (e.g. attach to the release or feature PR). This
plan is the manual runtime gate before promoting a plugin/runtime release.
