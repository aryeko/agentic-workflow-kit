# Producer↔Consumer Closure Audit — kit-vnext design corpus

- **Date:** 2026-06-25
- **Scope:** `docs/design/**` only (frozen design corpus). No story/epic/execution-package contracts, no code.
- **Status:** research / findings only. No fixes applied. Remediation is a separate decision.
- **Trigger:** Epic 4 orchestrated delivery blocked twice on the same defect shape (SDK barrel
  ownership, then approval `normalize` producer gap). This audit asks whether that defect class lives
  in the **design** itself, or was introduced by the implementation/execution plan.

## Verdict

The defect class lives in the **design**. The execution plan and the implementer behaved correctly —
they transcribed under-specified seam contracts, and Gate-1 has no closure check to catch them. Epic 4
merely sits on two of the worst-affected seams, so it surfaced first. The same class is latent today in
fnd-04 (Epic 1) and the forge / protected-policy seams (Epic 5).

- **~18 confirmed closure defects**, **2 refuted**, **~8 ambiguous (under-specified mapping)**.
- Concentrated in: approval-and-escalation, credentials-and-secrets (fnd-04), recovery-and-reconciliation,
  completion-and-merge, sdk-and-packaging, and the protected-policy architecture seam.
- **Closure-clean** (verified): capability-and-safety (core-02), observability-and-analysis (core-07),
  run-lifecycle (core-01, except one field), supervision-fold (core-04), fnd-01 config-policy,
  fnd-02 storage, fnd-03 workspace, and most provider ports (work-source and agent ports fully clean).

## The defect class

> **A contract declares a required OUTPUT (a required field on a produced record/event, or a required
> public symbol) that has no producer reachable from the declared INPUTS.**

Every finding reduces to one of four root patterns. The fix is per-pattern, not per-field.

| Pattern | Description | Canonical fix |
|---|---|---|
| **P1 — No injected clock** | A producer must stamp `at`/`requestedAt`/`recordedAt`/`classifiedAt` but its signature takes no time input. Violates the corpus convention (fnd-01 injects `occurredAt`, "never reads ambient time"; core-04 injects `clock`). | Thread an explicit timestamp into the producing input, as `decide`/`recordOutcome` already do. |
| **P2 — Ref/identity assumed at a seam** | A `*Ref`, a minted id, or run/task identity assumed present when crossing a boundary, with no producer wired to supply it. | Name the producing step (persistence → ref) or add the field to the crossing context; state the minting rule (deterministic for replay). |
| **P3 — Producer input not threaded** | The source data exists in a sibling domain but is never passed into the function that must emit it. | Pass the source domain's data into the signature; demote runtime-only fields out of config-sourced types. |
| **P4 — Two sources / shapeless type** | Canonical SDK catalog and domain doc disagree, or a type is referenced but never defined. | One source of truth (provider-ports.md is canonical); define the missing payload interfaces using the supervision `*Payload` convention. |

## Confirmed findings

Severity is impact if shipped; confidence reflects how many independent reviewers verified it
(✓✓ = re-verified by ≥2 agents).

| # | Pattern | Location | Missing / mismatched | Sev | Conf |
|---|---|---|---|---|---|
| 1 | P1 | approval `normalize` → `ApprovalRequest.requestedAt` (decision-model.md:40; consumed README.md:147) | timestamp; only envelope `AgentEvent.at` has it, never passed in | High | ✓✓ |
| 2 | P2 | approval `normalize` → `ApprovalRequest.promptRef` (decision-model.md:33) | a *ref*; input has raw `prompt`; no prompt-persistence step exists anywhere | High | ✓✓ |
| 3 | P1 | approval `classify`/request/pending/park `*At` (iet.md:145,122,136,163) | no clock input on these producers | Med | ✓ |
| 4 | P2 | approval `ApprovalEscalation` interface (iet.md:12-19) | **no producer method** for `ApprovalRequested`, `ApprovalPendingPersisted`, `ApprovalParked` | Med | ✓ |
| 5 | P3+P1 | fnd-04 `redact(value, redactionSet)` → `RedactionApplied extends AuditBase` (C&E:95,115,102-109) | entire run/task/operation/party/phase identity + `at` | High | ✓✓ |
| 6 | P3 | fnd-04 `issueEgressPolicy(refs, scope)` → `EgressPolicy.rules/negativeProbes/requiredAttesters` (C&E:38-52,97) | fnd-01 `EgressPolicySource` never threaded in | High | ✓✓ |
| 7 | P3 | fnd-04 `RequiredAttester.platform/driverVersion` (C&E:48-51 vs fnd-01 schema:129-133) | runtime Host-driver facts mis-sourced to config | High | ✓✓ |
| 8 | P2+P1 | fnd-04 `resolveCredential(ref, scope)` → `CredentialUseStarted.attestationEventIds/evidenceRefs/at` (C&E:93,105,108,111; README:171 shows them passed) | attestation refs undeclared in signature | High | ✓✓ |
| 9 | P1 | fnd-04 every audit `.at` (C&E:108, all methods) | no clock channel anywhere in fnd-04 | High | ✓✓ |
| 10 | P4/P2 | protected-policy-gate.md:50-58 ↔ approval `ApprovalDecisionRecordedPayload` (iet.md:148-154) | `candidateHeadSha`, `newPolicyDigest`, snapshot ref (old digest + paths belong on core-05; arch doc mis-attributes) | High | ✓✓ |
| 11 | P4 | `ForgeRuleset.requiredStatusChecks` — provider-ports.md:665 (canonical, absent) vs forge contracts:177 + core-05 consumer evidence-model:149 | field missing from canonical SDK type | High | ✓✓ |
| 12 | P2 | sdk-and-packaging (whole section) | public entrypoint/barrel `index.ts` has **no declared owner** (design-level root of Epic-4 issue 1) | High | ✓✓ |
| 13 | P4 | recovery `record(input: RecoveryRecordInput, …)` (README.md:141) | `RecoveryRecordInput` **defined nowhere** | High | ✓ |
| 14 | P2 | recovery `plan(…) → RecoveryPlan.planId` (README.md:151) | no input carries/mints it; no replay-safe minting rule | Med | ✓ |
| 15 | P4 | completion `CompletionDecisionPayload`/`MergeDecisionPayload` (README.md:156,159) | return types **named but never defined** | Med | ✓ |
| 16 | P4 | recovery 8 barrier events (README.md:176-177) | one shared prose field-list, no per-event `*Payload` | Med | ✓ |
| 17 | P4 | edge consumes `ReconciliationBlocked` (AET:35-37) ↔ core-06 (README.md:175) | event named, no payload shape (no `summary`/`severity`/evidence-ref) | Med | ✓ |
| 18 | P2 | core-01 `RunCreatedPayload.requestedBy` (contracts.md:76) vs `CreateRunInput` (26-29) | required, no `holder→requestedBy` mapping; lineage prose (README:150-152) omits it | Med | ✓ |
| 19 | P4 | recovery `completion.latestDecisionState`/`postMergeOutcome` typed bare `string` (recovery-model.md:39) vs core-05 enums | loose type; rule 8 (recovery-model.md:69-71) branches on exact strings; missing `latestMergeState` slot | Med | ✓ |

## Refuted (verified NOT defects)

- **Host `CapabilityAttestation.egressPolicyDigest`** — not stranded. Reachable as
  `attestation.details.egressPolicyDigest`; the canonical envelope is generic-by-design
  (`details?: Record<string, unknown>`) and the host seam narrows `details` to `HostAttestationDetails`.
  Explicitly reconciled in the Epic-2 story-dag (story-dag.md:236-239) and prov-04-s1. At most a cosmetic
  doc-presentation note worth one clarifying line in the host-domain doc.
- **Supervision `SupervisorTerminationRequested.workerHandleId`** — not a gap. The event only fires on the
  branch where an owned worker is present; the handle-less timeout path routes to
  `supervision-lost`/`termination-unavailable` and never emits the event (README.md:309-314). The guard
  closes it.

## Ambiguous (source exists, mapping/derivation unstated — not structural impossibilities)

- approval `subject` ← `kind` (no enum map; `protected-policy-change` has no `kind` antecedent),
  `answerChannelPersistable`/`answerChannelRef` (reachable via nested channel object, assignment unwritten).
- fnd-04 `InjectionBinding.mode`/`nameOrPath`; `CredentialUsePlanned.reason` (success path).
- fnd-03 `finalizeLease` → `WorktreeLeaseFinalized.headSha` (readback projection undeclared at boundary).
- fnd-02 `ArtifactInput` referenced but never defined.
- `CapabilityGateRecord` (consumed by recovery README:122,161) vs producer type name
  `CapabilityGateRecordPayload` (gate-evaluation-and-records.md:108) — name drift.

## Recommended shapes (by pattern)

### P1 — inject time, never read it

```ts
// approval: carry envelope time on the context that already crosses the boundary.
interface ApprovalContext {                 // +2 fields
  runId; taskId; operationId; sessionId; policyRef; agentRequestEventId;
  requestedAt: string;   // = approval-requested AgentEvent envelope .at
  promptRef: string;     // minted by an upstream prompt-persistence step (see P2)
}
classify(request, policy, replay, projections, classifiedAt: string): ApprovalRisk;

// fnd-04: one shared audit context on all five methods, instead of touching each.
interface CredentialAuditContext {
  scope: CredentialScope;          // runId/taskId/operationId/party/phase
  attestationEventIds: string[];   // from the matching fresh CapabilityAttestation
  evidenceRefs: string[];
  occurredAt: string;              // injected
}
// AuditBase then becomes a pure projection of ctx + fnd-04-computed digests + writer hash-chain.
```

Keeps `normalize`/`redact` pure total functions and leaves the **frozen Agent port untouched**
(the value rides context, not `AgentApprovalRequest`).

### P2 — name the producing step

- `promptRef` needs a documented prompt→`ArtifactRef` persistence step (mirroring
  `AgentOutputSink.putToolOutput → outputRef`). This adds an **fnd-02 dependency to core-03 that the
  design does not currently list**.
- Add the missing approval append-side producer methods (`park`, and the request/pending emitters) to
  `ApprovalEscalation` so every emitted event has a declared producer.
- `RecoveryPlan.planId` and `RunCreatedPayload.requestedBy` need either an input field or an explicit
  "minted by producer" rule. For `planId`, mint as a deterministic content hash so replay stays stable.
- The **barrel** needs an owning producer — a dedicated export-aggregation owner, or a stated rule that
  each domain owns its slice of `index.ts`. (Epic-4 #150 forced the latter, badly, by serializing all 8
  stories on the one file.)

### P3 — thread the input in

- `issueEgressPolicy` must receive fnd-01's `EgressPolicySource` (rules/probes/attesters), not just
  `refs+scope`.
- Drop `platform`/`driverVersion` from the config-sourced `RequiredAttester`; match them at release time
  against the Host `CapabilityAttestation` (the prose at fnd-04 README:133-135 already describes the match —
  encode it, don't duplicate it as a config field).
- `redact`/`resolveCredential` receive run/task identity + attestation refs via `CredentialAuditContext`.

### P4 — one source of truth

- Add `requiredStatusChecks: string[]` to the canonical `ForgeRuleset` (provider-ports.md).
- Define the missing payload interfaces using the supervision `*Payload` convention (named interface +
  `schema: "kit-vnext.<event>.v1"` per event): `CompletionDecisionPayload`, `MergeDecisionPayload`, the
  8 recovery event payloads, `ReconciliationBlockedPayload`, and `RecoveryRecordInput`.
- Import the core-05 enums into recovery's snapshot (`CompletionDecisionState`, `PostMergeOutcomeState`,
  plus a `latestMergeState?: MergeDecisionState` slot rule 8 needs).
- Protected-policy: add a slim binding block to core-03's approval event (`runId`, `candidateHeadSha`,
  `protectedPolicySnapshotEventId`, `newPolicyDigest?`) and **correct the architecture doc** to reference
  rather than duplicate the old-digest/changed-paths (authoritative on core-05's
  `ProtectedPolicySnapshotRecorded` + `LocalGitEvidence`).

## Process finding (root cause behind the root cause)

The story-contract template has a **Predicate-input matrix** intended to catch exactly this, but it is
pointed at *decision predicates consumed*, not *construction obligations produced*. It treats produced
records (e.g. a normalized `ApprovalRequest`) as given inputs rather than checking that each required
output field has a source. **Recommendation:** add a **closure/construction check** to design review and
Gate-1 — for every produced record/event and every required public symbol, assert a declared source in
the inputs or owned pathset. This is the single change that would have caught all 18 before delivery.

## Method & caveats

- Two waves of read-only domain reviewers (opus, high effort) over the full corpus, then a verification
  wave that chased cross-references before confirming, and refuted 2 candidates.
- `✓✓` findings are re-verified by ≥2 independent agents and are the most reliable. `✓` findings are
  single-agent-confirmed with cross-reference chasing; still subject to a final human read before they
  drive edits.
- "Named but shapeless" findings (#15–#17) were specifically checked for "defined elsewhere" pointers and
  confirmed genuinely undefined (the supervision domain establishes the per-event `*Payload` convention
  they violate).

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../README.md) · **← Prev:** [Closure-Defect Remediation — Durable Execution Plan](./2026-06-25-closure-remediation-plan.md) · **Next →:** [roadmap](../roadmap.md)

<!-- /DOCS-NAV -->
