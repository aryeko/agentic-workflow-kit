# Wave 3 — architect rulings (sign-off sheet)

Status: **DRAFT — awaiting architect decision.** Wave-3 (T9) is ready to freeze as a proposal (5/5 ACs,
corpus read-only, guardrails substantive). These are the open choices it surfaced, plus one ruling
carried from Wave-1 T3 that becomes apply-blocking here. All have a recommended pick.

**One-pass approval:** reply "approve all", or mark the specific `Amend` lines. Nothing here is applied
to the corpus — rulings are recorded for the later apply phase.

Legend: **◻ Approve recommended ◻ Amend → ____**. None of these block freezing the proposal.

---

## T9 — make the inversion legible

**R-T9.1 — Seam-node ids.** `seam-<provider>-contract-mock` (e.g. `seam-agent-contract-mock`) — vs
shorter ids (`seam-agent`, `seam-host`, `seam-forge`, `seam-work-source`).
**Recommended:** `seam-<provider>-contract-mock`. *Self-documenting — the id states the node IS the contract + mock, which is the whole point of the seam node.*
**Decision:** ◻ Approve recommended ◻ Amend → ____

**R-T9.2 — Real-driver frontier expression.** Keep the current frontier files/numbers and add
contract+mock vs real-driver story-class splits within them — vs introduce a formal `5p`
production-readiness frontier for real drivers.
**Recommended:** keep current files + story-class splits. *Minimal change; avoids renumbering frontiers and the churn that follows. The non-core-blocking nature of real-driver stories is captured by the story class, not a new frontier.*
**Decision:** ◻ Approve recommended ◻ Amend → ____

**R-T9.3 — Architecture attestation clarifier (optional).** Add a short note to
`docs/design/10-architecture/capability-attestation.md` distinguishing mock/recorded attestation
fixtures (which drive core tests) from live runtime probes (production) — vs skip it.
**Recommended:** apply it. *Cheap, and it cements the load-bearing point of the whole inversion — attestation is data a mock can supply, so core builds/tests without real drivers. Reduces the chance the distinction erodes later.*
**Decision:** ◻ Approve recommended ◻ Amend → ____ (skip)

**R-T9.4 — Canonical provider-interface names (carried from Wave-1 T3, now apply-blocking).** The SDK
section uses `AgentProvider`/`ExecutionHostProvider`/`ForgeProvider`/`WorkSourceProvider`; the provider
deep-specs use `AgentDriver`/`ExecutionHost`/`ForgeContract`/`WorkSource`. T2 froze the agent port
*surface* (methods/events/types) but not its *name*; T3 and T9 both use the `*Provider` names.
**Recommended:** adopt the SDK `*Provider` names as canonical; rename the four provider deep-specs to
match (or add explicit alias notes). *The SDK consumer owns the port (the inversion), so the SDK name is the natural canonical one; the frozen T2 surface is unchanged — only the interface name resolves. This reconciles T2 ↔ T3 ↔ T9 under one name set.*
**Decision:** ◻ Approve recommended ◻ Amend → ____ (keep deep-spec names canonical, alias SDK side)

---

## Apply-time checklist (record, not a pick)

- **A-1 — frontmatter re-sync.** After the DAG edits land, re-point each domain's frontmatter `prov-*`
  dependencies to the seam contract+mock nodes, or the DAG-alignment rule is violated. (T9 flagged this
  honestly; it's a follow-up of the apply step, not a defect.)
- **A-2 — do not delete real-driver stories.** When applying, real-driver story files/expectations are
  *reclassified* (production-readiness, non-core-blocking), never removed. Runtime attestation stays
  required for production live powers — narrowed only away from core build/test readiness.

---

## On approval

Approving these closes the **decision** layer of design-closure. What remains is execution, not design:
**apply** the approved Wave 1–3 proposals to the corpus (the apply plan), then write implementation
story-contracts core-first. The two provider-contract follow-ups from Wave 2 (F-1 prov-02 ruleset
field, F-2 prov-04 `commandDigest`) remain tracked as sibling-domain work.
