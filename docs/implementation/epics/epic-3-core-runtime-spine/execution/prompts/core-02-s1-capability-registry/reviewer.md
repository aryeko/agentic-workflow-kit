# Reviewer Prompt: core-02-s1-capability-registry

## Assigned Routing

- Source story id: `core-02-s1-capability-registry`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, `AC-14`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `elevated`.
- Reasoning tier: `elevated`.
- Routing rationale: core-02-s1-capability-registry covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14 and carries public capability posture catalog and safety vocabulary used by gate evaluation. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Original Scope

- Story id: `core-02-s1-capability-registry`.
- Epic slug: `epic-3-core-runtime-spine`.
- Source story contract path: `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-02-s1-capability-registry.md`.
- Allowed pathset: `packages/sdk/src/core/capability/registry/**`, `packages/sdk/tests/core/capability/registry/**`.
- Direct dependencies: none.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus committed producer shapes and public import paths named in the source contract and DAG.

### Acceptance Criteria

Each AC is a single assertion that is true or false against a type-level fixture, an exhaustiveness
check, a frozen-data assertion, or a public-import test. As a type/catalog story, each "rejection" is a
compilation failure or a frozen-data assertion proven by its own negative fixture; a green `tsc -b`
proves only acceptance. The `evidence` names the exact test id and the result.

- **AC-1** `CapabilityId` has exactly the five members `"auto-merge" | "auto-recover" |
  "unattended-run" | "escalation-auto-grant" | "orchestrator-decide"` and no others - evidence:
  `capability-id.unit.test.ts` runs an exhaustiveness `switch` (a `never` check) over the union and a
  negative fixture (`capability-id-extra-member.fixture.ts`) adding a sixth member fails the `never`
  check (compilation).
- **AC-2** `CapabilityMode` has exactly the two members `"manual" | "assisted"` and `"auto"` is not a
  member - evidence: `capability-mode.unit.test.ts` runs an exhaustiveness `switch` over the union and a
  negative fixture (`capability-mode-auto.fixture.ts`) assigning `"auto"` to a `CapabilityMode` fails
  compilation.
- **AC-3** The v1 posture catalog has exactly one frozen entry per `CapabilityId` (keys equal the
  `CapabilityId` union, no missing or extra key) - evidence: `posture-catalog.unit.test.ts` asserts the
  catalog key set deep-equals the five `CapabilityId` members, and a negative fixture
  (`posture-missing-entry.fixture.ts`) omitting one capability key fails the exhaustive-record type
  (`Record<CapabilityId, PostureEntry>`) at compilation.
- **AC-4** Every non-deferred posture entry declares `allowedMode` as `"assisted"` only (no entry
  permits `manual` as an allowed autonomous mode) - evidence: `posture-modes.unit.test.ts` asserts each
  non-deferred entry's `allowedMode` is `"assisted"`, and a negative fixture
  (`posture-manual-allowed.fixture.ts`) setting an entry's `allowedMode` to `"manual"` is rejected by
  the entry type / assertion (manual fail-closed).
- **AC-5** `orchestrator-decide` has v1 status `deferred` and is structurally always-denied with
  `capability-deferred` (no positive-allow shape is constructable for it) - evidence:
  `deferred-capability.unit.test.ts` asserts the `orchestrator-decide` entry's status is `deferred` and
  carries denial token `capability-deferred`, and a negative fixture
  (`deferred-orchestrator-allow.fixture.ts`) attempting to give `orchestrator-decide` a non-`deferred`
  status or an attestation requirement set fails compilation (fail-closed by construction).
- **AC-6** The `auto-merge` entry requires exactly the Forge attestations `canInspectProtection`,
  `supportsRulesets` (always) plus `supportsMergeQueue` (queue-conditional) and Work Source
  `supportsStatusWrite` (status-conditional), each named by its `CapabilityAttestation.capability`
  literal - evidence: `posture-auto-merge.unit.test.ts` asserts the entry's required-attestation set
  deep-equals that catalog, and a negative fixture (`auto-merge-missing-rulesets.fixture.ts`) dropping
  `supportsRulesets` fails the assertion.
- **AC-7** The `auto-recover` entry requires Execution Host `canKill` and `containmentStrength`
  (containment floor) plus Agent `preservesHostProcessParentage` (worker-activity-conditional), each
  named by its attestation `capability` literal - evidence: `posture-auto-recover.unit.test.ts` asserts
  the entry's required-attestation set deep-equals that catalog, and a negative fixture
  (`auto-recover-missing-kill.fixture.ts`) dropping `canKill` fails the assertion.
- **AC-8** The `unattended-run` entry requires Work Source `supportsClaim`, Execution Host `canKill`,
  `containmentStrength`, and `egress-confinement`, and Agent `preservesHostProcessParentage`, each named
  by its attestation `capability` literal - evidence: `posture-unattended-run.unit.test.ts` asserts the
  entry's required-attestation set deep-equals that catalog, and a negative fixture
  (`unattended-run-missing-egress.fixture.ts`) dropping `egress-confinement` fails the assertion.
- **AC-9** The `escalation-auto-grant` entry requires Agent `canRelayApproval` and
  `canPersistApprovalAnswerChannel` (park/resume-conditional) plus Execution Host `egress-confinement`
  (network-grant-conditional), each named by its attestation `capability` literal - evidence:
  `posture-escalation.unit.test.ts` asserts the entry's required-attestation set deep-equals that
  catalog, and a negative fixture (`escalation-missing-relay.fixture.ts`) dropping `canRelayApproval`
  fails the assertion.
- **AC-10** The v1 containment floor for `unattended-run` and kill-dependent `auto-recover` is
  `process-group` or stronger: the acceptable `ContainmentStrength` set is exactly
  `{ "process-group", "kernel-tree", "job-object" }` and excludes `"none"` - evidence:
  `containment-floor.unit.test.ts` asserts the floor set deep-equals those three members, and a
  negative fixture (`containment-floor-includes-none.fixture.ts`) adding `"none"` fails the assertion
  (weak/absent containment denies).
- **AC-11** The shared guarantee-requirement catalog enumerates exactly the five guarantees every
  non-deferred capability requires: (1) mode is `assisted`; (2) resolved policy permits the capability
  for this scope; (3) core-01 replay/projection health is usable; (4) required evidence is recorded,
  unambiguous, and not self-report-only; (5) required attestations are fresh, positive, in scope,
  non-contradictory, and replayable - evidence: `guarantee-requirements.unit.test.ts` asserts the
  catalog's member set has exactly those five identifiers, and a negative fixture
  (`guarantee-requirements-missing.fixture.ts`) dropping the attestation-freshness guarantee fails the
  exhaustive-set assertion.
- **AC-12** Each non-deferred capability's posture entry references the full shared guarantee-requirement
  catalog (the five guarantees) in addition to its capability-specific attestation set - evidence:
  `posture-shared-guarantees.unit.test.ts` asserts every non-deferred entry's required-guarantee set
  is a superset of the five shared guarantees, and a negative fixture
  (`posture-drops-shared-guarantee.fixture.ts`) on one entry omitting a shared guarantee fails the
  assertion.
- **AC-13** The three registry/mode-level denial tokens are exactly `mode-disallows-capability`,
  `policy-disallows-capability`, `capability-deferred` - evidence: `denial-tokens.unit.test.ts` runs an
  exhaustiveness `switch` over the denial-token union and a negative fixture
  (`denial-tokens-extra.fixture.ts`) adding a fourth token fails the `never` check.
- **AC-14** `CapabilityId`, `CapabilityMode`, `PostureEntry`, the posture catalog, the
  guarantee-requirement catalog, and the registry denial-token type are importable from the `sdk`
  package public entrypoint, not a private module path - evidence:
  `capability-registry-public-import.unit.test.ts` imports all six from the `sdk` entrypoint, reads one
  posture entry and asserts it has `status`, `allowedMode`, `requiredGuaranteeIds`, and
  `requiredAttestations` fields, and reads the guarantee catalog.

### Dependencies And Frozen Inputs

- Covers signals: "Capability registry and v1 capability posture" and "Mode handling for `manual` and
  `assisted`, with deferred capabilities represented explicitly" (both owned by this story per the
  Epic 3 charter `core-02` table and the story-DAG `core-02-s1` row).
- Depends on: none (no intra-epic producer edge — band-1 root catalog; Epic 2 attestation is a frozen
  input).
- Depended on by: `core-02-s2-gate-evaluator` (consumes `CapabilityId`, `CapabilityMode`, the
  posture/guarantee-requirement catalog).
- Shared shapes consumed (cross-epic frozen inputs, referenced not redeclared):
  - `prov-00-s1-capability-attestation/CapabilityAttestation` — the attestation envelope the posture
    references; the posture names the attestations by their `capability` literal, specialized in Epic 2
    as `prov-02-s1-forge-port/ForgeCapability` (`canInspectProtection`, `supportsRulesets`,
    `supportsMergeQueue`), `prov-03-s1-work-source-port/WorkSourceCapability` (`supportsClaim`,
    `supportsStatusWrite`), `prov-04-s1-execution-host-port/HostCapability` (`canKill`,
    `containmentStrength`, `egress-confinement`) with `prov-04-s1-execution-host-port/ContainmentStrength`
    (`"none" | "process-group" | "kernel-tree" | "job-object"`), and
    `prov-01-s1-agent-port/AgentCapability` (`preservesHostProcessParentage`, `canRelayApproval`,
    `canPersistApprovalAnswerChannel`). These literals are cited verbatim; this story does not redeclare
    the unions.
  - `fnd-01` resolved policy — referenced by the `policy-disallows-capability` denial token; its schema
    is not redeclared here.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

### Non-Goals

- `evaluateCapabilityGate`, guarantee predicate evaluation, attestation freshness/expiry/scope/negative/
  contradictory/non-replayable handling, the `CapabilityGateRecordPayload`, `GuaranteeEvaluation`,
  `AttestationRef`, `CapabilityGateScope`, `GateDecision`, and `CapabilityGateFailureReason` — owned by
  `core-02-s2-gate-evaluator`.
- Appending the `CapabilityGateRecord` at `barrier` and the `gate-record-unwritable` fail-closed path —
  owned by `core-02-s3-gate-record-durability`.
- The `CapabilityAttestation<Capability>` payload type and validator — owned by Epic 2
  `prov-00-s1-capability-attestation`; the per-seam capability unions — owned by the Epic 2 seam port
  stories.
- Resolved policy schema — owned by Configuration & Policy (`fnd-01`); referenced as a frozen input.

### STOP Conditions And Boundaries

- Package or module boundary: `packages/sdk/src/core/capability/registry` only.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/core/capability/registry/**`, `packages/sdk/tests/core/capability/registry/**`.
- Forbidden dependencies: no `testkit`, no `provider-*`, no `cli`/`mcp`, no `core-02-s2`/`s3` evaluator
  or record modules, no concrete driver, no re-declaration of the per-seam capability unions or the
  `CapabilityAttestation` payload.
- Boundary/forbidden-symbol sweep (runnable recipe):
  `grep -REn "testkit|provider-(codex|local|github|markdown)|/cli/|/mcp/|evaluateCapabilityGate|CapabilityGateRecord|interface CapabilityAttestation|interface ForgeCapability|interface HostCapability|interface AgentCapability|interface WorkSourceCapability|Date\.now|Math\.random|crypto\.randomUUID" packages/sdk/src/core/capability/registry/`
  over path root `packages/sdk/src/core/capability/registry/`; forbidden-token set = `testkit`,
  `provider-codex|local|github|markdown`, `/cli/`, `/mcp/`, `evaluateCapabilityGate`,
  `CapabilityGateRecord`, any re-declaration of the attestation/seam-capability interfaces, and the
  ambient nondeterminism calls; expected result zero matches (exit code 1), captured into the evidence
  pack; plus `pnpm deps` proves the dependency-rule edges. A non-empty match means the registry leaked
  gate-evaluation logic, redeclared a frozen Epic 2 shape, or used ambient nondeterminism and fails the
  story.
- STOP when: a requirement needs gate EVALUATION over replay/projections/attestations (that is
  `core-02-s2`) or the durable gate record / `gate-record-unwritable` path (that is `core-02-s3`). This
  story declares the registry; it does not evaluate gates or write records.

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check implementation against source story `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-02-s1-capability-registry.md` and AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, `AC-14`.

- AC coverage by source `AC-n` id, including every failure, degraded, validation, and negative-fixture row named by the source contract.
- Evidence pack completeness against the source `Quality bar` and `Evidence pack` sections.
- Public API names, exports, and import paths against the source contract and DAG producer/consumer table.
- Dependency boundaries, committed dependency inputs, and `{{DEPENDENCY_COMMITS}}` consistency.
- Stale names and sibling occurrences of any issue found.
- Tests, targeted checks, coverage commands, forbidden-symbol sweeps, and `pnpm check` output.
- Scope control against allowed writes: `packages/sdk/src/core/capability/registry/**`, `packages/sdk/tests/core/capability/registry/**`.
- Repo conventions and mutation limits from `AGENTS.md` and the source contract.

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - Core runtime spine](../../../README.md) · **← Prev:** [Implementer Prompt: core-02-s1-capability-registry](./implementer.md) · **Next →:** [Implementer Prompt: core-02-s2-gate-evaluator](../core-02-s2-gate-evaluator/implementer.md)

<!-- /DOCS-NAV -->
