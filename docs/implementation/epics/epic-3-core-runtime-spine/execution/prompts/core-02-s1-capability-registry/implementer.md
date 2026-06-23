# Implementer Prompt: core-02-s1-capability-registry

## Assigned Routing

- Source story id: `core-02-s1-capability-registry`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, `AC-14`.
- Model class: `strong-coder`.
- Effort: `high`.
- Suggested-tier floor: `elevated`.
- Reasoning tier: `elevated`.
- Routing rationale: core-02-s1-capability-registry covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14 and carries public capability posture catalog and safety vocabulary used by gate evaluation. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Exact Task

Implement source story `core-02-s1-capability-registry` for epic `epic-3-core-runtime-spine`. Deliver exactly the outcome in the ready source contract and nothing outside it:

The `packages/sdk` capability registry module (`CapabilityId`, `CapabilityMode`, the v1 posture
catalog, the guarantee-requirement catalog, and the registry/mode-level denial-token type), exposed on
the `sdk` public entrypoint, plus the evidence pack.

## Why It Matters

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

The DAG dependents for this story are: `core-02-s2-gate-evaluator`. Preserve the producer/consumer shape boundaries named above so later stories can consume committed dependency inputs without re-declaring or widening this story's scope.

## Required Reading

- `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-02-s1-capability-registry.md` — source story contract for `core-02-s1-capability-registry`.
- `docs/implementation/epics/epic-3-core-runtime-spine/story-dag.md` — frozen DAG row, dependencies, owned pathset, wave, and suggested-tier floor for `core-02-s1-capability-registry`.
- `docs/design/30-domain-reference/core/capability-and-safety/capability-registry.md`
- `docs/design/30-domain-reference/core/capability-and-safety/README.md` (§4 modes/AD-14, §8 denial tokens)
- `prov-00-s1-capability-attestation` story contract (the `CapabilityAttestation` envelope referenced)
- `epic0-s4-export-templates` story contract (`PackageExportConvention`)
- `docs/engineering/test-lanes.md`

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.
- `{{DEPENDENCY_COMMITS}}` — runtime slot for committed dependency story inputs when this story has dependencies.

## Acceptance Criteria

Source story: `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-02-s1-capability-registry.md`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, `AC-14`.

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

## Allowed Writes

Source story: `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-02-s1-capability-registry.md`. Owned pathset from the frozen DAG and source contract:

- `packages/sdk/src/core/capability/registry/**`
- `packages/sdk/tests/core/capability/registry/**`

Every other write is forbidden, including this execution package, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, commits, pushes, PRs, and merges.

## Dependency Inputs

Direct dependency story ids: none.

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

Use `{{DEPENDENCY_COMMITS}}` for dependency commits that can only exist during execution. Import only producer-owned public shapes and paths named by the DAG or source contract.

## Non-Goals And STOP Conditions

### Source Out Of Scope

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

### Source Boundaries And STOP Conditions

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

Also stop and report if dependency inputs are missing, required writes fall outside the allowed pathset, a source gap blocks implementation, or any AC would need reinterpretation.

## Implementation Constraints

### Source Responsibilities

- Declare `CapabilityId` with exactly the five design members, including `orchestrator-decide`.
- Declare `CapabilityMode` with exactly `manual` and `assisted`; `auto` is unrepresentable (AD-14).
- Declare the v1 posture catalog as frozen data covering every `CapabilityId`: each non-deferred
  capability is `assisted`-only; `orchestrator-decide` is `deferred`.
- For each non-deferred capability, declare its required provider capability-attestation set by the
  exact `CapabilityAttestation.capability` literals the design names.
- Declare the v1 containment floor (`process-group` or stronger) for the capabilities that require it
  (`unattended-run`, kill-dependent `auto-recover`), naming the acceptable `ContainmentStrength` set.
- Declare the shared guarantee-requirement catalog (the five guarantees every non-deferred capability
  requires) and own the per-capability requirement mapping.
- Represent deferral and the mode/policy/deferred denials fail-closed by construction: a deferred
  capability cannot be marked allowable, and an unsafe mode/posture combination is unrepresentable or
  rejected.
- Expose `CapabilityId`, `CapabilityMode`, `PostureEntry`, and the registry/posture/guarantee catalog
  on the `sdk` public entrypoint.

### Source Spec Surface

What the normative design defines and the implementation must expose or consume, by the design's exact
names. This story DECLARES the registry catalog (types + frozen data) and proves its shape; it
implements NONE of the gate-evaluation logic (`core-02-s2`) and writes no records (`core-02-s3`).

- Interfaces / types:
  - `CapabilityId` — the union `"auto-merge" | "auto-recover" | "unattended-run" |
    "escalation-auto-grant" | "orchestrator-decide"`.
  - `CapabilityMode` — the union `"manual" | "assisted"` (`auto` / LLM adjudication deferred by AD-14;
    not a member).
  - `PostureEntry` — the per-`CapabilityId` record type. Fields (all derived from the design's posture
    table in `capability-registry.md`):
    - `status`: `"assisted"` | `"deferred"` — whether the capability is active in v1 (`assisted`-only)
      or always-denied (`deferred`; `orchestrator-decide` is the sole v1 deferred entry per AD-14).
    - `allowedMode`: `ReadonlyArray<CapabilityMode>` — the mode(s) in which the capability may run
      autonomously. Every non-deferred entry lists only `"assisted"`; no entry may include `"manual"`.
      A deferred entry carries an empty array (no mode can allow it).
    - `requiredGuaranteeIds`: `ReadonlyArray<GuaranteeRequirementId>` — the shared guarantee-requirement
      identifiers that apply. Every non-deferred entry references all five shared guarantees (see the
      guarantee-requirement catalog).
    - `requiredAttestations`: `ReadonlyArray<string>` — the provider `CapabilityAttestation.capability`
      literals the capability requires, drawn verbatim from the posture table's "Required guarantees"
      column: Forge literals (`canInspectProtection`, `supportsRulesets`, `supportsMergeQueue`), Work
      Source literals (`supportsClaim`, `supportsStatusWrite`), Execution Host literals (`canKill`,
      `containmentStrength`, `egress-confinement`), and Agent literals (`preservesHostProcessParentage`,
      `canRelayApproval`, `canPersistApprovalAnswerChannel`). A deferred entry carries an empty array.
    - `containmentFloor?`: `ReadonlyArray<ContainmentStrength>` — present only for capabilities that
      impose a minimum `prov-04-s1-execution-host-port/ContainmentStrength` (`unattended-run` and
      kill-dependent `auto-recover`). When present the value is exactly
      `["process-group", "kernel-tree", "job-object"]`, excluding `"none"`. Absent on entries that carry
      no containment requirement.
  - The v1 posture catalog: a frozen `Record<CapabilityId, PostureEntry>` mapping every capability to
    its `PostureEntry`; keyed exhaustively over `CapabilityId` with no missing or extra key.
  - The shared guarantee-requirement catalog: the five guarantee-requirement identifiers every
    non-deferred capability requires.
- Events / append intents: none. The `CapabilityGateRecord` event and `CapabilityGateRecordPayload`
  are owned by `core-02-s2`/`s3`; this story declares no event.
- Provider operations / commands: none. Provider capability names are contract-owned by Agent / Forge /
  Work Source / Execution Host (Epic 2); referenced here, never redeclared.
- Failure and degraded tokens owned here (registry/mode level only):
  - `mode-disallows-capability` — the active mode is `manual` (or otherwise not `assisted`), so the
    autonomous capability is denied.
  - `policy-disallows-capability` — resolved policy does not permit the capability for this scope.
  - `capability-deferred` — the capability is `orchestrator-decide` (or any `deferred`-status entry),
    always denied in v1 per AD-14.
- Evidence records / attestations: none produced. The registry *references* the provider
  `CapabilityAttestation<Capability>` attestation type (Epic 2) by the attestation `capability`
  literals each capability requires; it does not declare or emit attestations.

Done requires every item here present with the design's names, shapes, and semantics. As a type/catalog
story, every declared type has a construction or exhaustiveness fixture and every deferral/denial token
has a negative fixture or fail-closed assertion.

Do not introduce implementation choices outside the names, events, failure tokens, determinism rules, boundary rules, import rules, conformance obligations, and safety invariants fixed above.

## Verification

### Source Quality Bar

- Coverage scope and threshold: the registry catalog helpers that carry runtime data and assertions
  (the frozen posture catalog, the guarantee-requirement catalog, and any accessor reading them in
  `src/core/capability/registry/`) at 90% minimum, aiming for 95%. Type-only declarations
  (`CapabilityId`, `CapabilityMode`, the denial-token union, the posture entry type) are proven by the
  type-level fixtures in AC-1/AC-2/AC-5/AC-13, not by line coverage.
- Coverage command and instrumented lane(s): `pnpm coverage:baseline` instruments the unit lane for the
  aggregate gate; for a focused per-story report measuring exactly the registry catalog scope
  (`packages/sdk/src/core/capability/registry/**`), `pnpm exec vitest run --project unit --coverage
  --passWithNoTests -- packages/sdk/tests/core/capability/registry/` — the frozen-data catalog tests
  (AC-3/AC-4/AC-6..AC-12) are the instrumentable lanes; the pure type-level fixtures contribute no
  instrumented lines.
- Required tests, catalogued by AC and failure row: `capability-id.unit.test.ts` (AC-1);
  `capability-mode.unit.test.ts` (AC-2); `posture-catalog.unit.test.ts` (AC-3);
  `posture-modes.unit.test.ts` (AC-4, `mode-disallows-capability` row);
  `deferred-capability.unit.test.ts` (AC-5, `capability-deferred` row);
  `posture-auto-merge.unit.test.ts` (AC-6); `posture-auto-recover.unit.test.ts` (AC-7);
  `posture-unattended-run.unit.test.ts` (AC-8); `posture-escalation.unit.test.ts` (AC-9);
  `containment-floor.unit.test.ts` (AC-10, weak-containment row);
  `guarantee-requirements.unit.test.ts` (AC-11, `policy-disallows-capability` row);
  `posture-shared-guarantees.unit.test.ts` (AC-12); `denial-tokens.unit.test.ts` (AC-13, all denial
  rows); `capability-registry-public-import.unit.test.ts` (AC-14).
- Public exposure (import path + public-import test): `CapabilityId`, `CapabilityMode`, `PostureEntry`,
  the posture catalog, the guarantee-requirement catalog, and the registry denial-token type exported
  from the `sdk` public entrypoint per `epic0-s4-export-templates/PackageExportConvention` (export +
  barrel + `exports`); proven by `capability-registry-public-import.unit.test.ts`.
- Determinism constraints: the registry is pure frozen data and pure accessors; no clock, randomness,
  ids, storage, or I/O (`Date.now`/`new Date`/`Math.random`/`crypto.randomUUID` forbidden). The
  catalog is a module-level constant, not computed at call time from ambient state.
- Dependency boundaries: `sdk` may import only pure runtime libraries; it must not import `testkit`, any
  `provider-*`, `cli`, or `mcp` (`dependency-rules.md`). It must not import `core-02-s2`/`s3` evaluation
  or record modules.
- File-size budget (lines per file; default soft cap ~200): the `CapabilityId`/`CapabilityMode` unions,
  the posture catalog, the guarantee-requirement catalog, and the denial-token type live in separate
  focused files, each ≤ 200 lines.
- Domain non-negotiables: the registry is default-off and fail-closed by construction — a deferred
  capability is never allowable, `manual` never unlocks an autonomous power, weak/absent containment
  never satisfies the floor, and the registry declares no gate-evaluation or record-writing logic.

### Source Evidence Pack

- Test name or artifact proving each AC (catalogued in the quality bar).
- Test name or artifact proving each failure/degraded row (`posture-modes` for
  `mode-disallows-capability`; `guarantee-requirements`/`denial-tokens` for
  `policy-disallows-capability`; `deferred-capability`/`denial-tokens` for `capability-deferred`;
  `containment-floor` for the weak-containment row).
- Negative fixture for every rejection: `capability-id-extra-member.fixture.ts`,
  `capability-mode-auto.fixture.ts`, `posture-missing-entry.fixture.ts`,
  `posture-manual-allowed.fixture.ts`, `deferred-orchestrator-allow.fixture.ts`,
  `auto-merge-missing-rulesets.fixture.ts`, `auto-recover-missing-kill.fixture.ts`,
  `unattended-run-missing-egress.fixture.ts`, `escalation-missing-relay.fixture.ts`,
  `containment-floor-includes-none.fixture.ts`, `guarantee-requirements-missing.fixture.ts`,
  `posture-drops-shared-guarantee.fixture.ts`, `denial-tokens-extra.fixture.ts`.
- `pnpm check` result, unless blocked by a named unrelated repository issue.
- Coverage command, instrumented lane, and number for the registry catalog scope.
- Public-import test result for every exposed shape, imported through the `sdk` entrypoint.
- Boundary/forbidden-symbol sweep: the exact `grep` command, path root, forbidden-token set, and
  zero-match output, plus the `pnpm deps` result.

Run the targeted commands and `pnpm check`, then report exact command output or an explicit blocked reason. Do not treat prose-only claims as evidence.

## Delivery Report

Return a report with changed files, AC coverage by `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, `AC-14`, tests and checks run, evidence pack, open questions, and blockers. The report is review evidence only; it is not permission to update tracker state or perform delivery actions.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - Core runtime spine](../../../README.md) · **← Prev:** [Reviewer Prompt: core-01-s6-cursor-wait](../core-01-s6-cursor-wait/reviewer.md) · **Next →:** [Reviewer Prompt: core-02-s1-capability-registry](./reviewer.md)

<!-- /DOCS-NAV -->
