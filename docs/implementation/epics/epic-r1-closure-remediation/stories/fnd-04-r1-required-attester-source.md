---
title: "fnd-04-r1-required-attester-source - drop runtime-only RequiredAttester facts and fix release-match"
id: "fnd-04-r1-required-attester-source"
epic: "r1"
status: "story: ready"
design:
  - "docs/design/30-domain-reference/foundation/credentials-and-secrets/contracts-and-events.md"
  - "docs/design/30-domain-reference/foundation/credentials-and-secrets/README.md"
---

# fnd-04-r1-required-attester-source - RequiredAttester mis-sourcing forward-fix

## Purpose

Forward-fix the **one** genuinely-open closure defect in the already-delivered fnd-04 code (Epic 1,
PR #128): audit finding **#7**. The delivered `RequiredAttester` carries `platform`, `driverVersion`
(and an undesigned `runtimeMetadataAvailable`) that fnd-04 fabricates from a `runtime` fallback
(`'runtime-metadata-missing'`) and then matches incoming egress attestations against — but the amended
design states these are **runtime facts of the attesting Execution Host driver, matched at credential
release time against the Host `CapabilityAttestation`**, not values fnd-04 can produce. This story drops
those fields from `RequiredAttester`, removes the fabrication, and reworks the release-match so it matches
on the design's criteria (`driverId`/`scopeDigest`/`egressPolicyDigest` + fresh positive attestation),
not on fnd-04-fabricated platform/version copies.

### Scope note — findings #5, #6, #8, #9 are already satisfied in the delivered code

The closure audit listed findings #5–#9 against fnd-04 as a *design* defect class (the pre-amendment
design under-specified the producer of audit provenance). Epic 1's delivered code realized the contract
functionally as `(input, dependencies)` and **already** threads that provenance, so those four are closed
at the code layer and are explicitly **out of scope** here (verified, see Out of scope). The amendment
formalized the provenance as `CredentialAuditContext`; the delivered functional realization is the
house-pattern equivalent (the SDK realizes every design `interface { method() }` as an `(input,
dependencies)` function — e.g. `createRunEventLog`). Only finding #7 is an open code↔design mismatch.

## Normative design

- `docs/design/30-domain-reference/foundation/credentials-and-secrets/contracts-and-events.md`
  — the `RequiredAttester` comment (lines 48–56): "`point`, `capability`, `driverId` come from the fnd-01
  `RequiredAttesterSource`; `scopeDigest` and `egressPolicyDigest` are computed by fnd-04. `platform` and
  `driverVersion` are NOT declared here — they are runtime facts of the attesting Execution Host driver,
  matched at credential release time against the Host `CapabilityAttestation` … not values config or
  fnd-04 can produce." The `RequiredAttester` interface body (lines 54–56):
  `{ point; capability; driverId; scopeDigest; egressPolicyDigest }`.
- `docs/design/30-domain-reference/foundation/credentials-and-secrets/README.md`
  — the release-match rule (lines 132–135): a credential "is released only after the Execution Host
  enforcement point has a fresh positive `CapabilityAttestation` (`capability: "egress-confinement"`)
  matching the egress-policy `scope` and `egressPolicyDigest`, freshness key, platform, driver version,
  expiry, evidence ref, and negative probes. Missing, stale, partial, or mismatched attestation denies
  injection." (Platform/driver-version are properties the Host attestation *reports*; they are not values
  fnd-04 pre-specifies on `RequiredAttester`.)

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the amended design defines and the delivered implementation must change, by name (the delivered API
shape — `(input, dependencies)` functions — is preserved; only the `RequiredAttester` shape and the
release-match predicate change):

- Type narrowed: `RequiredAttester` (`egress-types.ts:16-22`) becomes exactly the amended design shape —
  `RequiredAttesterSource & { scopeDigest: string; egressPolicyDigest: string }`, i.e.
  `{ point, capability, driverId, scopeDigest, egressPolicyDigest }`. The members `platform`,
  `driverVersion`, and `runtimeMetadataAvailable` are removed.
- Producer corrected: `resolveRequiredAttesters` (`issue-egress-policy.ts:~100-102`) no longer assigns
  `platform`/`driverVersion`/`runtimeMetadataAvailable` onto the produced `RequiredAttester` (removing the
  `'runtime-metadata-missing'` fabrication).
- Release-match corrected: `matchesEgressAttestation` (`resolve-credential.ts:~42,52,53`) no longer
  predicates acceptance on `required.platform`/`required.driverVersion`/`required.runtimeMetadataAvailable`;
  it matches the attestation against the `RequiredAttester` on the design's criteria (`driverId`,
  `scopeDigest`, `egressPolicyDigest`, fresh positive `egress-confinement` attestation). The attestation's
  own `platform`/`driverVersion` remain available as reported evidence on `EgressAttestation`.
- Companion types reconciled: `RequiredAttesterRuntime` (`egress-types.ts:46-50`) is reduced or removed to
  the extent it existed only to feed the now-removed `RequiredAttester` fields; `EgressAttestation`
  (`egress-types.ts:73-74`) keeps its `platform`/`driverVersion` (these are the Host's reported facts —
  the evidence being matched, not a fnd-04 requirement).

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Remove `platform`, `driverVersion`, `runtimeMetadataAvailable` from `RequiredAttester` so its shape is
  exactly the amended design's (closing finding #7).
- Remove the fabrication of those fields in `resolveRequiredAttesters` (no `'runtime-metadata-missing'`
  fallback).
- Rework `matchesEgressAttestation` so acceptance no longer depends on fnd-04-produced platform/version;
  matching is on `driverId` + `scopeDigest` + `egressPolicyDigest` + a fresh positive
  `egress-confinement` attestation per the README release-match rule.
- Preserve the existing denial behaviour (`egress-policy-unattested` still denies a genuinely
  missing/stale/mismatched attestation; no confined credential released without a matching attestation).
- Reconcile `RequiredAttesterRuntime` and any internal call sites; keep `EgressAttestation.platform`/
  `driverVersion` as reported evidence.
- Update the fnd-04 tests/fixtures to the narrowed `RequiredAttester` and the corrected match.

## Out of scope

- **Findings #5, #6, #8, #9 (verified already closed in delivered code):**
  - #6 — `EgressPolicySource` is already threaded into `issueEgressPolicy` via `input.egressSource`, and
    `selectRules` already derives rules from it (`issue-egress-policy.ts`).
  - #9 — fnd-04 reads no ambient time today: `at` is injected via dependencies; the clock sweep
    (`Date.now|new Date(|Math.random|crypto.randomUUID`) over the fnd-04 src tree returns zero matches.
  - #8 — `CredentialUseStarted` already carries `attestationEventIds`, `evidenceRefs`, and `at`
    (`operation-audit.ts:~162-163`, sourced from matched attestations).
  - #5 — `RedactionApplied` already carries full run/task/operation/party/phase identity + `at`, sourced
    from the caller's `input.audit` seed.
  This story must NOT re-implement these; a regression guard (sweep) keeps #9 from regressing.
- Migrating the delivered `(input, dependencies)` function API to a literal `CredentialsAndSecretsContract`
  object or a `CredentialAuditContext` parameter type — the functional realization is the accepted house
  pattern and already carries the provenance; a literal-shape rewrite would be new construction, not a
  forward-fix, and is not what the amendment requires.
- Emitting an `EgressPolicyIssued` audit event from `issueEgressPolicy`, or back-filling
  `CredentialUsePlanned.attestationEventIds`/`evidenceRefs` — neither is a listed closure finding;
  flagged here as observed-but-out-of-scope so it is not silently dropped.
- The fnd-01 `RequiredAttesterSource` declaration (frozen, Epic 1); the Host `CapabilityAttestation`
  domain logic (not yet delivered); the core-01 envelope.
- Editing the Epic 1 `fnd-04-s1..s4` charter, story DAG, or story contracts.

## Dependencies and frozen inputs

- Covers signals: **none** — forward-fix of delivered surface; signal ownership remains Epic 1
  `fnd-04-s1..s4`. ACs trace to the frozen amended design seam above.
- Depends on: nothing intra-epic. Consumes frozen fnd-01 `RequiredAttesterSource`. Band 1.
- Depended on by: nothing intra-epic.
- Shared shapes consumed (verbatim, not redeclared): fnd-01 `RequiredAttesterSource`.

## Acceptance criteria

- **AC-1** `RequiredAttester` declares exactly `{ point, capability, driverId, scopeDigest, egressPolicyDigest }`
  and no `platform`, `driverVersion`, or `runtimeMetadataAvailable` — evidence:
  `required-attester-shape.types.test.ts` assigns a `RequiredAttester` fixture with exactly those five
  members (tsc zero errors) and includes three `@ts-expect-error` lines asserting that `platform`,
  `driverVersion`, and `runtimeMetadataAvailable` are not assignable members (pass); backed by the AC-4
  sweep proving the symbols are gone from the declaration.

- **AC-2** `resolveRequiredAttesters` produces a `RequiredAttester` carrying only the five design members
  and never the `'runtime-metadata-missing'` fabrication — evidence:
  `issue-egress-policy-attester-shape.unit.test.ts` calls `issueEgressPolicy` with an
  `egressSource`/`requiredAttesters` fixture and asserts each produced required-attester has keys exactly
  `["point","capability","driverId","scopeDigest","egressPolicyDigest"]` and that the produced object has
  no `platform`/`driverVersion`/`runtimeMetadataAvailable` key (pass).

- **AC-3** Release-match acceptance does not depend on platform/driver-version: an egress attestation whose
  reported `platform`/`driverVersion` differ from anything fnd-04 produced is **accepted** when its
  `driverId`, `scopeDigest`, and `egressPolicyDigest` match a fresh positive `egress-confinement`
  attestation — evidence: `release-match-platform-agnostic.unit.test.ts` drives `resolveCredential` with a
  matching `RequiredAttester` and an `EgressAttestation` carrying arbitrary sentinel
  `platform: "any-os"`, `driverVersion: "9.9.9"` but matching `driverId`/`scopeDigest`/`egressPolicyDigest`,
  and asserts the result is `{ ok: true }` (pass).

- **AC-4** Release-match still **denies** on a genuine mismatch — evidence:
  `release-match-denies-mismatch.unit.test.ts` drives `resolveCredential` with an `EgressAttestation`
  whose `egressPolicyDigest` does NOT match the `RequiredAttester`, and asserts
  `{ ok: false, reason: "egress-policy-unattested" }` (pass). Plus a runnable sweep
  (Evidence pack) proving `resolve-credential.ts` no longer reads
  `required.platform`/`required.driverVersion`/`required.runtimeMetadataAvailable`.

- **AC-5** No ambient clock regression — evidence: the clock sweep
  `grep -REn "Date\.now|new Date\(|Math\.random|crypto\.randomUUID" packages/sdk/src/foundation/credentials-secrets/`
  returns zero matches (exit 1), captured into the evidence pack (guards finding #9 from regressing).

- **AC-6** `RequiredAttester` is importable from the `sdk` public entrypoint with the narrowed shape —
  evidence: `required-attester-public-import.unit.test.ts` imports `RequiredAttester` (type) from the
  `sdk` entrypoint and constructs a value with exactly the five members (compiles, pass).

## Coverage matrix

| Responsibility / spec-surface item | Proven by |
|---|---|
| `RequiredAttester` narrowed to the five design members | AC-1, AC-6 |
| `resolveRequiredAttesters` drops the fabrication | AC-2 |
| Release-match no longer gates on fnd-04 platform/version | AC-3, AC-4 (sweep) |
| Denial behaviour preserved on genuine mismatch | AC-4 |
| No ambient-clock regression (#9 guard) | AC-5 |
| Public exposure with narrowed shape | AC-6 |

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `egress-policy-unattested` | the Execution Host attestation is missing/stale/partial or its `scope`/`egressPolicyDigest`/`driverId` does not match the `RequiredAttester` | deny: return `{ ok: false, reason: "egress-policy-unattested" }`; no confined credential released | AC-4 |

## Quality bar

- Coverage scope and threshold: the changed surface under
  `packages/sdk/src/foundation/credentials-secrets/egress/**` and
  `.../injection/resolve-credential.ts` at ≥90%, aiming 95%; aggregate gate `pnpm coverage:baseline`.
- Coverage command / instrumented lane: `pnpm exec vitest run --project unit --coverage
  --passWithNoTests -- packages/sdk/tests/foundation/credentials-secrets/**`.
- Required tests, catalogued by AC / failure row:
  - `required-attester-shape.types.test.ts` (AC-1)
  - `issue-egress-policy-attester-shape.unit.test.ts` (AC-2)
  - `release-match-platform-agnostic.unit.test.ts` (AC-3)
  - `release-match-denies-mismatch.unit.test.ts` (AC-4; failure row `egress-policy-unattested`)
  - `required-attester-public-import.unit.test.ts` (AC-6)
- Public exposure (import path + public-import test): `RequiredAttester` is exported from the `sdk` public
  entrypoint per `epic0-s4-export-templates/PackageExportConvention` (export exists; its shape narrows);
  proven by `required-attester-public-import.unit.test.ts`.
- Determinism constraints: no `Date.now()`, `new Date()`, `Math.random()`, `crypto.randomUUID()` in
  production source (AC-5).
- Dependency boundaries: `packages/sdk/src/foundation/credentials-secrets/**` imports only fnd-01 / fnd-02
  / core-01 types it already depends on; must not import `testkit`, any `provider-*` package, `cli`, or
  `mcp` in production source.
- File-size budget (lines per file; default soft cap ~200; hard cap 800): no edited file exceeds 400
  lines; test files ≤ 250 lines each.
- Domain non-negotiables:
  - fnd-04 never fabricates Host-driver runtime facts (`platform`/`driverVersion`); they are matched as
    reported evidence at release, per design lines 48–56 / 132–135.
  - The fix preserves fail-closed denial: a missing/stale/mismatched attestation still denies
    (`egress-policy-unattested`).
  - fnd-04 reads no ambient time.

## Required reading

- `docs/design/30-domain-reference/foundation/credentials-and-secrets/contracts-and-events.md`
  (`RequiredAttester` comment + body, lines 48–56).
- `docs/design/30-domain-reference/foundation/credentials-and-secrets/README.md`
  (release-match rule, lines 132–135).
- fnd-01 config-and-policy `RequiredAttesterSource` (frozen).
- `docs/reviews/2026-06-25-producer-consumer-closure-audit.md` finding #7 (and #5/#6/#8/#9 for the
  already-closed context).
- The delivered fnd-04 code: `egress/egress-types.ts`, `egress/issue-egress-policy.ts`,
  `injection/resolve-credential.ts`, and tests under `packages/sdk/tests/foundation/credentials-secrets/`.
- `docs/engineering/test-lanes.md`; `docs/design/20-sdk-and-packaging/dependency-rules.md`.

## Deliverable

The amended `packages/sdk/src/foundation/credentials-secrets/egress/` and `.../injection/resolve-credential.ts`
with `RequiredAttester` narrowed to the design shape, the fabrication removed, the release-match corrected,
updated tests, and the evidence pack.

## Evidence pack

- Test name proving each AC (see Required tests).
- Negative fixtures: `@ts-expect-error` lines for `platform`/`driverVersion`/`runtimeMetadataAvailable`
  (AC-1); mismatched-`egressPolicyDigest` attestation fixture (AC-4).
- `pnpm check` result.
- Coverage command, instrumented lane, and number for the changed credentials-secrets surface.
- Public-import test result for `RequiredAttester` from the `sdk` entrypoint.
- Runnable sweeps (capture output; expected zero matches → exit 1):
  - Match no longer reads them:
    `grep -REn "required\.(platform|driverVersion|runtimeMetadataAvailable)" packages/sdk/src/foundation/credentials-secrets/`
    — expected zero matches.
  - Ambient clock (AC-5):
    `grep -REn "Date\.now|new Date\(|Math\.random|crypto\.randomUUID" packages/sdk/src/foundation/credentials-secrets/`
    — expected zero matches.

## Boundaries and STOP conditions

- Owned pathset (the orchestrator commits strictly this):
  `packages/sdk/src/foundation/credentials-secrets/**`,
  `packages/sdk/tests/foundation/credentials-secrets/**`.
- Forbidden dependencies (production source): `testkit`, any `provider-*` package, `cli`, `mcp`.
- STOP when: the fix would require changing the amended design, a fnd-01 type, the Host attestation
  domain, or the core-01 envelope; or when it would touch findings #5/#6/#8/#9 surface (already closed) or
  add new behaviour (EgressPolicyIssued emission, CredentialUsePlanned back-fill). Escalate rather than
  widen scope.

## Characterization Review

### Decision: narrow the fnd-04 forward-fix to finding #7 only

- Rationale: the delivered Epic 1 code realized the contract functionally and already threads audit
  provenance (verified: #5/#6/#8/#9 satisfied — `input.audit` seed, `input.egressSource`,
  `operation-audit.ts` attestation refs, injected `at`). The only open code↔design mismatch is #7, where
  fnd-04 fabricates Host-driver `platform`/`driverVersion` and matches against them.
- Design trace: `contracts-and-events.md` lines 48–56; README lines 132–135; delivered code
  `egress-types.ts:16-22`, `issue-egress-policy.ts:~100-102`, `resolve-credential.ts:~42,52,53`.
- Falsification: any of #5/#6/#8/#9 is in fact still open in the delivered code (e.g. `CredentialUseStarted`
  lacks `attestationEventIds`), or the design requires a literal `CredentialAuditContext` parameter type
  that the functional realization cannot express.
- Escalation: if a re-read shows another finding open, add a scoped AC; if the design genuinely mandates
  the object-method API shape, STOP and escalate a scope expansion to the owner before freezing.

### Decision: release-match drops fnd-04 platform/version, keeps attestation evidence

- Rationale: platform/driver-version are Host-driver runtime facts reported by the `CapabilityAttestation`
  and matched at release; fnd-04 must not pre-specify required values for them (the delivered
  `'runtime-metadata-missing'` fallback proves the fabrication is meaningless).
- Design trace: `contracts-and-events.md` lines 48–56 ("NOT declared here … matched at credential release
  time against the Host `CapabilityAttestation`").
- Falsification: removing the gate weakens a real security check the design requires (i.e. the design
  expects fnd-04 to pre-specify platform/version) — it does not; the design says the opposite.
- Escalation: if a consumer genuinely needs fnd-04 to assert platform/version, that is a design change —
  STOP and escalate.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic R1 - stories](./README.md) · **← Prev:** [core-01-r1-create-run-requested-by - source CreateRunInput.requestedBy on the run-creation seam](./core-01-r1-create-run-requested-by.md) · **Next →:** [Epic R1 - story DAG](../story-dag.md)

<!-- /DOCS-NAV -->
