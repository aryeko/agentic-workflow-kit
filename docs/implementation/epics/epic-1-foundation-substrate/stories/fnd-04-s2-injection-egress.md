---
title: "fnd-04-s2-injection-egress - injection egress implementation story"
id: "fnd-04-s2-injection-egress"
epic: 1
status: "story: ready"
design:
  - "docs/design/30-domain-reference/foundation/credentials-and-secrets/README.md"
  - "docs/design/30-domain-reference/foundation/credentials-and-secrets/contracts-and-events.md"
---

# fnd-04-s2-injection-egress - Injection Egress

## Purpose

Plan scoped credential injection and issue default-deny egress policies while preserving the
worker/runner boundary and requiring matching egress attestation before confined release.

## Normative design

- `docs/design/30-domain-reference/foundation/credentials-and-secrets/README.md`
- `docs/design/30-domain-reference/foundation/credentials-and-secrets/contracts-and-events.md`
- `docs/design/30-domain-reference/foundation/configuration-and-policy/schema-and-resolution.md`
- `docs/design/40-decisions/accepted-decisions.md` for AD-12 and AD-5.
- `docs/engineering/testing-policy.md`
- `docs/engineering/dependency-policy.md`

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types: `CredentialsAndSecretsContract`, `ResolvedCredential`, `InjectionBinding`,
  `InjectionPlan`, `ResolveCredentialResult`, `PlanInjectionResult`, `EgressPolicy`, `EgressRule`,
  `RequiredAttester`, `NegativeProbe`.
- Events / append intents: `CredentialUsePlanned`, `CredentialUseStarted`, `CredentialUseDenied`,
  `EgressPolicyIssued`.
- Provider operations / commands: none.
- Failure and degraded tokens: `credential-ref-unresolved`, `credential-scope-denied`,
  `worker-forge-credential-denied`, `egress-policy-unattested`, `redaction-unavailable`,
  `audit-write-unavailable`.
- Evidence records / attestations: injection plan, egress policy digest, matching attestation
  references, negative probe ids.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Implement `resolveCredential`, `planInjection`, and `issueEgressPolicy` contract behavior at the
  planning layer without storing secret material.
- Keep the worker environment closed and minimal by default; inject only explicit non-Forge refs whose
  policy allows worker use.
- Give runner Forge credentials only for runner-owned Forge phases.
- Enforce party, phase, command prefix, TTL, host allowlist, injection mode, egress policy, prior audit
  event, redaction set, and fresh attestation requirements.
- Issue default-deny `EgressPolicy` data with rules, negative probes, required attesters, freshness
  key, expiry, and digest.

## Out of scope

- Execution Host egress enforcement and `CapabilityAttestation` production; Epic 2/provider stories
  own attestation payload producers.
- Concrete provider credential shapes and real credentialed drivers.
- Redaction implementation, owned by `fnd-04-s3-redaction`.
- Audit payload definitions, owned by `fnd-04-s4-audit-failures`.

## Dependencies and frozen inputs

- Covers signals: Injection plans that distinguish runner-only Forge credentials from worker-safe
  grants; Egress policy issuance and matching attestation evidence before confined credential release.
- Depends on: `fnd-04-s1-credential-refs`, `fnd-04-s4-audit-failures`, `fnd-04-s3-redaction`,
  `fnd-01-s1-config-schema`, `fnd-01-s2-policy-resolution`.
- Depended on by: Epic 2 provider ports, Epic 3 capability gates, Epic 6 concrete drivers.
- Shared shapes consumed: `fnd-04-s1-credential-refs/CredentialRef`,
  `fnd-04-s1-credential-refs/CredentialScope`,
  `fnd-04-s4-audit-failures/CredentialAuditEvent`,
  `fnd-04-s4-audit-failures/CredentialDenialReason`,
  `fnd-04-s3-redaction/RedactionSet`, `fnd-01-s1-config-schema/EgressPolicySource`,
  `fnd-01-s2-policy-resolution/ResolvedPolicy`.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. Avoid "exactly as
specified."

- **AC-1** `planInjection` returns `InjectionPlan` with operation id, party, bindings, credential ref
  ids, egress policy, redaction set, and required `CredentialUsePlanned` audit event - evidence:
  injection plan test.
- **AC-2** Worker plans containing Forge credentials always return `worker-forge-credential-denied` -
  evidence: worker-no-Forge property test.
- **AC-3** Runner Forge credentials are allowed only for runner Forge phases and configured hosts -
  evidence: runner Forge scope tests.
- **AC-4** Scoped grants cannot expand configured parties, phases, hosts, command prefix, TTL, or
  credential kind - evidence: grant narrowing tests.
- **AC-5** `issueEgressPolicy` emits default-deny `EgressPolicy` with rules, negative probes,
  required attesters, freshness key, expiry, and `egressPolicyDigest` - evidence: egress policy
  snapshot.
- **AC-6** Credential release requiring egress confinement fails as `egress-policy-unattested` unless
  fresh positive matching attestation evidence is supplied by id - evidence: attestation matching
  tests.
- **AC-7** A missing required audit event denies use before any material exposure as
  `audit-write-unavailable` - evidence: pre-use audit failure test.
- **AC-8** A missing redaction set denies use before any capture and never persists unredacted
  material, failing as `redaction-unavailable` - evidence: pre-use redaction failure test.
- **AC-9** `resolveCredential(ref, scope)` returns `ResolvedCredential` carrying a
  `CredentialUseStarted` audit event on success, or `CredentialDenied` with `credential-ref-unresolved`
  when the ref cannot resolve - evidence: credential resolution test.

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| Implement `resolveCredential`, `planInjection`, `issueEgressPolicy` planning behavior without storing material | AC-1, AC-5, AC-9 |
| Keep worker environment closed and minimal; inject only worker-allowed non-Forge refs | AC-2 |
| Give runner Forge credentials only for runner-owned Forge phases | AC-3 |
| Enforce party, phase, command prefix, TTL, host, injection mode, egress policy, prior audit event, redaction set, fresh attestation | AC-3, AC-4, AC-6, AC-7, AC-8 |
| Issue default-deny `EgressPolicy` with rules, negative probes, required attesters, freshness key, expiry, digest | AC-5 |
| Interfaces / types: `CredentialsAndSecretsContract`, `ResolvedCredential`, `InjectionBinding`, `InjectionPlan`, `ResolveCredentialResult`, `PlanInjectionResult` | AC-1, AC-9 |
| Interfaces / types: `EgressPolicy`, `EgressRule`, `RequiredAttester`, `NegativeProbe` | AC-5, AC-6 |
| Events: `CredentialUsePlanned` | AC-1 |
| Events: `CredentialUseStarted` | AC-9 |
| Events: `CredentialUseDenied` | AC-2 |
| Events: `EgressPolicyIssued` | AC-5 |
| Failure token `credential-ref-unresolved` | AC-9 |
| Failure token `credential-scope-denied` | AC-3, AC-4 |
| Failure token `worker-forge-credential-denied` | AC-2 |
| Failure token `egress-policy-unattested` | AC-6 |
| Failure token `audit-write-unavailable` | AC-7 |
| Failure token `redaction-unavailable` | AC-8 |
| Evidence: injection plan, egress policy digest, matching attestation references, negative probe ids | AC-1, AC-5, AC-6 |

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `worker-forge-credential-denied` | Worker injection plan includes Forge credential. | Deny use and audit; never expose Forge material to worker. | AC-2 |
| `credential-scope-denied` | Scope, grant, host, command prefix, or TTL exceeds policy. | Deny use and emit denial data. | AC-3, AC-4 |
| `egress-policy-unattested` | Required attestation is missing, stale, partial, or mismatched. | Deny confined credential release. | AC-6 |
| `audit-write-unavailable` | Required audit event cannot be written before use. | Deny use before material exposure. | AC-7 |
| `redaction-unavailable` | Redaction set is absent before capture. | Deny use before any capture and never persist unredacted material. | AC-8 |
| `credential-ref-unresolved` | Consumed credential ref cannot resolve. | Deny use and expose no material. | AC-9 |

## Quality bar

- Coverage scope and threshold: injection/egress modules at 90% minimum, aiming for 95%.
- Coverage command and instrumented lane(s): `pnpm coverage:baseline` instruments the unit, integration, and conformance-mock lanes; this story's stated injection/egress helper scope is exercised in the unit lane.
- Required tests, catalogued by AC and failure row: injection plan, worker-no-Forge property, runner
  scope, grant narrowing, egress snapshot, attestation matching, pre-use audit failure, pre-use
  redaction failure, and credential resolution (success + `credential-ref-unresolved`) tests.
- Exact commands: `pnpm test:unit -- packages/sdk/tests/foundation/credentials-secrets/injection/*.unit.test.ts`;
  `pnpm check`; coverage with `pnpm coverage:baseline` for the stated injection/egress scope.
- Determinism constraints: policy digests, scope digests, freshness keys, and expiry inputs are
  injected or canonicalized.
- Dependency boundaries: no Execution Host enforcement, no provider package, no Forge client, no
  process runner, no network call, no concrete secret backend.
- File-size or module-size constraints: injection planning, egress policy, and attestation matching
  remain focused modules.
- Domain non-negotiables: worker never receives Forge credentials; egress policy is data for
  attestation, not enforcement.

## Required reading

- `docs/design/30-domain-reference/foundation/credentials-and-secrets/README.md`
- `docs/design/30-domain-reference/foundation/credentials-and-secrets/contracts-and-events.md`
- `docs/design/30-domain-reference/foundation/configuration-and-policy/schema-and-resolution.md`
- `fnd-04-s1-credential-refs`, `fnd-04-s4-audit-failures`, and `fnd-04-s3-redaction` story contracts

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The SDK injection and egress policy modules providing `InjectionPlan`, `EgressPolicy`, and
`CredentialsAndSecretsContract` planning behavior, plus the evidence pack.

## Evidence pack

- Test name or artifact proving each AC.
- Test name or artifact proving each failure/degraded outcome row.
- Negative fixture or equivalent failing assertion proving every rejection, degraded, or fail-closed
  claim named by an AC or failure row.
- `pnpm check` result, unless the gate is blocked by an unrelated repository issue that is named.
- Coverage command, instrumented lane(s), and number for the stated scope.
- Sweep-grep results proving no Execution Host enforcement, provider, Forge client, process, network,
  or concrete secret backend dependency.

## Boundaries and STOP conditions

- Package or module boundary: `packages/sdk/src/foundation/credentials-secrets/injection` and
  `egress`.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/foundation/credentials-secrets/injection/**`,
  `packages/sdk/src/foundation/credentials-secrets/egress/**`,
  `packages/sdk/tests/foundation/credentials-secrets/injection/**`.
- Forbidden dependencies: no Execution Host implementation, provider packages, Forge client, process,
  network, CLI, MCP, concrete secret backend, or CapabilityAttestation producer implementation.
- STOP when: egress enforcement, provider attestation production, or concrete driver credential
  shapes are required.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 1 - stories](./README.md) · **← Prev:** [fnd-04-s1-credential-refs - credential refs implementation story](./fnd-04-s1-credential-refs.md) · **Next →:** [fnd-04-s3-redaction - redaction implementation story](./fnd-04-s3-redaction.md)

<!-- /DOCS-NAV -->
