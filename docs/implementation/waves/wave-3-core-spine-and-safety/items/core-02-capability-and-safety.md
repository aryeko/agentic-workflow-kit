---
title: "core-02 — Capability & Safety — implementation charter"
id: "core-02"
wave: 3
layer: "core (control plane)"
status: "item: ready"
spec: "docs/design/domains/core/core-02-capability-and-safety/ (README.md + capability-registry.md + gate-evaluation-and-records.md)"
---

# core-02 — Capability & Safety

**Purpose.** The "earn autonomy" gate: the registry of autonomous capabilities and the pure
`evaluateCapabilityGate` predicate that unlocks each one only when its guarantees hold against recorded
evidence and **capability attestations** (probed, fresh, in-scope, positive — never self-report), writing
a `CapabilityGateRecord` per evaluation. (FR-7, NFR-SAFE, NFR-DET; AD-14.)

**Spec (normative).** Implement `docs/design/domains/core/core-02-capability-and-safety/` (`README.md` +
`capability-registry.md` + `gate-evaluation-and-records.md`). The capability registry + per-capability
guarantee predicates, the attestation-consumption rules, the stable failure-reason ordering, and the
`CapabilityGateRecordPayload` shape are normative. Ambiguous or under-specified → **STOP and surface** to
the architect; do not invent.

## Spec surface (manifest)

What the normative spec defines and the implementation must expose/consume, by name:

- **Types (`gate-evaluation-and-records.md`):** `CapabilityMode` (`"manual" | "assisted"`), `GateDecision`
  (`"allow" | "deny"`), `CapabilityGateFailureReason` (the 14-member union below), `ProviderDomain`
  (`"Agent" | "Forge" | "Work Source" | "Execution Host"`), `CapabilityGateScope`, `AttestationRef`,
  `GuaranteeEvaluation`, `CapabilityGateRequest`, `CapabilityGateRecordPayload`.
- **Capability registry (`capability-registry.md`):** `CapabilityId` =
  `auto-merge | auto-recover | unattended-run | escalation-auto-grant | orchestrator-decide`; each
  capability's guarantee predicate (shared guarantees 1–5 plus the per-capability guarantees in the
  registry table); the `process-group`-or-stronger containment floor.
- **Function:** `evaluateCapabilityGate(request: CapabilityGateRequest, replay: RunReplay,
  projections: RunProjections): CapabilityGateRecordPayload` (pure).
- **Event / append intent:** `CapabilityGateRecord` — `domain = "core-02"`, **`barrier`** durability;
  payload is `CapabilityGateRecordPayload` with `schema: "kit-vnext.capability-gate-record.v1"`.
- **Failure & degraded outcomes:** the 14 tokens of `CapabilityGateFailureReason` — detailed in the table.

(Done requires every item here present, with the spec's names, shapes, and semantics.)

## Responsibilities (in scope)

- The capability registry + each capability's **guarantee predicate** (shared 1–5 plus per-capability),
  including the `process-group`-or-stronger containment floor for `unattended-run` and kill-dependent
  `auto-recover`.
- `evaluateCapabilityGate` as a **pure** function of `CapabilityGateRequest` + core-01 `RunReplay` +
  `RunProjections`, selecting fresh, in-scope, positive, non-contradictory, replayable attestations from
  the recorded event log.
- Producing the `CapabilityGateRecordPayload` (allow/deny + `evaluatedGuarantees` + `attestationRefs` +
  `failureReason`) for append as a `barrier` `CapabilityGateRecord`.
- The mode rules (`manual` denies autonomous powers; `assisted` may allow only deterministic
  policy-enabled capabilities whose guarantees hold) and the default-off posture.
- Latest-gate **read models as pure projections** over recorded gate records (never writing projection
  state).

## Out of scope

Approval adjudication (core-03); merge mechanics (core-05); recovery action selection (core-06);
supervision/liveness (core-04); Work Source status policy and provider probing (drivers/contracts); the
policy *schema* that resolves `policyRef` (fnd-01 owns it — core-02 consumes a resolved `policyRef`
string); appending the record / choosing the lifecycle consequence (the caller does this via core-01
legal transitions). core-02 supplies the deny reason and the payload; it never calls or imports a concrete
Driver.

## Requirements owned

FR-7 (gating of irreversible actions), NFR-SAFE (fail-closed autonomy), NFR-DET (pure recorded-evidence
decisions); NFR-TEST (mock-only control-plane tests); **plus full core-02 design-spec compliance.**

## Dependencies & frozen contracts

Depends on **core-01** for the Event log read primitives and event facts it evaluates; consumes a resolved
**`policyRef`** string (owned by fnd-01, schema not defined here). Depended on by core-03/04/05/06 (they
call the gate and act only after citing a committed record). Must **NOT** depend on edge, drivers,
composition-root, a concrete driver, or `@kit-vnext/conformance-kit` (test-support) — Dependency Rule,
enforced by the `core-must-not-import-edge-or-driver` depcruise rule.

**Attestation layering (resolved — R5).** core-02 does **not** import the `CapabilityAttestation` *type*
from `@kit-vnext/conformance-kit` (that is the Test-support layer; a control-plane import of it violates
the Dependency Rule). Instead, exactly as core-07 states ("provider seam evidence are consumed as data
from the core-01 log, not as code dependencies", core-07 `README.md`), core-02 reads committed
`CapabilityAttestation` **event payloads as recorded DATA** from the core-01 `RunReplay`/log and
references each via the spec's `AttestationRef` (defined in `gate-evaluation-and-records.md`), consumed
from recorded data rather than imported from the kit:

```ts
interface AttestationRef {
  eventId: string; provider: ProviderDomain; capability: string;
  evidenceRef: string; freshnessKey: string; scope: string; expiry: string;
}
```

Cross-item shapes consumed (named, per R5 — never "the fields core-01 supplies"):

- **`RunReplay`** = `{ runId; events: RunEventEnvelope[]; lastSequence: number; writerEpoch?: number;
  health: RunDegradedHealth; healthRecords: RunLogHealthRecord[] }` (core-01 `contracts.md`).
- **`RunProjections`** = `{ state: RunStateProjection; summary; metrics; launch: RunLaunchProjection }`;
  `state.degradedHealth: RunDegradedHealth` and `launch.linkage: "known" | "unknown" | "ambiguous"` are
  the health/linkage inputs to the gate (core-01 `contracts.md`).
- **`RunDegradedHealth`** = `"ok" | "tail-repaired" | "interior-corrupt" | "event-log-unavailable"`
  (anything other than a usable health → `run-log-degraded`).
- The `CapabilityGateRecordPayload` is handed to the caller for append via the core-01 `RunWriter`;
  core-02 does not call `append` itself.

## Libraries

`zod` (payload/request schema validation, JSON-Schema-representable per dependency-policy.md schema
ownership), `fast-check` + `@fast-check/vitest` (determinism / replay-equivalence / fail-closed property
cases). **No SDKs; no `@kit-vnext/conformance-kit`; no concrete driver.**

## Acceptance criteria (the shared rubric)

Each AC is a single assertion that is true or false against a test.

- **AC-1 (pure, injected time)** `evaluateCapabilityGate(request, replay, projections)` is a pure function:
  same `(request, replay, projections)` → byte-identical `CapabilityGateRecordPayload`; it reads no
  `Date.now`/`new Date()`/`Math.random`/filesystem/provider, and uses only `request.evaluatedAt` for time.
  — test: determinism property (fast-check) + a grep/lint asserting no ambient time/randomness. *trace:
  gate-evaluation-and-records.md "pure function … never … reads live time"; NFR-DET; README §4.*
- **AC-2 (replay equivalence)** Two replays producing the same recorded facts yield identical
  `evaluatedGuarantees`, `attestationRefs`, and `failureReason`. — test: replay-equivalence property over
  generated event logs. *trace: README §9 "replay property tests for identical CapabilityGateRecord
  payloads"; NFR-DET.*
- **AC-3 (manual denies autonomy)** With `mode: "manual"`, every `CapabilityId` returns `deny` with
  `failureReason: "mode-disallows-capability"`. — test: table test over all five capabilities. *trace:
  capability-registry.md shared guarantee 1; README §4.*
- **AC-4 (orchestrator-decide deferred)** `orchestrator-decide` returns `deny` with
  `"capability-deferred"` in **both** modes, **before** any provider-evidence selection. — test: assert
  deny + reason + that no attestation lookup occurred. *trace: capability-registry.md registry row;
  README §4; AD-14.*
- **AC-5 (policy gate)** When `policyRef` does not permit the capability for the scope, the gate returns
  `deny` with `"policy-disallows-capability"` (checked before provider evidence). — test: per-capability
  policy-denies case. *trace: gate-evaluation-and-records.md algorithm step 2; shared guarantee 2.*
- **AC-6 (run-log-degraded fails closed)** When `replay.health`/`projections.state.degradedHealth` is not
  usable, projections are missing, writer fencing failed, or required session `launch.linkage` is
  `"ambiguous"`, every autonomous capability returns `deny` with `"run-log-degraded"`. — test: each
  degraded-health value + missing projection + ambiguous linkage. *trace: README §6; algorithm step 1.*
- **AC-7 (evidence absent/ambiguous)** Missing required recorded evidence → `"required-evidence-absent"`;
  evidence that is recorded but ambiguous → `"required-evidence-ambiguous"`. — test: one case each per a
  capability that requires evidence (`auto-merge` completion/verification evidence). *trace: shared
  guarantee 4; README §8.*
- **AC-8 (attestation freshness + scope, injected clock)** An attestation is usable only when
  `at <= request.evaluatedAt < expiry` **and** its `scope` exactly matches the gate scope (or a
  contract-approved parent — comparing provider domain, driver id/version, platform,
  repo/workspace/session-or-PR-head, egress-policy digest when relevant, and freshness key). A stale
  attestation → `deny` `"attestation-stale"`; a scope mismatch → `deny` `"attestation-out-of-scope"`. —
  test: at/just-before/just-after expiry + future-dated using `evaluatedAt` as the only clock; one case per
  scope dimension. *trace: gate-evaluation-and-records.md attestation rules 2–3; `CapabilityGateScope`.*
- **AC-9 (attestation absent/negative/contradictory)** A required attestation with no committed event →
  `deny` `"attestation-absent"` (capability treated as absent, never a silent allow); a fresh in-scope
  `result: "negative"` → `deny` `"attestation-negative"`; conflicting fresh in-scope results for the same
  provider capability → `deny` `"attestation-contradictory"`. — test: omit, negative (`auto-recover`
  `canKill`), and contradictory-pair cases. *trace: gate-evaluation rules 1, 4; README §4 default-off, §8.*
- **AC-10 (non-replayable + self-report rejected)** An attestation whose `evidenceRef` does not resolve to
  recorded probe output / an artifact digest → `deny` `"attestation-non-replayable"` (schema-only evidence
  proves shape but never liveness/persistence/parentage/kill/egress/write-side behavior); a guarantee
  supported only by worker/Agent/Guardian prose, a driver feature list, or a schema-only behavioral claim
  → `deny` `"self-report-only"`. — test: unresolvable `evidenceRef`; schema-only behavioral claim;
  self-report-only support. *trace: gate-evaluation rule 5; capability-registry.md "Self-report rejection".*
- **AC-11 (per-capability guarantees)** Each non-deferred capability enforces its registry-table
  guarantees, returning the matching deny when any is unmet: `auto-merge` (recorded completion/verification
  evidence; exact-head unambiguous Forge evidence; `canInspectProtection` + `supportsRulesets` fresh
  positive; `supportsMergeQueue` when policy requires queue; `supportsStatusWrite` when marking the Task
  complete); `auto-recover` (non-terminal/approved-edge lifecycle; known ownership/linkage; `canKill` +
  acceptable `containmentStrength`; Agent `preservesHostProcessParentage` when worker activity is
  involved); `unattended-run` (`supportsClaim`; `canKill` + `containmentStrength` + `egress-confinement`;
  Agent linkage + `preservesHostProcessParentage`; relay limitations recorded so missing relay parks);
  `escalation-auto-grant` (policy permits the exact kind/scope; grant no broader than request;
  `canRelayApproval`; `canPersistApprovalAnswerChannel` when surviving park/resume; `egress-confinement`
  for network grants; no LLM/worker prose chooses the answer). — test: per-capability table toggling each
  required guarantee pass→fail. *trace: capability-registry.md registry table.*
- **AC-12 (containment floor)** A `containmentStrength` weaker than `process-group` (or unknown/stale/
  absent) denies the dependent capability; `process-group` / `kernel-tree` / `job-object` satisfy the
  floor; a stricter policy floor is honored. — test: each strength value + a policy that raises the floor.
  *trace: capability-registry.md containment floor; README §4.*
- **AC-13 (allow only when every guarantee passes)** `decision: "allow"` is returned **only** when every
  required guarantee for the capability passes; `evaluatedGuarantees` lists each guarantee with `passed`,
  its `attestationRefs`, and `evidenceRefs`. — test: fully-satisfied happy path per non-deferred
  capability + a one-guarantee-short variant flips to `deny`. *trace: gate-evaluation algorithm step 6.*
- **AC-14 (stable failure ordering)** When multiple guarantees fail, the returned `failureReason` is the
  first in the spec's predicate order (run-log → mode/policy/deferred → evidence → attestation classes →
  self-report). — test: a request failing several reasons returns the earliest stable reason. *trace:
  gate-evaluation algorithm step 6 "first stable failure reason in predicate order".*
- **AC-15 (barrier record payload)** Every evaluation yields a `CapabilityGateRecordPayload` with
  `schema: "kit-vnext.capability-gate-record.v1"` and all required fields, constructed as a
  `CapabilityGateRecord` append intent with `domain = "core-02"` + `barrier` durability. — test:
  schema-validate the payload (allow + deny); assert the append intent carries `barrier`. *trace:
  gate-evaluation §Types + §record; README §6.*
- **AC-16 (gate-record-unwritable → caller must not act)** An `allow` is usable only after the record is
  committed: core-02 supplies the `"gate-record-unwritable"` reason and the caller-side rule "if append
  fails, deny and do not perform the action". — test: a stubbed append failure forces a
  `gate-record-unwritable` deny and asserts no autonomous action is signalled. *trace: gate-evaluation
  §record; README §4/§8.*
- **AC-17 (Dependency Rule + no test-support import)** dependency-cruiser confirms `@kit-vnext/core-02`
  imports only foundation + core-01 (+ test-only in tests); no edge/driver/composition-root import and **no
  `@kit-vnext/conformance-kit`** import; attestation payloads are consumed as data, not via a kit/contracts
  package dependency. — test: depcruise lane (`core-must-not-import-edge-or-driver`) + a grep asserting no
  `conformance-kit` import in `src/`. *trace: architecture.md §2; package-map.md; dependency-policy.md.*

## Failure & degraded outcomes (first-class)

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `mode-disallows-capability` | `mode: "manual"` for an autonomous capability | deny (before provider evidence) | AC-3 |
| `policy-disallows-capability` | resolved `policyRef` does not permit the capability for the scope | deny (before provider evidence) | AC-5 |
| `capability-deferred` | capability is `orchestrator-decide` (AD-14) | deny in both modes, before evidence selection | AC-4 |
| `run-log-degraded` | replay/projection health unusable, projection missing, writer fenced, or required linkage ambiguous | deny all autonomous capabilities | AC-6 |
| `required-evidence-absent` | required recorded evidence missing | deny | AC-7 |
| `required-evidence-ambiguous` | required evidence recorded but ambiguous | deny | AC-7 |
| `attestation-absent` | no attestation for the requested provider+capability | deny; capability treated as absent | AC-9 |
| `attestation-stale` | not `at <= evaluatedAt < expiry` (expired or future-dated) | deny | AC-8 |
| `attestation-negative` | fresh in-scope `result: "negative"` | deny | AC-9 |
| `attestation-out-of-scope` | attestation `scope` ≠ gate scope / approved parent | deny | AC-8 |
| `attestation-contradictory` | conflicting fresh in-scope attestations for the same capability | deny | AC-9 |
| `attestation-non-replayable` | `evidenceRef` unresolvable, or schema-only proof of a behavioral guarantee | deny | AC-10 |
| `self-report-only` | only worker/Agent/Guardian prose, driver feature list, or schema-only claim supports the guarantee | deny | AC-10 |
| `gate-record-unwritable` | the `CapabilityGateRecord` cannot be appended at `barrier` durability | caller must not act; deny | AC-16 |

## Quality bar

- Coverage ≥ 90% lines/branches (aim 95%), enforced for this package by
  `vitest run --coverage --coverage.thresholds.lines=90 --coverage.thresholds.branches=90` (paste the
  number in the evidence pack). The verify gate does not enforce a threshold today — see the wave charter.
- Required tests (catalogue, not examples):
  - **Per capability × per mode** table tests over all five `CapabilityId` values in `manual` + `assisted`
    (AC-3, AC-13); `orchestrator-decide` denies in both modes before evidence selection (AC-4).
  - **Each guarantee predicate per capability** toggled pass→fail (AC-11): the `auto-merge`
    exact-head/ruleset/merge-queue/status-write set, `auto-recover` kill/containment/parentage set,
    `unattended-run` claim/launch/relay set, `escalation-auto-grant` grant-scope/relay/persist/egress set;
    plus the containment-floor value sweep (AC-12).
  - **Attestation** with the injected `evaluatedAt`: at/just-before/just-after expiry + future-dated and
    each scope dimension (AC-8); absent, negative, contradictory (AC-9); unresolvable `evidenceRef`,
    schema-only behavioral claim, self-report-only (AC-10).
  - **Fail-closed on every failure-reason token** in the table (one triggering test each), including
    `run-log-degraded` for every `RunDegradedHealth` value + missing projection + ambiguous linkage (AC-6),
    evidence absent/ambiguous (AC-7), and `gate-record-unwritable` via a stubbed append failure that
    asserts no autonomous action is signalled (AC-16).
  - **Determinism / purity** property (fast-check): identical inputs → identical payload (AC-1); replay
    equivalence over generated logs (AC-2); stable failure ordering when several reasons apply (AC-14).
  - **Schema** probe of `CapabilityGateRecordPayload` (allow + deny) incl. the `schema` literal + `barrier`
    durability (AC-15); **depcruise** lane + no-`conformance-kit`-import grep (AC-17).
- File ≤ 800 lines; clock + id injected (no ambient `Date.now`/`new Date()`/`Math.random`/`crypto.randomUUID`);
  decisions immutable (return new payloads, never mutate `request`/`replay`/`projections`); no SDK; no
  `@kit-vnext/conformance-kit`; no concrete driver import.

## Required reading

This item's spec (`README.md` + `capability-registry.md` + `gate-evaluation-and-records.md`);
`architecture.md` §2 (Dependency Rule) + §3 (capability-attestation model); `decisions.md` AD-14 (cite
AD-12 party separation and AD-13 no-locality where they shape consumed attestations); `requirements.md`
FR-7 / NFR-SAFE / NFR-DET / NFR-TEST; `package-map.md`; `dependency-policy.md` (determinism ports, schema
ownership, layer placement); `testing-policy.md` (property-test requirement + coverage bar); core-01
`contracts.md` + `event-log-writer-and-corruption.md` + `projections-lifecycle-and-tests.md`
(`RunReplay` / `RunProjections` / `RunWriter` / `RunEventLog` / events); the provider specs' capability
**names** (Agent/Forge/Work Source/Execution Host) for the per-capability guarantees; core-07 README
(the "consumed as data, not as code dependencies" precedent). Nothing else.

## Deliverable

The `@kit-vnext/core-02` package (`packages/core-02`) exposing: the `CapabilityId` registry + per-capability
guarantee predicates; the gate types (`CapabilityMode`, `GateDecision`, `CapabilityGateFailureReason`,
`ProviderDomain`, `CapabilityGateScope`, `AttestationRef`, `GuaranteeEvaluation`, `CapabilityGateRequest`,
`CapabilityGateRecordPayload`); the pure `evaluateCapabilityGate`; the `CapabilityGateRecord` append-intent
constructor (`domain = "core-02"`, `barrier`); and latest-gate read-model projections over recorded gate
records. Plus the **evidence pack**: a test named per AC and per failure-outcome row; `pnpm check` output +
the coverage number; the depcruise output + the no-`conformance-kit`-import grep result.

## Boundaries

Stay in `packages/core-02`; depend only on foundation + core-01; consume attestation/evidence **event
payloads as recorded data** (never import the `conformance-kit` attestation type or any concrete driver);
never call a provider, read live time, read the filesystem, or write a projection. **STOP and surface** (do
not edit another package or guess) when: a required attestation field/scope dimension is undefined in
core-01's recorded payload; the provider capability *name* a guarantee needs is absent from the cited
provider spec; the resolved `policyRef` semantics needed to decide `policy-disallows-capability` are not
expressible from a string ref; or a guarantee in the registry requires evidence that core-01 does not
record.

## Open questions (non-blocking)

- **Q1 (spec open question, non-blocking).** Whether `auto-pr` should be a separate capability from
  `auto-merge` (README §10 / mandate). v1 treats PR creation/update as a completion-domain gate and
  reserves `auto-merge` for the irreversible merge boundary; implement the v1 registry as written
  (`auto-merge` only). No code branch — record and proceed.
- **Q2 (confirm at dispatch).** `policyRef` is an opaque resolved-policy **string** (fnd-01 owns the
  schema; README §10). Confirm core-02 evaluates `policy-disallows-capability` from a resolved policy
  decision surfaced via the request, not by parsing a policy document — the design assumes a resolved
  ref and does not define the schema.
- **Q3 (confirm at dispatch).** The exact `RunWriter.append` durability literal for `barrier` and the
  `CapabilityGateRecord` event-type registration live in core-01; core-02 produces the payload and the
  append intent but does not call `append`. Confirm the core-01 append-intent shape that carries the
  `barrier` durability tag.
