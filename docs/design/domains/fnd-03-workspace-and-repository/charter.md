---
title: "Workspace & Repository — charter"
id: "fnd-03"
layer: "foundation"
status: "charter: ready"
last-reviewed: 2026-06-18
---

# Workspace & Repository — charter

**Purpose.** The local git worktree lifecycle and local git evidence. **Local git only** — a hard
boundary (see architecture §5).

## Responsibilities (in scope)
- Create / lease / clean up an isolated worktree; create the task branch; expose working-tree state.
- Define the **declared repo setup** contract (the command + fresh-worktree detection); the command is
  *executed* via the Execution Host as the worker's contracted first step.
- Produce **local git evidence**: branch exists, commits present, base/head SHAs, diff from merge base,
  uncommitted paths. Read-only inspection of local repo state.

## Out of scope (the hard boundary)
- **No remote, no credentials, no push / PR / checks / merge** — that is the Forge (prov-02).
- **No process spawning or containment** — that is the Execution Host (prov-04).
- **No CI.** Workspace prepares and inspects *local* repo state and nothing else.

## Requirements owned
FR-2 (workspace provisioning), the local-git slice of FR-6 (evidence), NFR-SOLID, NFR-TEST.

## Dependencies (Dependency Rule)
- Depends on: nothing above Foundation (the setup command runs via Execution Host; persisted refs via
  fnd-02).
- Depended on by: core-01 / core-05 (evidence), prov-04 (the workspace it runs in).

## Required reading
Standard set + the seam-boundary note in [architecture.md](../../architecture.md) §5.

## Deliverable
`design.md` defining: the worktree lifecycle; the branch model; the local git evidence shape; the
declared-setup contract + fresh-worktree detection; cleanup.

## Definition of done (domain-specific)
- Local git only — no remote/credential/process leakage (the hard boundary is explicit and testable).
- Git evidence is read-only inspection; worktree lifecycle is leak-free (always cleaned up).

## Open questions
- Worktree prune/repair on missing/moved; concurrent worktrees per repo.
