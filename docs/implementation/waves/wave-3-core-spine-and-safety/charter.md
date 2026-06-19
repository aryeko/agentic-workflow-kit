---
title: "Wave 3 — Core Spine & Safety"
wave: 3
status: "wave: draft"
depends-on-waves: [0, 1, 2]
delivers-as: "single PR into v-next"
last-updated: 2026-06-19
---

# Wave 3 — Core Spine & Safety

**Goal.** Stand up the deterministic control-plane spine — the run lifecycle / append-only event log
plus the capability / safety gates — that every later core and edge wave builds on.

**Frozen inputs.**

- **W0 (truth & substrate):** the [package map](../../package-map.md) (`@kit-vnext/core-01`,
  `@kit-vnext/core-02`, the control-plane layer + its directory prefix), the active
  `.dependency-cruiser.cjs` (the `core-must-not-import-edge-or-driver` lane), and the policy docs
  `dependency-policy.md` (determinism ports, layer placement, library acceptance) + `testing-policy.md`
  (unit/integration lanes, property-test requirement, coverage floor).
- **W1 (foundation):** the foundation packages `fnd-01` (resolved policy inputs), `fnd-02`
  (`LeaseStore`/`LeaseCapability`, `EventLogStore.openForAppend`/`append`/`replay` + `LogHandle`, `AppendBatch`/`AppendReceipt`,
  `DurabilityClass`, replay-health values, `ArtifactRef`), `fnd-03`, `fnd-04` — frozen and consumed,
  never reimplemented.
- **W2 (seam contracts, mocks & conformance):** the four seam **contracts**, w2-1's canonical
  `CapabilityAttestation` shape + cross-cutting attestation tokens, and the conformance kit. **Note:**
  core-02 consumes attestation/evidence payloads as **recorded DATA from the core-01 log**, not as a
  package dependency — it does **not** import the `@kit-vnext/conformance-kit` attestation type (that
  is the Test-support layer; a control-plane import of it violates the Dependency Rule).

> **Authored against** [`../../wave-authoring-guide.md`](../../wave-authoring-guide.md). Each item
> charter carries an enumerated **AC list**, a **spec-surface manifest**, and a **failure-outcome
> table**; the implementer and the independent reviewer grade against that one rubric.

## Work items (one commit each; the coordinator plans agent delegation)

Order follows the DAG: `core-01` is the spine (everyone needs it) and lands **first**; `core-02` reads
core-01's `RunReplay` / `RunProjections` and the recorded event log, so it lands **second**.

- [`core-01` — Run Lifecycle & Event State](./items/core-01-run-lifecycle-and-state.md) — the
  append-only run event log (single source of truth), the single-leased-writer append protocol with
  writer-epoch fencing, the pure projection model, and the lifecycle state machine over the legal
  transition table. **Produces** `RunEventEnvelope` (`"kit-vnext.run-event.v1"`),
  `EvidenceEventRef = { eventId; sequence; payloadDigest; type }`, `RunReplay`, the `RunProjections`
  set, and the `RunEventLog` / `RunWriter` contract — consumed verbatim by core-02/04/05/06/07.
- [`core-02` — Capability & Safety](./items/core-02-capability-and-safety.md) — the registry of
  autonomous capabilities and the pure `evaluateCapabilityGate` predicate that unlocks each one only
  when its guarantees hold against recorded evidence + capability attestations (probed, fresh,
  in-scope, positive — never self-report), producing a `CapabilityGateRecordPayload` per evaluation.
  **Consumes** core-01's `RunReplay`, `RunProjections`, and recorded `CapabilityAttestation` event
  payloads (as data).

## Scope & boundaries

- *In:* the **control-plane spine** — core-01 (run lifecycle + event log + projections) and core-02
  (capability registry + gate evaluation + gate records).
- *Out:* approval adjudication (core-03), supervision/liveness (core-04), completion/verification/merge
  (core-05), recovery & coordination (core-06), observability & analysis (core-07) — the later core
  waves; the edge (edge-01); all real drivers + their SDKs (the driver track); real storage backends.
  Each is named in **Out of scope / deferred** below.
- Dependency Rule (activate/keep green the `core-must-not-import-edge-or-driver` lane):
  - **core → foundation only** (fnd-01, fnd-02), **plus core-02 → core-01**.
  - core **↛** contracts, drivers, edge, test-support (`@kit-vnext/conformance-kit`), composition root,
    or any SDK (architecture.md §2; package-map.md).
  - New runtime deps permitted in this wave: **`zod`** (envelope/payload/request schema validation,
    JSON-Schema-representable) and **`fast-check`** + `@fast-check/vitest` (property tests, test-only).
    No provider/native SDK, `execa`, `child_process`, `octokit`, SQLite client, `awilix`,
    `pino`/`@opentelemetry/*`, and no real process, network, or filesystem.

## Integration

- **Package wiring.** Both packages are created against the [package map](../../package-map.md)
  skeleton convention (`packages/core-01`, `packages/core-02`) and wired into the TypeScript solution
  via project references (`composite: true`, references only to allowed layers) and into
  `.dependency-cruiser.cjs` coverage.
- **The layer lane.** The `core-must-not-import-edge-or-driver` depcruise rule is active and green over
  both packages; core-02's reference to core-01 is the only intra-core edge; neither imports a contract,
  a driver, edge, the conformance kit, or an SDK.
- **Determinism ports.** Clock and id are injected ports in both packages — no ambient
  `Date.now`/`new Date()`/`crypto.randomUUID`/`Math.random` anywhere in non-test source.
- **Tests run against mocks only.** core-01 is tested against a deterministic in-memory fnd-02 fake
  (with fault injection) and mock/fake fnd-01; core-02 against generated event logs. No real process,
  network, or filesystem; no SDK.
- **How core-01 + core-02 wire.** core-02 reads core-01's `RunReplay` and `RunProjections`, and selects
  committed `CapabilityAttestation` / evidence event payloads from the core-01 log **as recorded data**
  (referencing each via core-02's own `AttestationRef` shape). core-02 produces the
  `CapabilityGateRecordPayload` + the `CapabilityGateRecord` append intent (`domain = "core-02"`,
  `barrier` durability) but **does not call `append`** — the caller appends via core-01's `RunWriter`.

## Wave definition of done

- *Spec compliance:* every AC of **both** items is met and independently verified impl-vs-spec against
  the core-01 / core-02 design (`README.md` + sibling aspect files); every spec-surface manifest item is
  present with the spec's names/shapes/semantics; no requirement invented beyond the spec.
- *Quality bar:* `pnpm check` green; coverage **≥ 90%** lines/branches per item (aim 95%), enforced by
  each item's stated `vitest run --coverage --coverage.thresholds.lines=90 --coverage.thresholds.branches=90`
  command (number pasted as evidence); the required-test catalogues present; the
  `core-must-not-import-edge-or-driver` layer rule active + green; no SDK and no cross-layer import (no
  contracts/drivers/edge/conformance-kit import); clock/id injected (no ambient time/randomness).

## Wave checklist

- [ ] Both items committed (core-01 then core-02); each reviewed against its charter **AC list** AND its
      domain spec.
- [ ] Spec compliance confirmed per item (no invented requirements; any spec gap surfaced + amended).
- [ ] `packages/core-01` + `packages/core-02` wired into the tsconfig solution + dependency-cruiser; the
      `core-must-not-import-edge-or-driver` rule active & green.
- [ ] core → foundation only, plus core-02 → core-01; no import of contracts/drivers/edge/`conformance-kit`/SDK.
- [ ] Clock/id injected; no `Date.now`/`new Date()`/`crypto.randomUUID`/`Math.random` in this wave's
      non-test source (grep clean, quoted in the evidence pack).
- [ ] core-01: full legal-transition matrix, writer-epoch fencing, lost-ack replay recovery,
      tail-repair / interior-corrupt / unavailable fail-closed, durability-class enforcement, and the
      append/replay/projection determinism property all proven.
- [ ] core-02: gate is a pure predicate over recorded evidence + attestations (never self-report);
      every failure-reason token has a triggering fail-closed test; `gate-record-unwritable` ⇒ caller
      must not act; `orchestrator-decide` always denies (`capability-deferred`).
- [ ] `pnpm check` green; coverage ≥ 90% per item (number pasted as evidence).
- [ ] Only `zod` + `fast-check`/`@fast-check/vitest` added; SDK placement (package-map.md) respected
      (zero SDKs in this wave).
- [ ] `readiness-matrix.md` updated with cited executable evidence for each item (package-implemented
      axis → `yes`).
- [ ] No out-of-scope changes; one PR opened against `v-next`.

## Open questions / spec reconciliation before dispatch

Applying the authoring guide, both item charters were diffed against their specs (R4) and are marked
`status: item: ready` — there are **no `blocked-on-spec` gaps** in this wave. The open questions below
are consolidated from both charters and classified; none blocks dispatch of its own item. They are
**confirmations to make at dispatch** (and obligations to track for the *consuming* waves), not gates on
authoring core-01 / core-02 themselves.

**The substantive one — downstream-sibling writer access (core-01 Q1), non-blocking for core-01.**
core-01's spec (§1 / §6) says siblings "either return `AppendIntent`s for the owning flow or use the
active leased `RunWriter` when their approved contract exposes one," but core-01 does **not** enumerate
*which* siblings receive the live leased `RunWriter` vs return `AppendIntent`s, or the exact contract
that grants writer access. This is a **downstream-sibling (W4+) obligation**, not a core-01 assertion:
core-01 discharges it by **exposing BOTH mechanisms** — it returns a `RunWriter` *and* its append
protocol accepts `AppendIntent` batches — so the decision of who gets the live writer is owned by the
consuming sibling/wave (core-04/05/06), not invented by core-01. **Therefore it is non-blocking for
core-01.** Confirm the grant contract **before the consuming waves (W4+) dispatch**, not before W3.

**Non-blocking confirmations (record + proceed; do not let an implementer invent an answer).**

- **core-01 Q2 (`waitRunEvents` cancellation / back-pressure).** Spec defines bounded
  poll-over-`replay` with `timeoutMs` / `maxEvents` but not consumer-side cancellation or back-pressure;
  the implementation picks a bounded behavior and flags it. core-04 owns liveness. *Non-blocking.*
- **core-01 Q3 (terminal idempotency window).** Confirm core-01 reads the terminal-epoch expiry from the
  fnd-02 `LeaseCapability` TTL rather than computing its own. *Non-blocking confirmation.*
- **core-01 Q4 (`metrics.retryCount` source).** Confirm `retryCount` derives only from recovery-authority
  re-entry transitions referenced by a `RunLifecycleTransitioned`, parsing no sibling retry payload.
  *Non-blocking confirmation.*
- **core-02 Q1 (`auto-pr` vs `auto-merge`).** A spec open question (README §10): v1 treats PR
  creation/update as a completion-domain gate and reserves `auto-merge` for the irreversible merge
  boundary. Implement the v1 registry as written (`auto-merge` only); no code branch. *Non-blocking —
  record and proceed.*
- **core-02 Q2 (`policyRef` is an opaque resolved string).** Confirm core-02 decides
  `policy-disallows-capability` from a resolved policy decision surfaced via the request, not by parsing
  a policy document (fnd-01 owns the schema). *Non-blocking confirmation at dispatch.*
- **core-02 Q3 (append-intent `barrier` shape).** Confirm the core-01 append-intent shape that carries
  the `barrier` durability tag (core-02 produces the payload + intent but never calls `append`).
  *Non-blocking confirmation at dispatch — resolved by core-01 landing first.*

**Dispatch gating (separate from the open questions above).** W3 dispatch is additionally gated on the
**W2 pipeline-validation gate** — the clean two-item W2 PR (w2-1 + prov-04) and its independent Opus
review must land first to confirm the rewritten authoring guide produces clean PRs. **Author W3 now;
dispatch W3 after that gate passes.**

## Out of scope / deferred

- **core-03** (Approval & Escalation), **core-04** (Supervision & Liveness), **core-07** (Observability
  & Analysis) — picked up by **W4 (Core flows)**.
- **core-05** (Completion, Verification & Merge) — picked up by **W5 (Completion & merge)**.
- **core-06** (Recovery, Reconciliation & Coordination) — picked up by **W6 (Recovery & coordination)**.
- **edge-01** (Operator & Entry Surface) — picked up by **W7 (Edge)**.
- All **real drivers** + their SDKs / native containment helper (Codex / GitHub / Local / Markdown) —
  the **driver track (D1–D4)**; real-smoke + live capability attestations light up in **W8**.
- **Real storage backends** for the event log / lease store — core-01 runs on the deterministic
  in-memory fnd-02 fake; real backends live behind the fnd-02 port (foundation), not this wave.
