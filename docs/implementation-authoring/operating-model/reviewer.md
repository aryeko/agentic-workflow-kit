---
title: "Role — reviewer"
status: draft
last-reviewed: "2026-06-22"
---

# Reviewer

> **Audience** — whoever builds or verifies this role's engine: the reviewer sub-agent.

## Goal

Verify the implementation against the characterization, and own **Bucket 2** — the implementation
defects a clear spec cannot prevent.

## Requirements

- Confirm **each AC is met** and **its evidence is present and genuine** — **spot-re-run** the
  pasted commands rather than trusting the paste.
- Run the **Bucket-2 hunt** — concurrency, resource leaks, code-level fail-open, boundary leaks.
  **This is its real value**, not AC box-ticking.
- Run the **incremental loop:** **re-review each fix** the implementer returns, until **APPROVE**.
- **Does NOT** re-characterize or fix.
- **STOP / escalate condition:** on a spec gap, **escalate a characterization defect to the
  [architect](architect.md)** instead of silently coding around it.

## Inputs

- The story characterization — ACs and their evidence clauses (the same contract the
  [implementer](implementer.md) built against).
- The implementation in its **isolated worktree draft** (pointed at by the
  [orchestrator](orchestrator.md), never a stashed tree), plus the attached evidence each round.

## Outputs

- A **structured verdict** — **APPROVE**, or **BLOCKING with findings**.
- On a spec gap: a **characterization-defect escalation** to the architect.

## Flow

1. Receive the implementation draft and its attached evidence for the story's ACs.
2. Confirm each AC is met; spot-re-run its evidence to confirm it is genuine.
3. Run the Bucket-2 hunt across concurrency, leaks, code-level fail-open, boundary leaks.
4. If a spec gap surfaces, **escalate a characterization defect** to the architect.
5. Return the verdict — **APPROVE**, or **BLOCKING with findings**; on a re-dispatch, re-review the
   fix and loop until APPROVE.

## Validation

An engine implements this role correctly when:

- it **spot-re-runs** evidence rather than accepting a paste at face value;
- it surfaces genuine Bucket-2 defects (a race, a throw-path leak) — its real value;
- it **escalates** a spec gap to the architect instead of re-characterizing or coding around it;
- it never fixes the code itself, and re-reviews each fix until APPROVE.

## Acceptance

Correctly implemented when each AC is confirmed met with genuine re-run evidence, Bucket-2 defects
are caught here rather than shipped, spec gaps are escalated to the architect, and the verdict is a
structured APPROVE / BLOCKING that drives the loop to APPROVE.

## References

- [Operating model](README.md) — the parent spec; the incremental loop; Bucket 2 ownership.
- [Implementer](implementer.md) — produces the implementation and evidence under review.
- [Orchestrator](orchestrator.md) — gates on this verdict; routes BLOCKING; re-dispatches review.
- [Architect](architect.md) — receives escalated characterization defects.
- [Authoring standard](../authoring-standard/README.md) — the evidence clause the reviewer re-runs.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Operating model — delivery system spec](./README.md) · **← Prev:** [Role — implementer](./implementer.md) · **Next →:** [implementation lessons ledger](../lessons-ledger.md)

<!-- /DOCS-NAV -->
