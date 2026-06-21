# Wave 1 — frozen decisions (best-of synthesis · input for Wave 2)

This is the authoritative Wave-1 result. The four task deliverables here are the **best-of** from a
three-model run (Claude / Codex / Gemini), chosen per task by an evidence-based review. The frozen
decisions below are the source of truth; the per-task `proposal.md` + `draft/` files are the supporting
detail. Where an open either/or existed, the reviewer-recommended pick is recorded and marked.

**Codex continues Wave 2 on this branch.** Treat the frozen decisions below as inputs. Per the README
Quality guardrails: if you find a contradiction with the corpus, **flag it — do not silently resolve.**

## Provenance

| Task | Adopted from | File |
|---|---|---|
| T1 — policy contract | **Claude** | `T1/proposal.md` + `draft/resolved-policy.contract.md` |
| T2 — agent-port disposition | **Claude** | `T2/proposal.md` + `draft/frozen-port-surface.md` |
| T3 — SDK port hoist | **Codex** (most complete TS) | `T3/proposal.md` + `draft/provider-ports.md` |
| T4 — fnd-02 typed contracts | **Claude** | `T4/proposal.md` + `draft/storage-contracts.md` |

Invariant check at selection time: every source run wrote only under `design-closure/outputs/` — no
corpus file was edited.

---

## Frozen decisions (authoritative)

### T1 — policy contract (fnd-01)
- **Capabilities:** keep kebab-case literal keys; the core-02 predicate field is
  `capabilities[id].desired` (+ `requireFreshAttestation`). **ADD** `escalation-auto-grant`.
  **EXCLUDE** `orchestrator-decide` (AD-14 — not a settable policy capability).
- **Approval:** `approval.mode`; **ADD** `approval.decisionWindowMs` — **name + type frozen; the
  numeric default is deferred to Wave-2 T6.**
- **Merge block:** reached at **`policy.merge`** (the `PolicyLayer` key is `merge`, *not* `mergePolicy`
  — the task spec's `mergePolicy` string is wrong; fix consumer prose, do not rename the corpus key).
  Keep `merge.requiredEvidence` and `changePolicy.allowedChangePaths` as the **existing string-literal
  arrays** (no object-array restructure).
- **Risk:** computed by core-03 via `escalationPolicy.maxGrantScope` + `grantRules`; **no new risk
  policy block.**
- *Optional upgrade (not frozen):* Codex's `escalationPolicy.autoGrant.{maxRisk,…}` block and richer
  object-array evidence shapes — available if T6/T7 decide they want them.

### T2 — agent-port disposition (prov-01)
- **FREEZE the current v1 `AgentDriver` surface.** Defer the provider-neutral redesign as a non-breaking
  post-v1 evolution behind the unchanged port. (The three research drafts disagree among themselves and
  the redesign closes neither real-Codex evidence gap; finalizing now would break already-approved
  core-03 / core-04 specs.)
- **`ScopedGrant` / `ScopedGrantKind`: frozen verbatim** — these are the exact types core-03 imports
  into its grant-mapping table. (See `draft/frozen-port-surface.md` for the full surface.)
- **Production-gated (absent at core-build):** `preservesHostProcessParentage`,
  `canPersistApprovalAnswerChannel`. Covered by core-04 `supervision-lost` and core-03 park via
  `approval-answer-channel-lost`.
- **prov-01 subfile status:** promote `contracts-and-conformance`, `capabilities-and-conformance`,
  `mock-driver` to `approved`; **keep `codex-driver.md` draft** (live evidence still open). Applied by
  the prov-01 owner, not by this package.

### T3 — SDK port hoist (input to Wave 3, **not** a Wave-2 dependency)
- Adopt the Codex draft (most complete TS, no stubs) → new `docs/design/20-sdk-and-packaging/provider-ports.md`.
- **Open rulings carried to the architect / Wave 3** (do not silently resolve in Wave 2):
  1. **Canonical provider names** — deep-specs use `AgentDriver`/`ExecutionHost`/`ForgeContract`/`WorkSource`;
     the SDK section uses `*Provider`. Pick one set + alias. **Cross-task with T2**, which freezes the port
     as `AgentDriver`.
  2. `CapabilityAttestation` **generic `<C>`** (recommended) vs `capability: string`.
  3. SDK doc scope: method-signatures-only (lean) vs full type catalog (Codex draft).

### T4 — fnd-02 typed contracts
- Adopt the Claude draft (`draft/storage-contracts.md`) — types all required shapes.
- **`DurabilityClass` and `AppendBatch` are frozen** — these are the input to Wave-2 T8.
- **Carry forward (must be addressed):** core-01's `RunDegradedHealth` uses **different token strings**
  than fnd-02's `StorageHealth` — a real value-drift hazard; needs a relationship note where the two
  meet.
- *Optional upgrade (not frozen):* Codex's `readonly`/branded-alias polish and `LeaseReadResult` /
  `ReplayResult` wrappers.

---

## Open rulings the architect still owes (do not block Wave 2 unless noted)

1. **T1 `decisionWindowMs` numeric default** → resolved *inside* Wave-2 **T6** (T6 proposes it).
2. **T1 richer evidence object-arrays now?** → default **NO** (kept string arrays); revisit if T7 needs it.
3. **T3 canonical provider names + alias** (cross-task with T2) → architect / Wave 3.
4. **T3 `CapabilityAttestation` genericity + SDK doc scope** → architect / Wave 3.

Only #1 touches Wave 2, and T6 itself resolves it. T6/T7/T8 are otherwise unblocked.

## What Wave 2 consumes

- **T5** — independent.
- **T6** ← T1 (approval/escalation fields, `decisionWindowMs` name) · T2 (`ScopedGrant` shape).
- **T7** ← T1 (`merge.requiredEvidence`, `changePolicy.allowedChangePaths`).
- **T8** ← T4 (`DurabilityClass`, `AppendBatch`).

## Honesty note

These selections are a reviewer best-of, not a separate re-derivation. Picks that were genuinely the
architect's preference use the recommended default and are marked above. Gemini's Wave-1 outputs were
not adopted (real defects: camelCase + `orchestrator-decide` in T1; `ScopedGrant` conflated with
`PolicyGrantScope` in T2; `any`-stubs in T3; stub types in T4).
