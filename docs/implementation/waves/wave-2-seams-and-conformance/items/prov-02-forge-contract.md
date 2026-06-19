---
title: "prov-02 — Forge contract + mock — implementation charter"
id: "prov-02-contract"
wave: 2
layer: "contracts (providers)"
status: "item: ready"
spec: "docs/design/domains/providers/prov-02-forge-collaboration/"
---

# prov-02 — Forge contract + mock

**Purpose.** The seam for remote collaboration: PR create/update, CI/check status, review threads,
merge (+ merge queue), and the **evidence DTOs** the runner relies on — plus a mock forge. Contract +
mock only; the real GitHub/octokit driver is the driver track.

**Spec (normative).** Implement the contract + capability set + evidence DTOs from
`docs/design/domains/providers/prov-02-forge-collaboration/`. The evidence DTO shapes (CI/PR/review/
merge) and the capability set (`supportsMergeQueue`, `supportsThreadResolution`, attestation) are
normative — and **defined independently of any SDK shape**.

## Responsibilities (in scope)

- The Forge contract: branch push; PR create/update; gather CI/PR/review evidence; merge + merge-queue
  actions; thread resolution.
- The capability set + attestation.
- A **mock forge** with adversarial cases (missing checks, partial review data, merge race, lies about
  merge state) + conformance cases.

## Out of scope

The real GitHub driver + `octokit` + GraphQL schema pinning (driver track); auth (injected via fnd-04
at the driver, not here); completion/merge *decisions* (core-05 — this seam gathers/acts, core decides).

## Requirements owned

The contract side of FR-6/FR-7 (forge evidence + merge actions); NFR-EXT, NFR-TEST, NFR-SAFE
(partial-data fail-closed); **plus prov-02 contract spec compliance.**

## Dependencies & frozen contracts

Depends on fnd-04 (creds, at runtime via the driver), w2-1. Consumed by core-05/06.

## Libraries

`zod`, conformance-kit, `fast-check`. **No `octokit`, no network** (driver track).

## Required reading

This domain's spec (`README.md` + sibling aspect files) (+ its evidence/ index for the DTO shapes); `dependency-policy.md` (octokit as
the worked example: evidence DTOs, no SDK leakage); `testing-policy.md`; w2-1.

## Deliverable

The Forge contract package + mock forge, passing the conformance kit; evidence DTOs with explicit
partial/degraded states.

## Definition of done

- *Spec compliance:* contract + evidence DTOs + capability set match the design; DTOs are SDK-agnostic
  (no octokit type could leak through them).
- *Quality bar:* the mock passes the kit; adversarial cases (missing/partial/lying forge data) map to
  fail-closed evidence states as specified; `pnpm check` green.

## Boundaries

Contract + mock only; evidence DTOs must be expressible from both a mock and (future) octokit without
leaking SDK shapes. If a DTO can only be expressed in octokit terms, **STOP and surface**.
