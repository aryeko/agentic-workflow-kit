---
title: "fnd-01-s2-policy-resolution - policy resolution implementation story"
id: "fnd-01-s2-policy-resolution"
epic: 1
status: "story: draft"
design:
  - "docs/design/30-domain-reference/foundation/configuration-and-policy/README.md"
  - "docs/design/30-domain-reference/foundation/configuration-and-policy/schema-and-resolution.md"
  - "docs/design/30-domain-reference/foundation/configuration-and-policy/interfaces-events-and-verification.md"
---

# fnd-01-s2-policy-resolution - Policy Resolution

## Purpose

Resolve policy deterministically from built-in defaults, profile patches, and operator overrides while
returning provenance and event-ready append intents.

## Normative design

- `docs/design/30-domain-reference/foundation/configuration-and-policy/README.md`
- `docs/design/30-domain-reference/foundation/configuration-and-policy/schema-and-resolution.md`
- `docs/design/30-domain-reference/foundation/configuration-and-policy/interfaces-events-and-verification.md`
- `docs/engineering/testing-policy.md`
- `docs/engineering/dependency-policy.md`

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types: `ConfigurationPolicy`, `ResolvedPolicy`, `ResolvedPolicyResult`,
  `ConfigurationPolicyAppendIntent`, `FieldProvenance`, `ResolutionContext`,
  `PolicyResolutionFailure`.
- Events / append intents: `ConfigFieldResolved`, `ConfigResolved`, `PolicyResolutionFailed`.
- Provider operations / commands: none.
- Failure and degraded tokens: `profile-unknown`, `override-invalid`, `config-invalid`,
  `unsupported-deferred-capability`, `provenance-write-failed`.
- Evidence records / attestations: canonical provenance map, event-ready append intent batch, stable
  resolved policy hash.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Implement `ConfigurationPolicy.resolveRunPolicy`.
- Apply precedence as operator override, then selected profile patch, then immutable built-in defaults.
- Enumerate leaf fields in canonical lexicographic order and return one `ConfigFieldResolved` intent
  per leaf before `ConfigResolved`.
- Preserve array/scalar replacement semantics and object-map merge semantics.
- Return no active policy unless the caller can append the returned provenance intents through core-01.

## Out of scope

- Schema/default definitions, owned by `fnd-01-s1-config-schema`.
- Adoption diagnostics, owned by `fnd-01-s3-adoption-diagnostics`.
- Appending through the core-01 run writer or defining the core event envelope.
- Applying capability, approval, merge, escalation, credential, or egress policy.

## Dependencies and frozen inputs

- Covers signals: Deterministic precedence across defaults, profile, and operator override;
  Per-field provenance and policy-resolution event payloads.
- Depends on: `fnd-01-s1-config-schema`.
- Depended on by: `fnd-03-s1-repository-branch`, `fnd-04-s1-credential-refs`,
  `fnd-04-s2-injection-egress`.
- Shared shapes consumed: `fnd-01-s1-config-schema/KitConfig`,
  `fnd-01-s1-config-schema/RunConfigInput`, `fnd-01-s1-config-schema/PolicyLayer`,
  `fnd-01-s1-config-schema/PolicyLayerPatch`.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. Avoid "exactly as
specified."

- **AC-1** For every leaf field, an operator override value wins over a profile value and built-in
  default - evidence: precedence property test.
- **AC-2** Profile patch values win over built-in defaults when no operator override exists -
  evidence: precedence table test.
- **AC-3** Arrays and scalar values replace atomically, object maps merge, and invalid `null` values
  fail validation - evidence: merge semantics tests.
- **AC-4** Returned `ConfigFieldResolved` intents are in canonical lexicographic field order and one
  intent exists per resolved leaf - evidence: provenance order test.
- **AC-5** `ResolvedPolicy` carries `schema: "kit-vnext.resolved-policy.v1"`, full `PolicyLayer`, and
  `FieldProvenance` for each leaf - evidence: resolved policy snapshot.
- **AC-6** Unknown profiles return `profile-unknown`; invalid overrides return `override-invalid`;
  base config that fails schema validation returns `config-invalid`; any resolution input containing
  `orchestrator-decide` returns `unsupported-deferred-capability`; in all four cases no fallback,
  partial override, or `ResolvedPolicy` is returned - evidence: failure tests.
- **AC-7** If provenance intents cannot be appended by the caller, the result is
  `provenance-write-failed` and no policy is active - evidence: core writer handoff fixture.

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| Implement `ConfigurationPolicy.resolveRunPolicy` | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 |
| Apply precedence: operator override > profile patch > built-in defaults | AC-1, AC-2 |
| Enumerate leaf fields in canonical lexicographic order; one `ConfigFieldResolved` per leaf before `ConfigResolved` | AC-4 |
| Preserve array/scalar replacement and object-map merge semantics | AC-3 |
| Return no active policy unless caller can append returned provenance intents | AC-7 |
| Interfaces / types: `ConfigurationPolicy`, `ResolvedPolicy`, `ResolvedPolicyResult` | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 |
| Interfaces / types: `ConfigurationPolicyAppendIntent`, `FieldProvenance`, `ResolutionContext`, `PolicyResolutionFailure` | AC-4, AC-5, AC-6, AC-7 |
| Events / append intents: `ConfigFieldResolved`, `ConfigResolved` | AC-4, AC-5 |
| Events / append intents: `PolicyResolutionFailed` | AC-6 |
| Failure token `profile-unknown` | AC-6 |
| Failure token `override-invalid` | AC-6 |
| Failure token `config-invalid` | AC-6 |
| Failure token `unsupported-deferred-capability` | AC-6 |
| Failure token `provenance-write-failed` | AC-7 |
| Evidence: canonical provenance map | AC-4 |
| Evidence: event-ready append intent batch | AC-4, AC-5 |
| Evidence: stable resolved policy hash | AC-5 |

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `profile-unknown` | Requested profile does not exist. | Return failure and select no fallback profile. | AC-6 |
| `override-invalid` | Operator override has unknown or invalid fields. | Return failure and apply no partial override. | AC-6 |
| `config-invalid` | Base config fails schema validation. | Return failure and no `ResolvedPolicy`. | AC-6 |
| `unsupported-deferred-capability` | Resolution input attempts v1-deferred autonomy. | Return failure and no `ResolvedPolicy`. | AC-6 |
| `provenance-write-failed` | Caller cannot append returned provenance events. | Treat policy as inactive and block launch. | AC-7 |

## Quality bar

- Coverage scope and threshold: policy resolution/provenance modules at 90% minimum, aiming for 95%.
- Required tests, catalogued by AC and failure row: property and table tests for AC-1 through AC-3,
  provenance order/hash tests for AC-4/AC-5, failure tests for AC-6, append-failure handoff fixture
  for AC-7.
- Exact commands: `pnpm test:unit -- packages/sdk/tests/foundation/configuration-policy/resolution/*.unit.test.ts`;
  `pnpm check`; coverage with `pnpm coverage:baseline`.
- Determinism constraints: injected `occurredAt`; no ambient time, randomness, or object insertion
  order dependency.
- Dependency boundaries: SDK policy resolution imports no core writer, provider, CLI, MCP, or testkit
  production code.
- File-size or module-size constraints: split resolution, provenance, and event intent helpers.
- Domain non-negotiables: returned append intents are structural; core-01 owns actual append.

## Required reading

- `docs/design/30-domain-reference/foundation/configuration-and-policy/schema-and-resolution.md`
- `docs/design/30-domain-reference/foundation/configuration-and-policy/interfaces-events-and-verification.md`
- `fnd-01-s1-config-schema` story contract
- `docs/engineering/testing-policy.md`

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The SDK policy-resolution modules providing `ConfigurationPolicy.resolveRunPolicy`, provenance, and
event-ready append intents, plus the evidence pack.

## Evidence pack

- Test name or artifact proving each AC.
- Test name or artifact proving each failure/degraded outcome row.
- `pnpm check` result, unless the gate is blocked by an unrelated repository issue that is named.
- Coverage command and number for the stated scope.
- Sweep-grep results showing no core writer import and no ambient time/randomness in resolution code.

## Boundaries and STOP conditions

- Package or module boundary: `packages/sdk/src/foundation/configuration-policy/resolution`,
  `provenance`, and `events`.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/foundation/configuration-policy/resolution/**`,
  `packages/sdk/src/foundation/configuration-policy/provenance/**`,
  `packages/sdk/src/foundation/configuration-policy/events/**`,
  `packages/sdk/tests/foundation/configuration-policy/resolution/**`.
- Forbidden dependencies: no event-log writer implementation, no core runtime imports, no provider
  packages, no process/network/credential code.
- STOP when: activation semantics require changing core-01 append protocol or adding policy fields not
  named by fnd-01 design.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 1 - stories](./README.md) · **← Prev:** [fnd-01-s1-config-schema - configuration schema implementation story](./fnd-01-s1-config-schema.md) · **Next →:** [fnd-01-s3-adoption-diagnostics - adoption diagnostics implementation story](./fnd-01-s3-adoption-diagnostics.md)

<!-- /DOCS-NAV -->
