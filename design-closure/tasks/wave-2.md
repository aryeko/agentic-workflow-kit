# Wave 2 — core closures + remaining types (T5–T8)

Read `../README.md` first. These specs state **what** and **why** plus acceptance criteria; *how* is the
session's call. **Wave 2 consumes frozen Wave-1 decisions** — read the relevant Wave-1 proposals under
`outputs/wave-1/` before running a dependent task, and if a needed decision is missing or ambiguous,
record it as a blocker rather than inventing it. T5 is independent; T6/T7/T8 depend on Wave-1 outputs.
Write only under `outputs/wave-2/<TASK-ID>/`.

---

## T5 — Author fnd-03 event payload types + concurrent-worktree policy · AUTHORING

**Why:** fnd-03 lists its event payloads by name only (untyped); core-01 and core-05 integrate against
them. One open policy question (concurrent worktrees per `repoId`) also blocks the lease-creation path.

**In scope:** the fnd-03 Workspace & Repository domain; core-01 (event-name standardization); core-05
(consumes `LocalGitEvidence`).

**Produce:** proposed typed event payloads for fnd-03 (draft), plus a recommendation on
concurrent-worktree-per-`repoId`.

**Acceptance criteria:**
1. Every event listed by name in fnd-03 §6 (`WorktreeLeaseCreated`, `LocalGitEvidenceRecorded`, etc.) has a typed payload in the draft.
2. Payload field shapes match the prose semantics (cite sections); the `LocalGitEvidence` shape carries exactly what core-05 consumes.
3. A recommendation closes the concurrent-worktree-per-`repoId` question (policy-limited vs path-lease-only), with rationale.
4. Notes any dependency on a core-01 event-name decision; if that name set is itself unfrozen, flag it.
5. The proposal lists corpus files+sections to amend; **no corpus file is edited.**

---

## T6 — Close core-03 (Approval & Escalation) · DECISION · depends on Wave-1 T1, T2

**Why:** two gaps block the park/resume and grant-answer paths: no decision-window default, and no
specified mapping from core-03's grant scope vocabulary to prov-01's `ScopedGrant`.

**Frozen inputs:** the Wave-1 T1 proposal (policy field names for approval/escalation) and the Wave-1
T2 proposal (frozen `ScopedGrant` shape). **In scope:** the core-03 Approval & Escalation domain.

**Produce:** a recommendation closing both gaps.

**Acceptance criteria:**
1. A decision-window default is proposed (numeric, with where it is configurable via the T1 approval policy fields); the "expired parked request" and live-answer time-box cases become testable.
2. A deterministic `PolicyGrantPlan → ScopedGrant` scope-mapping is specified, reconciling core-03's scope values with the T2-frozen `ScopedGrant.scope` values; the `approval-grant-mapping-invalid` case becomes testable.
3. Both proposals are consistent with the frozen Wave-1 T1/T2 decisions (cite them); any conflict with them is surfaced, not silently resolved.
4. If T1 or T2 outputs are missing/ambiguous for what this task needs, that is recorded as a blocker.
5. The proposal lists corpus files+sections to amend; **no corpus file is edited.**

---

## T7 — Close core-05 (Completion, Verification & Merge) · DECISION · depends on Wave-1 T1

**Why:** the merge predicate can't be fully specified: the trusted-check / `requiredEvidence` source is
undefined, what classifies a "blocker PR" isn't enumerated, and the verifier `commandDigest` from
prov-04 must be confirmed stable.

**Frozen input:** the Wave-1 T1 proposal (`mergePolicy.requiredEvidence`, `changePolicy.allowedChangePaths`).
**In scope:** the core-05 Completion & Merge domain; prov-04 Execution Host (for `commandDigest`);
prov-02 Forge (protection/check evidence).

**Produce:** a recommendation closing the three gaps.

**Acceptance criteria:**
1. The trusted-check / `requiredEvidence` source is defined (which Forge protection/ruleset evidence + which T1 merge-policy field), so `merge-required-check-missing` becomes testable.
2. The event/evidence conditions that classify a Forge operation as a "blocker PR" are enumerated, so the blocker-PR path becomes testable.
3. Confirms prov-04 exposes a stable verifier `commandDigest` for the `ProtectedPolicySnapshotRecorded` event (or flags that it does not).
4. All proposals are consistent with the frozen Wave-1 T1 policy fields (cite them); missing/ambiguous T1 input for this task is recorded as a blocker.
5. The proposal lists corpus files+sections to amend; **no corpus file is edited.**

---

## T8 — Settle durability-class-per-event · DECISION · depends on Wave-1 T4

**Why:** core-01's `AppendBatch.durability` can't be finalized until each run-log event type has a
durability class.

**Frozen input:** the Wave-1 T4 output (the typed `DurabilityClass` + `AppendBatch`). **In scope:** the
core-01 Run Lifecycle & Event State domain; fnd-02 Storage & Artifacts (durability rules).

**Produce:** a proposed event→durability mapping.

**Acceptance criteria:**
1. A table maps every run-log event type → `durable` or `barrier` (no lifecycle/evidence event left `buffered`), consistent with the T4-typed `DurabilityClass`.
2. Each assignment cites the durability rule it follows (from fnd-02 / core-01 prose).
3. Barrier events are justified (why an ordering barrier is required there).
4. If the T4 output is missing/ambiguous, that is recorded as a blocker.
5. The proposal lists corpus files+sections to amend; **no corpus file is edited.**
