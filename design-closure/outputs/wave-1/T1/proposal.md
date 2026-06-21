---
title: "T1 — Freeze the policy contract (fnd-01) — PROPOSAL"
task: "T1 / fnd-01 — design-closure wave-1 (DECISION task)"
status: "recommendation — NOT applied; no corpus file edited"
owner: "T1 sub-agent"
date: "2026-06-21"
---

# T1 — Freeze the policy contract (fnd-01)

> This is a **recommendation for an architect ruling**, not a final decision. Nothing under
> `docs/` is edited. A companion typed draft is at
> [`draft/resolved-policy.contract.md`](./draft/resolved-policy.contract.md).

## Summary (2–3 sentences)

The fnd-01 `PolicyLayer` blocks are already typed in the corpus; the real gap is that three of the
consumer↔policy field bindings are unresolved or mismatched: (a) core-02's
`policy-disallows-capability` predicate has **no named field** to read — `CapabilityPolicy` lacks an
`escalation-auto-grant` key and core-02 §10 admits the assisted-enable shape is undefined; (b) the
`merge` layer key is named `merge` in fnd-01 but consumers/spec call it `mergePolicy`; (c) core-03's
**decision window** field is an open question with no name in `ApprovalPolicy`. I recommend freezing
the consumed paths exactly, adding `capabilities["escalation-auto-grant"]` and
`approval.decisionWindowMs`, and ruling that the merge block is reached at `policy.merge`
(type name remains `MergePolicy`).

---

## Decision / recommended frozen field names + types

All paths are `ResolvedPolicy.policy.<block>.<field>`. `ResolvedPolicy` is defined in
`docs/design/30-domain-reference/foundation/configuration-and-policy/interfaces-events-and-verification.md`
(lines 40–44); `PolicyLayer` and the blocks in `…/configuration-and-policy/schema-and-resolution.md`
(lines 37–151).

### 1. `capabilities` → `CapabilityPolicy`  (CHANGE: add one key)

- **Frozen predicate path** for core-02 `policy-disallows-capability`:
  `ResolvedPolicy.policy.capabilities[capabilityId].desired`.
- **CHANGE:** add `"escalation-auto-grant": CapabilitySetting` to `CapabilityPolicy`.
  - *Why:* core-02's capability registry
    (`…/capability-and-safety/capability-registry.md` lines 9–16) enumerates **five** capability ids;
    its shared guarantee #2 (line 36) is "Resolved policy permits the capability for this scope" and
    its failure reason `policy-disallows-capability`
    (`…/gate-evaluation-and-records.md` line 47) must reference an exact field. The current
    `CapabilityPolicy` (`schema-and-resolution.md` 134–138) only has `auto-merge`, `auto-recover`,
    `unattended-run` — so `escalation-auto-grant` (used by core-03 via core-02) has **no policy
    field**. core-02 README §10 (line 230) explicitly defers "the exact policy shape that enables
    assisted capabilities" to fnd-01. This change closes that gap.
  - `orchestrator-decide` is **intentionally excluded** (AD-14 deferred; `schema-and-resolution.md`
    176 already rejects it as `unsupported-deferred-capability`).
- **`desired: boolean`** is the assisted-enable bit the predicate reads;
  `requireFreshAttestation: true` is unchanged (attestation still required separately by core-02).

  *Rejected alternative:* a separate `assistedCapabilities: CapabilityId[]` allowlist. Rejected
  because it duplicates the existing per-capability `desired` flag and would create two sources of
  truth for "is this capability enabled," violating the default-off invariant's single-field model.

### 2. `approval` → `ApprovalPolicy` and `escalationPolicy` → `EscalationPolicy`

**approval (CHANGE: add decision window):**
- mode → `ResolvedPolicy.policy.approval.mode` (`"manual" | "assisted"`) — already named
  (`schema-and-resolution.md` 73).
- **CHANGE:** add `decisionWindowMs: number` to `ApprovalPolicy`.
  - *Why:* core-03 `expired` state and `approval-expired` fail-closed
    (`…/approval-and-escalation/park-resume-and-failures.md` lines 26, "policy decision window
    elapsed") depend on a decision window, but **both** fnd-01 §10 (line 226) and core-03 §10
    (line 237) flag "decision-window default" as an **open question** with no field name. This
    freezes the name.
  - *Recommended name:* `decisionWindowMs` (unit-suffixed integer, matching the unit-explicit
    convention; the live-answer deadline in `interfaces-events-and-tests.md` line 82 is a duration).
  - *Rejected:* `decisionWindow` (ambiguous unit) and `liveAnswerWindowSec` (couples the name to the
    "live answer" sub-case; the field also bounds the parked `expired` transition, which is broader).

**escalationPolicy (NO CHANGE — fields already named, frozen as-is):**
- `…escalationPolicy.maxGrantScope` — high-risk rule input
  (`…/approval-and-escalation/decision-model.md` line 97).
- `…escalationPolicy.grantRules[].prefixes` / `.scope` / `.reason` / `.requiresOperator` — low/medium
  risk + allowlist (`decision-model.md` mode-ladder + risk rules).
- `…escalationPolicy.allowedGrantScopes`, `.denyByDefault`.
- **"risk" is not a block.** Risk is core-03-computed (`decision-model.md` "Deterministic risk
  classification"); its policy inputs ARE the escalation fields above. AC-2's "risk" field is met by
  naming `maxGrantScope` + `grantRules`, not by inventing a `risk` block.

  core-03 already binds these explicitly: `interfaces-events-and-tests.md` line 66–67 reads
  `ResolvedPolicy.policy.approval` and `ResolvedPolicy.policy.escalationPolicy`. So the block keys
  `approval` and `escalationPolicy` are **already consumed by exact path** and are frozen unchanged.

### 3. `merge` → `MergePolicy` and `changePolicy` → `ChangePolicy`

**merge (NO TYPE CHANGE — path-naming RULING):**
- **RULING:** the block is reached at **`ResolvedPolicy.policy.merge`**; the *type* is `MergePolicy`.
  The layer key is `merge` (`schema-and-resolution.md` line 46), **not** `mergePolicy`.
  - *Why this is the gap:* the task spec (AC-3) and core-05 README line 247 say
    "`mergePolicy.requiredEvidence`", but **no such key exists** — the `PolicyLayer` key is `merge`.
    A grep of the corpus shows core-05 never references an exact `merge`/`mergePolicy` path; it uses
    bare field names `runnerMayMerge`, `runnerMayPush`, `runnerMayOpenPr`, `requiredEvidence`
    (`evidence-model-and-predicates.md` 139, 181; README 247) and the phrase "resolved merge policy".
    So the consumer→field binding for core-05 is currently **unanchored**. This ruling anchors it.
  - *Recommendation:* keep the layer key `merge` (do not rename to `mergePolicy`). Renaming the key
    touches the frozen `PolicyLayer` and the precedence/provenance leaf-path enumeration; the cheaper,
    lower-risk fix is to correct the **consumer prose** to cite `policy.merge.requiredEvidence`.
  - *Rejected alternative:* rename the layer key `merge → mergePolicy` for symmetry with
    `escalationPolicy`/`changePolicy`. Rejected: it mutates a frozen foundation type and every
    canonical leaf field path under it, for cosmetic consistency; the asymmetry (`run`,
    `provisioning`, `approval`, `capabilities`, `egress`, `merge` are bare; `escalationPolicy`,
    `changePolicy`, `credentialRefs` are suffixed) already exists in the frozen schema and is not
    worth a breaking change. Flag for architect if symmetry is preferred.
- Frozen core-05 paths: `policy.merge.runnerMayMerge`, `.runnerMayPush`, `.runnerMayOpenPr`,
  `.requiredEvidence`, `.mergeMethod`.

**changePolicy (NO CHANGE — already correctly bound):**
- `ResolvedPolicy.policy.changePolicy.allowedChangePaths` — core-05 already cites this exact path
  (README lines 105, 163, 251; context diagram edge `CFG -->|"ChangePolicy.allowedChangePaths"| CMP`).

---

## Consumer → field mapping table

| Consumer | Predicate / use | Frozen field path | Type | Status |
|---|---|---|---|---|
| core-02 | `policy-disallows-capability` (auto-merge) | `ResolvedPolicy.policy.capabilities["auto-merge"].desired` | `boolean` | exists |
| core-02 | `policy-disallows-capability` (auto-recover) | `…capabilities["auto-recover"].desired` | `boolean` | exists |
| core-02 | `policy-disallows-capability` (unattended-run) | `…capabilities["unattended-run"].desired` | `boolean` | exists |
| core-02 | `policy-disallows-capability` (escalation-auto-grant) | `…capabilities["escalation-auto-grant"].desired` | `boolean` | **ADD** |
| core-02 | attestation-still-required floor | `…capabilities[id].requireFreshAttestation` | `true` | exists |
| core-03 | approval mode (manual/assisted ladder) | `ResolvedPolicy.policy.approval.mode` | `"manual"\|"assisted"` | exists |
| core-03 | park-on-latency posture | `…approval.parkOnHumanLatency` | `boolean` | exists |
| core-03 | require recorded decision | `…approval.requireRecordedDecision` | `boolean` | exists |
| core-03 | decision window → `expired` | `…approval.decisionWindowMs` | `number` | **ADD** |
| core-03 | high-risk scope ceiling | `…escalationPolicy.maxGrantScope` | grant-scope enum | exists |
| core-03 | allowlist prefix match (low/med risk) | `…escalationPolicy.grantRules[].prefixes` | `string[]?` | exists |
| core-03 | per-rule operator requirement (med risk) | `…escalationPolicy.grantRules[].requiresOperator` | `boolean?` | exists |
| core-03 | allowed scopes / deny-by-default | `…escalationPolicy.allowedGrantScopes`, `.denyByDefault` | enum[] / `boolean` | exists |
| core-05 | merge enable predicate | `ResolvedPolicy.policy.merge.runnerMayMerge` | `boolean` | exists (path ruling) |
| core-05 | required evidence gate | `…merge.requiredEvidence` | evidence enum[] | exists (path ruling) |
| core-05 | merge method allow | `…merge.mergeMethod` | method enum? | exists (path ruling) |
| core-05 | blocker-PR push/open | `…merge.runnerMayPush`, `.runnerMayOpenPr` | `boolean` | exists (path ruling) |
| core-05 | changed-file allowlist gate | `…changePolicy.allowedChangePaths` | `string[]` | exists |

---

## Proposed artifact

Typed draft: [`draft/resolved-policy.contract.md`](./draft/resolved-policy.contract.md). It pins every
consumed block, marks the two ADDs (`capabilities["escalation-auto-grant"]`,
`approval.decisionWindowMs`) and the one path RULING (`policy.merge`), and copies all unchanged types
verbatim from the corpus.

---

## Corpus impact — files + sections to amend later (NOT edited)

1. `docs/design/30-domain-reference/foundation/configuration-and-policy/schema-and-resolution.md`
   - **§Policy blocks**, `type CapabilityPolicy` (lines 134–138): add the
     `"escalation-auto-grant": CapabilitySetting` key.
   - **§Policy blocks**, `type ApprovalPolicy` (lines 72–76): add `decisionWindowMs: number`.
   - **§Safe defaults** (lines 153–171): add a safe default for `decisionWindowMs` and for
     `capabilities["escalation-auto-grant"].desired = false`.
2. `docs/design/30-domain-reference/foundation/configuration-and-policy/README.md`
   - **§Responsibilities** (line 19) and **§Open questions** (lines 50–52, 225–227): mark "exact field
     names (coordinate with core-03 / prov-01)" and "decision-window" as RESOLVED with the chosen
     names; reference this contract.
3. `docs/design/30-domain-reference/core/completion-and-merge/README.md`
   - Line 247 ("merge-policy `requiredEvidence`"): correct the path to
     `ResolvedPolicy.policy.merge.requiredEvidence` (the key is `merge`, not `mergePolicy`).
4. `docs/design/30-domain-reference/core/completion-and-merge/evidence-model-and-predicates.md`
   - Merge predicate (lines 139–148): where it says "resolved merge policy … `runnerMayMerge`",
     anchor the bare field names to `ResolvedPolicy.policy.merge.*`.
5. `docs/design/30-domain-reference/core/approval-and-escalation/README.md` §10 (line 237) and
   `…/park-resume-and-failures.md` (line 26): replace the "decision-window default open" note with the
   frozen `approval.decisionWindowMs` reference.
6. *(Optional, if architect wants the registry symmetric)*
   `docs/design/30-domain-reference/core/capability-and-safety/README.md` §10 (line 230): note that the
   assisted-enable shape is now defined as `capabilities[id].desired`.

> If the architect prefers renaming the layer key `merge → mergePolicy` instead of correcting consumer
> prose (item 3/4), the amendment site changes to `schema-and-resolution.md` line 46 plus the canonical
> leaf-path enumeration — a larger, frozen-schema-touching change. Recommended: do NOT rename.

---

## Acceptance criteria

**AC-1 — `capabilities` block typed with named fields; core-02 `policy-disallows-capability` can
reference exact field paths.** MET. Frozen path
`ResolvedPolicy.policy.capabilities[capabilityId].desired` (table rows 1–4). Gap closed by ADDing
`"escalation-auto-grant"` so all four non-deferred registry capabilities have a field;
`orchestrator-decide` is correctly excluded (AD-14). Evidence: `schema-and-resolution.md` 134–138;
`capability-registry.md` 9–16, 36; `gate-evaluation-and-records.md` 47.

**AC-2 — `approval` and `escalationPolicy` typed; the fields core-03 needs (mode, decision-window,
risk) are named.** MET. mode → `approval.mode`; decision-window → `approval.decisionWindowMs` (ADD);
"risk" → its policy inputs `escalationPolicy.maxGrantScope` + `grantRules[]` (risk itself is
core-03-computed, not a policy block). Evidence: `schema-and-resolution.md` 72–88;
`interfaces-events-and-tests.md` 66–67; `decision-model.md` risk rules; `park-resume-and-failures.md`
26.

**AC-3 — `mergePolicy.requiredEvidence` and `changePolicy.allowedChangePaths` typed; core-05 gates
reference exact paths.** MET with a naming correction. Both types exist verbatim. The spec/consumer
string "`mergePolicy`" is wrong — the layer key is `merge`; frozen path is
`ResolvedPolicy.policy.merge.requiredEvidence`. `changePolicy.allowedChangePaths` is already correctly
bound by core-05. Evidence: `schema-and-resolution.md` 90–92, 144–150; core-05 README 105/163/247/251;
`evidence-model-and-predicates.md` 139/181.

**AC-4 — every previously-open "coordinate with…" naming question resolved or explicitly deferred.**
MET.
- fnd-01 §Open-questions "Exact field names (coordinate with core-03 / prov-01)"
  (`README.md` 51, 225): RESOLVED — all consumed field names frozen above. (prov-01 supplies
  `ScopedGrant`, which `decision-model.md` already imports; no fnd-01 policy field needs a prov-01
  name, so the prov-01 half is N/A and noted.)
- fnd-01 / core-03 "decision-window default" (`README.md` 226; core-03 README 237): RESOLVED on the
  *name* (`approval.decisionWindowMs`); the *default value* is left to the safe-defaults amendment and
  flagged below as needing an architect number.
- fnd-01 "narrow dependency-install auto-grant default-on vs opt-in" (`README.md` 52, 227): **DEFERRED
  — out of T1 scope.** It is a `provisioning` field, not a consumed core-02/03/05 policy block; T1
  owns only the capability/approval/escalation/merge/change consumed blocks. Left for the architect.

**AC-5 — proposal lists exact `docs/**` files+sections to amend; no corpus file edited.** MET. See
"Corpus impact" (6 sites). `git status docs/` confirmation is in the return digest; no file under
`docs/` was created, edited, moved, or deleted.

---

## Open issues / assumptions / risk

- **Architect ruling needed — merge key naming.** I recommend keeping `merge` and fixing consumer
  prose. If symmetry with `escalationPolicy`/`changePolicy` is preferred, the rename is a
  frozen-schema change with wider blast radius (leaf-path enumeration). Cannot be decided unilaterally.
- **Architect value needed — `decisionWindowMs` default.** This proposal freezes the *name and type*
  only. The safe default number (the open "decision-window default" question) is a policy judgment;
  I do not invent it.
- **Assumption — adding a `CapabilityPolicy` key is non-breaking.** `CapabilityPolicy` is a closed
  object; adding `"escalation-auto-grant"` adds one canonical leaf path and one safe default
  (`desired=false`). It does not change precedence semantics. Risk: any test snapshotting the exact
  `CapabilityPolicy` field set (`schema-and-resolution.md` testing strategy) must be updated.
- **Assumption — "risk" in AC-2 means risk *inputs*, not a `risk` policy block.** Backed by
  `decision-model.md`, where risk is computed from `escalationPolicy` fields. If the architect intended
  a literal `approval.risk*` block, that is a new requirement beyond the current corpus and should be
  raised separately.
- **Scope note.** prov-01 coordination in the fnd-01 open question resolves to "no fnd-01 policy field
  is owned by prov-01"; prov-01 owns `ScopedGrant`, consumed by core-03 directly, not via fnd-01. If
  prov-01 later needs a policy-named field, reopen.
