---
title: Local coordinated worker design spec
status: implemented local v1 design
last-reviewed: 2026-06-19
---

# Local Coordinated Worker Design Spec

This spec documents the final local design used by this PR. It adjusts the
earlier brainstorming toward the later decisions: keep the kit small, local,
instruction-only, and deterministic enough to review in git.

## Scope

This is local development workflow infrastructure. It is not:

- the kit-vnext runtime control plane
- a public plugin surface
- an MCP server
- an orchestrator package
- a replacement for the repository architecture docs

The workflow helps a human or Codex main session split large development work
into bounded units and execute those units with implementer/reviewer subagents.

## Design Principles

- Keep workflow state in repo docs, not hidden runtime folders.
- Keep root Codex config minimal.
- Prefer human-readable contracts over schemas for v1.
- Use subagents for bounded work, not as autonomous control planes.
- Make the coordinator verify artifacts and git state.
- Stop on ambiguity instead of inventing policy.
- Add complexity only after repeated manual failures prove it is needed.

## Tracked Layout

```text
.codex/
  config.toml
  agents/
    task-implementer.toml
    task-reviewer.toml
    wave-coordinator.toml
    wave-coordinator-compact.md

.agents/
  skills/
    create-coordinated-wave/
      SKILL.md
      agents/openai.yaml
    run-coordinated-wave/
      SKILL.md
      agents/openai.yaml

docs/
  coordinated-waves/
    README.md
    design-spec.md
    usage.md
    workflow-report.md
```

Future wave plans live under `docs/coordinated-waves/<wave-id>/`.

Runtime artifacts remain ignored, especially `.codex/agentic-workflow-kit/**`.

## Root Codex Config

Root `.codex/config.toml` is intentionally tiny:

```toml
[features]
multi_agent = true

[agents]
max_threads = 6
max_depth = 1
```

Root depth stays at `1` so ordinary repo sessions can spawn direct workers but
cannot recursively fan out. The hard thread cap is explicit for reproducibility.
Wave plans should still use a lower active implementer cap, normally `4`, so
reviewers and recently completed agents have room.

The root config must not define provider, auth, profile, hooks, MCP servers,
rules, or a root compact prompt.

## Agents

### Task Implementer

`task-implementer` implements one bounded unit. It may edit only the assigned
write scope. It may not stage, commit, push, archive, spawn subagents, change
wave state, or edit unrelated files.

The same implementer handles fixes after review. There is no separate repairer
role.

### Task Reviewer

`task-reviewer` is read-only. It reviews only the candidate outputs and allowed
review inputs from the coordinator prompt. It must return exactly one verdict:
`APPROVE` or `CHANGES-NEEDED`.

For incremental review, it checks prior blockers plus regressions introduced by
the fix. It does not reopen resolved issues unless the new edits invalidate
them.

### Wave Coordinator

`wave-coordinator` is optional. The default coordinator can be the main Codex
session using the `run-coordinated-wave` skill.

The optional coordinator exists for runs where the operator wants orchestration
offloaded into a child agent. It has scoped nested delegation:

```toml
experimental_compact_prompt_file = "./wave-coordinator-compact.md"

[agents]
max_depth = 2
max_threads = 6
```

The compact prompt path is relative to `.codex/agents/` and is intentionally
coordinator-only. It is not configured at the root because ordinary sessions
should not inherit coordinated-wave compaction behavior.

## Skills

### create-coordinated-wave

Creates or updates one wave plan. It does not run the plan, spawn agents, edit
product/runtime code, or create commits.

It marks a plan `READY TO RUN` only when every unit has exact reads, exact write
scope, required outputs, typed dependencies, acceptance criteria, review
criteria, negative approval rules where required, verification, stop
conditions, and implementer/reviewer reasoning effort.

### run-coordinated-wave

Executes one `READY TO RUN` wave plan. It may be used by the main session or by
the optional `wave-coordinator`.

It revalidates readiness, rebuilds dependencies, starts eligible implementers,
sanity-checks handoffs, starts reviewers, routes fixes, runs coordinator-side
verification, stages only the approved unit scope, commits one unit at a time,
and updates durable wave status.

The run skill stops if the plan is not ready, dependency state is ambiguous,
review output is malformed after clarification, verification fails, worker
scope is violated, or git staging cannot be limited to the approved scope.

## Wave Plans

Wave plans are durable docs under `docs/coordinated-waves/<wave-id>/`.

Required wave content:

- goal
- global rules
- authoritative source inputs
- unit sections
- dependency plan
- coordinator checklist
- readiness verdict

Required unit content:

- id and title
- kind and risk
- implementer and reviewer effort
- objective
- allowed reads
- forbidden reads when relevant
- write scope
- required outputs
- typed dependencies
- acceptance criteria
- review criteria
- negative approval rules
- verification command or reason none is possible
- stop conditions

Optional `runs/<run-id>.md` files may be used for long resume/debug notes. They
are part of the wave docs, not `.codex`.

## Compaction And Resume

The workflow must survive context compaction by treating disk as source of
truth. Before any spawn, review send, commit, or final answer, the coordinator
should read the wave README and run notes if present, derive the next action
from disk, perform one action, and write updated status back to disk.

The coordinator compact prompt preserves only resumable facts:

- active wave path
- run notes path
- unit states and review rounds
- active implementer/reviewer ids if known
- unresolved findings
- commits already created
- blocker
- exact next action

If disk state is insufficient after compaction or resume, the coordinator must
stop and ask for operator direction.

## Verification Strategy

Static tests verify the local kit shape:

- `.gitignore` tracks only intended `.codex` config and agent files
- runtime `.codex/agentic-workflow-kit/**` remains ignored
- root config keeps `max_depth = 1`
- coordinator config scopes `max_depth = 2`
- reviewer is read-only and verdict-constrained
- agents forbid unintended push, stage, commit, and subagent behavior where
  applicable
- local skills have valid frontmatter and no placeholders
- docs remain local workflow infrastructure
- no public package/plugin/runtime surface is added

Live smoke verifies Codex can start with strict config and can perform scoped
nested delegation through the optional coordinator.

The remaining proof is a follow-up pilot wave that runs the workflow end to end
on a small low-risk change.

## Intentional Non-Goals

Do not add these for local v1:

- YAML policy files
- JSON schemas
- generated prompt folders
- run databases
- hooks
- MCP servers
- plugin manifests
- public skills
- local orchestrator packages
- `.codex/coordinated-workers/` artifact trees

These can be reconsidered only after manual pilot runs show a concrete failure
that a simpler document or test cannot address.
