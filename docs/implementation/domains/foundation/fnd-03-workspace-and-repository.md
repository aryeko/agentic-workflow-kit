---
title: "fnd-03 - Workspace & Repository domain charter"
id: "fnd-03"
layer: "foundation"
status: "domain-charter: frozen"
source-design: "docs/design/30-domain-reference/foundation/workspace-and-repository/README.md"
last-reviewed: "2026-06-22"
---

# fnd-03 - Workspace & Repository

## What

Workspace & Repository is the implementation-planning home for local git workspace lifecycle,
isolated worktree leases, task branch creation, declared repo setup metadata, fresh-worktree
detection, local git evidence, and local cleanup.

Its boundary is local git only.

## Why

The rebuild needs a safe local workspace contract before workers, execution hosts, completion
predicates, and merge-readiness checks can reason about branch state or changed files.

This domain turns repository state into local evidence without giving Foundation any remote,
credentialed, process, Forge, CI, or merge authority.

## Does Not Own

- Remote git operations, push, pull request creation, checks, review, or merge.
- Process spawning, command execution, containment, or declared setup execution.
- CI state or hosted Forge evidence.
- Secret material, credential injection, or worker environment construction.
- Recovery policy beyond reporting fenced lease and cleanup state.

## Inputs And Dependencies

- Direct domain dependencies: fnd-01 for repository policy, branch policy, setup declaration, and
  cleanup policy.
- Direct domain dependencies: fnd-02 for leases, artifact refs, and durable cleanup tombstones.
- Planning prerequisites: Epic 0 package and dependency guardrails before implementation work closes.
- Source design: `docs/design/30-domain-reference/foundation/workspace-and-repository/README.md`.
- Catalog and order inputs: `docs/design/30-domain-reference/domain-catalog.md`,
  `docs/implementation/domain-dag.md`, and `docs/implementation/epic-dag.md`.

## Downstream Epics

- Epic 1 - Foundation substrate: owns this domain's implementation story groups.
- Epic 2 - Provider contract layer and test harness: shapes the Execution Host port and mock
  workspace contract.
- Epic 5 - Completion, verification, and recovery: consumes local git evidence, clean-worktree
  state, base/head SHAs, and cleanup state.
- Epic 6 - Concrete provider drivers: consumes local workspace contracts for the Local Execution Host
  driver and downstream provider flows.
- Epic 7 - Operator surfaces and composition: consumes workspace status and local evidence summaries
  through the SDK composition path.

## Story Group Signals

- Repository identity and local-only branch model.
- Worktree lease lifecycle and cleanup state.
- Declared setup metadata and freshness evaluation handoff.
- Local git evidence for branch existence, commits, base/head SHAs, merge base, diff, and working
  tree state.
- Boundary checks proving no remote, credential, process, CI, PR, check, review, or merge fields.
- Cleanup tombstones, blocked cleanup records, and missing or moved worktree settlement.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [foundation domain charters](./README.md) · **← Prev:** [fnd-02 - Storage & Artifacts domain charter](./fnd-02-storage-and-artifacts.md) · **Next →:** [fnd-04 - Credentials & Secrets domain charter](./fnd-04-credentials-and-secrets.md)

<!-- /DOCS-NAV -->
