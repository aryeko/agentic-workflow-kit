# Wave 2 - summary for architect review

This wave produced proposals only. The live design corpus under `docs/**` was read-only; no corpus file
was edited. Each task proposal includes the required `Minimal-change justification` and
`Contradiction & open-choice log` sections.

## Task status

| Task | Status | Proposed decision / artifact | ACs met | Blockers |
|---|---|---|---|---|
| T5 - fnd-03 event payloads + concurrent-worktree policy | Complete | Adds draft typed payloads for every fnd-03 section 6 event in `T5/draft/fnd-03-event-payloads.md`; recommends **path-lease-only** concurrency inside fnd-03, with run caps handled by fnd-01 policy. | Met. Every named event has a payload; `LocalGitEvidenceRecordedPayload` keeps `headSha`, `changedPaths`, and `clean` as top-level core-05-consumed fields; corpus impact is listed. | None. |
| T6 - core-03 Approval & Escalation closure | Complete | Recommends `approval.decisionWindowMs = 900000` ms by default; specifies deterministic `PolicyGrantPlan -> ScopedGrant` mapping and fail-closed `approval-grant-mapping-invalid` cases. | Met. Uses T1-frozen `approval.decisionWindowMs` and T2-frozen `ScopedGrant` without reshaping them; lists valid and invalid mappings; corpus impact is listed. | None. |
| T7 - core-05 Completion, Verification & Merge closure | Complete with follow-up amendments | Binds trusted evidence to T1-frozen `policy.merge.requiredEvidence`; derives CI required checks from Forge branch protection plus ruleset evidence; enumerates blocker-PR eligibility/exclusions; flags prov-04 digest contract as partially insufficient. | Met. Required-evidence source and blocker classifier are specified; prov-04 `commandDigest` gap is explicitly flagged as required amendment rather than silently confirmed; corpus impact is listed. | None from T1. Follow-up amendments needed in prov-02/prov-04 before all tests are fully typeable. |
| T8 - event durability class mapping | Complete | Maps core-01 run-log events to `durable` or `barrier`; keeps fnd-02/T4 `DurabilityClass` and `AppendBatch` unchanged; recommends payload-sensitive durability for `RunLifecycleTransitioned`. | Met. Core-01-owned events are mapped; sibling-domain events are covered by minimum durable/barrier rules; barrier rows are justified; corpus impact is listed. | None from T4. |

## Architect approvals needed

1. **T5 event-name ownership:** approve whether fnd-03 section 6 event names are domain-owned and
   sufficient once typed, or whether core-01 must centrally standardize them.
2. **T5 concurrency policy:** approve path-lease-only for fnd-03, with any concurrency cap expressed
   through fnd-01 run policy rather than a hard per-`repoId` singleton in fnd-03.
3. **T6 decision-window default:** approve or amend the proposed `900000` ms default for
   `approval.decisionWindowMs`.
4. **T6 unmapped Agent grant kinds:** approve fail-closed handling for prov-01 `ScopedGrantKind`
   values that core-03 does not currently map through policy-level scopes.
5. **T7 Forge ruleset evidence:** approve adding the smallest normalized prov-02 ruleset
   required-check field so ruleset-derived CI checks are typeable.
6. **T7 verifier digest:** approve defining the prov-04 canonical, precomputable verifier
   `commandDigest` contract and referencing it from `ProtectedPolicySnapshotRecorded`.
7. **T7 blocker PR narrowing:** approve the conservative blocker-PR eligible and excluded state lists,
   including whether `protected-policy-change-unapproved` may publish blocker evidence but never enqueue
   or merge.
8. **T8 lifecycle durability:** approve payload-sensitive `RunLifecycleTransitioned` durability rather
   than one fixed durability for the event type.
9. **T8 sibling-domain boundary:** approve core-01 owning minimum durability rules while sibling domains
   own their named event-specific durability classifications.

## Wave-1 consistency check

- T6 is consistent with Wave-1 T1/T2: it uses `approval.decisionWindowMs` and keeps the T2
  `ScopedGrant` shape unchanged.
- T7 is consistent with Wave-1 T1: it uses `ResolvedPolicy.policy.merge.requiredEvidence`, not the
  loose `mergePolicy.requiredEvidence` wording from the task prompt.
- T8 is consistent with Wave-1 T4: it keeps `DurabilityClass = "buffered" | "durable" | "barrier"` at
  fnd-02 while narrowing canonical core-01 run-log usage to `durable | barrier`.
- No Wave-1 input was missing or ambiguous enough to block Wave 2. The surfaced conflicts are design
  follow-ups, not blockers.

## Outputs

- `design-closure/outputs/wave-2/T5/proposal.md`
- `design-closure/outputs/wave-2/T5/draft/fnd-03-event-payloads.md`
- `design-closure/outputs/wave-2/T6/proposal.md`
- `design-closure/outputs/wave-2/T7/proposal.md`
- `design-closure/outputs/wave-2/T8/proposal.md`

## Verification

- Required task proposals present for T5, T6, T7, and T8.
- Mandatory sections present in every task proposal: `Decision / answer`, `Proposed artifact or
  change`, `Corpus impact`, `Acceptance criteria`, `Minimal-change justification`,
  `Contradiction & open-choice log`, and `Open issues / assumptions / risk`.
- `git diff -- docs` returned empty; `git status --short -- docs` returned empty.
- Only Wave 2 output files were added under `design-closure/outputs/wave-2/`.

Stop point: Wave 2 is ready for architect review. Wave 3 has not been started.
