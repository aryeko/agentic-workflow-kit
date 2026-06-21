---
title: "T9 draft - readiness matrix and rollout fragments"
status: proposed
target-corpus-paths:
  - "docs/implementation/readiness-matrix.md"
  - "docs/implementation/package-rollout.md"
  - "docs/implementation/work-item-authoring-guide.md"
---

# T9 draft - readiness matrix and rollout fragments

This draft reclassifies runtime attestation as production-readiness evidence.

Source basis:

- NFR-TEST says the control plane runs against mock providers with zero real processes/network
  (`docs/design/00-orientation/requirements.md#requirements`).
- Frontier 3 already requires Agent contract and mock fixtures to drive core tests with zero real
  processes and zero network
  (`docs/implementation/frontiers/frontier-3-agent-and-core-gates/charter.md#readiness-criteria`).
- SDK docs forbid concrete providers, process helpers, GitHub clients, Codex clients, and runtime
  surfaces in the SDK (`docs/design/20-sdk-and-packaging/sdk-boundary.md#what-the-sdk-must-not-own`).
- Testkit owns provider mocks and conformance helpers while production provider interfaces and
  `CapabilityAttestation` stay SDK-owned
  (`docs/design/20-sdk-and-packaging/testkit-and-conformance.md#what-testkit-owns`,
  `docs/design/20-sdk-and-packaging/testkit-and-conformance.md#what-testkit-must-not-own`).

## Proposed readiness matrix term

In `docs/implementation/readiness-matrix.md#terms`, add:

| Term | Meaning |
|---|---|
| `production gate` | Evidence required before a real provider driver or live capability can be used in production. It is not required for SDK/core package build or mock-driven core tests. |

## Proposed domain readiness axis

Rename `runtime attestation` to `runtime / production attestation` and add this note above the
matrix:

> Runtime / production attestation is a production-readiness gate for real provider drivers and
> capability-dependent live powers. It is not a core build/test prerequisite. Core SDK tests run on
> SDK provider ports plus testkit mocks/fixtures with zero real processes and zero network.

Use `n/a` for SDK/core rows where the row is only claiming package/story readiness against mocks:

| Domain class | `runtime / production attestation` value |
|---|---|
| Foundation and core package rows | `n/a` unless the row claims a live provider capability |
| Provider contract + mock stories | `n/a` for core build/test readiness; mock/conformance evidence belongs under conformance/integration |
| Real provider driver stories | `no`, `partial`, or `yes` based on current live/provider capability evidence |
| Edge executable rows | `n/a` until they wire live providers; then inherit the real driver production gates they use |

## Proposed update rule

In `docs/implementation/readiness-matrix.md#update-rule`, replace the runtime-attestation bullet with:

> runtime / production attestation: capability attestation evidence exists for the named real driver,
> live provider surface, or production capability. Recorded/mock attestations can prove core gate
> predicates and conformance behavior, but they do not by themselves make a real driver
> production-ready.

Add:

> Matrix satisfaction for an SDK/core story does not require live runtime attestation unless the
> story itself claims a live provider capability. SDK/core readiness is proven by package
> implementation, conformance fixtures, replay tests, and mock-driven core tests.

## Proposed package rollout wording

In `docs/implementation/package-rollout.md#rollout-by-frontier`, replace Frontier 2 and Frontier 3
package effects with:

| Frontier | Package effect |
|---|---|
| Frontier 2 | Adds SDK provider ports for Work Source, Forge, and Execution Host; adds `testkit` mocks/conformance for those ports. Real `provider-markdown`, `provider-github`, and `provider-local` driver packages start only in separate real-driver stories and do not block core. |
| Frontier 3 | Adds the SDK Agent provider port and `testkit` Agent mocks/conformance; fills SDK capability gates and analysis modules. The `provider-codex` driver package starts only as a separate real-driver story and does not block core gates. |

Add to `docs/implementation/package-rollout.md#migration-tracking`:

> Readiness-matrix evidence for SDK/core package implementation is not blocked by live runtime
> attestation. Real-driver migration remains blocked until the relevant provider package has current
> runtime / production attestation evidence for the capabilities it claims.

## Proposed work-item authoring guide wording

In `docs/implementation/work-item-authoring-guide.md#evidence-pack`, replace:

> Conformance, smoke, or runtime-attestation evidence when a provider/capability is involved.

with:

> Conformance evidence for every provider port/mocking surface involved; runtime / production
> attestation evidence only when the story claims a real driver capability or live production power.
> Core stories may use recorded/mock attestations to prove gate predicates, but must not require real
> processes or network.

In `docs/implementation/work-item-authoring-guide.md#gate-b---evidence-pack-is-complete`, add the
same distinction: mock-driven core evidence proves SDK/core readiness; real runtime probes prove
production readiness for concrete drivers.
