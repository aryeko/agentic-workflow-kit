---
title: "prov-02 — Forge contract + mock — implementation charter"
id: "prov-02-contract"
wave: 2
layer: "contracts (providers)"
status: "item: ready"
spec: "docs/design/domains/providers/prov-02-forge-collaboration/ (README.md + contracts-and-conformance.md + evidence/)"
---

# prov-02 — Forge contract + mock

**Purpose.** The seam for remote collaboration: branch push, PR create/update, CI/check + review +
merge **evidence DTOs**, merge (+ merge queue), thread resolution — plus a mock forge. Contract + mock
only; the real GitHub/octokit driver is the driver track. (FR-6/FR-7, NFR-SAFE.)

**Spec (normative).** Implement the contract + capability set + evidence DTOs from
`docs/design/domains/providers/prov-02-forge-collaboration/` (`README.md` + `evidence/` index for the
observed GitHub shapes). DTOs are **defined independently of any SDK shape**. Ambiguous → STOP and surface.

> **Spec reconciliation done** — `contracts-and-conformance.md` now exists and types `ForgeEvidenceSnapshot` (+ its CI/PR/review/protection/merge-queue sub-DTOs), `ForgeDegraded`, and the `ForgeActionResult` discriminant (Q1/Q2 closed). Q3/Q4 are confirm-only owner-ratification items, non-blocking.

## Spec surface (manifest)

- **`ForgeContract`** — `probeCapabilities`, `pushBranch`, `upsertPullRequest`, `publishComment`,
  `collectEvidence`, `updateBranch`, `enqueue`, `merge`.
- **Head-binding** — `collectEvidence`/`updateBranch`/`enqueue`/`merge` take `expectedHeadSha` (required);
  every irreversible action re-reads head and refuses on mismatch.
- **Defined types** — `ForgeRepoRef`, `ForgeBranchRef`, `PullRequestRef`, `EvidenceRequest`,
  `ExpectedHeadActionRequest`. `ForgeEvidenceSnapshot` (PR state, base/head SHA, status/check rollup,
  reviews, unresolved threads, protection/ruleset facts, queue facts, evidence refs) — defined in
  `contracts-and-conformance.md`.
- **Capability set** — `supportsRulesets`, `supportsMergeQueue`, `supportsThreadResolution`,
  `canInspectProtection`. Attestation = w2-1 `CapabilityAttestation`.
- **Failure tokens (owned here, §8)** — `forge-credential-unavailable`, `forge-auth-denied`,
  `forge-head-mismatch`, `forge-state-unknown`, `forge-protection-uninspectable`,
  `forge-rulesets-unattested`, `forge-merge-queue-unavailable`, `forge-review-threads-uninspectable`,
  `forge-admin-bypass-refused`, `forge-ghes-capability-unknown`, `forge-rate-limited`,
  `forge-redaction-unavailable`. *(Note: there is no `forge-data-partial` token — missing CI/check data
  maps to `forge-state-unknown`.)*
- **Defined in `contracts-and-conformance.md`:** `ForgeDegraded` shape; `ForgeActionResult` discriminant +
  fields; the CI/PR/review/merge evidence sub-DTOs (including `ForgeEvidenceSnapshot` and its sub-DTOs).

## Responsibilities (in scope)

- The Forge contract + capability set + the evidence DTOs (SDK-agnostic).
- A **mock forge** with adversarial cases (missing checks, partial review data, merge race / head
  mismatch, admin-bypass, credential denied) + conformance cases.

## Out of scope

The real GitHub driver + `octokit` + GraphQL schema pinning (driver track); auth (injected via fnd-04 at
the driver); completion/merge *decisions* (core-05 — this seam gathers/acts, core decides).

## Requirements owned

FR-6/FR-7 (contract sides); NFR-EXT, NFR-TEST, NFR-SAFE (partial-data fail-closed); **plus full prov-02
contract spec compliance.**

## Dependencies & frozen contracts

Depends on `fnd-04` (creds, via the driver at runtime), `w2-1`. Consumed by core-05/06. Must NOT depend
on core/edge/drivers/SDK. No cross-item shape produced.

## Libraries

`zod`, `conformance-kit`, `fast-check`. **No `octokit`, no network** (driver track).

## Acceptance criteria (the shared rubric — defined surface only)

- **AC-1** `ForgeContract` exposes all eight methods with the spec signatures; the mock satisfies it
  (`satisfies ForgeContract`, no cast). — *README §5.*
- **AC-2** `collectEvidence`/`updateBranch`/`enqueue`/`merge` require `expectedHeadSha`; a head mismatch
  on re-read returns `forge-head-mismatch` and sends no mutation. — *README §4 (expected-head).*
- **AC-3** `collectEvidence` returns a full snapshot when all clusters are present, and a degraded result
  with the **exact named token** when a cluster is absent: missing CI/check rollup → `forge-state-unknown`;
  review threads uninspectable → `forge-review-threads-uninspectable`; rulesets stale →
  `forge-rulesets-unattested`; merge queue unavailable → `forge-merge-queue-unavailable`; protection
  uninspectable → `forge-protection-uninspectable`. Never a silently-empty snapshot. — *README §8; NFR-SAFE.*
- **AC-4** `probeCapabilities` returns a `CapabilityAttestation[]` for all four `ForgeCapability` values;
  a negative/stale attestation is treated as the capability absent (no enqueue attempted). — *architecture.md §3; README §5.*
- **AC-5** Credential failure → `forge-credential-unavailable`; provider auth rejection →
  `forge-auth-denied`; neither throws. — *README §8.*
- **AC-6** Admin override / bypass / force-push path → `forge-admin-bypass-refused`; no partial action. — *README §4/§8.*
- **AC-7** No `octokit`/`@octokit/*` import or GitHub SDK type in the contract or mock package (runtime
  + type level): `rg 'octokit|@octokit' packages/contracts-forge packages/drivers-mocks → 0`; depcruise
  confines `octokit` to `packages/drivers-github`. — *dependency-policy.md (SDK behind a seam).*
- **AC-8** The conformance run reproduces the dated `evidence/.../mock-forge-conformance.json` structure
  (capabilities = 4, operations = 7, adversarialCases ≥ 8, every degraded token present). — *evidence/ index.*
- **AC-9** Every evidence DTO and `ForgeActionResult` is expressible from the mock with no octokit type,
  validated by a Zod/JSON-Schema round-trip. *(DTO shapes + `ForgeActionResult` discriminant are now
  typed in `contracts-and-conformance.md`.)*

## Failure & degraded outcomes (first-class)

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `forge-head-mismatch` | observed head ≠ `expectedHeadSha` on re-read | refuse the action; no mutation sent | AC-2 |
| `forge-state-unknown` | CI/check rollup absent/ambiguous | `collectEvidence` degraded; never partial-as-complete | AC-3 |
| `forge-review-threads-uninspectable` | review-thread state unavailable | degraded; not an empty array | AC-3 |
| `forge-rulesets-unattested` / `forge-protection-uninspectable` | ruleset/protection probe stale/unavailable | capability absent; degraded | AC-3, AC-4 |
| `forge-merge-queue-unavailable` | merge queue unsupported/hidden | `enqueue` refused with this token | AC-3, AC-4 |
| `forge-credential-unavailable` / `forge-auth-denied` | fnd-04 denies / provider rejects | refuse; no throw | AC-5 |
| `forge-admin-bypass-refused` | success needs override/bypass/force-push | refuse; no partial action | AC-6 |
| `forge-redaction-unavailable` | safe persistence (redaction) unavailable | refuse persistence; no unredacted write | AC-3 (fail-closed) |
| `forge-ghes-capability-unknown` / `forge-rate-limited` | provider/version off the attested matrix / rate limited | degraded; no silent fallback to stale data | AC-4 |

## Quality bar

- Coverage ≥ 90% lines/branches (aim 95%), enforced by
  `vitest run --coverage --coverage.thresholds.lines=90 --coverage.thresholds.branches=90` (paste it).
- Required tests (catalogue): `satisfies ForgeContract` + no-octokit grep/depcruise (AC-1/AC-7);
  expected-head missing + mismatch (AC-2); one degraded-token test per cluster (AC-3); capability
  positive/negative (AC-4); credential/auth failures (AC-5); admin-bypass (AC-6); the conformance-JSON
  structure match (AC-8); a fail-closed property over arbitrary partial evidence.
- File ≤ 800 lines; clock/id injected; no SDK / network.

## Required reading

This domain's spec (`README.md` + `contracts-and-conformance.md` + `evidence/` index);
`dependency-policy.md` (octokit worked example — evidence DTOs, no SDK leakage); `testing-policy.md`;
`w2-1`. Nothing else.

## Deliverable

The Forge contract package + mock forge, passing the conformance kit; the evidence pack (test-per-AC,
coverage, no-octokit proof). The typed DTO/`ForgeActionResult`/`ForgeDegraded` definitions are now in the
spec (`contracts-and-conformance.md`); implement against them.

## Boundaries

Contract + mock only; evidence DTOs must be expressible from both a mock and (future) octokit without
leaking SDK shapes. If a DTO can only be expressed in octokit terms, **STOP and surface**.

## Open questions (non-blocking; tracked)

- **Q1 — RESOLVED.** `contracts-and-conformance.md` now exists and types `ForgeEvidenceSnapshot` and its
  CI/PR/review/protection/merge-queue sub-DTOs with explicit partial/degraded states.
- **Q2 — RESOLVED.** `ForgeDegraded` (token field + observed-facts field) and the `ForgeActionResult`
  discriminant (`kind`: `accepted | refused | degraded`; `accepted`/`refused` carry `observedHeadSha`,
  `degraded` carries it optionally — the head may be unread when a degrade occurs) are typed in
  `contracts-and-conformance.md`.
- **Q3 (confirm-only — design owner to ratify).** Confirm `forge-lies-merge-state` is covered by
  `forge-head-mismatch` (re-read before merge), not a separate token.
- **Q4 (confirm-only — design owner to ratify).** Confirm the partial-protection case (`supportsRulesets`
  available but `canInspectProtection` not) returns a degraded snapshot, not a partial one.
