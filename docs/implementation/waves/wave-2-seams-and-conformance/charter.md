---
title: "Wave 2 — Seam Contracts, Mocks & Conformance"
wave: 2
status: "wave: needs-spec-reconciliation"
depends-on-waves: [0, 1]
delivers-as: "single PR into v-next"
last-updated: 2026-06-19
---

# Wave 2 — Seam Contracts, Mocks & Conformance  (keystone)

**Goal.** Define the four provider seam contracts as **pure TypeScript + zod payload schemas +
capability-attestation types**, ship an in-memory **mock** with adversarial cases for each, and build
the shared **conformance kit** — so the *entire core can be built and tested against mocks with zero
real processes or network*. After this wave, no core wave ever touches a real SDK.

**Frozen inputs.** Foundation packages (W1); the package map + `dependency-policy.md` +
`testing-policy.md` + dependency-cruiser rules (W0); `fnd-02`'s `ArtifactRef` type (the evidence-ref
the conformance kit and host capture re-use).

> **Authored against** [`../../wave-authoring-guide.md`](../../wave-authoring-guide.md). Each item
> charter carries an enumerated **AC list**, a **spec-surface manifest**, and a **failure-outcome
> table**; the implementer and the independent reviewer grade against that one rubric.

## Work items (one commit each; the coordinator plans agent delegation)

Order: the kit + shared types first; then the Execution Host contract (the Agent contract references
it); then the other three in parallel.

- [w2-1 — Conformance kit & shared contract types](./items/w2-1-conformance-kit-and-shared-types.md) —
  the `CapabilityAttestation` model, the cross-cutting attestation tokens, and the harness every driver
  plugs into. **Produces** the shared attestation shape every seam cites.
- [prov-04 — Execution Host contract + mock](./items/prov-04-execution-host-contract.md) — host-neutral
  spawn/contain/terminate/verify contract + mock. **Produces** `WorkerHandle` (consumed by prov-01).
- [prov-01 — Agent contract + mock](./items/prov-01-agent-contract.md) — model protocol, approval
  relay, structured tool-exit, progress events + mock. **Consumes** prov-04's `WorkerHandle`.
- [prov-02 — Forge contract + mock](./items/prov-02-forge-contract.md) — PR/CI/review/merge evidence +
  actions + mock (evidence DTOs, no octokit).
- [prov-03 — Work Source contract + mock](./items/prov-03-work-source-contract.md) — task/track
  inventory, claim/release, status authority + mock.

## Scope & boundaries

- *In:* the four seam **contracts** (interfaces + zod payloads + attestation types), their **mocks**,
  and the **conformance kit**.
- *Out:* **real drivers** (Codex/GitHub/Local/Markdown — the driver track) and any boundary SDK
  (octokit/execa/native helper).
- Dependency Rule: activate `contracts ↛ {core,edge,driver}` and `mock-driver ↛ {core,edge}`;
  contracts MAY depend on foundation and on sibling contracts (prov-01 → prov-04). **Zero SDKs.**

## Integration

The four contracts + mocks all pass the conformance kit; the `conformance-mock` lane is now
**non-empty and green** (drop `--passWithNoTests` for it). The kit's real-smoke slots exist but stay
empty until the driver track. A core-facing barrel exposes only contract types — no mock leakage.

## Cross-cutting reconciliation (R5 — pinned once here)

- **`CapabilityAttestation`** — w2-1 owns the canonical shape (the 10 fields from `architecture.md` §3
  plus an optional `details?` extension carrying `containmentStrength` / `negativeProbeResults` /
  `egressPolicyDigest`). Every seam cites it; no seam redefines it.
- **Cross-cutting attestation tokens** — `attestation-stale`, `attestation-absent`,
  `attestation-negative`, `evidence-missing` are owned by w2-1. **Each seam's own failure tokens are
  owned by that seam** (the spec defines them per-domain in its §8; w2-1 does not own a single union).
- **`WorkerHandle`** — defined in prov-04 (`contracts-and-conformance.md`); prov-01 cites it verbatim
  as `AgentStartRequest.hostWorker: WorkerHandle`. The *equality* invariant (`WorkerHandle.operationId`
  ↔ `AgentStartRequest.operationId`; `WorkerHandle.handleId` ↔ `AgentSession.hostWorkerHandleId`) is a
  **core obligation**, surfaced to the core waves — not enforced inside the contract.
- **`ArtifactRef`** — owned by `fnd-02` (W1); the kit and prov-04 capture cite it, not a new type.

## Spec reconciliation required before dispatch (blocking)

Applying the authoring guide surfaced contract types that are **used in the specs but never defined**.
An AC cannot trace to an undefined type (R4), so these must be defined in the design corpus **before**
the affected items dispatch:

- **prov-01:** `AgentResumeRequest`, `ApprovalAnswerResult`, `AgentReleaseResult` (used in the
  `AgentDriver` interface, never defined).
- **prov-02:** `ForgeDegraded` and `ForgeActionResult` (discriminant + fields) and the CI/PR/review/
  merge evidence sub-DTOs are prose-only — prov-02 has **no `contracts-and-conformance.md`**.
- **prov-03:** `StatusWriteResult`, `WorkSourceError`, `TrackView` (used, never defined) — prov-03 also
  has **no `contracts-and-conformance.md`**.

Each affected item carries the specific list in its **Open questions** and is marked
`status: item: blocked-on-spec`. **w2-1 and prov-04 are dispatch-ready.** Recommended fix: add a
`contracts-and-conformance.md` to prov-02 and prov-03 (matching prov-01/prov-04) and define the three
prov-01 return types — design-corpus work, owned by the architect.

## Wave definition of done

- *Spec compliance:* each item's AC list met and independently verified impl-vs-spec; each mock honors
  the same contract a future real driver will; attestation types match the `CapabilityAttestation` model.
- *Quality bar:* every mock + adversarial case passes the conformance kit; the kit itself is proven (an
  adversarial mock that omits/delays/lies **fails** the kit); `conformance-mock` lane green and
  non-empty; `contracts ↛ core` enforced; coverage ≥ 90% per item (command stated in each charter);
  `pnpm check` green.

## Wave checklist

- [ ] All spec-reconciliation gaps closed (prov-01/02/03 types defined in the corpus).
- [ ] Conformance kit + shared attestation types landed; reviewed against its AC list + design.
- [ ] prov-01..04 contracts defined (pure TS + zod); each reviewed against **its AC list AND its spec**.
- [ ] Each seam has an in-memory mock + adversarial cases (omit/delay/lie) passing the kit.
- [ ] Kit self-test: a deliberately-broken mock **fails** the kit (proves the kit has teeth).
- [ ] `conformance-mock` lane non-empty + green; `--passWithNoTests` removed for it.
- [ ] `contracts ↛ {core,edge,driver}` depcruise rule active + green; zero SDK imports in the wave.
- [ ] Coverage ≥ 90% per item (number pasted); `pnpm check` green.
- [ ] `readiness-matrix.md` updated with cited evidence (package + mock-conformance axes) per item.
- [ ] No out-of-scope changes; one PR opened against `v-next`.

## Out of scope / deferred

All real drivers + their SDKs/native helper (driver track); real-smoke conformance (lights up in the
driver waves + W8).
