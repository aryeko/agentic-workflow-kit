---
title: "Wave 1 — Foundation"
wave: 1
status: "wave: ready"
depends-on-waves: [0]
delivers-as: "single PR into v-next"
last-updated: 2026-06-19
---

# Wave 1 — Foundation

**Goal.** Stand up the four foundation packages — the durable substrate every layer depends on:
configuration & policy, storage (log persistence + leases + artifacts), workspace & repository,
credentials & secrets.

**Frozen inputs.** Wave 0's package map, `dependency-policy.md`, `testing-policy.md`, dependency-cruiser
rules. Nothing above foundation exists yet.

## Work items (one commit each; Codex plans the agent delegation)

Build order follows the DAG — `fnd-01`/`fnd-02` have no deps; `fnd-03` needs 01+02; `fnd-04` needs 01.

- [`fnd-01` — Configuration & Policy](./items/fnd-01.md) — resolved policy + provenance; **adds the
  credential-ref & egress-policy source fields** (Wave 0 reconciliation w0-1).
- [`fnd-02` — Storage & Artifacts](./items/fnd-02.md) — crash-safe JSONL log persistence, lease/fence
  primitive, write-once artifact store.
- [`fnd-03` — Workspace & Repository](./items/fnd-03.md) — worktree lease, read-only local git
  evidence (no subprocess), workspace setup handshake.
- [`fnd-04` — Credentials & Secrets](./items/fnd-04.md) — credential resolution, scoped injection,
  redaction, egress attestation shape, audit.

## Scope & boundaries

- *In:* the foundation layer only. *Out:* event semantics/projections (core-01), any provider/driver,
  any SDK.
- Dependency Rule: activate `foundation ↛ {core,edge,driver,contracts}` (intra-foundation peer
  allowed). Only new runtime dep permitted: **zod** (plus a pure-JS git reader for fnd-03, no
  subprocess).

## Integration

All four packages wired into the tsconfig solution + dependency-cruiser; clock/id injected as ports
(no ambient time/randomness); a foundation composition smoke constructs each against in-memory/temp
backends.

## Wave Definition of done

- *Spec compliance:* every foundation contract/type/event/failure-mode across the four domain specs
  is implemented as specified and **independently verified impl-vs-design** per item.
- *Quality bar:* `pnpm check` green; coverage bar; property tests where items require them; the
  foundation layer rule active and passing; no SDK, no cross-layer import.

## Wave checklist

- [ ] All four work-item commits landed; each reviewed against **its charter AND its domain spec**.
- [ ] Spec compliance confirmed per item (no silent deviations; any deviation surfaced & recorded).
- [ ] Packages wired into tsconfig solution + dependency-cruiser; `foundation ↛ above` rule active &
      green.
- [ ] Clock/id ports injected; no `Date.now`/`Math.random` in foundation.
- [ ] `pnpm check` green on the wave branch; coverage bar met.
- [ ] Only `zod` (+ pure-JS git reader for fnd-03) added as runtime deps; no SDKs; JSONL-first
      (no SQLite lib).
- [ ] No out-of-scope changes; PR opened against `v-next`.

## Out of scope / deferred

SQLite backend (JSONL-first this wave); telemetry/OTel; anything owned by a core or provider domain.
