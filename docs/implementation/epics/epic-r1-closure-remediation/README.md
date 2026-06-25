---
title: Epic R1 - Delivered-code closure remediation
epic: "r1"
status: "epic: ready"
depends-on-epics: [1, 3]
last-reviewed: "2026-06-25"
---

# Epic R1 - Delivered-code closure remediation

## Purpose

Bring two **already-delivered** domains into line with the design-closure amendments that merged in
PR #151 (`2858a4a`). The amendments corrected under-specified producer↔consumer seam contracts; two of
the affected domains had already shipped as code against the pre-amendment contract, so their code now
mismatches the frozen design. This epic forward-fixes that code (and its tests) to the amended seam — it
does **not** re-open or re-plan the epics that originally delivered them.

This is a **remediation epic**: it claims **zero new Story Group Signals**. Signal ownership stays with
the originating epics (Epic 1 for fnd-04, Epic 3 for core-01); the global coverage rollup is unchanged.
Each story traces its acceptance criteria to the **frozen amended design seam**, not to a newly-claimed
signal.

## Included domains

| Domain | Role in this epic | Primary spec surface |
|---|---|---|
| `fnd-04` Credentials & Secrets (delivered Epic 1) | Forward-fix the one open code↔design mismatch (finding #7): drop runtime-only `platform`/`driverVersion`/`runtimeMetadataAvailable` from `RequiredAttester` and correct the release-match. Findings #5/#6/#8/#9 verified already closed in the delivered functional code | `docs/design/30-domain-reference/foundation/credentials-and-secrets/contracts-and-events.md`, `.../README.md` |
| `core-01` Run Lifecycle & State (delivered Epic 3) | Forward-fix `CreateRunInput` to carry top-level required `requestedBy` sourcing `RunCreatedPayload.requestedBy` | `docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md`, `.../README.md` |

## Why this epic exists

The producer↔consumer closure audit (`docs/reviews/2026-06-25-producer-consumer-closure-audit.md`)
confirmed a defect class — *a contract declares a required output with no producer reachable from its
declared inputs*. The design amendments closed it corpus-wide. Findings **#5–#9** (fnd-04) and **#18**
(core-01) sit on surface that was already delivered as code, so closing them in the design alone leaves
the delivered code diverged. The remediation plan
(`docs/reviews/2026-06-25-closure-remediation-plan.md`, Phase C) directs that these be forward-fixed via a
remediation epic rather than by reopening the delivered charters.

The four other affected domains (recovery, completion, sdk-barrel, protected-policy) were **not** yet
delivered; they need only the Phase-A design fix and are planned correctly when their epics run. They are
out of scope here.

## Frozen inputs

- Amended design — fnd-04:
  `docs/design/30-domain-reference/foundation/credentials-and-secrets/contracts-and-events.md`
  (`CredentialAuditContext`, `CredentialsAndSecretsContract`, `AuditBase`, `RequiredAttester`) and
  `.../README.md` (release-match rule for attesters; injected-time rule).
- Amended design — core-01:
  `docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md` (`CreateRunInput`,
  `RunCreatedPayload`) and `.../README.md` (lineage prose).
- fnd-01 producer of `EgressPolicySource` / `RequiredAttesterSource`:
  `docs/design/30-domain-reference/foundation/config-and-policy/` (frozen, Epic 1).
- Audit + plan: `docs/reviews/2026-06-25-producer-consumer-closure-audit.md` (findings #5–#9, #18),
  `docs/reviews/2026-06-25-closure-remediation-plan.md` (Phase C).
- Delivered code under remediation: `packages/sdk/src/foundation/credentials-secrets/**` (Epic 1,
  PR #128) and `packages/sdk/src/core/run-lifecycle/**` (Epic 3, PR #144).

## Outputs

- `fnd-04` `RequiredAttester` no longer declares or fabricates `platform`/`driverVersion`/
  `runtimeMetadataAvailable`; the release-match matches on `driverId`/`scopeDigest`/`egressPolicyDigest`
  + a fresh positive attestation, not on fnd-04-fabricated platform/version (finding #7). The audit
  provenance the amendment formalizes (`CredentialAuditContext` content) is already threaded by the
  delivered functional code (#5/#6/#8/#9 verified closed). Tests updated.
- `core-01` `CreateRunInput` carries a top-level required `requestedBy` that sources
  `RunCreatedPayload.requestedBy`; lineage prose reflects it. Tests updated.
- `pnpm check` green on the amended code.

## Scope boundaries

- **In:** editing the delivered code + tests for fnd-04 and core-01 so they match the frozen amended
  design seam.
- **Out:** any new feature behaviour; new Story Group Signal ownership; touching the recovery,
  completion, sdk-barrel, or protected-policy surfaces; editing `docs/design/**`; editing the Epic 1 or
  Epic 3 charters, story DAGs, or story contracts.
- **STOP when:** a fix would require a design change (escalate — the corpus is frozen), or would alter
  behaviour beyond the finding-#7 `RequiredAttester`/release-match correction (fnd-04) or the
  `requestedBy` sourcing (core-01) — e.g. emitting new audit events or migrating the delivered functional
  API to a literal contract-object shape.

## Per-domain expectations

This epic owns **zero** Story Group Signals. The table below records the **design seam** each story
forward-fixes and the existing signal owner that remains unchanged. The global coverage rollup is not
modified.

### `fnd-04` Credentials & Secrets

| Forward-fixed seam (amended design) | Owning story (this epic) | Signal owner (unchanged) |
|---|---|---|
| `RequiredAttester` drops runtime-only `platform`/`driverVersion`/`runtimeMetadataAvailable`; release-match corrected (finding #7). Findings #5/#6/#8/#9 verified already closed in the delivered functional code | `fnd-04-r1-required-attester-source` | Epic 1 `fnd-04-s1..s4` (no transfer) |

- Evidence expectation: `RequiredAttester` carries exactly `{ point, capability, driverId, scopeDigest,
  egressPolicyDigest }`; no `platform`/`driverVersion`/`runtimeMetadataAvailable` symbol remains and the
  release-match no longer reads them; existing `egress-policy-unattested` denial behaviour is preserved;
  no ambient time is read (regression guard).

### `core-01` Run Lifecycle & State

| Forward-fixed seam (amended design) | Owning story (this epic) | Signal owner (unchanged) |
|---|---|---|
| `CreateRunInput.requestedBy` top-level required field sourcing `RunCreatedPayload.requestedBy` | `core-01-r1-create-run-requested-by` | Epic 3 `core-01-s1..` (no transfer) |

- Evidence expectation: `CreateRunInput` exposes a required top-level `requestedBy`; `createRun`
  sources `RunCreatedPayload.requestedBy` from it; no caller supplies `requestedBy` twice.

## Epic readiness

On completion the delivered fnd-04 and core-01 code matches the frozen amended design, closing audit
finding #7 (fnd-04) and #18 (core-01) at the code layer (findings #5/#6/#8/#9 were verified already
closed in the delivered functional realization). No downstream epic depends on this epic; it removes
latent seam divergence in already-shipped surface.

## Deferred work

- Recovery, completion, sdk-barrel, and protected-policy closure fixes — design-only, handled when their
  (not-yet-delivered) epics run. Not part of this epic.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [epic charters](../README.md) · **← Prev:** [Epic 7 - story DAG](../epic-7-operator-surfaces-and-composition/story-dag.md) · **Next →:** [Epic R1 Execution Package Plan](./execution/plan.md)

**Children:** [Epic R1 Execution Package Plan](./execution/plan.md) · [Implementer Prompt: core-01-r1-create-run-requested-by](./execution/prompts/core-01-r1-create-run-requested-by/implementer.md) · [Reviewer Prompt: core-01-r1-create-run-requested-by](./execution/prompts/core-01-r1-create-run-requested-by/reviewer.md) · [Implementer Prompt: fnd-04-r1-required-attester-source](./execution/prompts/fnd-04-r1-required-attester-source/implementer.md) · [Reviewer Prompt: fnd-04-r1-required-attester-source](./execution/prompts/fnd-04-r1-required-attester-source/reviewer.md) · [Epic R1 Execution Tracker](./execution/tracker.md) · [Epic R1 - stories](./stories/README.md) · [Epic R1 - story DAG](./story-dag.md)

<!-- /DOCS-NAV -->
