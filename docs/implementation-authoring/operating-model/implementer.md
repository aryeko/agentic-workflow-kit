---
title: "Role — implementer"
status: draft
last-reviewed: "2026-06-22"
---

# Implementer

> **Audience** — whoever builds or verifies this role's engine: the implementer sub-agent.

## Goal

Realize one story's characterization and **prove** it.

## Requirements

- Implement **strictly to the story's acceptance criteria**, within its **owned pathset** (which
  includes the story's own `index.ts` export line when it exposes a public symbol).
- **Produce each AC's evidence as pasted command output** — the test run, the sweep output, the
  coverage number, the public-import test. Satisfying the AC *is* producing its proof.
- **Commit each round in the story worktree.** Make the gate green (`pnpm check`) before each commit:
  an impl-done commit when the story first proves out, then one commit per fix round. Tag each commit
  with the review-round trailer so the per-round history is visible. The orchestrator never commits
  story content; the commits are the implementer's.
- Run the **incremental loop:** fix every **BLOCKING** finding the orchestrator routes back, **re-prove
  and re-commit each round**, until the [reviewer](reviewer.md) returns **APPROVE**.
- **Rebase on the orchestrator's request.** When the orchestrator reports a merge-back conflict, rebase
  the story's commits onto the track branch `HEAD`, **re-prove** (gate green), and re-commit; report a
  real logic conflict back rather than forcing a resolution.
- **Does NOT** redefine or extend the "what"; edit outside the owned pathset; push, open PRs, merge, or
  close its own context; or paper over a bad spec.
- **STOP condition:** if the characterization is missing, contradictory, or blocking, **stop and
  report a characterization defect** to the [architect](architect.md) rather than improvising the
  "what".

## Inputs

- The **full story characterization** — ACs (each with its evidence clause), ownership / owned
  pathset, non-goals, evidence requirements (from the [architect](architect.md) via the
  [orchestrator](orchestrator.md)).
- BLOCKING findings routed back each loop round (from the [reviewer](reviewer.md) via the
  orchestrator).

## Outputs

- The implementation, confined to the owned pathset, **committed each round** (gate-green, round trailer)
  in the story worktree.
- Each AC's **evidence as pasted command output**, attached every round.
- On a bad spec: a **characterization-defect report** to the architect (instead of an
  implementation).

## Flow

1. Receive the story characterization in an isolated story worktree.
2. If the spec is missing / contradictory / blocking, **STOP** and report a characterization defect
   to the architect.
3. Otherwise implement strictly to the ACs within the owned pathset.
4. Produce each AC's evidence as pasted command output; make the gate green and **commit the impl-done
   round** in the worktree; hand off to review.
5. On **BLOCKING**, fix the findings, **re-prove, and commit the fix round** (gate green, round trailer);
   loop until APPROVE.
6. On an orchestrator merge-back-conflict request, **rebase onto track `HEAD`, re-prove, and re-commit**;
   escalate a real logic conflict.

## Validation

An engine implements this role correctly when:

- every edit lands inside the owned pathset; nothing outside it is touched;
- it **commits each round** (impl-done + one per fix round) gate-green in the story worktree, and never
  pushes, opens PRs, merges, or closes its own context;
- every AC ships with pasted command-output evidence, refreshed each round;
- it **rebases and re-proves** on an orchestrator merge-back request, escalating a real logic conflict;
- it **stops and reports** on a bad spec instead of inventing or extending the "what";
- it re-proves after every fix and never declares done before APPROVE.

## Acceptance

Correctly implemented when the implementation meets every AC within the owned pathset, the implementer
commits each gate-green round in the story worktree, each AC carries genuine pasted evidence, BLOCKING
findings are fixed and re-proven until APPROVE, merge-back conflicts are rebased and re-proven, and a bad
spec is escalated rather than papered over.

## References

- [Operating model](README.md) — the parent spec; the incremental loop; Bucket 1 vs Bucket 2.
- [Architect](architect.md) — owns the "what"; receives characterization-defect reports.
- [Orchestrator](orchestrator.md) — routes BLOCKING findings and re-dispatches review.
- [Reviewer](reviewer.md) — verifies the proof and returns the verdict.
- [Authoring standard](../authoring-standard/README.md) — the evidence clause the proof satisfies.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Operating model — delivery system spec](./README.md) · **← Prev:** [Role — orchestrator](./orchestrator.md) · **Next →:** [Role — reviewer](./reviewer.md)

<!-- /DOCS-NAV -->
