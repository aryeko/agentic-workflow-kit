---
title: "fnd-03 — Workspace & Repository — implementation charter"
id: "fnd-03"
wave: 1
layer: "foundation"
status: "item: ready"
spec: "docs/design/domains/foundation/fnd-03-workspace-and-repository/"
---

# fnd-03 — Workspace & Repository

**Purpose.** The local git worktree lifecycle and **read-only local git evidence** — local git only.

**Spec (normative).** Implement `docs/design/domains/foundation/fnd-03-workspace-and-repository/`. The
worktree lifecycle, branch model, `LocalGitEvidence` shape, and the setup handshake (`confirmSetup`
after the Control plane runs setup *through* the Execution Host) are normative. Ambiguous → STOP and
surface.

## Responsibilities (in scope)

- Worktree **lease** (provision an isolated worktree + branch; leak-free teardown/tombstones).
- Declared setup **metadata** — the command the Control plane will run via the Execution Host; fnd-03
  does **not** run it.
- `confirmSetup` re-inspection (the post-Execution-Host handshake).
- Read-only `LocalGitEvidence` (branch/base/head SHAs, diff from merge base, uncommitted paths) bound
  to a `headSha`, with the `local-git-evidence-unavailable` failure state.

## Out of scope

**Process spawning or containment (prov-04 Execution Host)** — fnd-03 never shells out; remote/
credentialed forge ops (prov-02); event semantics; sending anything to the Execution Host (the Control
plane coordinates that).

## Requirements owned

FR-2 (workspace provisioning); the local-git slice of FR-6 (evidence); NFR-SOLID, NFR-TEST, NFR-DET;
**plus full fnd-03 design-spec compliance.**

## Dependencies & frozen contracts

Depends on fnd-01 (setup/branch policy) and fnd-02 (worktree leases, evidence artifacts, cleanup
tombstones). Depended on by core-01/05 (evidence) and prov-04 (the workspace it runs in).

## Libraries

A **pure-JS, no-subprocess** git reader (e.g. `isomorphic-git`) or direct read-only `.git` inspection
for evidence — **never `child_process` git** (that would usurp the Execution Host seam and break the
integration lane's no-process guard). Node `fs`. No SDKs.

## Required reading

This domain's spec (`README.md` + sibling aspect files); `dependency-policy.md`; `testing-policy.md`; the Execution Host boundary in the
prov-04 design (so the setup handshake sits on the right side of the seam).

## Deliverable

The workspace package: worktree lease lifecycle (leak-free); declared-setup metadata + `confirmSetup`;
read-only `LocalGitEvidence` with its unavailable-failure state.

## Definition of done

- *Spec compliance:* worktree lifecycle + branch model + `LocalGitEvidence` shape + setup handshake
  match the design; no process is ever spawned; evidence excludes remote refs/URLs/credentials per
  spec.
- *Quality bar:* leak-free teardown proven (integration tests on real temp repos); unreadable repo
  state → `local-git-evidence-unavailable` (not partial); `pnpm check` green; coverage bar met.

## Boundaries

Stay in the workspace package; **no subprocess, ever**; clock/id injected. If read-only evidence appears
to require running `git`, **STOP and surface** — it must be obtained without a process.
