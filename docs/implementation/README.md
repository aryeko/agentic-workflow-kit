# kit-vnext — Implementation plan

This folder is the implementation-tracking layer for building kit-vnext from the **frozen design
corpus** in [`../design/`](../design/). The design corpus is the *what* (contracts, domains,
decisions, AD-1..AD-14); this folder is the *how, and in what order*.

> Status: **draft for review.** Waves 0–2 are authored; core/driver/edge/smoke waves are listed but
> their charters are pending (`charter pending` in the index).

---

## How the work is executed

- **One PR per wave.** A wave is a batch of work whose dependencies are all satisfied. It lands as a
  single PR into `v-next`.
- **One commit per work item.** Each work item has its own charter and is built + reviewed
  independently. The orchestrator (Codex) plans how many implementer/reviewer agents to assign and how
  to slice each item — **the charters are the contract, not the agent map.**
- **Implementer + independent reviewer.** Each item is built by an implementer from its work-item
  charter **and the normative domain spec (its `README.md` + sibling aspect files) it points to**; a *separate* reviewer verifies the build
  against that same charter **and** the design spec, independently. This is the loop that produced the
  design corpus flawlessly.
- **Charters are chief-architect altitude.** They pin the *what*, the *owned requirements*, the
  *boundaries*, and the two-part *Definition of done* (spec compliance + quality bar). They do **not**
  dictate file layout, signatures, or algorithms — senior implementers own that.

---

## The two tracks

A deterministic, mock-driven **critical path** (foundation → contracts → core → edge) runs alongside a
**driver track** (real Codex/GitHub/Local/Markdown). They meet only at the end, in a real end-to-end
smoke wave. The contract/mock keystone (W2) is what lets the entire core be built and tested without a
single real process or network call.

```
W0  Truth & substrate (GATE) ...... design reconciliation + package map +
        depcruise layer/SDK rules + policy docs            -> docs/tooling, no prod code
         |
W1  Foundation .................... fnd-01 fnd-02 -> fnd-03 fnd-04   -> +zod, clock/id ports, JSONL log
         |
W2  Seam contracts + mocks + ...... prov-01..04 contracts, mocks,   <== KEYSTONE
        conformance kit                                              pure TS, ZERO SDKs
         |
         +------------ CRITICAL PATH (mock-driven, deterministic) -----------------+
         |   W3  Core spine & safety ..... core-01 -> core-02                       |
         |   W4  Core flows .............. core-03 . core-04 . core-07 (parallel)   |
         |   W5  Completion & merge ...... core-05                                  |
         |   W6  Recovery & coordination . core-06                                  |
         |   W7  Edge .................... edge-01                                  |
         |                                                                          |
         +-------- DRIVER TRACK (parallel, conformance-gated) ----------------------+
             D1 Markdown WS . D2 Codex Agent . D3 GitHub Forge .                    |
             D4 Local ExecHost  (*+ native containment helper - highest risk)       |
                                                                                    v
                                          W8  Real E2E smoke + live capability attestations
```

---

## Wave index

| Wave | Delivers | Depends on | Status |
|---|---|---|---|
| [W0 — Truth & Substrate](./waves/wave-0-truth-and-substrate/charter.md) | corpus reconciliation, package map, depcruise rules, policy docs | — | authored |
| [W1 — Foundation](./waves/wave-1-foundation/charter.md) | fnd-01..04 packages | W0 | authored |
| [W2 — Seam Contracts, Mocks & Conformance](./waves/wave-2-seams-and-conformance/charter.md) | prov-01..04 contracts + mocks + conformance kit | W0, W1 | authored |
| W3 — Core spine & safety | core-01, core-02 | W2 | charter pending |
| W4 — Core flows | core-03, core-04, core-07 | W3 | charter pending |
| W5 — Completion & merge | core-05 | W4 | charter pending |
| W6 — Recovery & coordination | core-06 | W5 | charter pending |
| W7 — Edge | edge-01 | W6 | charter pending |
| D1–D4 — Driver track | markdown / codex / github / local(+native) drivers | W2 (per seam) | charter pending |
| W8 — Real E2E smoke | live wiring + attestations | core path + drivers | charter pending |

---

## The dependency DAG (ground truth — non-negotiable order)

```
fnd-01, fnd-02            (no deps)
fnd-03 -> fnd-01,02       fnd-04 -> fnd-01
-----------------------------------------------------------
seam contracts -> foundation only   (prov-04 contract before prov-01 contract)
-----------------------------------------------------------
core-01 -> fnd-01,02                         (the spine; everyone needs it)
core-02, core-04, core-07 -> core-01 + contracts   (independent of each other)
core-03 -> core-02
core-05 -> core-02, core-03                  (NOT parallel after 01/02 — see W0 w0-1)
core-06 -> core-04, core-05                  (synthesis; observes everything)
-----------------------------------------------------------
edge-01 -> all core
```

---

## Cross-cutting rules (apply to every wave)

- **Dependency Rule is machine-enforced** via dependency-cruiser — layer rules + package-name SDK bans
  (W0/w0-3). A library lives only at its one allowed boundary; core imports no driver and no SDK.
- **Core is pure functions of recorded events.** Clock, id, and randomness are **injected ports** — no
  ambient `Date.now`/`Math.random` anywhere in core or foundation.
- **Every item's DoD has two parts:** *spec compliance* (verified impl-vs-spec, independently)
  **plus** the *quality bar* (the verify gate + the required tests + conformance).
- **STOP-and-surface, never invent.** If a cross-item contract question isn't answered by the
  domain spec, the implementer stops and surfaces it to the architect — they do not guess or edit
  another item's package. (This is what kept the design effort clean.)
- See [`../foundation/dependency-policy.md`](../foundation/dependency-policy.md) and
  [`../foundation/testing-policy.md`](../foundation/testing-policy.md) (produced in W0/w0-4).

---

## Risk register

| Risk | Sev | Where | Mitigation |
|---|---|---|---|
| Native containment helper (kill-tree, cgroup/Job Object, egress confinement) | **High** | D4 Local Execution Host driver | Isolate as the last, standalone driver; spike the helper early; core never depends on it (runs on the mock host). execa does **not** solve this. |
| Event-log durability semantics (crash-safe append, fencing, corruption) | **High** | fnd-02 | JSONL-first; property + integration crash tests (torn tail / interior); backend behind a swappable port. |
| GitHub GraphQL schema drift | Med | D3 GitHub Forge driver | Pin octokit + snapshot the schema; conformance binds to the snapshot; provenance paths fixed in W0/w0-1. |
| Determinism leaks (`Date.now`/`Math.random`) | Med | all core/foundation | Clock/id ports enforced by depcruise + review; replay/projection property tests. |
| Credential/egress seam gap (fnd-01 ↔ fnd-04) | Med | W0/w0-1 | Closed in W0 before fnd-01/fnd-04 are coded. |
| Weak conformance kit lets bad drivers pass | Med | W2/w2-1 | The kit must have teeth: an adversarial mock that omits/delays/lies **fails** the kit (self-test). |
