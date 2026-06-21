# Wave 3 — make the inversion legible (T9)

Read `../README.md` first. This spec states **what** and **why** plus acceptance criteria; *how* (incl.
whether to split the surfaces across sub-agents) is the session's call. Depends on Wave-1 T3 — read
`outputs/wave-1/T3-port-hoist/` first; if it is missing/ambiguous, record a blocker rather than guessing
the new port location. Write only under `outputs/wave-3/T9/`.

---

## T9 — Flip DAG/frontier edges + reclassify runtime attestation · REORG/AUTHORING · depends on Wave-1 T3

**Why:** the architecture is already dependency-inverted, but the DAG and frontier charters point core
at whole provider domains (which bundle the real driver), and the readiness matrix treats runtime
attestation as if it were a core build prerequisite. Re-pointing core at "seam **contract + mock**"
nodes and reclassifying runtime attestation as a production gate makes the core-first order legible and
permanently answers "core must not depend on providers."

**In scope (three surfaces):** the implementation domain-DAG (direct-dependency table + frontier
ordering); the frontier charters (esp. provider-seams and agent + core-gates); the readiness matrix
(the "runtime attestation" axis) and the domain-catalog ordering rationale.

**Produce:** the proposed edits to the DAG, charters, and matrix as drafts (not applied), plus the
proposal.

**Acceptance criteria:**
1. The proposed DAG shows each core→provider edge depending on a "seam **contract + mock**" node, not the full provider domain (which includes the real driver). The edges are listed explicitly.
2. Each provider frontier charter is proposed to split its work into separate **contract+mock** stories vs **real-driver** stories, with core depending only on the former.
3. The readiness-matrix "runtime attestation" axis is reclassified as a **production-readiness gate**, with a note that it is not a core build/test prerequisite (core tests run on mocks, zero real processes/network).
4. The proposed published build order reads: foundation → seam ports & mocks (in `sdk`/`testkit`) → core spine → core gates → real drivers (parallel) → edge.
5. Consistent with Wave-1 T3 (cite it); the proposal lists corpus files+sections to amend; **no corpus file is edited.**
