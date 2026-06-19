---
title: "fnd-01 — Configuration & Policy — implementation charter"
id: "fnd-01"
wave: 1
layer: "foundation"
status: "item: ready"
spec: "docs/design/domains/foundation/fnd-01-configuration-and-policy/"
---

# fnd-01 — Configuration & Policy

**Purpose.** The single source of resolved configuration and policy — defaults, capabilities,
approval/escalation rules, merge/change policy, and (per w0-1) credential-reference + egress-policy
source fields — with full provenance.

**Spec (normative).** Implement `docs/design/domains/foundation/fnd-01-configuration-and-policy/`
**as amended by w0-1** (the credential-ref + egress-policy fields). The contracts, the `PolicyLayer`
schema, resolution precedence, and diagnostic events are normative. Ambiguous/contradictory → STOP and
surface.

## Responsibilities (in scope)

- Layered config resolution **with provenance** (which layer set each value).
- The full `PolicyLayer` schema **including the credential-ref + egress-policy source fields** that
  fnd-04 consumes.
- Adoption diagnostics (FR-13): detect legacy/incompatible config and **fail closed** with guidance.
- Emit config diagnostic records as append-intents (core-01 appends them).

## Out of scope

Secret *values* and resolution (fnd-04 owns those — fnd-01 carries references/policy only); *applying*
policy (consuming core domains); event semantics (core-01).

## Requirements owned

FR-13; the policy surfaces behind FR-4/FR-7/FR-12; NFR-SEC (egress-policy source), NFR-DET; **plus full
fnd-01 design-spec compliance.**

## Dependencies & frozen contracts

Foundation-only (no deps above foundation). Depended on by fnd-03, fnd-04, core-01/02/03/05.

## Libraries

`zod` for the config/policy schemas + JSON-Schema generation for docs. No SDKs.

## Required reading

This domain's spec (`README.md` + sibling aspect files) (+ the w0-1 amendment); `dependency-policy.md` (schema-ownership:
foundation-owned config schema); `testing-policy.md`.

## Deliverable

The config/policy package: resolution-with-provenance; the complete `PolicyLayer` schema (incl.
credential-ref + egress-policy); adoption diagnostics; diagnostic append-intents.

## Definition of done

- *Spec compliance:* `PolicyLayer` matches the amended design (incl. the new fields); resolution
  precedence + provenance exactly as specified; adoption diagnostics fail closed on legacy/incompatible
  input per spec.
- *Quality bar:* property tests for resolution precedence + provenance; fail-closed paths tested;
  `pnpm check` green; coverage bar met.

## Boundaries

Stay in the config/policy package; carry credential *references/policy* only, never secret values;
clock/id injected. If the credential/egress field shapes still look unsettled after w0-1, STOP and
surface.
