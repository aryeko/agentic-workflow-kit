# Run Impl-Phasing — review the updated design, confirm readiness, propose implementation phases

You are a fresh session with no memory of prior conversation. Run this **after** the apply session
(`run-apply.md`) has landed the closure proposals into the corpus. Your job: independently verify the
updated design is complete and ready, then propose the **high-level** implementation phases.

## Setup
1. Confirm you are in a working copy with the corpus (`docs/design/30-domain-reference/` exists) and the
   closure package; not the primary checkout. Else stop and report.
2. Read `design-closure/README.md` (rules). **This session is read-only on the corpus** — you review and
   propose; you write only under `design-closure/outputs/`. Do not edit `docs/**`.
3. Read `design-closure/outputs/apply/APPLY-REPORT.md` (what the apply session claims it changed) — as a
   pointer, not as truth to be trusted.

## Part A — independent readiness verification
Do **not** take the apply report's self-assessment at face value. Verify against the **updated corpus**
directly, and cite evidence:
- the typed shared contracts now exist in one owned location (fnd-02 storage types; the SDK
  `provider-ports.md`; fnd-03 event payloads);
- each core domain's previously-open blocking question is closed (core-03 decision-window + grant
  mapping; core-05 required-evidence source + blocker-PR rules; core-01 event durability map; fnd-03
  event types + concurrency);
- the dependency map re-points every core→provider edge to a seam contract + mock node — **no core
  domain still depends on a full provider domain, and no stray `prov-*` frontmatter dependency
  remains**;
- the published build order is foundation → seam ports & mocks → core spine → core gates → real drivers
  (parallel) → edge, and runtime attestation is a production gate;
- provider-interface naming is consistent (R-T9.4 applied — `*Provider` canonical; deep-specs
  renamed/aliased).
Flag every gap, inconsistency, or place the apply was incomplete. **Readiness is not automatic** — if
material gaps exist, say so plainly and stop short of declaring the design ready.

## Part B — high-level implementation phases
Assuming readiness (or explicitly noting the blocking gaps), propose the **high-level** phases to build
kit-vnext **core-first**. Stay at the *what / why* altitude — phases, not detailed story-contracts.
**Build on the corpus's existing frontier structure** (the frontiers, now updated by apply) — refine or
confirm it rather than inventing a parallel scheme. For each phase give:
- what it delivers (the slice);
- what it is tested against — emphasize that core phases run on **SDK ports + mocks, zero real
  providers / zero network**;
- entry criteria (what must be true to start) and exit criteria (what proves it done);
- dependencies on earlier phases;
- which work is explicitly **parallel / later** (the real provider drivers, gated by production
  attestation).
Make the core-first, mock-driven path explicit, and show where real providers join in parallel rather
than blocking it.

## Output + stop
- A proposal at `design-closure/outputs/impl-phasing/IMPL-PHASING.md`: the Part A readiness verdict
  (with cited gaps, if any) followed by the Part B phase plan. Write only under
  `design-closure/outputs/`; do not edit the corpus.
- **Stop for architect review.** Do not write story-contracts or code.

Report back with the proposal path, a short digest, and your plain readiness verdict (ready /
ready-with-gaps / not-ready).
