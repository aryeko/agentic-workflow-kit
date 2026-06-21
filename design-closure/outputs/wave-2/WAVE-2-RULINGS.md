# Wave 2 — architect rulings (sign-off sheet)

Status: **APPROVED — 2026-06-21.** All recommendations accepted in one pass (R-T5.3 verified moot —
see below). Wave 2 is frozen as the input for later corpus amendment; only Wave 3 (T9) remains. These
were the open choices Wave-2 surfaced (T5–T8), each with a recommended pick.

**One-pass approval:** if you accept every recommendation, reply "approve all". Otherwise mark the
specific `Amend` lines. Nothing here is applied to the corpus — these rulings will be recorded and the
proposals updated to match before any corpus edit.

Legend: **◻ Approve recommended ◻ Amend → ____**. None of these block Wave 3.

---

## T5 — fnd-03 events + concurrency

**R-T5.1 — Worktree concurrency model.** Path-lease-only inside fnd-03 (unique `<repoId>/<runId>` path
+ fnd-02 fencing), with any concurrency cap expressed via fnd-01 `RunPolicy.maxConcurrentRuns` — vs a
hard per-`repoId` singleton inside fnd-03.
**Recommended:** path-lease-only + fnd-01 cap. *Keeps the cap a policy concern; fnd-03 doesn't duplicate fnd-01's responsibility.*
**Decision:** ☑ Approve recommended **[APPROVED 2026-06-21]** ◻ Amend → ____

**R-T5.2 — Event-name ownership.** fnd-03 §6 event names are domain-owned and valid once typed — vs
core-01 maintaining a central event-name registry.
**Recommended:** domain-owned. *Matches core-01's stated envelope-agnostic, emitting-domain-owns-payload model.*
**Decision:** ☑ Approve recommended **[APPROVED 2026-06-21]** ◻ Amend → ____

**R-T5.3 — `baseRef` in `WorktreeLeaseCreatedPayload`.** ~~The T5 draft dropped `baseRef`.~~
**Correction on verification:** `baseRef: LocalRef` **is present** in the T5 draft (line 106). The
Wave-2 review's "silently dropped" claim was a reviewer error — Codex did not omit it.
**Resolution:** ruling void; no change needed. Codex's Wave 2 had no silent-narrowing slip.
**Decision:** ✔ N/A — already satisfied.

---

## T6 — core-03 (Approval & Escalation)

**R-T6.1 — Decision-window default.** `approval.decisionWindowMs = 900000` (15 min) as the fnd-01
built-in default (policy-overridable).
**Recommended:** approve 900000 ms. *Reasonable human-latency default; structure-neutral, so any number works — this is purely your call on the value.*
**Decision:** ☑ Approve recommended **[APPROVED 2026-06-21]** ◻ Amend → ____ ms

**R-T6.2 — Deadline precedence.** A request's explicit `expiresAt` wins over the policy default
(`decisionDeadline = expiresAt ?? requestedAt + decisionWindowMs`).
**Recommended:** approve (expiresAt wins), **and** have the corpus state the precedence explicitly. *Matches the existing park-resume semantics; making it explicit removes the ambiguity T6 flagged.*
**Decision:** ☑ Approve recommended **[APPROVED 2026-06-21]** ◻ Amend → ____

**R-T6.3 — Unmapped Agent grant kinds.** prov-01's frozen `ScopedGrantKind` includes values core-03's
policy taxonomy does not map (`filesystem-permission`, `mcp-elicitation-content`,
`tool-user-input-content`, one-time file-change). Block them fail-closed for v1 — vs invent policy
scopes to map them now.
**Recommended:** block fail-closed for v1. *No approved policy/risk taxonomy exists for these yet; inventing scopes would be over-reach. Revisit when the taxonomy is designed.*
**Decision:** ☑ Approve recommended **[APPROVED 2026-06-21]** ◻ Amend → ____

**R-T6.4 — `liveAnswerWindowMs` as a policy field.** Keep the live-answer window as pending-state data
(parks when elapsed) — vs promote it to its own fnd-01 policy field.
**Recommended:** keep as pending-state data (no new field). *T1 froze only `decisionWindowMs`; adding a field is scope creep beyond the frozen input.*
**Decision:** ☑ Approve recommended **[APPROVED 2026-06-21]** ◻ Amend → ____

---

## T7 — core-05 (Completion, Verification & Merge)

**R-T7.1 — Blocker-PR exclusion expansion.** Beyond the corpus's three exclusions
(`event-log-unwritable`, `head-ambiguous`, `changed-files-outside-allowlist`), also exclude dirty/missing
local evidence, `changed-file-policy-absent`, Forge-unavailable write paths, and `merge-intent-unwritable`.
**Recommended:** approve the expansion. *All are fail-closed safety exclusions; T7 logged each loudly for approval rather than baking it in silently — exactly the desired behavior.*
**Decision:** ☑ Approve recommended **[APPROVED 2026-06-21]** ◻ Amend → ____

**R-T7.2 — Unapproved protected-policy-change PRs.** Publish blocker evidence but never enqueue or
merge — vs forbid the push entirely as too risky.
**Recommended:** publish-only blocker. *Surfaces the risk without acting on it; conservative and useful. (Security-sensitive — worth a deliberate confirm.)*
**Decision:** ☑ Approve recommended **[APPROVED 2026-06-21]** ◻ Amend → ____ (forbid push)

**R-T8.1 below; T7 cross-package items are in "Provider-contract follow-ups".**

---

## T8 — event durability mapping

**R-T8.1 — `RunLifecycleTransitioned` durability.** Payload-sensitive: `barrier` for the initial three
transitions, all terminals, and any gating/irreversible transition; `durable` for non-gating mid-run
transitions — vs one fixed durability for the whole event type.
**Recommended:** approve payload-sensitive. *Faithful to the corpus's explicit per-transition barrier annotations; one fixed class would over- or under-strengthen.*
**Decision:** ☑ Approve recommended **[APPROVED 2026-06-21]** ◻ Amend → ____

**R-T8.2 — Sibling-domain durability ownership + enforcement.** core-01 owns the minimum durable/barrier
rules; sibling domains own their named event durability; enforced at `RunWriter.append` runtime.
**Recommended:** approve, **and record the `RunWriter.append` enforcement as an explicit decision** (not
just prose) so the conformance is a real contract, not a drift risk.
**Decision:** ☑ Approve recommended **[APPROVED 2026-06-21]** ◻ Amend → ____

---

## Provider-contract follow-ups (authorize + track — not Wave-2 blockers)

These need amendments in *other* domains before all core-05 merge tests are fully typeable. T7 flagged
them honestly rather than faking confirmation. They are follow-up work items, not design-closure
defects.

**F-1 — prov-02 `ForgeRuleset` required-check field.** Add the smallest normalized field so
ruleset-derived CI checks are typeable (branch-protection checks already are).
**Recommended:** approve adding the minimal field; track as a prov-02 follow-up.
**Decision:** ☑ Approve recommended **[APPROVED 2026-06-21]** ◻ Amend → ____

**F-2 — prov-04 canonical verifier `commandDigest`.** Define a canonical, pre-computable digest
(proposed input set `{kind, argv, cwd, timeoutSeconds, injection.scopeDigest}`) + a pre-run launch
surface, referenced by `ProtectedPolicySnapshotRecorded`. The field exists; the stability contract does
not.
**Recommended:** approve defining it; defer the exact input-set membership to the prov-04 owner.
**Decision:** ☑ Approve recommended **[APPROVED 2026-06-21]** ◻ Amend → ____

---

## On approval

Once these are decided: Wave 2 is frozen. The T5/T7 proposals get a small update to match
R-T5.3 / R-T7.x; F-1 and F-2 become tracked provider-domain follow-ups. Only **Wave 3 (T9)** remains
before the design is clear enough to start writing implementation story-contracts core-first.
