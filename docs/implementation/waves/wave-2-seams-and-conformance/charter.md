---
title: "Wave 2 — Seam Contracts, Mocks & Conformance"
wave: 2
status: "wave: ready"
depends-on-waves: [0, 1]
delivers-as: "single PR into v-next"
last-updated: 2026-06-19
---

# Wave 2 — Seam Contracts, Mocks & Conformance  ◆ keystone

**Goal.** Define the four provider seam contracts as **pure TypeScript + zod payload schemas +
capability-attestation types**, ship an in-memory **mock** with adversarial cases for each, and build
the shared **conformance kit** — so the *entire core can be built and tested against mocks with zero
real processes or network*. This wave is what decouples the layers: after it, no core wave ever touches
a real SDK.

**Frozen inputs.** Foundation packages (W1); the package map + `dependency-policy.md` +
`testing-policy.md` + dependency-cruiser rules (W0).

## Work items (one commit each; Codex plans the agent delegation)

Order: the kit + shared types first; then the Execution Host contract (the Agent contract references
it); then the other three in parallel.

- [w2-1 — Conformance kit & shared contract types](./items/w2-1-conformance-kit-and-shared-types.md) —
  the capability-attestation model, shared contract types, and the harness every driver plugs into.
- [prov-04 — Execution Host contract + mock](./items/prov-04-execution-host-contract.md) — host-neutral
  spawn/contain/terminate/verify contract + mock (no native helper, no real driver).
- [prov-01 — Agent contract + mock](./items/prov-01-agent-contract.md) — model protocol, approval
  relay, structured tool-exit, progress events + mock.
- [prov-02 — Forge contract + mock](./items/prov-02-forge-contract.md) — PR/CI/review/merge evidence +
  actions contract + mock (evidence DTOs, no octokit).
- [prov-03 — Work Source contract + mock](./items/prov-03-work-source-contract.md) — task/track
  inventory, claim/release, status authority + mock.

## Scope & boundaries

- *In:* the four seam **contracts** (interfaces + zod payloads + attestation types), their **mocks**,
  and the **conformance kit**.
- *Out:* **real drivers** (Codex/GitHub/Local/Markdown — that's the driver track) and any boundary SDK
  (octokit/execa/native helper).
- Dependency Rule: activate `contracts ↛ {core,edge,driver}` and
  `mock-driver ↛ {core,edge}`. **Zero SDKs** in this wave.

## Integration

The four contracts + mocks all pass the conformance kit; the `conformance-mock` lane is now
**non-empty and green** (drop `--passWithNoTests` for it). The kit's "real-smoke" slots exist but stay
empty until the driver track. A core-facing barrel exposes only contract types — no mock leakage into
core.

## Wave Definition of done

- *Spec compliance:* each contract matches its provider spec (`README.md` + aspect files) (the contract + capability set +
  events); each mock honors the same contract as the (future) real driver; attestation types match the
  design's `CapabilityAttestation` model.
- *Quality bar:* every mock + adversarial case passes the conformance kit; the kit itself is proven (an
  adversarial mock that omits/delays/lies **fails** the kit); `conformance-mock` lane green and
  non-empty; `contracts ↛ core` enforced; `pnpm check` green; coverage bar.

## Wave checklist

- [ ] Conformance kit + shared attestation/contract types landed and reviewed vs design.
- [ ] prov-01..04 contracts defined (pure TS + zod), each reviewed vs its domain spec.
- [ ] Each seam has an in-memory mock + adversarial cases (omit/delay/lie) passing the kit.
- [ ] Kit self-test: a deliberately-broken mock **fails** the kit (proves the kit has teeth).
- [ ] `conformance-mock` lane non-empty + green; `--passWithNoTests` removed for it.
- [ ] `contracts ↛ {core,edge,driver}` depcruise rule active + green; zero SDK imports in the wave.
- [ ] `pnpm check` green; PR opened against `v-next`.

## Out of scope / deferred

All real drivers + their SDKs/native helper (driver track); real-smoke conformance (lights up in the
driver waves + W8).
