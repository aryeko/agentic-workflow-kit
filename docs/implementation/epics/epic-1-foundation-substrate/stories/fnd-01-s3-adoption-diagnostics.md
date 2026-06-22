---
title: "fnd-01-s3-adoption-diagnostics - adoption diagnostics implementation story"
id: "fnd-01-s3-adoption-diagnostics"
epic: 1
status: "story: ready"
design:
  - "docs/design/30-domain-reference/foundation/configuration-and-policy/README.md"
  - "docs/design/30-domain-reference/foundation/configuration-and-policy/schema-and-resolution.md"
  - "docs/design/30-domain-reference/foundation/configuration-and-policy/interfaces-events-and-verification.md"
---

# fnd-01-s3-adoption-diagnostics - Adoption Diagnostics

## Purpose

Fail closed on legacy, unknown, or incompatible config and artifacts with diagnostic append intents
and adoption guidance.

## Normative design

- `docs/design/30-domain-reference/foundation/configuration-and-policy/README.md`
- `docs/design/30-domain-reference/foundation/configuration-and-policy/schema-and-resolution.md`
- `docs/design/30-domain-reference/foundation/configuration-and-policy/interfaces-events-and-verification.md`
- `docs/engineering/testing-policy.md`
- `docs/engineering/dependency-policy.md`

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types: `ConfigurationPolicy.diagnoseAdoption`, `ConfigSource`, `AdoptionSource`,
  `ArtifactSource`, `AdoptionReport`, `AdoptionContext`, `DurableEventWriter`,
  `AdoptionDiagnostic`, `AdoptionDiagnosticFailure`.
- Events / append intents: `ConfigLoaded`, `AdoptionDiagnosticEmitted`,
  `PolicyResolutionFailed`.
- Provider operations / commands: none.
- Failure and degraded tokens: `adoption-incompatible`, `adoption-unknown-artifact`,
  `adoption-diagnostic-unrecorded`, `config-loaded-unrecorded`.
- Evidence records / attestations: adoption diagnostic report with `mayLaunch` and append intents.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Diagnose only configured vNext state locations supplied by the caller.
- Recognize `kit-vnext.event-log.v1`, `kit-vnext.projection.v1`,
  `kit-vnext.resolved-policy.v1`, `kit-vnext.capability-attestation.v1`, and
  `kit-vnext.launch.v1` artifact markers.
- Return one `AdoptionDiagnosticEmitted` intent per blocking diagnostic and a
  `PolicyResolutionFailed` intent for the fail-closed state.
- Commit only pre-run `ConfigLoaded` through the injected foundation writer.
- Block launch when diagnostics or `ConfigLoaded` cannot be durably recorded.

## Out of scope

- Resolving policy after successful adoption, owned by `fnd-01-s2-policy-resolution`.
- Migrating legacy artifacts or silently interpreting non-vNext state.
- Scanning arbitrary repo paths not supplied as configured vNext state locations.
- Core-01 run-writer append implementation.

## Dependencies and frozen inputs

- Covers signals: Adoption diagnostics for legacy, unknown, or incompatible config and artifacts.
- Depends on: `fnd-01-s1-config-schema`.
- Depended on by: later run-launch and operator diagnostics stories.
- Shared shapes consumed: `fnd-01-s1-config-schema/KitConfig` marker rules.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. Avoid "exactly as
specified."

- **AC-1** Valid vNext config and recognized artifact markers produce an adoption report with
  `mayLaunch: true` and no blocking diagnostics - evidence: positive marker fixture.
- **AC-2** A config with a known non-vNext marker returns `adoption-incompatible` and
  `mayLaunch: false` - evidence: incompatible marker test.
- **AC-3** A config or configured artifact with absent or unknown marker returns
  `adoption-unknown-artifact` and `mayLaunch: false` - evidence: unknown marker tests.
- **AC-4** Unknown artifacts are diagnosed only when supplied in configured vNext state locations -
  evidence: configured-location fixture.
- **AC-5** Every blocking diagnostic returns an `AdoptionDiagnosticEmitted` intent and a
  `PolicyResolutionFailed` intent with guidance - evidence: append intent test.
- **AC-6** Failure to commit pre-run `ConfigLoaded` returns `config-loaded-unrecorded` and blocks
  launch - evidence: writer failure test.
- **AC-7** Failure by the owning core writer to append returned diagnostic intents keeps launch blocked
  as `adoption-diagnostic-unrecorded` - evidence: handoff failure fixture.

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| Diagnose only configured vNext state locations supplied by the caller | AC-4 |
| Recognize `kit-vnext.event-log.v1`, `kit-vnext.projection.v1`, `kit-vnext.resolved-policy.v1`, `kit-vnext.capability-attestation.v1`, `kit-vnext.launch.v1` artifact markers | AC-1, AC-3 |
| Return one `AdoptionDiagnosticEmitted` intent per blocking diagnostic and a `PolicyResolutionFailed` intent for fail-closed state | AC-5 |
| Commit only pre-run `ConfigLoaded` through injected foundation writer | AC-6 |
| Block launch when diagnostics or `ConfigLoaded` cannot be durably recorded | AC-6, AC-7 |
| Interfaces / types: `ConfigurationPolicy.diagnoseAdoption`, `ConfigSource`, `AdoptionSource`, `ArtifactSource` | AC-1, AC-2, AC-3, AC-4 |
| Interfaces / types: `AdoptionReport`, `AdoptionContext`, `DurableEventWriter` | AC-1, AC-6 |
| Interfaces / types: `AdoptionDiagnostic`, `AdoptionDiagnosticFailure` | AC-2, AC-3, AC-5 |
| Events / append intents: `ConfigLoaded` | AC-6 |
| Events / append intents: `AdoptionDiagnosticEmitted` | AC-5 |
| Events / append intents: `PolicyResolutionFailed` | AC-5 |
| Failure token `adoption-incompatible` | AC-2, AC-5 |
| Failure token `adoption-unknown-artifact` | AC-3, AC-5 |
| Failure token `adoption-diagnostic-unrecorded` | AC-7 |
| Failure token `config-loaded-unrecorded` | AC-6 |
| Evidence: adoption diagnostic report with `mayLaunch` and append intents | AC-1, AC-5 |

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `adoption-incompatible` | Config has a known non-vNext marker. | Refuse to run and return adoption guidance. | AC-2, AC-5 |
| `adoption-unknown-artifact` | Config or configured artifact has no recognized vNext marker. | Refuse to run and return adoption guidance. | AC-3, AC-5 |
| `config-loaded-unrecorded` | Pre-run `ConfigLoaded` cannot be committed. | Block launch before policy resolution. | AC-6 |
| `adoption-diagnostic-unrecorded` | Returned diagnostic/failure intents cannot be appended by the owning core writer. | Keep launch blocked; do not treat diagnostics as recorded. | AC-7 |

## Quality bar

- Coverage scope and threshold: adoption diagnostics modules at 90% minimum, aiming for 95%.
- Required tests, catalogued by AC and failure row: positive marker fixtures for AC-1, marker
  failure tests for AC-2/AC-3, configured-location fixtures for AC-4, append-intent tests for AC-5,
  writer failure tests for AC-6/AC-7.
- Exact commands: `pnpm test:unit -- packages/sdk/tests/foundation/configuration-policy/adoption/*.unit.test.ts`;
  `pnpm check`; coverage with `pnpm coverage:baseline`.
- Determinism constraints: injected `occurredAt`; diagnostic ordering follows supplied source order
  with stable per-source artifact order.
- Dependency boundaries: no provider, core writer, process, network, or migration dependency.
- File-size or module-size constraints: marker classification and append-intent construction stay
  separate if needed.
- Domain non-negotiables: fail closed; never migrate or silently accept non-vNext state.

## Required reading

- `docs/design/30-domain-reference/foundation/configuration-and-policy/schema-and-resolution.md`
- `docs/design/30-domain-reference/foundation/configuration-and-policy/interfaces-events-and-verification.md`
- `fnd-01-s1-config-schema` story contract
- `docs/engineering/testing-policy.md`

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The SDK adoption-diagnostics modules providing `ConfigurationPolicy.diagnoseAdoption` and diagnostic
append intents, plus the evidence pack.

## Evidence pack

- Test name or artifact proving each AC.
- Test name or artifact proving each failure/degraded outcome row.
- `pnpm check` result, unless the gate is blocked by an unrelated repository issue that is named.
- Coverage command and number for the stated scope.
- Sweep-grep results showing no migration path, no broad repo scanner, and no core writer import.

## Boundaries and STOP conditions

- Package or module boundary: `packages/sdk/src/foundation/configuration-policy/adoption`.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/foundation/configuration-policy/adoption/**`,
  `packages/sdk/tests/foundation/configuration-policy/adoption/**`.
- Forbidden dependencies: no provider packages, no core writer implementation, no concrete filesystem
  scanning beyond caller-supplied sources.
- STOP when: compatibility requires migrating legacy artifacts, accepting unknown markers, or changing
  artifact marker names outside the approved design.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 1 - stories](./README.md) · **← Prev:** [fnd-01-s2-policy-resolution - policy resolution implementation story](./fnd-01-s2-policy-resolution.md) · **Next →:** [fnd-02-s1-storage-health - storage health implementation story](./fnd-02-s1-storage-health.md)

<!-- /DOCS-NAV -->
