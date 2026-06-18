---
title: "Forge / Collaboration — charter"
id: "prov-02"
layer: "providers"
status: "charter: ready"
last-reviewed: 2026-06-18
---

# Forge / Collaboration — charter

**Purpose.** The Forge contract — all **remote, credentialed** repository collaboration — with the
**GitHub** driver and a **mock**. The runner uses this seam; the worker never does.

## Responsibilities (in scope)
- The host-neutral **Forge contract**: **push a branch**, **create/update a PR**, read merge evidence
  (PR state, CI checks, reviews, review threads, branch protection / rulesets) **bound to an exact head
  SHA**, and perform **merge / enqueue / update-branch** with `expectedHeadSha`; plus **capability
  attestation** (`supportsRulesets`, `supportsMergeQueue`, `supportsThreadResolution`,
  `canInspectProtection`).
- Holds **remote credentials** (via fnd-04); the worker is never given them (AD-12).
- The **GitHub driver**: rulesets vs branch protection, merge queue, review-thread resolution,
  exact-head merge, admin/bypass **refusal**, GHES/version degrade.
- The **mock forge**: scripted evidence for offline pipeline tests.

## Out of scope
- The merge/completion **decision** (core-05) — this gathers evidence and performs actions, it does not
  decide. Local git (fnd-03). Process execution (prov-04).

## Requirements owned
FR-6 (forge evidence), FR-7 (perform push/PR/merge), NFR-EXT, NFR-TEST, the Forge slice of NFR-SEC.

## Dependencies (Dependency Rule)
- Depends on: fnd-04 (remote credentials). Implements the Forge contract.
- Must NOT: depend on the control plane.

## Required reading
Standard set + AD-12 in [decisions.md](../../decisions.md) and the provider evidence/conformance rules
in [conventions.md](../../conventions.md). GitHub API facts go in this domain's dated `evidence/`
appendix; prefer explicit, stable signals over fragile rollup fields.

## Deliverable
`design.md` defining: the Forge contract + attested capabilities (validated against GitHub **and** the
mock); the GitHub mapping (push, PR, the REST/GraphQL surface used, exact-head binding,
queue/threads/rulesets, admin/bypass refusal); the mock; the conformance suite; degraded modes
(auth/queue/threads unavailable → fail closed).

## Definition of done (domain-specific)
- The contract is satisfiable by GitHub AND the mock; all reads bound to an exact head SHA.
- Remote credentials live only here (never reach the worker); missing/unknown forge state fails closed.
- No undocumented/unstable field is load-bearing.

## Open questions
- GHES coverage; trusted-check source configuration; auto-resolving review threads (default: no).
