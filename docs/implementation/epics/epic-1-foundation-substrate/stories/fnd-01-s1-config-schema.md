---
title: "fnd-01-s1-config-schema - configuration schema implementation story"
id: "fnd-01-s1-config-schema"
epic: 1
status: "story: draft"
design:
  - "docs/design/30-domain-reference/foundation/configuration-and-policy/README.md"
  - "docs/design/30-domain-reference/foundation/configuration-and-policy/schema-and-resolution.md"
---

# fnd-01-s1-config-schema - Configuration Schema

## Purpose

Define the vNext configuration schema, policy block types, safe defaults, and downstream consumer
policy shapes that every later Foundation and core story consumes.

## Normative design

- `docs/design/30-domain-reference/foundation/configuration-and-policy/README.md`
- `docs/design/30-domain-reference/foundation/configuration-and-policy/schema-and-resolution.md`
- `docs/design/40-decisions/accepted-decisions.md` for AD-14 deferred autonomy scope.
- `docs/engineering/testing-policy.md`
- `docs/engineering/dependency-policy.md`

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types: `KitConfig`, `RunConfigInput`, `PolicyLayer`, `PolicyLayerPatch`,
  `RunPolicy`, `ProvisioningPolicy`, `ApprovalPolicy`, `EscalationPolicy`, `ChangePolicy`,
  `CapabilityPolicy`, `CapabilitySetting`, `CredentialReferencePolicy`, `CredentialRefSource`,
  `EgressPolicySource`, `EgressRuleSource`, `NegativeProbeSource`, `RequiredAttesterSource`,
  `MergePolicy`.
- Events / append intents: none.
- Provider operations / commands: none.
- Failure and degraded tokens: `config-invalid`, `unsupported-deferred-capability`.
- Evidence records / attestations: safe-default snapshot and schema acceptance/rejection fixtures.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Accept only `schema: "kit-vnext.config.v1"`.
- Define all policy block types named in the normative design with unknown fields rejected.
- Ship complete built-in defaults for every leaf field in `PolicyLayer`.
- Prove no default silently enables autonomous power and `orchestrator-decide` is rejected in v1.
- Produce `PolicyLayer`, `CredentialReferencePolicy`, and `EgressPolicySource` for downstream stories.

## Out of scope

- Deterministic resolution and provenance, owned by `fnd-01-s2-policy-resolution`.
- Adoption diagnostics for legacy artifacts, owned by `fnd-01-s3-adoption-diagnostics`.
- Secret material resolution, scoped injection, and egress policy validation, owned by `fnd-04`.
- Applying approval, merge, escalation, or capability policy in core stories.

## Dependencies and frozen inputs

- Covers signals: Config schema and accepted vNext marker; Safe defaults, default-off capabilities,
  and deferred autonomy rejection; Consumer policy shapes for capability, approval, escalation,
  merge, credential refs, and egress.
- Depends on: none.
- Depended on by: `fnd-01-s2-policy-resolution`, `fnd-01-s3-adoption-diagnostics`,
  `fnd-03-s1-repository-branch`, `fnd-04-s1-credential-refs`, `fnd-04-s2-injection-egress`.
- Shared shapes consumed: none.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. Avoid "exactly as
specified."

- **AC-1** A config with `schema: "kit-vnext.config.v1"` and valid policy fields is accepted, while
  missing, non-vNext, or unknown schema markers are not accepted by this schema validator - evidence:
  schema fixture tests.
- **AC-2** Unknown fields outside explicitly reserved extension bags fail validation with
  `config-invalid` - evidence: unknown-field table tests.
- **AC-3** Built-in defaults include complete values for `run`, `provisioning`, `approval`,
  `escalationPolicy`, `changePolicy`, `capabilities`, `credentialRefs`, `egress`, and `merge` -
  evidence: safe-default snapshot.
- **AC-4** Defaults keep capabilities desired `false`, approval assisted with
  `decisionWindowMs = 900000`, default-deny egress, no credential refs, and runner merge disabled -
  evidence: safe-default assertions.
- **AC-5** Any config, profile, or override containing `orchestrator-decide` fails with
  `unsupported-deferred-capability` - evidence: deferred-capability tests.
- **AC-6** Consumer policy shapes expose only desired powers and policy source data; they do not apply
  policy or resolve credentials - evidence: public type/API boundary test.

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `config-invalid` | Schema validation fails or an unknown field appears. | Reject the config and return no active policy. | AC-1, AC-2 |
| `unsupported-deferred-capability` | Config attempts to set `orchestrator-decide` in v1. | Reject the config/profile/override and surface the named token. | AC-5 |

## Quality bar

- Coverage scope and threshold: configuration schema/defaults modules at 90% minimum, aiming for 95%.
- Required tests, catalogued by AC and failure row: schema fixtures for AC-1/AC-2, safe-default
  snapshots for AC-3/AC-4, deferred-capability tests for AC-5, API boundary tests for AC-6.
- Exact commands: `pnpm test:unit -- packages/sdk/tests/foundation/configuration-policy/schema/*.unit.test.ts`;
  `pnpm check`; coverage with `pnpm coverage:baseline`.
- Determinism constraints: default snapshots are stable and sorted by canonical field path.
- Dependency boundaries: SDK schema code imports only pure runtime libraries allowed by
  `dependency-policy.md`.
- File-size or module-size constraints: split schema blocks if a file approaches the repo cap.
- Domain non-negotiables: no schema default enables autonomous operation.

## Required reading

- `docs/design/30-domain-reference/foundation/configuration-and-policy/README.md`
- `docs/design/30-domain-reference/foundation/configuration-and-policy/schema-and-resolution.md`
- `docs/engineering/testing-policy.md`
- `docs/engineering/dependency-policy.md`

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The SDK configuration schema/defaults modules providing the spec surface above, plus the evidence pack.

## Evidence pack

- Test name or artifact proving each AC.
- Test name or artifact proving each failure/degraded outcome row.
- `pnpm check` result, unless the gate is blocked by an unrelated repository issue that is named.
- Coverage command and number for the stated scope.
- Sweep-grep results for `orchestrator-decide`, unknown default policy keys, and credential material.

## Boundaries and STOP conditions

- Package or module boundary: `packages/sdk/src/foundation/configuration-policy/schema`,
  `defaults`, and `policy-shapes`.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/foundation/configuration-policy/schema/**`,
  `packages/sdk/src/foundation/configuration-policy/defaults/**`,
  `packages/sdk/src/foundation/configuration-policy/policy-shapes/**`,
  `packages/sdk/tests/foundation/configuration-policy/schema/**`.
- Forbidden dependencies: no provider package, CLI, MCP, testkit production import, process helper,
  Forge client, or secret resolver.
- STOP when: a required field is not in the approved design, or a consumer needs repository/branch
  policy fields not named by the fnd-01 design.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 1 - stories](./README.md) · **← Prev:** [Epic 1 - stories](./README.md) · **Next →:** [fnd-01-s2-policy-resolution - policy resolution implementation story](./fnd-01-s2-policy-resolution.md)

<!-- /DOCS-NAV -->
