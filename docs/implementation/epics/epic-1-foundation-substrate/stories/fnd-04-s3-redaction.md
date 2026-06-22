---
title: "fnd-04-s3-redaction - redaction implementation story"
id: "fnd-04-s3-redaction"
epic: 1
status: "story: ready"
design:
  - "docs/design/30-domain-reference/foundation/credentials-and-secrets/README.md"
  - "docs/design/30-domain-reference/foundation/credentials-and-secrets/contracts-and-events.md"
---

# fnd-04-s3-redaction - Redaction

## Purpose

Implement recursive redaction sets and redacted value contracts for telemetry, process output,
provider responses, and artifacts.

## Normative design

- `docs/design/30-domain-reference/foundation/credentials-and-secrets/README.md`
- `docs/design/30-domain-reference/foundation/credentials-and-secrets/contracts-and-events.md`
- `docs/engineering/testing-policy.md`
- `docs/engineering/test-lanes.md`
- `docs/engineering/dependency-policy.md`

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types: `RedactionSet`, `ProcessOutputChunk`, `TextArtifact`, `RedactableScalar`,
  `RedactedInput`, `RedactedValue`, `RedactResult`.
- Events / append intents: `RedactionApplied` payload shape from `fnd-04-s4-audit-failures`.
- Provider operations / commands: none.
- Failure and degraded tokens: `redaction-unavailable`, `artifact-redaction-failed`.
- Evidence records / attestations: redaction property-test corpus and replacement-count evidence.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Build `RedactionSet` from raw secret fingerprints, labels, shell assignments, JSON values,
  authorization headers, URL-encoded values, and sensitive temporary file paths.
- Implement `redact<T extends RedactedInput>` recursively over scalars, arrays, objects,
  `ProcessOutputChunk`, and `TextArtifact`.
- Redact before persistence for events, projection inputs, process output, command lines, errors,
  Agent prompts/tool results, Forge responses, CI logs, analysis records, and text artifacts.
- Return `RedactedValue` with replacement count, fingerprint ids, and `RedactionApplied`.
- Quarantine binary or unredactable artifacts as `artifact-redaction-failed`.

## Out of scope

- Secret material resolution and injection, owned by `fnd-04-s2-injection-egress`.
- Audit payload type definitions, owned by `fnd-04-s4-audit-failures`.
- Artifact storage and tombstones, owned by `fnd-02-s4-artifact-evidence`.
- Provider-specific response schemas.

## Dependencies and frozen inputs

- Covers signals: Redaction sets for telemetry, process output, provider responses, and artifacts.
- Depends on: `fnd-04-s1-credential-refs`, `fnd-04-s4-audit-failures`.
- Depended on by: `fnd-04-s2-injection-egress`.
- Shared shapes consumed: `fnd-04-s1-credential-refs/CredentialRef`,
  `fnd-04-s1-credential-refs/CredentialScope`,
  `fnd-04-s4-audit-failures/CredentialAuditEvent`.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. Avoid "exactly as
specified."

- **AC-1** `RedactionSet` records credential ref ids, labels, fingerprint ids, and expiry without raw
  secret material - evidence: redaction set schema test.
- **AC-2** Redaction handles secret values as object values, object keys, base64 strings,
  JSON-escaped text, shell assignments, authorization headers, URL-encoded values, command lines,
  errors, stacks, provider responses, and text artifacts - evidence: generated corpus test.
- **AC-3** Redaction is recursive over arrays and objects and preserves non-secret values - evidence:
  recursive property test.
- **AC-4** `RedactedValue` includes redacted value, replacement count, fingerprint ids, and a
  `RedactionApplied` audit payload - evidence: redacted result test.
- **AC-5** A path requiring redaction without an available `RedactionSet` fails with
  `redaction-unavailable` and refuses persistence - evidence: unavailable hook test.
- **AC-6** Binary or unredactable artifacts fail as `artifact-redaction-failed` and cannot satisfy
  gates - evidence: artifact quarantine test.

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| Build `RedactionSet` from fingerprints, labels, shell assignments, JSON values, auth headers, URL-encoded values, sensitive temp file paths | AC-1 |
| Implement `redact<T extends RedactedInput>` recursively over scalars, arrays, objects, `ProcessOutputChunk`, `TextArtifact` | AC-2, AC-3 |
| Redact before persistence across events, output, command lines, errors, prompts/tool results, provider responses, CI logs, analysis, text artifacts | AC-2 |
| Return `RedactedValue` with replacement count, fingerprint ids, `RedactionApplied` | AC-4 |
| Quarantine binary or unredactable artifacts as `artifact-redaction-failed` | AC-6 |
| Interfaces / types: `RedactionSet` | AC-1 |
| Interfaces / types: `ProcessOutputChunk`, `TextArtifact`, `RedactableScalar`, `RedactedInput` | AC-2, AC-3 |
| Interfaces / types: `RedactedValue`, `RedactResult` | AC-4 |
| Event: `RedactionApplied` payload shape | AC-4 |
| Failure token `redaction-unavailable` | AC-5 |
| Failure token `artifact-redaction-failed` | AC-6 |
| Evidence: redaction property-test corpus and replacement-count evidence | AC-2, AC-3, AC-4 |

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `redaction-unavailable` | A capture path requires redaction but no redaction set is available. | Refuse persistence or credential use; never emit unredacted material. | AC-5 |
| `artifact-redaction-failed` | Artifact cannot be proven clean or transformed safely. | Quarantine artifact and bar it from evidence gates. | AC-6 |

## Quality bar

- Coverage scope and threshold: redaction modules at 90% minimum, aiming for 95%.
- Coverage command and instrumented lane(s): `pnpm coverage:baseline` instruments the unit, integration, and conformance-mock lanes; this story's stated redaction helper scope is exercised in the unit lane.
- Required tests, catalogued by AC and failure row: schema, generated corpus, recursive property,
  redacted result, unavailable hook, and artifact quarantine tests.
- Exact commands: `pnpm test:unit -- packages/sdk/tests/foundation/credentials-secrets/redaction/*.unit.test.ts`;
  `pnpm check`; coverage with `pnpm coverage:baseline` for the stated redaction scope.
- Determinism constraints: generated corpus uses recorded seeds and canonical output ordering.
- Dependency boundaries: redaction code imports no provider SDK, process runner, Forge client, network,
  or concrete artifact backend.
- File-size or module-size constraints: pattern generation, recursive traversal, and artifact
  quarantine logic remain focused.
- Domain non-negotiables: no secret value appears in logs, telemetry, provider responses, command
  capture, prompts, tool results, errors, stacks, or artifact output.

## Required reading

- `docs/design/30-domain-reference/foundation/credentials-and-secrets/README.md`
- `docs/design/30-domain-reference/foundation/credentials-and-secrets/contracts-and-events.md`
- `fnd-04-s1-credential-refs` and `fnd-04-s4-audit-failures` story contracts
- `docs/engineering/testing-policy.md`

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The SDK redaction modules providing `RedactionSet`, `RedactedInput`, and `RedactedValue`, plus the
evidence pack.

## Evidence pack

- Test name or artifact proving each AC.
- Test name or artifact proving each failure/degraded outcome row.
- Negative fixture or equivalent failing assertion proving every rejection, degraded, or fail-closed
  claim named by an AC or failure row.
- `pnpm check` result, unless the gate is blocked by an unrelated repository issue that is named.
- Coverage command, instrumented lane(s), and number for the stated scope.
- Sweep-grep results proving no raw fixture secret leaks into snapshots, logs, or artifacts.

## Boundaries and STOP conditions

- Package or module boundary: `packages/sdk/src/foundation/credentials-secrets/redaction`.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/foundation/credentials-secrets/redaction/**`,
  `packages/sdk/tests/foundation/credentials-secrets/redaction/**`.
- Forbidden dependencies: no concrete provider, process, network, Forge client, artifact backend, CLI,
  or MCP dependency.
- STOP when: a provider-specific response schema or binary redaction policy is required beyond the
  approved fnd-04 design.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 1 - stories](./README.md) · **← Prev:** [fnd-04-s2-injection-egress - injection egress implementation story](./fnd-04-s2-injection-egress.md) · **Next →:** [fnd-04-s4-audit-failures - audit failures implementation story](./fnd-04-s4-audit-failures.md)

<!-- /DOCS-NAV -->
