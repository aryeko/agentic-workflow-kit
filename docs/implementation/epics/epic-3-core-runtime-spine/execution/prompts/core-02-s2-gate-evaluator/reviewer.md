# Reviewer Prompt: core-02-s2-gate-evaluator

## Assigned Routing

- Source story id: `core-02-s2-gate-evaluator`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, `AC-14`, `AC-15`, `AC-16`, `AC-17`, `AC-18`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `elevated`.
- Reasoning tier: `elevated`.
- Routing rationale: core-02-s2-gate-evaluator covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-17, AC-18 and carries safety boundary and fail-closed capability gate evaluator over committed evidence and attestations. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Original Scope

- Story id: `core-02-s2-gate-evaluator`.
- Epic slug: `epic-3-core-runtime-spine`.
- Source story contract path: `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-02-s2-gate-evaluator.md`.
- Allowed pathset: `packages/sdk/src/core/capability/evaluator/**`, `packages/sdk/tests/core/capability/evaluator/**`.
- Direct dependencies: `core-02-s1-capability-registry`, `core-01-s1-event-contracts`.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus committed producer shapes and public import paths named in the source contract and DAG.

## Contract Repair Note

The source story has been repaired after this prompt was generated. The source story is authoritative
where this prompt's embedded excerpts still mention an undefined policy-permits shape or an undefined
provider-contract-approved parent-scope rule:

- `CapabilityGateRequest` includes `policyDecision: CapabilityGatePolicyDecision`; the evaluator checks
  `request.policyDecision.permits` and does not parse raw policy documents.
- `CapabilityGateScope.providerScopes[]` includes optional `approvedParentScopes`; an attestation parent
  scope is valid only when it is listed there for the same provider/freshness key and is a lexical parent
  of the exact scope using `/`, `:`, or `#` as the next separator.

Do not reject or stop on the old policy-shape or approved-parent-scope gap; review against the repaired
source story and matching design docs.

### Acceptance Criteria

Each AC is a single assertion that is true or false against a hermetic test over fixture `RunReplay` /
`RunProjections` / `CapabilityGateRequest` values. Every denial AC names its OWN failing fixture (a stale
attestation, an ambiguous evidence set, a degraded replay health, …) and asserts `decision="deny"` plus
that exact `failureReason`; a green tool exit is never cited for a denial. The `evidence` names the exact
test id and the result it produces.

- **AC-1** `evaluateCapabilityGate(request, replay, projections)` is exported with that exact signature,
  returns a `CapabilityGateRecordPayload`, and is pure: called twice with identical inputs it returns a
  deep-equal payload, and it reads no clock/process/network (`request.evaluatedAt` is the only time
  source) - evidence: `evaluate-signature.unit.test.ts` asserts two calls on the same fully-satisfied
  fixture return deep-equal payloads and a spy/guard fixture confirms no `Date.now`/`new Date` access.
- **AC-2** `CapabilityGateRecordPayload` carries the frozen `schema` literal
  `"kit-vnext.capability-gate-record.v1"` and declares exactly the fields `gateId`, `capability`,
  `decision`, `mode`, `scope`, `policyRef`, `requestedByDomain`, `requestedAction`, `evaluatedAt`,
  `evaluatedGuarantees`, `attestationRefs`, `evidenceRefs`, and optional `failureReason`; `GateDecision`
  is exactly `"allow" | "deny"` - evidence: `gate-record-shape.unit.test.ts` constructs a payload from a
  valid fixture, runs a `never` exhaustiveness switch over `GateDecision`, and a negative fixture
  (`gate-record-bad-schema.fixture.ts`) using a `schema` other than
  `"kit-vnext.capability-gate-record.v1"` or omitting `evaluatedGuarantees` fails compilation.
- **AC-3** `GuaranteeEvaluation`, `AttestationRef`, `CapabilityGateScope`, `ProviderDomain`, and
  `CapabilityGateRequest` are present with the design fields, where `ProviderDomain` is exactly
  `"Agent" | "Forge" | "Work Source" | "Execution Host"`, `AttestationRef` carries
  `eventId`/`provider`/`capability`/`evidenceRef`/`freshnessKey`/`scope`/`expiry`, and
  `CapabilityGateScope.providerScopes` is `{ provider: ProviderDomain; scope: string; freshnessKey: string }[]`
  - evidence: `gate-types.unit.test.ts` constructs each from a valid fixture, runs a `never` switch over
  `ProviderDomain`, and a negative fixture (`attestation-ref-missing-expiry.fixture.ts`) omitting
  `AttestationRef.expiry` fails compilation.
- **AC-4** `CapabilityGateFailureReason` is the full union with exactly the 14 members
  `mode-disallows-capability`, `policy-disallows-capability`, `capability-deferred`, `run-log-degraded`,
  `required-evidence-absent`, `required-evidence-ambiguous`, `attestation-absent`, `attestation-stale`,
  `attestation-negative`, `attestation-out-of-scope`, `attestation-contradictory`,
  `attestation-non-replayable`, `self-report-only`, `gate-record-unwritable`, and no others - evidence:
  `failure-reason-union.unit.test.ts` runs an exhaustiveness `never` switch over all 14 members and a
  negative fixture (`failure-reason-unknown.fixture.ts`) using a non-member literal fails compilation.
- **AC-5** A fully-satisfied fixture for an `assisted` capability — policy permits it, `replay.health`
  is `ok` or `tail-repaired`, `projections.launch.linkage` is not `ambiguous`, required evidence refs
  resolve, and every required attestation is committed, fresh (`at <= evaluatedAt < expiry`), positive,
  in scope, non-contradictory, and replayable — returns `decision="allow"`, no `failureReason`, every
  `GuaranteeEvaluation.passed === true`, and `attestationRefs` cites each consumed attestation event id -
  evidence: `evaluate-allow.unit.test.ts` (`allow-auto-merge.fixture.ts`) asserts `decision==="allow"`,
  `failureReason` absent, all five `evaluatedGuarantees[].passed` true, and `attestationRefs` non-empty.
- **AC-6** When `replay.health` is `interior-corrupt` or `event-log-unavailable`, or
  `projections.launch.linkage === "ambiguous"`, the evaluator returns `decision="deny"` with
  `failureReason="run-log-degraded"` **before** inspecting mode, policy, or any attestation - evidence:
  `deny-run-log-degraded.unit.test.ts` (`degraded-replay.fixture.ts` with `health:"interior-corrupt"`
  and `ambiguous-linkage.fixture.ts`) asserts `decision==="deny"` and `failureReason==="run-log-degraded"`.
- **AC-7** When `request.mode === "manual"` the evaluator denies with
  `failureReason="mode-disallows-capability"`; when `request.policyDecision.permits === false` for the
  already-resolved capability/action/scope decision it denies with
  `failureReason="policy-disallows-capability"`; and when the capability is `orchestrator-decide`
  (AD-14 deferred) it denies with `failureReason="capability-deferred"` — each
  raised before any provider attestation is inspected, reusing the
  `core-02-s1-capability-registry` tokens - evidence: `deny-mode-policy-deferred.unit.test.ts`
  (`manual-mode.fixture.ts`, `policy-denies.fixture.ts`, `orchestrator-decide.fixture.ts`) asserts each
  denial returns the matching `failureReason` and that `attestationRefs` is empty (no attestation
  selection occurred).
- **AC-8** When a guarantee's required evidence ref is not present in `request.evidenceRefs`/recorded
  evidence, the evaluator denies with `failureReason="required-evidence-absent"`; when two or more
  recorded evidence records contradict for the same required input (e.g. conflicting exact-head refs),
  it denies with `failureReason="required-evidence-ambiguous"` - evidence:
  `deny-evidence.unit.test.ts` (`evidence-absent.fixture.ts`, `evidence-ambiguous.fixture.ts`) asserts
  each returns the matching `failureReason` and the offending `GuaranteeEvaluation.passed === false`.
- **AC-9** When no committed `CapabilityAttestation` matches the required provider/capability/scope, the
  evaluator denies with `failureReason="attestation-absent"` - evidence:
  `deny-attestation-absent.unit.test.ts` (`no-attestation.fixture.ts`, a `replay.events` with no matching
  attestation) asserts `decision==="deny"`, `failureReason==="attestation-absent"`.
- **AC-10** A matching attestation whose freshness window fails (`evaluatedAt >= expiry`, or
  `at > evaluatedAt` so it is future-dated) is treated as stale and denies with
  `failureReason="attestation-stale"` - evidence: `deny-attestation-stale.unit.test.ts`
  (`expired-attestation.fixture.ts` with `expiry <= evaluatedAt`, `future-attestation.fixture.ts` with
  `at > evaluatedAt`) asserts both return `failureReason==="attestation-stale"`.
- **AC-11** A fresh in-scope attestation whose `result === "negative"` denies with
  `failureReason="attestation-negative"`, and a fresh in-scope `positive` accompanied by a fresh in-scope
  `negative`/conflicting attestation for the same provider capability denies with
  `failureReason="attestation-contradictory"` - evidence: `deny-attestation-negative-contradictory.unit.test.ts`
  (`negative-attestation.fixture.ts`, `contradictory-attestations.fixture.ts`) asserts the two distinct
  `failureReason` values.
- **AC-12** An attestation whose `scope` is neither the exact gate scope nor an approved parent scope
  listed in `providerScopes[].approvedParentScopes` for the same provider/freshness key denies with
  `failureReason="attestation-out-of-scope"` - evidence:
  `deny-attestation-out-of-scope.unit.test.ts` (`wrong-scope-attestation.fixture.ts` whose
  `scope`/`freshnessKey` does not match the gate `providerScopes`) asserts
  `failureReason==="attestation-out-of-scope"`.
- **AC-13** An attestation whose `evidenceRef` does not resolve to recorded probe output / artifact
  digest, or whose envelope is malformed, denies with `failureReason="attestation-non-replayable"` -
  evidence: `deny-attestation-non-replayable.unit.test.ts` (`unresolvable-evidence-ref.fixture.ts`,
  `malformed-attestation-envelope.fixture.ts`) asserts both return
  `failureReason==="attestation-non-replayable"`.
- **AC-14** When the only support for a guarantee is self-report — worker prose, Agent/Guardian text, an
  unprobed driver feature list, or schema-only evidence asserted to prove liveness/persistence/parentage/
  kill/egress/write-side behavior — the guarantee never passes and the evaluator denies with
  `failureReason="self-report-only"` - evidence: `deny-self-report-only.unit.test.ts`
  (`self-report-prose.fixture.ts`, `schema-only-liveness.fixture.ts`) asserts `decision==="deny"` and
  `failureReason==="self-report-only"`, and that `evaluatedGuarantees` for that guarantee is `passed:false`.
- **AC-15** The returned `failureReason` is the **first** failure in the design's stable predicate order
  (run-log-degraded → mode/policy/deferred → required-evidence → attestation checks → self-report-only):
  a fixture that violates two predicates at once (e.g. degraded replay AND a stale attestation) returns
  the earlier reason (`run-log-degraded`) - evidence: `deny-stable-ordering.unit.test.ts`
  (`degraded-and-stale.fixture.ts`, `manual-and-absent.fixture.ts`) asserts the earlier-in-order
  `failureReason` is the one returned, fixing replay determinism.
- **AC-16** Each `GuaranteeEvaluation` records its `guaranteeId`, `passed`, the `attestationRefs` and
  `evidenceRefs` it consumed, and (when failed) the `failureReason` for that guarantee; on `allow` every
  entry is `passed:true` with no `failureReason`, and the payload-level `attestationRefs`/`evidenceRefs`
  are the union of the per-guarantee refs - evidence: `guarantee-evaluation.unit.test.ts`
  (`allow-auto-merge.fixture.ts` and `deny-attestation-stale` reuse) asserts the per-guarantee refs and
  the payload-level union match, and that a failed guarantee carries its own `failureReason`.
- **AC-17** `evaluateCapabilityGate`, `CapabilityGateRecordPayload`, `CapabilityGateRequest`,
  `GuaranteeEvaluation`, `AttestationRef`, `CapabilityGateScope`, `GateDecision`, `ProviderDomain`, and
  `CapabilityGateFailureReason` are importable from the `sdk` package public entrypoint (not a private
  module path), per `epic0-s4-export-templates/PackageExportConvention` - evidence:
  `gate-public-import.unit.test.ts` imports all nine from the `sdk` entrypoint and evaluates one fixture.
- **AC-18** The evaluator source is pure and host-neutral: it imports no `RunEventLog`/`RunWriter` runtime
  module, no driver, process, or network client, does not redeclare `CapabilityAttestation`,
  `CapabilityId`, or any consumed core-01 value type, and contains no append/`barrier`/`RunWriter`
  reference (that is `core-02-s3`) - evidence: the forbidden-symbol sweep below over
  `packages/sdk/src/core/capability/evaluator/` reports zero matches (exit code 1, no lines), captured
  into the evidence pack.

### Dependencies And Frozen Inputs

- Covers signals: core-02 "Guarantee predicates over committed evidence and attestations;
  freshness/expiry/scope/negative/contradictory/absent attestation handling; `CapabilityGateRecord`
  payloads and denial reasons" — specifically the **payload + denial** part (the barrier-durability and
  unwritable-record part is `core-02-s3-gate-record-durability`).
- Depends on: `core-02-s1-capability-registry`, `core-01-s1-event-contracts` (band 2; consumes value
  types only, not core-01 runtime behaviors).
- Depended on by: `core-02-s3-gate-record-durability`, and (cross-epic) Epic 4 / Epic 5 gate callers.
- Shared shapes consumed (cited verbatim, not redeclared):
  - `core-02-s1-capability-registry/CapabilityId`, `core-02-s1-capability-registry/CapabilityMode`, and
    the `core-02-s1-capability-registry` posture/guarantee-requirement catalog (the per-capability
    required-guarantee list and the three pre-evidence tokens).
  - `core-01-s1-event-contracts/RunReplay`, `core-01-s1-event-contracts/RunProjections`,
    `core-01-s1-event-contracts/RunEventEnvelope`, `core-01-s1-event-contracts/RunDegradedHealth`,
    `core-01-s1-event-contracts/EvidenceEventRef`.
  - `prov-00-s1-capability-attestation/CapabilityAttestation` (and `CapabilityAttestationResult`,
    `CapabilityProvider`) — the attestation payloads carried in `replay.events`.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

### Non-Goals

- The capability registry, `CapabilityId`, `CapabilityMode`, and the v1 posture/guarantee-requirement
  catalog (incl. the three pre-evidence tokens `mode-disallows-capability`/`policy-disallows-capability`/
  `capability-deferred`) — owned by `core-02-s1-capability-registry`; cited, never redeclared.
- Appending the `CapabilityGateRecord` event at `barrier` via `RunWriter`, and raising
  `gate-record-unwritable` when the record is unwritable — owned by `core-02-s3-gate-record-durability`.
- The `CapabilityAttestation` payload shape and its validator — owned by Epic 2
  `prov-00-s1-capability-attestation`; consumed, never redeclared.
- The core-01 run-log value types (`RunReplay`, `RunProjections`, `RunEventEnvelope`,
  `RunDegradedHealth`, `EvidenceEventRef`) and the `replay()`/`project()` behaviors that build them —
  owned by `core-01-s1`/`s2`/`s5`; referenced as value types, never redeclared, and not depended on as
  runtime behaviors (the evaluator takes them as values built from fixtures).
- Full policy document schema — owned by Configuration & Policy (`fnd-01`); consumed here only as the
  normalized `CapabilityGatePolicyDecision` input.
- The lifecycle consequence of a deny (park/block/fail) — chosen by the caller via core-01 legal
  transitions, not by this evaluator.

### STOP Conditions And Boundaries

- Package or module boundary: `packages/sdk/src/core/capability/evaluator` only.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/core/capability/evaluator/**`, `packages/sdk/tests/core/capability/evaluator/**`.
- Forbidden dependencies: no `testkit` (production source), no `provider-*`, no `cli`/`mcp`, no
  `RunEventLog`/`RunWriter` runtime module, no driver / network client / `execa` / `child_process`; do
  not redeclare `CapabilityAttestation` (Epic 2 `prov-00-s1`), `CapabilityId`/`CapabilityMode`/the
  posture catalog (`core-02-s1`), or any core-01 value type (`core-01-s1`); no ambient
  `Date.now`/`new Date`/`Math.random`/`crypto.randomUUID`.
- STOP when: appending the `CapabilityGateRecord` event at `barrier` via `RunWriter` or raising
  `gate-record-unwritable` (owned by `core-02-s3-gate-record-durability`); declaring the registry catalog
  or the `CapabilityId`/posture shapes (`core-02-s1-capability-registry`); declaring the
  `CapabilityAttestation` payload (Epic 2 `prov-00-s1`); declaring the core-01 run-log value types
  (`core-01-s1-event-contracts`); parsing raw policy documents; inferring parent scopes not listed in
  `approvedParentScopes`; or any provider/driver behavior. If another design contract question blocks an
  AC, report it as a design gap — do not invent it.

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check implementation against source story `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-02-s2-gate-evaluator.md` and AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, `AC-14`, `AC-15`, `AC-16`, `AC-17`, `AC-18`.

- AC coverage by source `AC-n` id, including every failure, degraded, validation, and negative-fixture row named by the source contract.
- Evidence pack completeness against the source `Quality bar` and `Evidence pack` sections.
- Public API names, exports, and import paths against the source contract and DAG producer/consumer table.
- Dependency boundaries, committed dependency inputs, and `{{DEPENDENCY_COMMITS}}` consistency.
- Stale names and sibling occurrences of any issue found.
- Tests, targeted checks, coverage commands, forbidden-symbol sweeps, and `pnpm check` output.
- Scope control against allowed writes: `packages/sdk/src/core/capability/evaluator/**`, `packages/sdk/tests/core/capability/evaluator/**`.
- Repo conventions and mutation limits from `AGENTS.md` and the source contract.

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - Core runtime spine](../../../README.md) · **← Prev:** [Implementer Prompt: core-02-s2-gate-evaluator](./implementer.md) · **Next →:** [Implementer Prompt: core-02-s3-gate-record-durability](../core-02-s3-gate-record-durability/implementer.md)

<!-- /DOCS-NAV -->
