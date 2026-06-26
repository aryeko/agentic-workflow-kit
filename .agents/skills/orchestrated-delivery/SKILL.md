---
name: orchestrated-delivery
description: >-
  Use only when explicitly invoked with $orchestrated-delivery to execute a workflow-kit/kit-vnext
  repo-planned epic or story batch from an existing execution package that was produced by
  $plan-delivery and marked ready_for_implementation (or an equivalent deep readiness verdict).
  Verifies the package, binds runtime/provider details, dispatches packaged implementer/reviewer
  prompts in per-story worktrees where implementers commit each round, merges each approved story's
  commits back to the track branch and writes the tracker, opens or updates PRs when authorized, and
  stops at the requested boundary. Refuse missing,
  incomplete, underspecified, over-risk, or non-ready packages; do not author scope, prompts, ACs,
  dependency order, model class, or effort in this skill.
---

# Orchestrated Delivery

## Contract

Execute from a checked-in execution package. The package owns scope, story order, acceptance
criteria, prompts, model class, effort, dependency graph, and implementation readiness evidence. The
orchestrator verifies those artifacts and binds only runtime fields: repo/track worktree/story
worktree/track branch/base, surface bindings, provider profile, concrete model resolved from the
declared class, actual supported effort, Codex custom-agent `agent_type` when supported by the current
surface, completion signal, and current dependency merge-back commit hashes present on the track
branch.

In this model the **implementer commits each round in its story worktree**; the orchestrator commits no
story content. The orchestrator's only git writes are the **track-branch merge-back** of an approved
story's per-round commits and the **tracker**. Do not create, repair, or improve package-owned planning
artifacts during preflight. The only package file this skill edits is `execution/tracker.md`, written
on the track branch at the merge-back or blocked-story boundary defined in `commit-tracker.md`. If
package evidence is missing, stale, incomplete, vague, or above the supported risk ceiling, refuse
execution and route repair to the owning planning step named in the relevant reference.

## Reference Routing

Read only the reference files needed for the current step:

- `references/package-preflight.md`: validate the existing execution package, deep readiness verdict,
  selected stories, tracker rows, prompt completeness, and refusal behavior.
- `references/runtime-binding.md`: bind surface capabilities, provider profile, model class, actual
  model, effort, Codex custom-agent `agent_type` where supported, worker cap, story worktree fields,
  and unavailable-model handling.
- `references/surface-map.md`: map abstract capabilities to Codex, Claude Code, or a closest
  analogue for another surface.
- `references/story-worktrees.md`: create per-story worktrees and temporary branches, keep the track
  worktree clean, merge approved stories back to the track branch, trigger implementer rebase on
  advance, and clean up disposable story trees.
- `references/worker-lifecycle.md`: dispatch workers under the same-logic rule, reuse
  implementer/reviewer contexts (implementers commit each round), handle completion, enforce the
  5-round cap (block + escalate), and close only terminal worker pairs.
- `references/commit-tracker.md`: merge approved stories back to the track branch, write the tracker
  per the canonical schema, record blocked-story evidence, and decide downstream readiness.
- `references/pr-merge.md`: publish PRs, wait for reviews only when requested, handle review
  follow-up, and merge/cleanup only on explicit instruction.
- `references/communication.md`: keep status sparse, preserve coordinator context, and report the
  ledger without transcript or diff dumps.
- `references/providers/<provider>.md`: resolve concrete provider model IDs. Keep provider-specific
  IDs out of generic references.

Each reference owns one reason to change. Do not duplicate package schemas, model routing tables,
tracker policy, or lifecycle rules across files.

## Workflow

1. Enforce Plan Mode or an explicitly authorized read-only fallback before discovery on Plan-capable
   surfaces.
2. Use `package-preflight.md` to verify the package is present, selected, field-complete,
   prompt-complete, and backed by a deep readiness verdict from `$plan-delivery`.
3. Use `runtime-binding.md` and `surface-map.md` to bind current runtime/provider facts without
   changing package-owned decisions.
4. Present the execution plan and wait for approval unless the user already gave explicit execution
   authorization.
5. During execution, use `story-worktrees.md` and `worker-lifecycle.md` for dependency-gated worker
   waves under the same-logic rule, per-story worktrees with per-round implementer commits, and the
   5-round-capped review loop.
6. At each approved or blocked story boundary, use `commit-tracker.md`; downstream stories are ready
   only after the approved story's per-round commits are merged back to the track branch, its tracker
   row is `merged`, and its worker pair is closed or terminal. Blocked-story tracker evidence never
   unlocks dependents.
7. Use `pr-merge.md` for publication and follow-up boundaries (track branch → `v-next`) after selected
   stories are merged back to the track branch.
8. Use `communication.md` throughout for user updates and final closeout.

Stop rather than improvise when a required reference says to refuse. This skill is an executor, not a
planner or package author.
