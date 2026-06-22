---
title: "fnd-04-s1-credential-refs - credential refs implementation story"
id: "fnd-04-s1-credential-refs"
epic: 1
status: "story: ready"
design:
  - "docs/design/30-domain-reference/foundation/credentials-and-secrets/README.md"
  - "docs/design/30-domain-reference/foundation/credentials-and-secrets/contracts-and-events.md"
---

# fnd-04-s1-credential-refs - Credential Refs

## Purpose

Validate configured credential references into scoped credential contracts without resolving secret
material before use.

## Normative design

- `docs/design/30-domain-reference/foundation/credentials-and-secrets/README.md`
- `docs/design/30-domain-reference/foundation/credentials-and-secrets/contracts-and-events.md`
- `docs/design/30-domain-reference/foundation/configuration-and-policy/schema-and-resolution.md`
- `docs/engineering/testing-policy.md`
- `docs/engineering/dependency-policy.md`

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types: `CredentialKind`, `CredentialParty`, `InjectionMode`, `EnforcementPoint`,
  `SecretRef`, `CredentialRef`, `CredentialScope`.
- Events / append intents: none.
- Provider operations / commands: none.
- Failure and degraded tokens: `credential-ref-unresolved`, `credential-scope-denied`,
  `worker-forge-credential-denied`.
- Evidence records / attestations: credential-ref validation report with policy digest and scope
  digest evidence.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Validate fnd-01 `CredentialReferencePolicy` and `CredentialRefSource` into fnd-04 `CredentialRef`.
- Preserve `kind`, `purpose`, `secret`, `allowedParties`, `allowedPhases`, `allowedHosts`,
  `ttlSeconds`, and `policyDigest`.
- Define `CredentialScope` with run, task, operation, party, phase, command prefix, process id,
  expiry, and grant event id.
- Treat environment variables as the only v1 secret-material source; other secret-manager adapters are
  deferred.
- Keep secret material unresolved and out of repo files, events, projections, and artifacts.

## Out of scope

- Injection planning and egress policy issuance, owned by `fnd-04-s2-injection-egress`.
- Redaction behavior, owned by `fnd-04-s3-redaction`.
- Audit event lifecycle and failure catalog, owned by `fnd-04-s4-audit-failures`.
- Concrete provider credential shapes for first real drivers.

## Dependencies and frozen inputs

- Covers signals: Credential references, scopes, allowed parties, phases, hosts, TTL, and policy
  digests.
- Depends on: `fnd-01-s1-config-schema`, `fnd-01-s2-policy-resolution`.
- Depended on by: `fnd-04-s4-audit-failures`, `fnd-04-s3-redaction`,
  `fnd-04-s2-injection-egress`.
- Shared shapes consumed: `fnd-01-s1-config-schema/CredentialReferencePolicy`,
  `fnd-01-s1-config-schema/CredentialRefSource`,
  `fnd-01-s2-policy-resolution/ResolvedPolicy`.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. Avoid "exactly as
specified."

- **AC-1** `CredentialRef` preserves id, kind, purpose, secret reference, allowed parties/phases/hosts,
  TTL seconds, and policy digest from resolved policy input - evidence: validation fixture.
- **AC-2** Supported `CredentialKind` values are exactly `forge`, `registry-read`,
  `registry-publish`, `tool-api`, and `verification` - evidence: type exhaustiveness test.
- **AC-3** Supported `CredentialParty` values are exactly `runner` and `worker` - evidence:
  type exhaustiveness test.
- **AC-4** `CredentialScope` binds credential use to run id, task id, operation id, party, phase,
  optional command prefix, optional process id, expiry, and optional grant event id - evidence: scope
  shape test.
- **AC-5** Missing, inaccessible, ambiguous, or unsupported secret references fail with
  `credential-ref-unresolved` and resolve no material - evidence: unresolved ref tests.
- **AC-6** Scope values outside configured party, phase, host, command prefix, or TTL bounds fail with
  `credential-scope-denied` - evidence: scope denial property test.
- **AC-7** A worker scope with a Forge credential is always denied as
  `worker-forge-credential-denied` - evidence: worker-no-Forge property test.

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| Validate fnd-01 policy/source into `CredentialRef` preserving all fields | AC-1 |
| Preserve `kind`, `purpose`, `secret`, `allowedParties`, `allowedPhases`, `allowedHosts`, `ttlSeconds`, `policyDigest` | AC-1 |
| Define `CredentialScope` with run, task, operation, party, phase, command prefix, process id, expiry, grant event id | AC-4 |
| Environment variables are the only v1 secret-material source | AC-5 |
| Keep secret material unresolved and out of repo files, events, projections, artifacts | AC-5 |
| Interfaces / types: `CredentialRef` | AC-1 |
| Interfaces / types: `CredentialScope` | AC-4 |
| Interfaces / types: `CredentialKind` | AC-2 |
| Interfaces / types: `CredentialParty` | AC-3 |
| Interfaces / types: `InjectionMode`, `EnforcementPoint`, `SecretRef` | AC-1, AC-4 |
| Failure token `credential-ref-unresolved` | AC-5 |
| Failure token `credential-scope-denied` | AC-6 |
| Failure token `worker-forge-credential-denied` | AC-7 |
| Evidence: credential-ref validation report with policy digest and scope digest | AC-1, AC-4 |

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `credential-ref-unresolved` | Reference is missing, inaccessible, ambiguous, or unsupported in v1. | Deny use and resolve no secret material. | AC-5 |
| `credential-scope-denied` | Party, phase, host, command prefix, or TTL exceeds policy. | Deny use and preserve auditable denial data for the audit story. | AC-6 |
| `worker-forge-credential-denied` | Worker scope attempts Forge credential use. | Deny use unconditionally. | AC-7 |

## Quality bar

- Coverage scope and threshold: credential refs/scopes modules at 90% minimum, aiming for 95%.
- Coverage command and instrumented lane(s): `pnpm coverage:baseline` instruments the unit, integration, and conformance-mock lanes; this story's stated credential refs/scopes helper scope is exercised in the unit lane.
- Required tests, catalogued by AC and failure row: validation, type exhaustiveness, scope shape,
  unresolved refs, scope denial property, and worker-no-Forge property tests.
- Exact commands: `pnpm test:unit -- packages/sdk/tests/foundation/credentials-secrets/refs/*.unit.test.ts`;
  `pnpm check`; coverage with `pnpm coverage:baseline` for the stated credential refs/scopes scope.
- Determinism constraints: policy and scope digests are stable over canonical JSON input.
- Dependency boundaries: no secret-manager SDK, provider package, Forge client, process, network, CLI,
  MCP, or testkit production import.
- File-size or module-size constraints: refs, scopes, and digest helpers stay focused.
- Domain non-negotiables: worker never receives Forge credentials.

## Required reading

- `docs/design/30-domain-reference/foundation/credentials-and-secrets/README.md`
- `docs/design/30-domain-reference/foundation/credentials-and-secrets/contracts-and-events.md`
- `docs/design/30-domain-reference/foundation/configuration-and-policy/schema-and-resolution.md`
- `fnd-01-s1-config-schema` and `fnd-01-s2-policy-resolution` story contracts

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The SDK credential ref/scope modules providing `CredentialRef`, `CredentialScope`, and validation,
plus the evidence pack.

## Evidence pack

- Test name or artifact proving each AC.
- Test name or artifact proving each failure/degraded outcome row.
- Negative fixture or equivalent failing assertion proving every rejection, degraded, or fail-closed
  claim named by an AC or failure row.
- `pnpm check` result, unless the gate is blocked by an unrelated repository issue that is named.
- Coverage command, instrumented lane(s), and number for the stated scope.
- Sweep-grep results proving no secret material, Forge client, secret-manager SDK, process, or network
  import exists in refs/scopes code.

## Boundaries and STOP conditions

- Package or module boundary: `packages/sdk/src/foundation/credentials-secrets/refs` and `scopes`.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/foundation/credentials-secrets/refs/**`,
  `packages/sdk/src/foundation/credentials-secrets/scopes/**`,
  `packages/sdk/tests/foundation/credentials-secrets/refs/**`.
- Forbidden dependencies: no provider, Forge client, process execution, network, concrete secret
  manager, CLI, MCP, or testkit production import.
- STOP when: exact per-driver credential shapes are needed before Epic 6 concrete provider stories.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 1 - stories](./README.md) · **← Prev:** [fnd-03-s4-cleanup-settlement - cleanup settlement implementation story](./fnd-03-s4-cleanup-settlement.md) · **Next →:** [fnd-04-s2-injection-egress - injection egress implementation story](./fnd-04-s2-injection-egress.md)

<!-- /DOCS-NAV -->
