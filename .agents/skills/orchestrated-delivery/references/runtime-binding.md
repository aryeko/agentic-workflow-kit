# Runtime Binding

Bind runtime facts after package preflight succeeds. Runtime binding must not change package-owned
scope, prompts, acceptance criteria, dependency order, model class, or effort.

## Surface Binding

Read `surface-map.md`, detect the current surface, and record the concrete mechanism for:

`plan-mode`, `exec-checklist`, `worker-spawn`, `worker-completion`, `worker-readdress`,
`worker-naming`, `worker-isolation`, `worker-close`, `reasoning-tier`, `model-routing`,
`prompt-contract`, `worker-cap`, `pr-review-wait`, `pr-thread-followup`, and `merge-cleanup`.

On Plan-capable surfaces, enforce Plan Mode or an explicitly authorized read-only fallback before
repo discovery, edits, dispatch, commits, pushes, PRs, or merges.

## Runtime Envelope

For each selected story, bind only:

- repo root, worktree path, branch, base, and cleanliness;
- provider profile and resolved concrete model for the package-declared model class;
- actual effort supported by the worker surface for the package-declared tier;
- worker alias and completion signal;
- current dependency story commit hashes and tracker evidence commit hashes.

Unknown runtime facts stay `TBD pending ...` until inspected. Do not invent them.

## Provider Profiles

Select the provider profile that matches the surface:

- OpenAI/Codex: `providers/openai.md`
- Claude Code or Anthropic-backed workers: `providers/claude.md`
- Other providers: use an existing profile when present; otherwise use `providers/_template.md` and
  record `provider profile unavailable`.

Generic references must use abstract classes only: `cheap-coder`, `general-coder`, `strong-coder`,
`frontier`, and `frontier-reviewer`. Concrete model IDs belong only in provider profile files.

## Effort And Model Resolution

Map `light`, `standard`, `elevated`, and `critical` to the surface's detected effort values. Do not
assume an effort is unavailable without checking the worker tool metadata.

Resolve models in this order:

1. Honor a user/provider override only when it satisfies the required class or a stronger class.
2. Resolve the package-declared class through the selected provider profile.
3. Check whether the worker surface can pass a model override.
4. For implementers only, fall forward to the next stronger available implementer class and record
   the reason.
5. For reviewers and `critical` implementers, stop or ask if the required frontier class is
   unavailable; never silently downgrade.

Record provider profile, model class, planned model, actual model or inherited model, effort, tier,
and fallback or override reason before treating a worker as launched.

## Worker Cap

Bind `worker-cap` from tool metadata first, then project or repo config, then global config. If no
source exists, assume `6` and record that assumption.

The cap limits concurrently active worker sessions only. It never changes the package item count,
story order, or story boundaries.
