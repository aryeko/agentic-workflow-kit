# CLAUDE.md — Claude Code operating layer for kit-vnext

This file adds Claude Code-specific operating guidance on top of `AGENTS.md`. **Read
`AGENTS.md` first** — it holds the invariants, the ground-truth map (`docs/design/`), the
branch model, the verify gate, and the conventions. When the two conflict, `AGENTS.md`
wins. Do not restate AGENTS.md here; reference it.

---

## Operating mode

- **Explore → plan → code.** For anything non-trivial, read the relevant `docs/design/`
  files, then write a plan before implementing (Plan Mode: `shift+tab` twice). Skip the
  plan only for changes you could describe in one sentence.
- **TDD.** Failing test first (RED), implement (GREEN), refactor. Coverage targets are in
  `AGENTS.md`.
- **Protect context.** Use subagents to investigate the codebase or corpus so the main
  session stays lean. Give each parallel subagent a clear scope and a worktree check.

---

## Find context efficiently

Do not load the whole design corpus into a session. Use the "When you get a task" map in
`AGENTS.md` to pull only the `docs/design/` files your task actually touches, and let
subagents do the wide reads. The corpus is large by design; the win is reading the right
slice, not all of it.

---

## Worktree and branch discipline

Non-trivial work happens in a worktree under `<repo>/.worktrees/<name>` cut from
`v-next`, never in the main checkout (the main checkout is for reading). Before any
`git commit`, `git push`, or file write, confirm:

```
git rev-parse --show-toplevel   # must be the worktree root, not the main checkout
```

If it is not your worktree, stop and report. Open PRs with `v-next` as the base; never
push to `v-next` directly (it is protected). This applies to subagents too — they have
committed to the main checkout by mistake before, so the check is not optional.

---

## The gate — never claim done without it

Run `pnpm check` before declaring any change complete, and show its output as evidence
rather than asserting success. The steps and the CI extras are in `AGENTS.md`. If CI
fails after a clean local run, investigate before re-pushing.

---

## Frozen vs open

- **Frozen (do not re-decide):** the invariants and seam contracts, the domain model and
  event types, and the package decomposition — all owned by `docs/design/`. `packages/`
  is intentionally empty until design owners fill it; do not invent packages.
- **Open (iterate here):** tooling, CI, the verify-gate composition, and the test
  infrastructure in `tooling/` and `tests/`.
