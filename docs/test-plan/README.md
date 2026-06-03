# agentic-workflow-kit — behavioral smoke test plan

Pre-publish manual smoke plan for a fresh session (human or agent) to follow. The unit/contract
suite is green (186 tests), but the **agent-driven workflows and the live orchestrator dispatch
have never run end-to-end**. These smokes close that gap before the repo goes public.

## How this plan is organized

Two delivery surfaces share most of the work, so the steps are split to avoid duplication:

| File | What it holds |
| --- | --- |
| [common-phases.md](./common-phases.md) | The surface-agnostic steps: setup + containment, the orchestrator CLI phases (identical for both surfaces), and the **pass criteria** for each skill (what to verify, independent of how it is invoked). |
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
- **Capture evidence.** Save each transcript / command output (see common-phases.md → Evidence).

## Status

Record outcomes wherever you keep launch evidence (e.g. attach to the publish PR). This plan is the
the pre-launch gate before the launch sequence in `~/handoff-prompts/agentic-workflow-kit-launch.md`.
