---
title: Local coordinated worker usage
status: local development workflow guide
last-reviewed: 2026-06-19
---

# Local Coordinated Worker Usage

This guide describes the normal desktop-app workflow: start a new Codex app
thread in this repo and ask that thread to orchestrate the wave. The active
thread becomes the coordinator by loading the repo-local `run-coordinated-wave`
skill.

Official Codex docs basis:

- [Agent Skills](https://developers.openai.com/codex/skills)
- [Config basics](https://developers.openai.com/codex/config-basic)
- [Subagents](https://developers.openai.com/codex/subagents)
- [Codex app commands](https://developers.openai.com/codex/app/commands)

## Normal Desktop App Flow

1. Open this repo or worktree in the Codex desktop app.
2. Start a new thread.
3. Ask the new thread to orchestrate the wave:

```text
Start orchestrating the coordinated wave at
docs/coordinated-waves/<wave-id>/README.md.

Use the repo-local run-coordinated-wave workflow. You are the coordinator in
this main thread. Revalidate readiness, build the dependency plan, spawn
task-implementer and task-reviewer subagents only as the plan allows, keep
durable state in the wave docs, verify each approved unit, stage only approved
unit scopes, and commit one unit at a time.
```

If you want to force explicit skill selection, start the prompt with:

```text
$run-coordinated-wave
```

That is the docs-backed way to make the main app thread act as the orchestrator:
skills are reusable workflows that Codex can load into the active session, and
Codex app supports explicit skill invocation with `$`.

## Creating A Wave First

If the wave plan does not exist yet, start a normal Codex app thread and ask:

```text
Create a coordinated wave for <goal>.

Use the repo-local create-coordinated-wave workflow. Read these source inputs:
- <path>
- <path>

Do not execute the wave. Write the plan under
docs/coordinated-waves/<wave-id>/README.md and mark it READY TO RUN only if the
readiness rubric passes.
```

To force explicit skill selection, start with:

```text
$create-coordinated-wave
```

After the plan is `READY TO RUN`, start a fresh thread or continue in the same
thread with the orchestration prompt above.

## Can I Select The Orchestrator Agent In The App?

Not as a docs-backed top-level thread mode.

The current OpenAI docs say:

- skills are available in the Codex app and can be invoked with `$`
- subagent activity is surfaced in the Codex app
- custom agents under `.codex/agents/` are configuration layers for spawned
  sessions

The docs do not describe selecting a project custom agent as the top-level
agent for a new desktop app thread. So do not rely on a custom-agent picker for
this workflow.

For normal desktop use, the top-level app thread should stay a normal Codex
thread and load `run-coordinated-wave`. That gives you the behavior you want:
the visible main thread is the orchestrator, and it spawns implementer/reviewer
workers as needed.

## What The Custom Agents Are For

The repo-local custom agents are worker roles:

- `task-implementer`: implements or fixes one bounded unit
- `task-reviewer`: read-only independent reviewer for one bounded unit
- `wave-coordinator`: optional offloaded coordinator, not the normal desktop
  entry point

Use `task-implementer` and `task-reviewer` indirectly through the orchestration
skill. Do not start normal user work by manually prompting those agents.

## Optional Offloaded Coordinator

Use `wave-coordinator` only when you explicitly want coordination to happen in
a child agent while the main thread supervises it.

Prompt:

```text
Spawn the repo-local wave-coordinator agent to run the READY wave at
docs/coordinated-waves/<wave-id>/README.md.

The spawned coordinator must use the repo-local run-coordinated-wave workflow,
keep durable state in the wave docs, spawn only task-implementer and
task-reviewer children as dependencies permit, and stop on ambiguity.
```

This is not the normal "main thread is the orchestrator" flow. It is useful
only when you want to keep orchestration noise out of the main thread.

## Discovery Requirements

For the desktop app to see the local workflow:

- the active workspace must be this repo or a worktree from it
- the project must be trusted so project `.codex/config.toml` and
  `.codex/agents/` load
- repo-local skills must be under `.agents/skills`
- if newly added skills do not appear, restart Codex or use the app's skill
  reload command when available

The app also has a Skills view at:

```text
codex://skills
```

## Safety Rules

- Do not run a `NOT READY` wave.
- The main orchestrator thread owns dependency decisions, verification,
  staging, commits, and durable wave status.
- Workers do not push, stage, commit, or edit outside assigned scope.
- Fixes go back to the same implementer when possible.
- Incremental rereview goes back to the same reviewer when possible.
- Approved units are committed one at a time.
- After compaction or resume, read the wave README and run notes before acting.
