# Wave 1 — unblockers (T1–T4)

Read `../README.md` first (rules, deliverable format, read-only-corpus invariant). These specs state
**what** each task must deliver and **why**, plus the acceptance criteria. *How* to produce them —
navigation, sequencing, sizing — is the session's call. The four tasks are independent. Write only
under `outputs/wave-1/<TASK-ID>/`.

---

## T1 — Freeze the policy contract (fnd-01) · DECISION

**Why:** the most-leveraged gap. `ResolvedPolicy` exists but the field names of the blocks core
consumes are flagged open ("coordinate with core-03/prov-01"). This one gap propagates into core-02,
core-03, and core-05.

**In scope:** the fnd-01 Configuration & Policy domain, and its consumers — core-02 (capability gates),
core-03 (approval/escalation), core-05 (merge/change policy).

**Produce:** a recommendation of frozen field names/types for the consumed policy blocks, with a
consumer→field mapping table (and a proposed typed draft if it clarifies).

**Acceptance criteria:**
1. The `capabilities` policy block is typed with named fields; core-02's `policy-disallows-capability` predicate can reference exact field paths.
2. The `approval` and `escalationPolicy` blocks are typed; the fields core-03 needs (mode, decision-window, risk) are named.
3. `mergePolicy.requiredEvidence` and `changePolicy.allowedChangePaths` are typed; core-05 gates reference exact paths.
4. Every previously-open "coordinate with…" naming question for these fields is either resolved (with the chosen name) or explicitly deferred with a stated reason.
5. The proposal lists the exact `docs/**` files+sections to amend later; **no corpus file is edited.**

---

## T2 — Decide the Agent-port disposition (prov-01) · DECISION

**Why:** prov-01's port is in flux — an active "smallest-useful, provider-neutral" redesign plus two
real-Codex attestation gaps. core-03 and core-04 consume this port, so its surface must be frozen
before they can be coded against. This decision reconnects the prior redesign work to the
implementation critical path.

**In scope:** the prov-01 Agent Execution domain (contract, capabilities, mock); the redesign research
under `docs/agent-provider-contract-researches/` (read-only input); and the consumers core-03 (uses
`ScopedGrant`) and core-04 (consumes agent events).

**Produce:** a recommendation of **finalize the smallest-useful redesign now** vs **freeze the current
v1 surface and redesign behind the port later**, with the tradeoff and the impact on core-03/core-04.

**Acceptance criteria:**
1. A clear recommendation (finalize-redesign vs freeze-current) with rationale tied to (a) core-03/core-04 needs and (b) schedule/risk; the alternatives rejected are stated.
2. The port surface core depends on — methods, event union, capability vocabulary, failure tokens, and the `ScopedGrant` shape — is listed as the frozen contract under the recommendation.
3. The two real-Codex attestation capabilities (`preservesHostProcessParentage`, `canPersistApprovalAnswerChannel`) are explicitly marked production-gated (absent at core-build time); the core degraded/park paths that cover their absence are identified.
4. The subfile status mismatch (README `approved` vs subfiles `draft`) is noted with a proposed resolution.
5. The proposal lists the `docs/**` files+sections to change; **no corpus file is edited.**

---

## T3 — Hoist provider ports + `CapabilityAttestation` into the SDK doc section · AUTHORING

**Why:** the port type-detail is filed under provider folders, so core domains read "across" into
provider land for the interface they own — which makes the (already-correct) inversion *look*
provider-first. Relocating the type definitions to the SDK section makes ownership legible.

**In scope:** the SDK & packaging section (`20-sdk-and-packaging`), the architecture provider-seams
doc, and the four provider seams' contract definitions.

**Produce:** the proposed SDK-section port docs (the four provider interfaces + one
`CapabilityAttestation` type, authored as SDK-owned) as drafts, plus a move-map.

**Acceptance criteria:**
1. A draft authors the four provider interface type-definitions + a single `CapabilityAttestation` type as SDK-owned doc content (under a proposed `20-sdk-and-packaging/` location).
2. A "what moves / what stays" table: type definitions → SDK section; driver-mapping, attestation evidence, and conformance suites → stay in provider folders.
3. A cross-reference plan: provider folders link up to the SDK port; core domains reference the SDK location.
4. Confirms this is doc-only — the interfaces already target `packages/sdk`, so no code moves between packages.
5. The proposal lists the `docs/**` files+sections to change; **no corpus file is edited.**

---

## T4 — Author fnd-02 typed contracts · AUTHORING

**Why:** `LeaseSnapshot`, `StorageHealth`, `AppendBatch`, etc. are prose-only in the fnd-02 README, so
every core test fake re-invents them (drift risk). core-01 (the spine) and core-06 consume them.

**In scope:** the fnd-02 Storage & Artifacts domain, and its consumers core-01 (run/event spine) and
core-06 (recovery).

**Produce:** a proposed typed contract for fnd-02 (draft), plus the proposal.

**Acceptance criteria:**
1. Every type core-01 and core-06 consume from fnd-02 is typed in the draft: at minimum `LeaseSnapshot`, `StorageHealth`, `AppendBatch`, `DurabilityClass`, `ArtifactRef`, `ScratchArtifactRef`, and the `EventLogStore`/`LeaseStore`/`ArtifactStore` interfaces.
2. Each type matches the prose semantics in the fnd-02 README (cite the section each derives from).
3. The lease/health types include exactly the fields core-06's `RecoveryEvidenceSnapshot.leases` needs.
4. A drift check: lists each place a core domain currently re-invents one of these shapes inline.
5. The proposal lists where the new file would live in the corpus; **no corpus file is edited.**
