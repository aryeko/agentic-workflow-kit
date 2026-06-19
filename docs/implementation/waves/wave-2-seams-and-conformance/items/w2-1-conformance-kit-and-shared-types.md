---
title: "w2-1 — Conformance kit & shared contract types — implementation charter"
id: "w2-1"
wave: 2
layer: "contracts / test-kit"
status: "item: ready"
spec: "docs/design/conventions.md (provider evidence/conformance); docs/design/architecture.md (capability attestation)"
---

# w2-1 — Conformance kit & shared contract types

**Purpose.** The shared substrate the four seams plug into: the capability-attestation model, common
contract types, and the conformance harness that every driver (mock now, real later) must pass. AD-10
requires *one* suite all drivers satisfy — this is it.

**Spec (normative).** Implement to `architecture.md` (capability attestation) and `conventions.md`
(provider evidence + conformance: schema probes, real-driver smoke, adversarial mocks). The
`CapabilityAttestation` shape (capability, probeMethod, result, evidenceRef, scope, expiry,
driverVersion, platform, freshnessKey, at) is normative.

## Responsibilities (in scope)

- The `CapabilityAttestation` type + shared contract primitives (evidence-ref, error/reason token
  unions in **kebab-case** per w0-1).
- The **conformance harness**: a schema-probe runner, an adversarial-mock scaffold (helpers to build
  mocks that omit/delay/lie), and **empty real-smoke slots** (skipped until a real driver registers).
- A way for each seam to declare its conformance cases.

## Out of scope

The seam contracts themselves (their own items); any real driver; any SDK.

## Requirements owned

NFR-TEST, NFR-EXT; the AD-10 conformance bar; capability-attestation honesty; **plus w2-1 spec
compliance.**

## Dependencies & frozen contracts

Foundation-only (may use fnd-02 evidence-ref types). Depended on by all four seam items + every future
driver.

## Libraries

`zod` (schema probes), `fast-check` + `@fast-check/vitest` (adversarial/property cases). No SDKs.

## Required reading

`architecture.md` (capability attestation); `conventions.md` (conformance); `testing-policy.md` (the
conformance bar + which lanes); the four provider design.md capability sets.

## Deliverable

The `conformance-kit` package: attestation + shared types; the harness (schema-probe runner, adversarial
scaffold, real-smoke registration slots); its own self-tests.

## Definition of done

- *Spec compliance:* the attestation model + conformance dimensions match
  `conventions.md`/`architecture.md`; the kit exposes exactly the schema-probe / real-smoke /
  adversarial-mock dimensions AD-10 names.
- *Quality bar:* **the kit has teeth** — a sample mock that omits/delays/lies provably **fails** it
  (self-test); the kit runs in the `conformance-mock` lane (no real proc/net); `pnpm check` green;
  coverage bar.

## Boundaries

Stay in the conformance-kit package; it depends only on foundation. If a seam needs a conformance
dimension the kit can't express, extend the kit here (not in the seam) — and keep it driver-agnostic.
