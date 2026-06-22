---
title: "prov-00-s1-capability-attestation - shared capability attestation payload implementation story"
id: "prov-00-s1-capability-attestation"
epic: 2
status: "story: ready"
design:
  - "docs/design/20-sdk-and-packaging/provider-ports.md"
  - "docs/design/20-sdk-and-packaging/provider-interface-model.md"
---

# prov-00-s1-capability-attestation - Shared Capability Attestation Payload

## Purpose

Define the one SDK-owned generic `CapabilityAttestation<Capability>` envelope, its provider
discriminator and result enum, and its canonical runtime validator, so every provider seam specializes
the same shape and testkit validates against it without redefining it.

## Normative design

- `docs/design/20-sdk-and-packaging/provider-ports.md` — "Shared attestation payload" (the canonical
  `CapabilityAttestation<Capability>` payload, `CapabilityProvider`, `CapabilityAttestationResult`, and
  the `eventId`-absent rule).
- `docs/design/20-sdk-and-packaging/provider-interface-model.md` — "Capability attestation" (SDK owns
  the type; testkit validates against it; the freshness invariant).
- `docs/design/20-sdk-and-packaging/sdk-boundary.md` — the `CapabilityAttestation` type is SDK-owned.
- `docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/stories/epic0-s4-export-templates.md`
  — `PackageExportConvention` for the public `sdk` entrypoint.
- `docs/engineering/testing-policy.md`, `docs/engineering/test-lanes.md`,
  `docs/engineering/dependency-policy.md`.

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types: `CapabilityAttestation<Capability extends string = string>` with fields
  `capability`, `probeMethod`, `result`, `evidenceRef`, `scope`, `expiry`, `driverVersion`,
  `platform`, `freshnessKey`, `at`, and optional `details`; `CapabilityProvider`
  (`"agent" | "executionHost" | "forge" | "workSource"`); `CapabilityAttestationResult`
  (`"positive" | "negative"`).
- Events / append intents: none. `eventId` is intentionally **not** a payload field; the run-log
  envelope assigns the event id after append (core-01/core-02, Epic 3).
- Provider operations / commands: none.
- Failure and degraded tokens: none owned here. The "freshly and positively attested or treated as
  absent" rule is a structural invariant carried by the `result`, `expiry`, and `freshnessKey` fields;
  the gate that evaluates it is core-02 (Epic 3), and each seam's failure tokens live in its port story.
- Evidence records / attestations: the `CapabilityAttestation` payload is itself the attestation
  record; a canonical runtime validator (`capabilityAttestationSchema` and the `isCapabilityAttestation`
  type guard) that testkit and the seam ports validate against without redefining the type.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Define the generic `CapabilityAttestation<Capability>` envelope with exactly the design's ten
  required fields plus optional `details`, parameterized by a capability string union.
- Define `CapabilityProvider` and `CapabilityAttestationResult` with exactly the design's members.
- Omit `eventId` from the payload; expose no field that pre-assigns an event id.
- Carry the freshness invariant structurally: every attestation records `result`, `expiry`, and
  `freshnessKey` so a consumer can distinguish a fresh positive attestation from a stale or negative
  one without trusting self-report.
- Provide one canonical runtime validator (schema + type guard) so testkit and all four seam ports
  validate attestations against the SDK type rather than redefining it.

## Out of scope

- The per-seam capability unions (`AgentCapability`, `ForgeCapability`, `WorkSourceCapability`,
  `HostCapability`) and `probeCapabilities` specializations — owned by each seam's port story
  (`prov-01-s1-agent-port`, `prov-02-s1-forge-port`, `prov-03-s1-work-source-port`,
  `prov-04-s1-execution-host-port`).
- The capability-gate evaluation that enforces freshness — owned by core-02 (Epic 3).
- The run-log event envelope and event-id assignment — owned by core-01 (Epic 3).
- `HostAttestationDetails` and any seam-specific `details` payload — owned by the seam port stories.

## Dependencies and frozen inputs

- Covers signals: the shared-envelope `split` part of each provider seam's "capability attestation
  payloads" `Story Group Signal` (`prov-01`, `prov-02`, `prov-03`, `prov-04`).
- Depends on: none (root producer).
- Depended on by: `prov-01-s1-agent-port`, `prov-02-s1-forge-port`, `prov-03-s1-work-source-port`,
  `prov-04-s1-execution-host-port`, and all four testkit stories.
- Shared shapes consumed: none.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. The `evidence` names
the exact test id or command and the result it produces.

- **AC-1** `CapabilityAttestation<Capability>` is generic over `Capability extends string = string` and
  declares exactly the ten required fields `capability`, `probeMethod`, `result`, `evidenceRef`,
  `scope`, `expiry`, `driverVersion`, `platform`, `freshnessKey`, `at` plus optional `details?:
  Record<string, unknown>`, with `capability` typed as the `Capability` parameter - evidence:
  `attestation-shape.unit.test.ts` asserts a constructed `CapabilityAttestation<"canKill">` typechecks
  and that omitting any required field fails compilation (type-level fixture).
- **AC-2** `CapabilityProvider` is the union `"agent" | "executionHost" | "forge" | "workSource"` with
  no other members - evidence: `attestation-shape.unit.test.ts` exhaustiveness check over the union
  yields the four discriminants.
- **AC-3** `CapabilityAttestationResult` is the union `"positive" | "negative"` with no other members -
  evidence: `attestation-shape.unit.test.ts` exhaustiveness check yields the two members.
- **AC-4** The payload exposes no `eventId` (or other pre-assigned event-id) field - evidence:
  `no-event-id.unit.test.ts` asserts `"eventId" extends keyof CapabilityAttestation` is `false`
  (type-level negative fixture).
- **AC-5** `capabilityAttestationSchema` accepts a payload carrying `result`, `expiry`, and
  `freshnessKey` and rejects one missing any of them, so freshness is representable without self-report
  - evidence: `attestation-schema.unit.test.ts` parses a valid fixture (pass) and a
  missing-`freshnessKey` fixture (parse error), and the `isCapabilityAttestation` guard returns
  `false` for the latter.
- **AC-6** `CapabilityAttestation`, `CapabilityProvider`, `CapabilityAttestationResult`,
  `capabilityAttestationSchema`, and `isCapabilityAttestation` are importable from the `sdk` package
  public entrypoint, not a private module path - evidence: `attestation-public-import.unit.test.ts`
  imports all five from the `sdk` entrypoint and constructs one attestation.

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No
responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| `CapabilityAttestation<Capability>` generic envelope with ten fields + optional `details` | AC-1 |
| `CapabilityProvider` union members | AC-2 |
| `CapabilityAttestationResult` union members | AC-3 |
| Omit `eventId` from the payload | AC-4 |
| Freshness carried structurally by `result`/`expiry`/`freshnessKey` | AC-5 |
| Canonical runtime validator (`capabilityAttestationSchema`, `isCapabilityAttestation`) | AC-5, AC-6 |
| Public exposure of the attestation type catalog and validator | AC-6 |

## Failure and degraded outcomes

This story owns a type catalog and a validator; it defines no runtime failure/degraded tokens (those
live in the seam port stories). The validator's rejection behavior is a validation-failure surface:

| failure mode | invalid fixture | required validation | proven by |
|---|---|---|---|
| Attestation missing a freshness field | payload without `freshnessKey` (or `expiry`/`result`) | `capabilityAttestationSchema` parse fails and `isCapabilityAttestation` returns `false` | AC-5 |
| Payload carries a pre-assigned `eventId` | type-level fixture adding `eventId` | does not satisfy `CapabilityAttestation` (compile-time) | AC-4 |

## Quality bar

- Coverage scope and threshold: the attestation schema and type-guard helpers (`capabilityAttestationSchema`,
  `isCapabilityAttestation`) at 90% minimum, aiming for 95%. Type-only declarations are proven by the
  type-level fixtures in AC-1/AC-2/AC-3/AC-4, not by line coverage.
- Coverage command and instrumented lane(s): `pnpm coverage:baseline` instruments the unit lane for the
  aggregate gate; for a focused per-story report measuring exactly the validator helper scope
  (`src/providers/attestation/{schema,guard}.ts`), `pnpm exec vitest run --project unit --coverage
  --passWithNoTests -- packages/sdk/tests/providers/attestation/attestation-schema.unit.test.ts` — the
  schema/guard test is the only instrumentable lane; the other three attestation unit tests are
  type-level fixtures (AC-1/AC-2/AC-3/AC-4) contributing no instrumented lines, so the focused glob
  excludes them to keep the number measuring the claimed helper scope.
- Required tests, catalogued by AC and failure row: `attestation-shape.unit.test.ts` (AC-1, AC-2,
  AC-3); `no-event-id.unit.test.ts` (AC-4); `attestation-schema.unit.test.ts` (AC-5, both validation
  rows); `attestation-public-import.unit.test.ts` (AC-6).
- Public exposure (import path + public-import test): `CapabilityAttestation`, `CapabilityProvider`,
  `CapabilityAttestationResult`, `capabilityAttestationSchema`, `isCapabilityAttestation` exported from
  the `sdk` public entrypoint per `epic0-s4-export-templates/PackageExportConvention`; proven by
  `attestation-public-import.unit.test.ts`.
- Determinism constraints: the schema and guard are pure and side-effect free; no clock, randomness, or
  I/O (`at`/`expiry` are caller-supplied strings).
- Dependency boundaries: `sdk` may import only pure runtime libraries (zod); it must not import
  `testkit`, any `provider-*`, `cli`, or `mcp` (`dependency-rules.md`).
- File-size budget (lines per file; default soft cap ~200): type declarations and the validator stay in
  separate focused files, each ≤ 200 lines.
- Domain non-negotiables: the attestation type is SDK-owned and singular; no other story redeclares it,
  and a capability is trusted only when freshly and positively attested.

## Required reading

- `docs/design/20-sdk-and-packaging/provider-ports.md` ("Shared attestation payload")
- `docs/design/20-sdk-and-packaging/provider-interface-model.md` ("Capability attestation")
- `docs/design/20-sdk-and-packaging/sdk-boundary.md`
- `epic0-s4-export-templates` story contract
- `docs/engineering/test-lanes.md`

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The `packages/sdk` shared capability-attestation type catalog (`CapabilityAttestation`,
`CapabilityProvider`, `CapabilityAttestationResult`) and its canonical runtime validator, exposed on
the `sdk` public entrypoint, plus the evidence pack.

## Evidence pack

- Test name or artifact proving each AC (catalogued above).
- Test name or artifact proving each validation-failure row.
- Negative fixture for every rejection: missing-`freshnessKey` payload (AC-5); `eventId`-bearing
  type-level fixture (AC-4).
- `pnpm check` result, unless blocked by a named unrelated repository issue.
- Coverage command, instrumented lane, and number for the validator helper scope.
- Public-import test result for every exposed shape, imported through the `sdk` entrypoint.
- Boundary/forbidden-symbol sweep: the exact `grep` command, path root, forbidden-token set, and
  zero-match output, plus the `pnpm deps` result.

## Boundaries and STOP conditions

- Package or module boundary: `packages/sdk/src/providers/attestation` only.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/providers/attestation/**`, `packages/sdk/tests/providers/attestation/**`.
- Forbidden dependencies: no `testkit`, no `provider-*`, no `cli`/`mcp`, no per-seam capability union,
  no capability-gate evaluation logic.
- Boundary/forbidden-symbol sweep (runnable recipe): `grep -REn "testkit|provider-(codex|local|github|markdown)|/cli/|/mcp/|AgentCapability|ForgeCapability|WorkSourceCapability|HostCapability|eventId" packages/sdk/src/providers/attestation/`
  over path root `packages/sdk/src/providers/attestation/`; forbidden-token set = `testkit`,
  `provider-codex|local|github|markdown`, `/cli/`, `/mcp/`, the four per-seam capability unions, and
  `eventId`; expected result zero matches (exit code 1), captured into the evidence pack; plus
  `pnpm deps` proves the dependency-rule edges. A non-empty match means this catalog leaked a per-seam
  union, an `eventId` field, or a forbidden package edge and fails the story.
- STOP when: a requirement needs a per-seam capability union, the freshness gate evaluation, or the
  run-log event envelope — those belong to the seam port stories or to Epic 3.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 2 - stories](./README.md) · **← Prev:** [Epic 2 - stories](./README.md) · **Next →:** [prov-01-s1-agent-port - SDK Agent provider port implementation story](./prov-01-s1-agent-port.md)

<!-- /DOCS-NAV -->
