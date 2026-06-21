# T5 proposal - fnd-03 event payload types and concurrent-worktree policy

## Decision / answer

Recommend adopting the draft payloads in `draft/fnd-03-event-payloads.md` for all fnd-03 section 6 event names. The draft is intentionally payload-only: core-01 already owns the `RunEventEnvelope` and `AppendIntent` shape, while emitting domains own payload schemas (`docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md` section "Contracts", lines 18-35; `docs/design/30-domain-reference/core/run-lifecycle-and-state/event-log-writer-and-corruption.md` section "Event envelope", lines 30-39).

Recommend closing the concurrent-worktree-per-`repoId` question as **path-lease-only inside fnd-03**, not a hard one-live-worktree-per-`repoId` invariant. Fnd-03 already allocates `<worktreeRoot>/<repoId>/<runId>/`, creates collision-resistant local branch names, and fences cleanup/finalize through fnd-02 lease data (`docs/design/30-domain-reference/foundation/workspace-and-repository/README.md` section 4, lines 106-127 and 139-151). Fnd-02 provides atomic lease acquire/renew/fence semantics (`docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md` section 4, lines 100-118). If operators need a concurrency cap, use policy outside fnd-03: fnd-01 already has `RunPolicy.maxConcurrentRuns`, with safe default `1` (`docs/design/30-domain-reference/foundation/configuration-and-policy/schema-and-resolution.md` section "Policy blocks", lines 57-61, and section "Safe defaults", lines 155-158).

Rejected alternative: hard policy-limited one worktree per `repoId` in fnd-03. It would narrow a currently open option without a cited local-git safety requirement, duplicate existing run concurrency policy, and block valid isolated worktrees whose paths and branches are already independently fenced.

## Proposed artifact or change

Add a typed fnd-03 event-payload section, using the draft file as the starting point:

- `design-closure/outputs/wave-2/T5/draft/fnd-03-event-payloads.md`

The draft covers these fnd-03 section 6 event names: `WorktreeLeaseCreated`, `LocalBranchCreated`, `RepoSetupEvaluated`, `RepoSetupConfirmed`, `LocalGitEvidenceRecorded`, `WorktreeLeaseFinalized`, `WorktreeCleanupRetryScheduled`, `WorktreeCleanupCompleted`, and `WorktreeCleanupBlocked` (`docs/design/30-domain-reference/foundation/workspace-and-repository/README.md` section 6, lines 171-178).

Field-shape basis:

- `WorktreeLeaseCreated` and `LocalBranchCreated` use fnd-03's `WorktreeLease` and branch-model fields: `leaseId`, `epoch`, `runId`, `repoId`, `worktreePath`, `baseRef`, `baseSha`, `branchName`, and lifecycle states (`docs/design/30-domain-reference/foundation/workspace-and-repository/README.md` section 4, lines 105-127).
- `RepoSetupEvaluated` and `RepoSetupConfirmed` use the `DeclaredSetup` and `SetupEvaluation` shapes, including freshness reasons and the post-Execution Host confirmation handoff (`docs/design/30-domain-reference/foundation/workspace-and-repository/README.md` section 4, lines 90-104, and section 5, lines 153-170).
- `LocalGitEvidenceRecorded` uses fnd-03's local-git evidence contents and boundary exclusions (`docs/design/30-domain-reference/foundation/workspace-and-repository/README.md` section 4, lines 128-137).
- `WorktreeLeaseFinalized` cites the evidence required before finalization (`docs/design/30-domain-reference/foundation/workspace-and-repository/README.md` section 4, lines 120-122).
- Cleanup events use fnd-03 cleanup fencing, blocked-retry records, tombstones, branch deletion rules, and settled-cleanup semantics (`docs/design/30-domain-reference/foundation/workspace-and-repository/README.md` section 4, lines 138-151; section 8, lines 204-220).

`LocalGitEvidenceRecordedPayload` carries exactly what core-05 consumes by keeping `headSha`, `changedPaths`, and `clean` as top-level fields. Core-05 selects the candidate head from the latest usable `LocalGitEvidence.headSha`, fails closed on missing/ambiguous/dirty evidence, and classifies changed paths from `LocalGitEvidence.changedPaths` (`docs/design/30-domain-reference/core/completion-and-merge/README.md` section 4, lines 122-139; `docs/design/30-domain-reference/core/completion-and-merge/evidence-model-and-predicates.md` sections "Evidence anchoring" and "Protected policy and changed files", lines 21-28 and 75-87).

The draft deliberately omits `fenceToken` from durable event payloads. Fnd-03's in-process `WorktreeLease` includes a `fenceToken`, but fnd-02 states token secrets are returned only in `LeaseCapability`; persisted records and snapshots expose `tokenDigest` instead (`docs/design/30-domain-reference/foundation/workspace-and-repository/README.md` section 4, lines 106-110; `docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md` section 4, lines 100-110).

## Corpus impact

Files and sections to amend later:

- `docs/design/30-domain-reference/foundation/workspace-and-repository/README.md` section 6 "Events & data": add typed payload definitions or link to a sibling `events.md`; replace the current name-only list with the typed list.
- `docs/design/30-domain-reference/foundation/workspace-and-repository/README.md` section 4 "Local git evidence": clarify that `headSha`, `changedPaths`, and `clean` are top-level `LocalGitEvidence` fields because core-05 consumes them by those names.
- `docs/design/30-domain-reference/foundation/workspace-and-repository/README.md` section 10 "Open questions": close "Should concurrent worktrees per `repoId` be limited by policy or only by path-level leases?" as path-lease-only for fnd-03, with run-level caps handled by fnd-01.
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md` section 6 "Events & data": either remove the fnd-03 open question dependency or state that sibling-domain event names are domain-owned and valid once listed in the emitting domain.
- Optional: `docs/design/30-domain-reference/core/completion-and-merge/README.md` section 5 "Contracts & interfaces" or `evidence-model-and-predicates.md` section "Evidence anchoring": link to the finalized fnd-03 `LocalGitEvidenceRecordedPayload`.

No corpus file was edited.

## Acceptance criteria

1. Every event listed by name in fnd-03 section 6 has a typed payload in the draft.
   - Met in `draft/fnd-03-event-payloads.md` section "Payloads"; the covered event list matches fnd-03 section 6 (`docs/design/30-domain-reference/foundation/workspace-and-repository/README.md` lines 171-178).

2. Payload field shapes match prose semantics; `LocalGitEvidence` carries exactly what core-05 consumes.
   - Met. Worktree, setup, evidence, finalization, and cleanup fields are derived from fnd-03 sections 4-8 (`docs/design/30-domain-reference/foundation/workspace-and-repository/README.md` lines 90-170 and 204-220). `LocalGitEvidenceRecordedPayload` includes top-level `headSha`, `changedPaths`, and `clean` because core-05 consumes those fields for candidate head, changed-file classification, and dirty-worktree fail-closed behavior (`docs/design/30-domain-reference/core/completion-and-merge/README.md` lines 122-139; `docs/design/30-domain-reference/core/completion-and-merge/evidence-model-and-predicates.md` lines 26-28 and 75-87).

3. A recommendation closes the concurrent-worktree-per-`repoId` question.
   - Met. Recommendation: fnd-03 should be path-lease-only, with any run concurrency cap expressed by fnd-01 policy. Rationale cites fnd-03 path allocation and branch collision suffixes, fnd-02 lease fencing, and fnd-01 `maxConcurrentRuns` (`docs/design/30-domain-reference/foundation/workspace-and-repository/README.md` lines 112-127; `docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md` lines 100-118; `docs/design/30-domain-reference/foundation/configuration-and-policy/schema-and-resolution.md` lines 57-61 and 155-158).

4. Notes dependency on a core-01 event-name decision; flags if unfrozen.
   - Met. Fnd-03 still asks which Foundation event names core-01 will standardize (`docs/design/30-domain-reference/foundation/workspace-and-repository/README.md` lines 233-237). Current core-01 does not freeze sibling event names centrally: it accepts any valid `RunEventEnvelope`, keeps payload-specific meaning with the emitting domain, and preserves unknown future payloads (`docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md` lines 168-173; `docs/design/30-domain-reference/core/run-lifecycle-and-state/event-log-writer-and-corruption.md` lines 30-39). Architect ruling needed: either standardize fnd-03 names centrally in core-01 or declare the fnd-03 section 6 names domain-owned and sufficient.

5. Lists corpus files and sections to amend; no corpus file is edited.
   - Met in "Corpus impact." Current git diff shows no `docs/**` changes; current git status shows the T5 output files plus unrelated T6/T8 worker outputs.

## Minimal-change justification

No existing typed fnd-03 event payload shape was changed; fnd-03 section 6 currently lists event names only (`docs/design/30-domain-reference/foundation/workspace-and-repository/README.md` lines 171-178).

The draft stays minimal by:

- Reusing core-01's existing `RunEventEnvelope`/`AppendIntent` instead of proposing a new envelope (`docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md` lines 18-35).
- Reusing fnd-03's existing worktree, setup, evidence, and cleanup prose fields rather than adding remote, Forge, CI, process, or worker-report data outside fnd-03's hard local-git boundary (`docs/design/30-domain-reference/foundation/workspace-and-repository/README.md` lines 53-61 and 128-137).
- Keeping only top-level `headSha`, `changedPaths`, and `clean` as a deliberate shape choice forced by core-05's cited consumer paths (`docs/design/30-domain-reference/core/completion-and-merge/evidence-model-and-predicates.md` lines 26-28 and 75-87).

Optional upgrades:

- Add a dedicated `events.md` sibling file for fnd-03 if section 6 becomes too large. This is editorial only; it is not required for the typed contract.
- Add `leaseRecordDigest` consistently to all lease lifecycle payloads if architects want every fnd-03 lease event to cite the fnd-02 lease record digest. The draft includes it only on creation because fnd-02 exposes record digests in persisted lease records, but no cited core consumer currently requires it (`docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md` lines 100-103).

## Contradiction & open-choice log

- Open choice: fnd-03 asks which Foundation event names core-01 will standardize, but current core-01 keeps sibling payload semantics with emitting domains and preserves unknown event types. Recommendation: do not create a central core-01 registry for fnd-03 names unless another task requires it; declare the fnd-03 section 6 names domain-owned and valid once typed in fnd-03 (`docs/design/30-domain-reference/foundation/workspace-and-repository/README.md` lines 233-237; `docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md` lines 168-173).
- Open choice: `fenceToken` appears in fnd-03's `WorktreeLease` handle, but fnd-02 treats lease tokens as secrets and exposes persisted token digests. Recommendation: keep `fenceToken` out of run-log payloads; record `leaseId`/`epoch` and optional non-secret lease digest only (`docs/design/30-domain-reference/foundation/workspace-and-repository/README.md` lines 106-110; `docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md` lines 108-110).
- Open choice closed by recommendation: concurrent worktrees per `repoId`. Recommendation: path-lease-only in fnd-03, with run-level caps in fnd-01 policy; no fnd-03 per-`repoId` singleton (`docs/design/30-domain-reference/foundation/workspace-and-repository/README.md` lines 50-51 and 233-234; `docs/design/30-domain-reference/foundation/configuration-and-policy/schema-and-resolution.md` lines 57-61).
- Potential shape drift: fnd-03 prose groups `changedPaths` under "diff", while core-05 cites `LocalGitEvidence.changedPaths`. Recommendation: type it as a top-level field and explain that `fromSha`, `toSha`, `statRef`, and `patchRef` are the rest of the diff evidence (`docs/design/30-domain-reference/foundation/workspace-and-repository/README.md` lines 129-133; `docs/design/30-domain-reference/core/completion-and-merge/evidence-model-and-predicates.md` lines 75-83).

No existing option is proposed for removal except rejecting a new hard per-`repoId` singleton rule for fnd-03.

## Open issues / assumptions / risk

- The missing/moved worktree repair question remains open and is intentionally not solved by T5 (`docs/design/30-domain-reference/foundation/workspace-and-repository/README.md` lines 233-236). Cleanup payloads represent blocked, retry, and completed outcomes without deciding whether recreation from `baseSha` is allowed.
- The draft assumes fnd-03 event payloads request `durable` durability unless batched by core-01 with a lifecycle `barrier`. T8 owns final event-to-durability mapping; core-01 already normalizes multi-intent batches to the strongest requested durability (`docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md` lines 131-136).
- The proposal does not add a new fnd-01 `maxConcurrentWorktreesPerRepoId` field. If architects want repo-specific caps beyond `RunPolicy.maxConcurrentRuns`, that should be a separate fnd-01 policy amendment, not an implicit fnd-03 invariant.
