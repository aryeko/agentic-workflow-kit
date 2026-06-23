---
name: orchestrated-delivery
description: >-
  Use only when explicitly invoked with $orchestrated-delivery to execute a workflow-kit/kit-vnext
  repo-planned epic or story batch from an existing execution package that was produced by
  $plan-delivery and marked ready_for_implementation (or an equivalent deep readiness verdict).
  Verifies the package, binds runtime/provider details, dispatches packaged implementer/reviewer
  prompts in dependency-gated waves, commits approved story scopes, durably commits tracker evidence,
  opens or updates PRs when authorized, and stops at the requested boundary. Refuse missing,
  incomplete, underspecified, over-risk, or non-ready packages; do not author scope, prompts, ACs,
  dependency order, model class, or effort in this skill.
---

# Orchestrated Delivery

## Contract

Execute from a checked-in execution package. The package owns scope, story order, acceptance
criteria, prompts, model class, effort, dependency graph, and implementation readiness evidence. The
coordinator verifies those artifacts and binds only runtime fields: repo/worktree/branch/base,
surface bindings, provider profile, concrete model resolved from the declared class, actual supported
effort, completion signal, and current dependency commit hashes.

Do not create, repair, or improve package-owned planning artifacts during preflight. The only package
file this skill edits is `execution/tracker.md`, and only at the committed-story boundary defined in
`commit-tracker.md`. If package evidence is missing, stale, incomplete, vague, or above the supported
risk ceiling, refuse execution and route repair to the owning planning step named in the relevant
reference.

## Reference Routing

Read only the reference files needed for the current step:

- `references/package-preflight.md`: validate the existing execution package, deep readiness verdict,
  selected stories, tracker rows, prompt completeness, and refusal behavior.
- `references/runtime-binding.md`: bind surface capabilities, provider profile, model class, actual
  model, effort, worker cap, and unavailable-model handling.
- `references/surface-map.md`: map abstract capabilities to Codex, Claude Code, or a closest
  analogue for another surface.
- `references/worker-lifecycle.md`: dispatch workers, reuse implementer/reviewer contexts, handle
  completion, enforce review caps, and close only terminal worker pairs.
- `references/commit-tracker.md`: run the commit lock, make the story commit, make the durable
  tracker-only commit, and decide downstream readiness.
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
5. During execution, use `worker-lifecycle.md` for dependency-gated worker waves and review loops.
6. At each approved story boundary, use `commit-tracker.md`; downstream stories are ready only after
   both the story commit and the tracker evidence commit exist.
7. Use `pr-merge.md` for publication and follow-up boundaries.
8. Use `communication.md` throughout for user updates and final closeout.

Stop rather than improvise when a required reference says to refuse. This skill is an executor, not a
planner or package author.
