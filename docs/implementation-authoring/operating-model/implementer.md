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

- Implement **strictly to the story's acceptance criteria**, within its **owned pathset**.
- **Produce each AC's evidence as pasted command output** — the test run, the sweep output, the
  coverage number, the public-import test. Satisfying the AC *is* producing its proof.
- Run the **incremental loop:** fix every **BLOCKING** finding the orchestrator routes back and
  **re-prove each round**, until the [reviewer](reviewer.md) returns **APPROVE**.
- **Does NOT** redefine or extend the "what"; touch shared / coordinator-owned files; or paper over
  a bad spec.
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

- The implementation, confined to the owned pathset.
- Each AC's **evidence as pasted command output**, attached every round.
- On a bad spec: a **characterization-defect report** to the architect (instead of an
  implementation).

## Flow

1. Receive the story characterization in an isolated worktree draft.
2. If the spec is missing / contradictory / blocking, **STOP** and report a characterization defect
   to the architect.
3. Otherwise implement strictly to the ACs within the owned pathset.
4. Produce each AC's evidence as pasted command output; hand off to review.
5. On **BLOCKING**, fix the findings and **re-prove**; loop until APPROVE.

## Validation

An engine implements this role correctly when:

- every edit lands inside the owned pathset; shared / coordinator-owned files are untouched;
- every AC ships with pasted command-output evidence, refreshed each round;
- it **stops and reports** on a bad spec instead of inventing or extending the "what";
- it re-proves after every fix and never declares done before APPROVE.

## Acceptance

Correctly implemented when the implementation meets every AC within the owned pathset, each AC
carries genuine pasted evidence, BLOCKING findings are fixed and re-proven until APPROVE, and a bad
spec is escalated rather than papered over.

## References

- [Operating model](README.md) — the parent spec; the incremental loop; Bucket 1 vs Bucket 2.
- [Architect](architect.md) — owns the "what"; receives characterization-defect reports.
- [Orchestrator](orchestrator.md) — routes BLOCKING findings and re-dispatches review.
- [Reviewer](reviewer.md) — verifies the proof and returns the verdict.
- [Authoring standard](../authoring-standard/README.md) — the evidence clause the proof satisfies.