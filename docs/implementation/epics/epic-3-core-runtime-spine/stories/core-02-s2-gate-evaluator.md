---
title: "core-02-s2-gate-evaluator - capability gate evaluator and record payload implementation story"
id: "core-02-s2-gate-evaluator"
epic: 3
status: "story: ready"
design:
  - "docs/design/30-domain-reference/core/capability-and-safety/gate-evaluation-and-records.md"
  - "docs/design/30-domain-reference/core/capability-and-safety/README.md"
  - "docs/design/30-domain-reference/core/capability-and-safety/capability-registry.md"
---

# core-02-s2-gate-evaluator - Capability Gate Evaluator and Record Payload

## Purpose

Implement `evaluateCapabilityGate(request, replay, projections)` as a pure fail-closed decision over
committed run-log evidence and provider capability attestations — the five shared guarantee predicates,
attestation consumption, the denial-reason catalog, and the `CapabilityGateRecordPayload` shape — so a
caller (Epic 4/5) can decide an autonomous power only when its guarantees hold against recorded
evidence (FR-7, NFR-SAFE, NFR-DET).

## Normative design

- `docs/design/30-domain-reference/core/capability-and-safety/gate-evaluation-and-records.md` — the
  `evaluateCapabilityGate` signature; §Attestation consumption (the five usability checks); §Types
  (`CapabilityGateRecordPayload`, `GuaranteeEvaluation`, `AttestationRef`, `CapabilityGateScope`,
  `GateDecision`, `CapabilityGateFailureReason`, `CapabilityGateRequest`, `ProviderDomain`); §Algorithm
  (the six-step evaluation and the stable failure ordering as replay determinism).
- `docs/design/30-domain-reference/core/capability-and-safety/capability-registry.md` — the five shared
  guarantee predicates (§Shared guarantees) the evaluator runs, and §Self-report rejection.
- `docs/design/30-domain-reference/core/capability-and-safety/README.md` §5 (the `evaluateCapabilityGate`
  contract surface and consumed interfaces), §6 (`CapabilityGateRecord` event, `domain = "core-02"`,
  consumed events), §8 (the failure & degraded token list and fail-closed posture).
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md` — the frozen core-01 value
  types this evaluator consumes (`RunReplay`, `RunProjections`, `RunEventEnvelope`, `RunDegradedHealth`,
  `EvidenceEventRef`), referenced not redeclared.
- `docs/design/20-sdk-and-packaging/dependency-rules.md`, `sdk-boundary.md` — `sdk` imports only pure
  runtime libraries; no driver, process, network, or `testkit`.
- `docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/stories/epic0-s4-export-templates.md`
  — `PackageExportConvention` for the public `sdk` entrypoint (export + barrel + `exports`).
- `docs/engineering/test-lanes.md` — the hermetic `*.unit.test.ts` / `*.conformance.test.ts` lanes
  (zero process/network/filesystem).

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by the design's exact
names (runtime-types variant).

- Interfaces / types (this story PRODUCES and exposes):
  - `evaluateCapabilityGate(request: CapabilityGateRequest, replay: RunReplay, projections: RunProjections): CapabilityGateRecordPayload`
    — pure function over core-01 value types, never a `RunEventLog`.
  - `CapabilityGateRequest` — `gateId`, `runId`, `capability: CapabilityId`, `mode: CapabilityMode`,
    `scope: CapabilityGateScope`, `policyRef`, `policyDecision: CapabilityGatePolicyDecision`,
    `requestedByDomain`, `requestedAction`, `evaluatedAt`, `evidenceRefs: string[]`.
  - `CapabilityGatePolicyDecision` — `policyRef`, `permits: boolean`, optional `denialReason?: string`;
    this is the normalized Configuration & Policy result for the exact capability, requested action, and
    gate scope. The evaluator does not parse policy documents.
  - `CapabilityGateRecordPayload` — `schema: "kit-vnext.capability-gate-record.v1"`, `gateId`,
    `capability: CapabilityId`, `decision: GateDecision`, `mode: CapabilityMode`, `scope:
    CapabilityGateScope`, `policyRef`, `requestedByDomain`, `requestedAction`, `evaluatedAt`,
    `evaluatedGuarantees: GuaranteeEvaluation[]`, `attestationRefs: AttestationRef[]`,
    `evidenceRefs: string[]`, optional `failureReason?: CapabilityGateFailureReason`.
  - `GuaranteeEvaluation` — `guaranteeId`, `passed: boolean`, `attestationRefs: AttestationRef[]`,
    `evidenceRefs: string[]`, optional `failureReason?: CapabilityGateFailureReason`.
  - `AttestationRef` — `eventId`, `provider: ProviderDomain`, `capability`, `evidenceRef`,
    `freshnessKey`, `scope`, `expiry`.
  - `CapabilityGateScope` — `runId`, optional `taskId`, `operationId`, `providerScopes: { provider:
    ProviderDomain; scope: string; freshnessKey: string; approvedParentScopes?: string[] }[]`, optional
    `repoRef`, `workspaceRef`, `sessionId`, `pullRequestRef`, `expectedHeadSha`, `egressPolicyDigest`.
- Unions (kept distinct):
  - `GateDecision` = `"allow" | "deny"`.
  - `ProviderDomain` = `"Agent" | "Forge" | "Work Source" | "Execution Host"`.
  - `CapabilityGateFailureReason` — the FULL union (declared here as the single producer):
    `"mode-disallows-capability" | "policy-disallows-capability" | "capability-deferred" |
    "run-log-degraded" | "required-evidence-absent" | "required-evidence-ambiguous" |
    "attestation-absent" | "attestation-stale" | "attestation-negative" | "attestation-out-of-scope" |
    "attestation-contradictory" | "attestation-non-replayable" | "self-report-only" |
    "gate-record-unwritable"`.
- Events / append intents: `CapabilityGateRecord` is the event type that the `CapabilityGateRecordPayload`
  is appended as (`domain = "core-02"`, `barrier` durability). This story produces only the **payload
  shape** and its `schema` literal; the append-at-barrier behavior and the `gate-record-unwritable`
  raising are owned by `core-02-s3-gate-record-durability`.
- Provider operations / commands: none. `core-02` calls no driver.
- Failure and degraded tokens this story OWNS (declares + raises in the returned payload's
  `decision="deny"` + `failureReason`):
  - `run-log-degraded`, `required-evidence-absent`, `required-evidence-ambiguous`, `attestation-absent`,
    `attestation-stale`, `attestation-negative`, `attestation-out-of-scope`, `attestation-contradictory`,
    `attestation-non-replayable`, `self-report-only`.
  - Reused (NOT redeclared; the catalog member is owned by `core-02-s1-capability-registry`, raised here
    by this evaluator): `mode-disallows-capability`, `policy-disallows-capability`, `capability-deferred`.
  - Declared in this union but NOT raised here (owned/raised by `core-02-s3-gate-record-durability`):
    `gate-record-unwritable`.
- Evidence records / attestations: this evaluator CONSUMES committed `prov-00-s1-capability-attestation/CapabilityAttestation`
  events (carried in `replay.events` as `RunEventEnvelope` payloads) and the caller-supplied
  `request.evidenceRefs`. It produces no attestation; it produces `AttestationRef` entries that cite the
  committed attestation event ids it consumed.

Done requires every item here present with the design's names, shapes, and semantics, and each denial
token proven by its own negative fixture asserting `decision="deny"` with that exact `failureReason`.

## Responsibilities

- Declare `CapabilityGateRequest`, `CapabilityGatePolicyDecision`, `CapabilityGateRecordPayload` (with
  the frozen `schema` literal `"kit-vnext.capability-gate-record.v1"`), `GuaranteeEvaluation`,
  `AttestationRef`, `CapabilityGateScope`, `GateDecision`, `ProviderDomain`, and the full
  `CapabilityGateFailureReason` union with exactly the design's members and no others.
- Implement `evaluateCapabilityGate` as a pure function: it reads only `request`, `replay`, and
  `projections`; it never reads the clock, filesystem, network, a provider, or a `RunEventLog`, and never
  writes a projection — `request.evaluatedAt` is the only time source.
- Reject with `run-log-degraded` (step 1) when core-01 replay/projection health is unusable
  (`replay.health` is `interior-corrupt` or `event-log-unavailable`), projections are missing, or session
  linkage required by the capability is ambiguous (`projections.launch.linkage === "ambiguous"`).
- Reject with `mode-disallows-capability`, `policy-disallows-capability`, or `capability-deferred`
  (step 2) — before checking provider evidence — when mode, `request.policyDecision.permits`, or AD-14
  deferral prevents the capability (reusing the `core-02-s1-capability-registry` posture/guarantee
  catalog and its three pre-evidence tokens).
- Select only committed `CapabilityAttestation` events whose envelope `at <= request.evaluatedAt`
  (step 3), then filter by provider domain, capability name, driver version, platform, freshness key, and
  scope (step 4).
- Evaluate each of the five shared guarantee predicates and the capability-specific required attestations
  (step 5), marking a guarantee `passed` only when required recorded evidence exists and the selected
  attestations are fresh, positive, non-contradictory, in scope, and replayable.
- Apply the attestation-consumption checks: valid envelope fields; freshness `at <= evaluatedAt <
  expiry`; scope exact-or-approved-parent; `result === "positive"`; `evidenceRef` resolves to recorded
  probe output / artifact digest; a fresh in-scope `negative` or contradictory attestation for the same
  provider capability denies the guarantee; schema-only evidence cannot prove liveness, persistence,
  parentage, kill, egress confinement, or write-side Forge behavior. Exact-or-approved-parent means the
  attestation provider/freshness key matches a `providerScopes[]` entry and either
  `attestation.scope === providerScope.scope`, or `attestation.scope` appears in
  `providerScope.approvedParentScopes` and is a lexical parent of `providerScope.scope` using `/`, `:`,
  or `#` as the next separator. The evaluator must not infer parent scopes from providers.
- Fail closed: stale, absent, future-dated, negative, out-of-scope, contradictory, malformed, or
  non-replayable evidence denies, and self-report (worker prose, Agent/Guardian text, unprobed driver
  feature list) never allows a guarantee.
- Return `allow` only when every guarantee passes (step 6); otherwise return `deny` with the first stable
  failure reason in predicate order, recording the per-guarantee `GuaranteeEvaluation` results, the
  consumed `attestationRefs`, and the echoed `evidenceRefs` in the payload.
- Build a `CapabilityGateRecordPayload` that echoes `gateId`, `capability`, `mode`, `scope`, `policyRef`,
  `requestedByDomain`, `requestedAction`, and `evaluatedAt` from the request, sets `decision` and (on
  deny) `failureReason`, and carries the evaluated guarantees and the attestation/evidence refs.
- Export the function, the payload, and the supporting types — including the full
  `CapabilityGateFailureReason` union — from the `sdk` public entrypoint per
  `epic0-s4-export-templates/PackageExportConvention`.

## Out of scope

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

## Dependencies and frozen inputs

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

## Acceptance criteria

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
- **AC-3** `GuaranteeEvaluation`, `AttestationRef`, `CapabilityGateScope`,
  `CapabilityGatePolicyDecision`, `ProviderDomain`, and `CapabilityGateRequest` are present with the
  design fields, where `ProviderDomain` is exactly
  `"Agent" | "Forge" | "Work Source" | "Execution Host"`, `AttestationRef` carries
  `eventId`/`provider`/`capability`/`evidenceRef`/`freshnessKey`/`scope`/`expiry`,
  `CapabilityGatePolicyDecision` carries `policyRef` and `permits`, and
  `CapabilityGateScope.providerScopes` is
  `{ provider: ProviderDomain; scope: string; freshnessKey: string; approvedParentScopes?: string[] }[]`
  - evidence: `gate-types.unit.test.ts` constructs each from a valid fixture, runs a `never` switch over
  `ProviderDomain`, and negative fixtures (`attestation-ref-missing-expiry.fixture.ts`,
  `policy-decision-missing-permits.fixture.ts`) fail compilation when required fields are omitted.
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
  denies with `failureReason="attestation-out-of-scope"`. A parent is approved only when it is listed in
  the matching `providerScopes[].approvedParentScopes` for the same provider/freshness key and is a
  lexical parent of the exact scope using `/`, `:`, or `#` as the next separator - evidence:
  `deny-attestation-out-of-scope.unit.test.ts` (`wrong-scope-attestation.fixture.ts` whose
  `scope`/`freshnessKey` does not match the gate `providerScopes`) asserts
  `failureReason==="attestation-out-of-scope"`, and `approved-parent-scope.unit.test.ts` asserts a listed
  parent scope is accepted while an unlisted lexical parent is denied.
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

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No
responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| `evaluateCapabilityGate` exact signature + purity/determinism (no clock/IO) | AC-1 |
| `CapabilityGateRecordPayload` shape + `schema` literal; `GateDecision` union | AC-2 |
| `GuaranteeEvaluation` / `AttestationRef` / `CapabilityGateScope` / `CapabilityGatePolicyDecision` / `ProviderDomain` / `CapabilityGateRequest` shapes | AC-3 |
| `CapabilityGateFailureReason` full 14-member union (single producer) | AC-4 |
| `allow` only when all five guarantees pass over a fully-satisfied fixture | AC-5 |
| Step-1 reject `run-log-degraded` (degraded health / missing projections / ambiguous linkage) | AC-6 |
| Step-2 pre-evidence denial: mode / resolved policy decision / deferred (reused s1 tokens) | AC-7 |
| `required-evidence-absent` / `required-evidence-ambiguous` | AC-8 |
| Attestation selection/filter; `attestation-absent` | AC-9 |
| Freshness check `at <= evaluatedAt < expiry`; `attestation-stale` | AC-10 |
| Result-positive + non-contradictory checks; `attestation-negative` / `attestation-contradictory` | AC-11 |
| Scope exact-or-listed-approved-parent check; `attestation-out-of-scope` | AC-12 |
| Replayable-evidence check + malformed envelope; `attestation-non-replayable` | AC-13 |
| Self-report / schema-only rejection; `self-report-only` | AC-14 |
| Stable failure ordering (replay determinism) | AC-15 |
| `GuaranteeEvaluation` per-guarantee + payload-level ref recording | AC-16 |
| Public exposure of evaluator + payload + supporting types + failure union | AC-17 |
| Pure host-neutral evaluator (no impl/driver/process/network; no redeclared shapes; no append/barrier) | AC-18 |

## Failure and degraded outcomes

Each row's `proven by` AC asserts THIS row's trigger and required behavior (the deny decision plus the
exact `failureReason`) against its own negative fixture — never a happy-path exit.

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `run-log-degraded` | `replay.health` is `interior-corrupt`/`event-log-unavailable`, projections missing, or `projections.launch.linkage === "ambiguous"` | `decision="deny"`, `failureReason="run-log-degraded"`, raised before mode/policy/attestation inspection | AC-6 |
| `mode-disallows-capability` (s1 token) | `request.mode === "manual"` for an autonomous capability | `decision="deny"`, `failureReason="mode-disallows-capability"`, no attestation selected | AC-7 |
| `policy-disallows-capability` (s1 token) | `request.policyDecision.permits === false` for the already-resolved capability/action/scope decision | `decision="deny"`, `failureReason="policy-disallows-capability"` | AC-7 |
| `capability-deferred` (s1 token) | capability is `orchestrator-decide` (AD-14) | `decision="deny"`, `failureReason="capability-deferred"` | AC-7 |
| `required-evidence-absent` | a guarantee's required recorded evidence ref is not present | `decision="deny"`, `failureReason="required-evidence-absent"`, failing guarantee `passed:false` | AC-8 |
| `required-evidence-ambiguous` | recorded evidence contradicts for a required input | `decision="deny"`, `failureReason="required-evidence-ambiguous"` | AC-8 |
| `attestation-absent` | no committed `CapabilityAttestation` matches the required provider/capability/scope | `decision="deny"`, `failureReason="attestation-absent"` | AC-9 |
| `attestation-stale` | matched attestation fails `at <= evaluatedAt < expiry` (expired or future-dated) | `decision="deny"`, `failureReason="attestation-stale"` | AC-10 |
| `attestation-negative` | fresh in-scope attestation `result === "negative"` | `decision="deny"`, `failureReason="attestation-negative"` | AC-11 |
| `attestation-contradictory` | fresh in-scope positive + a fresh in-scope negative/conflicting for the same provider capability | `decision="deny"`, `failureReason="attestation-contradictory"` | AC-11 |
| `attestation-out-of-scope` | attestation `scope` is neither exact nor listed in the matching `approvedParentScopes` as a lexical parent of the gate scope | `decision="deny"`, `failureReason="attestation-out-of-scope"` | AC-12 |
| `attestation-non-replayable` | `evidenceRef` does not resolve, or the attestation envelope is malformed | `decision="deny"`, `failureReason="attestation-non-replayable"` | AC-13 |
| `self-report-only` | the only support is worker/Agent/Guardian prose, an unprobed feature list, or schema-only evidence claiming behavioral guarantees | `decision="deny"`, `failureReason="self-report-only"`, guarantee never passes | AC-14 |

> `gate-record-unwritable` is declared in this story's `CapabilityGateFailureReason` union (single
> producer) but its **trigger and raise** are owned by `core-02-s3-gate-record-durability`; this
> evaluator never returns it (proven by AC-18's sweep over append/`barrier`/`RunWriter` symbols).

## Quality bar

- Coverage scope and threshold: the evaluator decision logic — `evaluateCapabilityGate` plus its
  guarantee-predicate, attestation-consumption, and failure-ordering helpers under
  `packages/sdk/src/core/capability/evaluator/` — at ≥ 90% line+branch (aim 95%). The type-only
  declarations (`CapabilityGateRecordPayload`, the unions, the request/scope/ref types) are proven by the
  type-level construction fixtures in AC-2/AC-3/AC-4, not by line coverage.
- Coverage command and instrumented lane(s): `pnpm coverage:baseline` instruments the unit lane for the
  aggregate gate; for a focused per-story report measuring exactly the evaluator helper scope,
  `pnpm exec vitest run --project unit --coverage --passWithNoTests -- packages/sdk/tests/core/capability/evaluator/`
  scoped to `packages/sdk/src/core/capability/evaluator/**`. The branch-heavy decision helpers (one
  branch per failure token) carry the instrumented number; the type fixtures contribute no instrumented
  lines.
- Required tests, catalogued by AC and failure row: `evaluate-signature.unit.test.ts` (AC-1);
  `gate-record-shape.unit.test.ts` (AC-2); `gate-types.unit.test.ts` (AC-3);
  `failure-reason-union.unit.test.ts` (AC-4); `evaluate-allow.unit.test.ts` (AC-5);
  `deny-run-log-degraded.unit.test.ts` (AC-6, `run-log-degraded` row);
  `deny-mode-policy-deferred.unit.test.ts` (AC-7, the three pre-evidence rows);
  `deny-evidence.unit.test.ts` (AC-8, both evidence rows);
  `deny-attestation-absent.unit.test.ts` (AC-9); `deny-attestation-stale.unit.test.ts` (AC-10);
  `deny-attestation-negative-contradictory.unit.test.ts` (AC-11, both rows);
  `deny-attestation-out-of-scope.unit.test.ts` (AC-12); `deny-attestation-non-replayable.unit.test.ts`
  (AC-13); `deny-self-report-only.unit.test.ts` (AC-14); `deny-stable-ordering.unit.test.ts` (AC-15);
  `guarantee-evaluation.unit.test.ts` (AC-16); `gate-public-import.unit.test.ts` (AC-17); the
  forbidden-symbol sweep (AC-18). Negative fixtures (each its own file under
  `tests/core/capability/evaluator/fixtures/`): `gate-record-bad-schema.fixture.ts`,
  `attestation-ref-missing-expiry.fixture.ts`, `policy-decision-missing-permits.fixture.ts`,
  `failure-reason-unknown.fixture.ts`,
  `degraded-replay.fixture.ts`, `ambiguous-linkage.fixture.ts`, `manual-mode.fixture.ts`,
  `policy-denies.fixture.ts`, `orchestrator-decide.fixture.ts`, `evidence-absent.fixture.ts`,
  `evidence-ambiguous.fixture.ts`, `no-attestation.fixture.ts`, `expired-attestation.fixture.ts`,
  `future-attestation.fixture.ts`, `negative-attestation.fixture.ts`,
  `contradictory-attestations.fixture.ts`, `wrong-scope-attestation.fixture.ts`,
  `unresolvable-evidence-ref.fixture.ts`, `malformed-attestation-envelope.fixture.ts`,
  `self-report-prose.fixture.ts`, `schema-only-liveness.fixture.ts`, `degraded-and-stale.fixture.ts`,
  `manual-and-absent.fixture.ts`; plus the positive `allow-auto-merge.fixture.ts`. A
  `*.conformance.test.ts` lane is used only if a fixture exercises an Epic 2 mock attestation builder;
  otherwise all tests are hermetic `*.unit.test.ts`.
- Public exposure (import path + public-import test): `evaluateCapabilityGate`,
  `CapabilityGateRecordPayload`, `CapabilityGateRequest`, `GuaranteeEvaluation`, `AttestationRef`,
  `CapabilityGateScope`, `GateDecision`, `ProviderDomain`, `CapabilityGateFailureReason` exported from the
  `sdk` public entrypoint per `epic0-s4-export-templates/PackageExportConvention` (export + barrel +
  `exports`); proven by `gate-public-import.unit.test.ts` (AC-17).
- Determinism constraints: `evaluateCapabilityGate` is pure and side-effect free — it reads only
  `request`, `replay`, `projections`; `request.evaluatedAt` (a caller-supplied ISO string) is the only
  time source; it never calls `Date.now`/`new Date`/`Math.random`/`crypto.randomUUID`, never reads the
  filesystem/network/a provider, and never writes a projection. The stable failure ordering makes the
  returned `failureReason` deterministic across replays (AC-15).
- Dependency boundaries: `sdk` may import only pure runtime libraries; the evaluator must not import
  `testkit`, any `provider-*`, `cli`, `mcp`, any `RunEventLog`/`RunWriter` runtime module, driver,
  network client, `execa`, or `child_process` (`dependency-rules.md`). It imports the
  `core-02-s1-capability-registry` catalog, the `core-01-s1-event-contracts` value types, and the Epic 2
  `prov-00-s1-capability-attestation/CapabilityAttestation` type (type position) only, never redeclaring
  them. Test files may import the testkit attestation builders (test files are exempt).
- File-size budget (lines per file; default soft cap ~200): split into focused files, each ≤ 200 lines —
  e.g. `types.ts` (`CapabilityGateRequest`/`CapabilityGateRecordPayload`/`GuaranteeEvaluation`/
  `AttestationRef`/`CapabilityGateScope`/`GateDecision`/`ProviderDomain`),
  `failure-reasons.ts` (`CapabilityGateFailureReason`), `attestation-consumption.ts` (the five usability
  checks), `guarantee-predicates.ts` (the five shared predicates + capability-specific required
  attestations), and `evaluate.ts` (the ordered algorithm assembling the payload), with a barrel
  re-export.
- Domain non-negotiables: gate evaluation is a pure predicate over recorded evidence + attestations and
  never trusts self-report; a capability with no fresh positive in-scope replayable attestation is
  absent, never a silent allow; `allow` requires every guarantee to pass; the failure union is a closed
  set so an unknown reason is unrepresentable; the failure ordering is stable for replay determinism;
  this story produces the payload + denial only and never appends the record or returns
  `gate-record-unwritable` (that is `core-02-s3`).

### Forbidden-symbol sweep (runnable recipe)

```sh
grep -REn "execa|child_process|node:net|node:http|node:https|@octokit|net\\.connect|spawn\\(|new WebSocket|RunWriter|RunEventLog|\\.append\\(|\"barrier\"|testkit|provider-(codex|local|github|markdown)|interface CapabilityAttestation|type CapabilityAttestation|type CapabilityId|Date\\.now|new Date\\(|Math\\.random|crypto\\.randomUUID" \
  packages/sdk/src/core/capability/evaluator/
```

- Path root: `packages/sdk/src/core/capability/evaluator/`.
- Forbidden-token set: `execa`, `child_process`, `node:net`, `node:http`, `node:https`, `@octokit`,
  `net.connect`, `spawn(`, `new WebSocket` (process/network leaks); `RunWriter`, `RunEventLog`,
  `.append(`, `"barrier"` (the append-at-barrier behavior owned by `core-02-s3`; the token
  `gate-record-unwritable` is intentionally **not** swept — it is a legitimate member of this story's
  `CapabilityGateFailureReason` union declaration, and non-raising is proven by the absence of the
  append/`barrier`/`RunWriter` machinery); `testkit`, `provider-codex|local|github|markdown` (forbidden package edges);
  `interface/type CapabilityAttestation`, `type CapabilityId` (redeclaring a consumed shape);
  `Date.now`, `new Date(`, `Math.random`, `crypto.randomUUID` (ambient nondeterminism).
- Expected result: zero matches (exit code 1, no lines), captured into the evidence pack, plus the
  `pnpm deps` result proving the dependency-rule edges. A non-empty match means the evaluator leaked a
  process/network dependency, the s3 append behavior, a forbidden package edge, a redeclared consumed
  shape, or ambient nondeterminism, and fails this story.

## Required reading

- `docs/design/30-domain-reference/core/capability-and-safety/gate-evaluation-and-records.md`
  (§Attestation consumption, §Types, §Algorithm — the stable failure ordering).
- `docs/design/30-domain-reference/core/capability-and-safety/capability-registry.md`
  (§Shared guarantees — the five predicates; §Self-report rejection).
- `docs/design/30-domain-reference/core/capability-and-safety/README.md` §5, §6, §8.
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md` (the consumed core-01 value
  types `RunReplay`/`RunProjections`/`RunEventEnvelope`/`RunDegradedHealth`/`EvidenceEventRef`).
- `core-02-s1-capability-registry` story contract (`CapabilityId`, `CapabilityMode`, the posture/
  guarantee-requirement catalog, the three pre-evidence tokens).
- `prov-00-s1-capability-attestation` story contract (the consumed `CapabilityAttestation` payload).
- `docs/design/20-sdk-and-packaging/dependency-rules.md`, `sdk-boundary.md`.
- `epic0-s4-export-templates` story contract (the `PackageExportConvention`).
- `docs/engineering/test-lanes.md` (the hermetic unit/conformance lanes).

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The `packages/sdk` capability gate evaluator — `evaluateCapabilityGate`, the
`CapabilityGateRecordPayload` shape and its supporting types (`CapabilityGateRequest`,
`GuaranteeEvaluation`, `AttestationRef`, `CapabilityGateScope`, `GateDecision`, `ProviderDomain`), and the
full `CapabilityGateFailureReason` union — implemented as a pure fail-closed decision over the
`core-01-s1` value types, the `core-02-s1` registry catalog, and the Epic 2 `CapabilityAttestation`
events, split into focused files, exposed on the `sdk` public entrypoint, plus the evidence pack.

## Evidence pack

- Test name or artifact proving each AC (catalogued in the quality bar).
- Test name or artifact proving each failure/degraded row (the `deny-*.unit.test.ts` suite, one per
  token, each asserting `decision="deny"` + the exact `failureReason`).
- Negative fixture for every denial/rejection: the `*.fixture.ts` files listed in the quality bar (each
  its own failing fixture), plus the type-level negative fixtures
  (`gate-record-bad-schema.fixture.ts`, `attestation-ref-missing-expiry.fixture.ts`,
  `failure-reason-unknown.fixture.ts`).
- `pnpm check` result, unless blocked by a named unrelated repository issue.
- Coverage command, instrumented lane, and number for the evaluator helper scope
  (`packages/sdk/src/core/capability/evaluator/**`), ≥ 90% (aim 95%).
- Public-import test result for every exposed shape, imported through the `sdk` entrypoint
  (`gate-public-import.unit.test.ts`).
- Forbidden-symbol sweep: the exact command above, path root, forbidden-token set, and zero-match output,
  captured; plus the `pnpm deps` result.
- Conformance evidence: if any fixture uses an Epic 2 mock attestation builder, the
  `*.conformance.test.ts` result; otherwise none — this story uses recorded/mock attestation fixtures and
  requires no real process, network, filesystem, driver, or credential.

## Boundaries and STOP conditions

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

## Characterization Review

Architect-recorded review of this contract's load-bearing scope decisions. Each entry records
rationale, the design line it traces to, the falsification criterion, and the escalation path.

### Decision: gate-record-unwritable-declared-not-raised-here

- Rationale: the evaluator owns the denial catalog and payload shape, but only the record writer can
  know an append failed.
- Design trace: `docs/design/30-domain-reference/core/capability-and-safety/gate-evaluation-and-records.md`
  (`gate-record-unwritable` denial reason and append-failure behavior).
- Falsification: `evaluateCapabilityGate` returns `gate-record-unwritable` without an attempted
  durable record append.
- Escalation: if evaluator callers need append-status information, route through `core-02-s3`; do not
  make the pure evaluator perform record I/O.

### Decision: stable-failure-ordering-for-replay-determinism

- Rationale: gate decisions must replay deterministically from the same evidence, so simultaneous
  failures need one stable ordering.
- Design trace: `docs/design/30-domain-reference/core/capability-and-safety/gate-evaluation-and-records.md`
  (evaluation over replay/projections/attestations and stable denial reasons).
- Falsification: equivalent replay inputs produce denial reasons in different orders, or ordering
  depends on object iteration, wall time, or random values.
- Escalation: if two failures have equal priority, record an explicit tie-breaker in this contract
  before implementation.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - stories](./README.md) · **← Prev:** [core-02-s1-capability-registry - capability registry, modes, and v1 posture catalog implementation story](./core-02-s1-capability-registry.md) · **Next →:** [core-02-s3-gate-record-durability - gate record durability implementation story](./core-02-s3-gate-record-durability.md)

<!-- /DOCS-NAV -->
