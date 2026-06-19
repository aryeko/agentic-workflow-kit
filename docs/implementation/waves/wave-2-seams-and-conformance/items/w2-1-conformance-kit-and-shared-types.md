---
title: "w2-1 — Conformance kit & shared contract types — implementation charter"
id: "w2-1"
wave: 2
layer: "contracts / test-kit"
status: "item: ready"
spec: "docs/design/architecture.md (capability attestation); docs/design/conventions.md (provider evidence/conformance); docs/foundation/testing-policy.md (conformance lane)"
---

# w2-1 — Conformance kit & shared contract types

**Purpose.** The shared substrate the four seams plug into: the `CapabilityAttestation` model, the
cross-cutting attestation tokens, and the conformance harness every driver (mock now, real later) must
pass. AD-10 requires *one* suite all drivers satisfy — this is it.

**Spec (normative).** Implement to `architecture.md` §3 (the capability-attestation model) and
`conventions.md` "Provider evidence & conformance" (schema probes, real-driver smoke slots, adversarial
mocks). Ambiguous or under-specified → STOP and surface; do not invent.

## Spec surface (manifest)

- **`CapabilityAttestation`** (canonical — owned here, cited by every seam): `capability`,
  `probeMethod`, `result: "positive" | "negative"`, `evidenceRef`, `scope`, `expiry`, `driverVersion`,
  `platform`, `freshnessKey`, `at`, optional `eventId?` for linking to an already-recorded attestation
  event, and an optional `details?` (carrying `containmentStrength` / `negativeProbeResults` /
  `egressPolicyDigest` for seams that need them).
- **Cross-cutting attestation tokens** (owned here): `attestation-stale`, `attestation-absent`,
  `attestation-negative`, `evidence-missing`. (Per-seam failure tokens are owned by each seam.)
- **`ArtifactRef`** — re-exported / referenced from `fnd-02` (W1); not redefined here.
- **Harness:** a schema-probe runner (Zod → JSON-Schema-representable validation), an adversarial-mock
  scaffold (helpers to build mocks that omit / delay / lie), real-smoke registration slots (skipped in
  the `conformance-mock` lane), and a per-seam conformance-case declaration API.

## Responsibilities (in scope)

- The canonical `CapabilityAttestation` type + the cross-cutting attestation tokens above.
- The conformance harness and the per-seam case-declaration API.
- The kit's own self-tests proving it has teeth.

## Out of scope

The seam contracts themselves (their own items); the per-seam failure-token unions (owned by each seam);
any real driver; any SDK.

## Requirements owned

NFR-TEST, NFR-EXT; the AD-10 conformance bar; capability-attestation honesty; **plus full w2-1 spec
compliance.**

## Dependencies & frozen contracts

Foundation-only. Cross-item shape consumed (R5): **`ArtifactRef` from `fnd-02`** (used by `evidenceRef`).
Depended on by all four seam items + every future driver. Must NOT depend on contracts/core/edge/drivers.

## Libraries

`zod` (schema probes), `fast-check` + `@fast-check/vitest` (adversarial/property cases). No SDKs.

## Acceptance criteria (the shared rubric)

- **AC-1** The exported `CapabilityAttestation` Zod schema accepts a value with all ten required fields
  plus optional `eventId?`, and rejects one missing any required field (10 negative cases, one per field).
  — *trace: architecture.md §3.*
- **AC-2** `result` is the literal union `"positive" | "negative"` only; any other string is rejected. — *architecture.md §3.*
- **AC-3** `details?` is optional and round-trips `containmentStrength` / `negativeProbeResults` /
  `egressPolicyDigest` without making them required for seams that omit them. — *prov-04 attestation extension.*
- **AC-4** The freshness predicate, given an injected clock, returns `attestation-stale` when `expiry`
  is in the past and treats the capability as absent. — *architecture.md §3 (stale → off).*
- **AC-5** The gate predicate treats `result: "negative"` as `attestation-negative` (capability off,
  not an error). — *architecture.md §3 (negative → off).*
- **AC-6** A schema probe over a payload missing a required field returns a typed failure naming the
  field (`evidence-missing` when `evidenceRef` is absent/unresolvable); it never throws. — *testing-policy.md (conformance).*
- **AC-7 (teeth)** The adversarial scaffold builds a mock that (a) omits a required signal, (b) delays a
  signal past the contract deadline, (c) returns `negative` where `positive` is required — and **each
  variant provably FAILS** the kit's conformance run (asserted `FAIL`, not skipped). — *conventions.md; AD-10.*
- **AC-8** A conformant mock PASSES the same run (the positive control for AC-7). — *conventions.md.*
- **AC-9** Real-smoke slots registered via the API are reported `skip` (not `fail`) in the
  `conformance-mock` lane (no real process / network / credentials). — *testing-policy.md.*
- **AC-10** The schema-probe runner emits a JSON-Schema representation from a Zod schema (structurally
  valid). — *dependency-policy.md (schema ownership: JSON-Schema-representable).*
- **AC-11** No ambient `Date.now`/`Math.random`; the freshness predicate is a pure function of
  (attestation, injected clock) — same inputs → same token (property test). — *dependency-policy.md (determinism ports); guide R3.*
- **AC-12** dependency-cruiser confirms the package imports only foundation (+ test-only); no contracts/
  core/edge/driver/SDK import. — *architecture.md §2; package-map.md.*

## Failure & degraded outcomes (first-class)

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `attestation-stale` | `expiry` past relative to injected clock | freshness predicate → stale; capability absent | AC-4 |
| `attestation-absent` | no attestation for the requested capability | gate → absent | AC-5 (absence path) |
| `attestation-negative` | `result: "negative"` | gate → capability off (not error) | AC-5 |
| `evidence-missing` | `evidenceRef` absent/unresolvable | schema probe → typed failure; no throw | AC-6 |
| kit-has-no-teeth (inverted) | an omit/delay/lie mock PASSES the suite | self-test asserts the suite returns FAIL | AC-7 |

## Quality bar

- Coverage ≥ 90% lines/branches (aim 95%), enforced by
  `vitest run --coverage --coverage.thresholds.lines=90 --coverage.thresholds.branches=90` for this
  package (paste the number in the evidence pack). The verify gate does not enforce a threshold today —
  see the wave charter.
- Required tests (catalogue): the 10 per-field attestation rejections (AC-1); the three teeth variants +
  positive control (AC-7/8); freshness at/before/after expiry with injected clock (AC-4); the
  negative-result gate (AC-5); the determinism property (AC-11); the depcruise lane (AC-12).
- File ≤ 800 lines; clock injected (no ambient time/randomness); no SDK.

## Required reading

`architecture.md` §3 (capability attestation); `conventions.md` (provider evidence & conformance);
`testing-policy.md` (the conformance lane + property-test requirement); `dependency-policy.md` (schema
ownership, determinism ports); `fnd-02`'s `ArtifactRef` export. Plus the four provider specs' capability
sets (for the attestation `details` shape). Nothing else.

## Deliverable

The `conformance-kit` package: the canonical attestation type + cross-cutting tokens; the harness
(schema-probe runner, adversarial scaffold, real-smoke slots, case-declaration API); its self-tests.
Plus the evidence pack (test-per-AC, coverage number, depcruise output).

## Boundaries

Stay in the `conformance-kit` package; depend only on foundation. If a seam needs a conformance
dimension the kit can't express, extend the kit here (not in the seam), keeping it driver-agnostic.

## Open questions (resolve or confirm before/at dispatch)

- **Q1 (narrowed claim).** The spec mandates kebab-case tokens but does **not** mandate a single shared
  token-union owned by this kit. This charter therefore narrows w2-1 to own only the cross-cutting
  attestation tokens; each seam owns its own failure tokens. Confirm this narrowing is intended.
- **Q2.** Name the exact `fnd-02` export used for `evidenceRef` (`ArtifactRef`); confirm it is a frozen
  W1 contract.
- **Q3.** `conformance-mock` is a Vitest project name (test infra), not a spec concept — confirm it
  exists in `tooling/` or add it to `testing-policy.md`.
- **Q4.** `probeMethod` is a free string in the spec (no enumeration) — confirm it is intentionally
  driver-specific (the kit validates presence, not value).
