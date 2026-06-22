---
title: "fnd-04-s4-audit-failures - audit failures implementation story"
id: "fnd-04-s4-audit-failures"
epic: 1
status: "story: ready"
design:
  - "docs/design/30-domain-reference/foundation/credentials-and-secrets/README.md"
  - "docs/design/30-domain-reference/foundation/credentials-and-secrets/contracts-and-events.md"
---

# fnd-04-s4-audit-failures - Audit Failures

## Purpose

Define credential audit payloads, tamper-evidence fields, denial records, destroy records, and the
failure token catalog consumed by credential use stories.

## Normative design

- `docs/design/30-domain-reference/foundation/credentials-and-secrets/README.md`
- `docs/design/30-domain-reference/foundation/credentials-and-secrets/contracts-and-events.md`
- `docs/design/40-decisions/accepted-decisions.md` for AD-12 worker/runner isolation.
- `docs/engineering/testing-policy.md`
- `docs/engineering/dependency-policy.md`

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types: `CredentialDenialReason`, `CredentialDenied`, `AuditBase`,
  `CredentialUsePlanned`, `CredentialUseStarted`, `CredentialUseFinished`,
  `CredentialUseDenied`, `CredentialMaterialDestroyed`, `RedactionApplied`,
  `EgressPolicyIssued`, `CredentialAuditEvent`.
- Events / append intents: credential audit payloads above; core-01 owns the run envelope.
- Provider operations / commands: `destroy(operationId): CredentialMaterialDestroyed`.
- Failure and degraded tokens: `credential-ref-unresolved`, `credential-scope-denied`,
  `worker-forge-credential-denied`, `egress-policy-unattested`, `redaction-unavailable`,
  `audit-write-unavailable`, `credential-destroy-unconfirmed`, `artifact-redaction-failed`.
- Evidence records / attestations: payload-local credential audit hash chain test records.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Define every credential audit event payload from `contracts-and-events.md`.
- Include `policyDigest`, `credentialRefDigest`, `scopeDigest`, `grantEventId`,
  `attestationEventIds`, `evidenceRefs`, `prevEventHash`, `eventHash`, and `at`.
- Keep global ordering and writer identity out of payload-local audit types; core-01 owns the envelope.
- Define denial records and destroy records so every started use can settle or degrade.
- Implement `destroy(operationId): CredentialMaterialDestroyed`, returning `tempFilesRemoved` and
  `memoryHandlesDropped`, and degrade to `credential-destroy-unconfirmed` when destruction is
  unconfirmed.
- Define failure/degraded tokens for unresolved refs, denied scopes, worker Forge exposure, missing
  audit, failed redaction, missing egress attestation, and unconfirmed destruction.

## Out of scope

- Credential ref validation, owned by `fnd-04-s1-credential-refs`.
- Redacting values, owned by `fnd-04-s3-redaction`.
- Injection and egress issuance behavior, owned by `fnd-04-s2-injection-egress`.
- Appending events through core-01 or defining the run event envelope.

## Dependencies and frozen inputs

- Covers signals: Credential audit events, tamper-evidence fields, finish and destroy records, and
  denial records; Failure modes for unresolved refs, denied scopes, worker Forge exposure, missing
  audit, failed redaction, missing egress attestation, and unconfirmed destruction.
- Depends on: `fnd-04-s1-credential-refs`.
- Depended on by: `fnd-04-s3-redaction`, `fnd-04-s2-injection-egress`.
- Shared shapes consumed: `fnd-04-s1-credential-refs/CredentialRef`,
  `fnd-04-s1-credential-refs/CredentialScope`.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. Avoid "exactly as
specified."

- **AC-1** `CredentialAuditEvent` is the union of `CredentialUsePlanned`, `CredentialUseStarted`,
  `CredentialUseFinished`, `CredentialUseDenied`, `CredentialMaterialDestroyed`,
  `RedactionApplied`, and `EgressPolicyIssued` - evidence: type exhaustiveness test.
- **AC-2** Every audit payload includes the full `AuditBase` tamper-evidence fields and no reversible
  secret material - evidence: audit payload schema test.
- **AC-3** `CredentialDenied` carries `{ ok: false, reason, auditEvent }` for all
  `CredentialDenialReason` values - evidence: denial record test.
- **AC-4** `destroy(operationId)` returns `CredentialMaterialDestroyed` carrying `tempFilesRemoved`
  and `memoryHandlesDropped` - evidence: destroy record test.
- **AC-5** Every `CredentialUseStarted` must be pairable with `CredentialUseFinished` and a confirmed
  `CredentialMaterialDestroyed`, and an unconfirmed or missing destruction enters
  `credential-destroy-unconfirmed` - evidence: lifecycle invariant test.
- **AC-6** `audit-write-unavailable` denies credential use before material exposure - evidence:
  audit failure test.
- **AC-7** `RedactionApplied` and `EgressPolicyIssued` payloads contain replacement counts,
  fingerprint ids, policy ids, egress digests, negative probe ids, freshness key, and expiry as
  defined - evidence: event payload tests.

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| Define every credential audit event payload | AC-1, AC-2, AC-7 |
| Include full `AuditBase` tamper-evidence fields with no reversible secret material | AC-2 |
| Keep global ordering and writer identity out of payload-local audit types | AC-2 |
| Define denial records and destroy records so every started use can settle or degrade | AC-3, AC-4, AC-5 |
| Implement `destroy(operationId): CredentialMaterialDestroyed` returning `tempFilesRemoved`, `memoryHandlesDropped`; degrade to `credential-destroy-unconfirmed` | AC-4, AC-5 |
| Define failure/degraded tokens for the full credential failure catalog | AC-3, AC-5, AC-6, AC-7 |
| Interfaces / types: `CredentialAuditEvent` union | AC-1 |
| Interfaces / types: `AuditBase` and all event payloads | AC-2 |
| Interfaces / types: `CredentialDenialReason`, `CredentialDenied` | AC-3 |
| Interfaces / types: `CredentialMaterialDestroyed` | AC-4 |
| Interfaces / types: `RedactionApplied`, `EgressPolicyIssued` | AC-7 |
| Provider operation `destroy(operationId): CredentialMaterialDestroyed` | AC-4 |
| Failure token `audit-write-unavailable` | AC-6 |
| Failure token `credential-destroy-unconfirmed` | AC-5 |
| Failure tokens `credential-ref-unresolved`, `credential-scope-denied`, `worker-forge-credential-denied`, `egress-policy-unattested` | AC-3 |
| Failure token `redaction-unavailable` | AC-3 |
| Failure token `artifact-redaction-failed` | AC-7 |
| Evidence: payload-local credential audit hash chain test records | AC-2 |

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `audit-write-unavailable` | Required audit event cannot be appended before use. | Deny credential use before material exposure. | AC-6 |
| `credential-destroy-unconfirmed` | Operation ends or TTL expires without confirmed material destruction. | Block settlement until recovery records the outcome. | AC-5 |
| `credential-ref-unresolved` | Ref validation story reports unresolved reference. | Emit denial payload with no material exposure. | AC-3 |
| `credential-scope-denied` | Scope exceeds policy. | Emit denial payload with no material exposure. | AC-3 |
| `worker-forge-credential-denied` | Worker scope attempts Forge credential. | Emit denial payload and preserve worker-no-Forge invariant. | AC-3 |
| `egress-policy-unattested` | Required egress attestation is missing, stale, partial, or mismatched. | Emit denial payload with no confined credential release. | AC-3 |
| `redaction-unavailable` | Redaction set is unavailable before capture. | Deny use before any capture and never persist unredacted material. | AC-3, AC-7 |
| `artifact-redaction-failed` | Artifact cannot be proven clean or redacted. | Quarantine artifact; it cannot satisfy gates. | AC-7 |

## Quality bar

- Coverage scope and threshold: credential audit/failure modules at 90% minimum, aiming for 95%.
- Required tests, catalogued by AC and failure row: event union, payload schema, denial record,
  destroy record, lifecycle invariant, audit failure, and event detail tests.
- Exact commands: `pnpm test:unit -- packages/sdk/tests/foundation/credentials-secrets/audit/*.unit.test.ts`;
  `pnpm check`; coverage with `pnpm coverage:baseline`.
- Determinism constraints: payload-local hash chain uses canonical serialized payloads and injected
  prior hash/time.
- Dependency boundaries: audit code imports no provider, core writer implementation, process, network,
  or secret resolver.
- File-size or module-size constraints: audit payloads, denial builders, and lifecycle invariants
  remain focused modules.
- Domain non-negotiables: audit payloads never contain reversible secret values.

## Required reading

- `docs/design/30-domain-reference/foundation/credentials-and-secrets/contracts-and-events.md`
- `docs/design/30-domain-reference/foundation/credentials-and-secrets/README.md`
- `fnd-04-s1-credential-refs` story contract
- `docs/engineering/testing-policy.md`

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The SDK credential audit and failure catalog modules, plus the evidence pack.

## Evidence pack

- Test name or artifact proving each AC.
- Test name or artifact proving each failure/degraded outcome row.
- `pnpm check` result, unless the gate is blocked by an unrelated repository issue that is named.
- Coverage command and number for the stated scope.
- Sweep-grep results proving no secret values, core writer imports, provider imports, process, or
  network code in audit/failure modules.

## Boundaries and STOP conditions

- Package or module boundary: `packages/sdk/src/foundation/credentials-secrets/audit` and `failures`.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/foundation/credentials-secrets/audit/**`,
  `packages/sdk/src/foundation/credentials-secrets/failures/**`,
  `packages/sdk/tests/foundation/credentials-secrets/audit/**`.
- Forbidden dependencies: no core writer implementation, provider, Forge client, process, network,
  CLI, MCP, or secret resolver dependency.
- STOP when: audit ordering requires changing core-01 run event envelope semantics.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 1 - stories](./README.md) · **← Prev:** [fnd-04-s3-redaction - redaction implementation story](./fnd-04-s3-redaction.md) · **Next →:** [Epic 1 - story DAG](../story-dag.md)

<!-- /DOCS-NAV -->
