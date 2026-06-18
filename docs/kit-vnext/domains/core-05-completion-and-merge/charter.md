---
title: "Completion, Verification & Merge — charter"
id: "core-05"
layer: "core"
status: "charter: ready"
last-reviewed: 2026-06-18
---

# Completion, Verification & Merge — charter

**Purpose.** Decide "done" and "merge" from independently gathered evidence + explicit policy — never
worker prose — and gate irreversible actions.

## Responsibilities (in scope)
- The evidence model (git / verification / CI / PR / review / blocker / claim-reconciliation), bound to
  an exact head SHA.
- The completion decision and the **fail-closed merge predicate**.
- Merge policy: conditions for merge, blocker-evidence PRs, and the **changed-file anti-gaming gate**
  backed by a **protected-policy snapshot taken at launch** (verify command, CI defs, package scripts,
  config): a change to protected policy requires human approval + re-verification under the pre-change
  (or explicitly approved new) policy.

## Out of scope
- Gathering raw forge data (Forge), the **runner-owned verify capture (Execution Host)**, and local git
  evidence (Workspace) — this domain **evaluates** that evidence, it does not gather it.
- The capability predicate definition (core-02), evaluated here.

## Requirements owned
FR-6 (independent evidence), FR-7 (completion & merge), NFR-SAFE, NFR-DET.

## Dependencies (Dependency Rule)
- Depends on: core-01, core-02; the **Forge** (CI/PR/review + merge), **Execution Host** (runner-owned
  verify), and **Workspace & Repository** (local git evidence) contracts.
- Must NOT: depend on a concrete driver.

## Required reading
Standard set + [core-02](../core-02-capability-and-safety/charter.md), the Forge contract in
[prov-02](../prov-02-forge-collaboration/charter.md), the runner-owned verify in
[prov-04](../prov-04-execution-host/charter.md), and local git evidence in
[fnd-03](../fnd-03-workspace-and-repository/charter.md).

## Deliverable
`design.md` defining: the evidence records; the completion + merge predicates; the merge-policy config
surface; changed-file classes + the protected-policy snapshot; who performs push/PR/merge (the runner,
after the gate, via Forge); fail-closed behaviors.

## Definition of done (domain-specific)
- The gate is a pure function over evidence; `claim-evidence-mismatch` is a first-class outcome.
- Missing/unknown evidence fails closed (parks); a worker-declared green with no captured/CI evidence
  is unverified.

## Open questions
- Trusted-check sources; exact blocker-evidence semantics.
