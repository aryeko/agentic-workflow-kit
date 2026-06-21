---
title: "T7 - Close core-05 Completion, Verification & Merge - PROPOSAL"
task: "T7 / core-05 - design-closure wave-2 (DECISION task)"
status: "recommendation - NOT applied; no corpus file edited"
owner: "T7 worker"
date: "2026-06-21"
---

# T7 - Close core-05 Completion, Verification & Merge

This is a decision proposal for architect review. It does not edit the live corpus.

## Decision / answer

### Recommendation

1. **Trusted checks / required evidence.** Use the frozen T1 field
   `ResolvedPolicy.policy.merge.requiredEvidence`, not `mergePolicy.requiredEvidence`, as the policy
   switch for required evidence classes. For the `ci` class, the trusted required-check source should be
   the Forge evidence snapshot: applicable branch-protection required status-check contexts plus
   applicable ruleset required-check rules, compared against the same snapshot's status/check rollup for
   the exact candidate head. This follows T1's frozen `policy.merge` path and existing `MergePolicy`
   enum, core-05's merge predicate, and prov-02's exact-head Forge evidence model.
   Evidence: `design-closure/outputs/wave-1/WAVE-1-SUMMARY.md` §T1; `design-closure/outputs/wave-1/T1/draft/resolved-policy.contract.md` §merge;
   `docs/design/30-domain-reference/core/completion-and-merge/evidence-model-and-predicates.md` §Merge predicate;
   `docs/design/30-domain-reference/providers/forge-collaboration/contracts-and-conformance.md` §Contract types.

2. **Blocker PR classification.** Classify a Forge operation as a blocker PR only when it is a
   `ForgeOperationIntentRecorded` for `push-branch`, `upsert-pr`, or `publish-blocker-evidence` with
   blocker purpose, cites a committed non-ready `CompletionDecisionRecorded` or `MergeDecisionRecorded`,
   is bound to a safe exact `headSha`, and is allowed by
   `ResolvedPolicy.policy.merge.runnerMayPush` plus `.runnerMayOpenPr`. It must never emit enqueue or
   merge intent and must never mark the Work Source task complete. Evidence: core-05 README §Events &
   data and §Design; core-05 evidence subfile §Blocker-evidence PR behavior; fnd-03 README §Local git
   evidence.

3. **Verifier command digest.** Flag prov-04 as **partially insufficient** for the protected-policy
   snapshot. It exposes `CommandResult.commandDigest`, and its conformance target says command/output
   digest stability is tested, but the corpus does not define a canonical digest algorithm or a pre-run
   digest surface that `ProtectedPolicySnapshotRecorded` can use at launch. Amend prov-04/core-05 so the
   same stable verifier command digest can be computed before `runCommand(verify)` and later matched to
   `RunnerCommandCaptured`. Evidence: prov-04 README §Responsibilities, §Design, §Contracts &
   interfaces, §Testing strategy; prov-04 contracts §Contract types; core-05 evidence subfile
   §Protected policy and changed files; architecture protected-policy gate §Snapshot record.

### Alternatives rejected

- **Rename `policy.merge` to `policy.mergePolicy`.** Rejected because Wave-1 T1 explicitly freezes the
  layer key as `merge` and says task specs using `mergePolicy` are loose prose, not the schema key.
  Evidence: Wave-1 summary §T1; T1 draft §PolicyLayer.

- **Use configured check names in fnd-01 policy.** Rejected for v1 because T1 preserved
  `merge.requiredEvidence` as a string-literal evidence-class array, not a richer object array or check
  allowlist. The authoritative required-check names should come from Forge's protection/ruleset
  evidence, because core-05 already says missing required checks from that source fail closed.
  Evidence: Wave-1 summary §T1; fnd-01 schema §Policy blocks; core-05 evidence subfile §Merge
  predicate.

- **Treat every failed completion/merge state as blocker-PR eligible.** Rejected because existing
  core-05 prose already forbids blocker intents for unwritable event logs, ambiguous heads, and
  outside-allowlist changes; fnd-03 and core-05 also make dirty or missing local evidence unsafe before
  Forge writes. Evidence: core-05 evidence subfile §Blocker-evidence PR behavior and §Evidence
  anchoring; fnd-03 README §Local git evidence.

## Proposed artifact or change

### 1. Trusted-check / `requiredEvidence` binding

Define `policy.merge.requiredEvidence` as an evidence-class gate:

| `requiredEvidence` token | Required source | Missing / negative result |
|---|---|---|
| `verification` | Fresh runner-owned `verify` capture, bracketed by clean pre/post local git evidence for the same `headSha`. | Completion/merge cannot proceed; use existing verification states. |
| `ci` | Required check identifiers derived from Forge protection/ruleset evidence and matched against `ForgeStatusCheckFacts.contexts` for the exact head. | Missing context: `merge-required-check-missing`; present but non-success: `merge-required-check-failed`. |
| `review` | `ForgePrStateFacts.reviewDecision === "APPROVED"` for the exact head. | `merge-review-not-approved`. |
| `threads-resolved` | All `ForgeReviewThreadFacts.threads[].isResolved === true`; thread state must be inspectable. | `merge-unresolved-review-threads` or Forge thread degraded state. |
| `protection` | Fresh `ForgeProtectionFacts` plus fresh positive Forge `canInspectProtection`; fresh positive `supportsRulesets` when rulesets are applicable. | `merge-protection-snapshot-stale` or Forge degraded state. |

For `ci`, the normalized required-check set is:

- Branch protection: the applicable `ForgeBranchProtectionRule.requiredStatusCheckContexts` where the
  branch-protection rule applies to the PR target branch and `requiresStatusChecks` is true.
- Rulesets: applicable status/check requirements from `RepositoryRuleset.rules`.

The current prov-02 typed `ForgeRuleset` carries only `id`, `name`, `enforcement`, and `target`, even
though the dated GitHub evidence says `RepositoryRuleset` exposes `rules`. Therefore ruleset-derived
required checks need a small prov-02 type amendment before ruleset-only `merge-required-check-missing`
tests are fully typeable. Evidence: prov-02 contracts §Contract types; prov-02 evidence appendix
§Observed shape used by the design.

### 2. Blocker PR event/evidence conditions

Add a normative classifier to core-05 prose:

```ts
type ForgeOperationPurpose = "candidate-pr" | "blocker-evidence-pr";
```

A Forge operation is a blocker PR operation when all of these conditions hold:

1. A committed `CompletionDecisionRecorded` or `MergeDecisionRecorded` exists at or before the replay
   cursor and is cited by the `ForgeOperationIntentRecorded`.
2. The cited decision state is not ready:
   - completion: `completion-pending-evidence`, `claim-evidence-mismatch`,
     `verification-failed`, `verification-uncertain`, or `protected-policy-change-unapproved`;
   - merge: `merge-policy-disabled`, `merge-required-check-missing`,
     `merge-required-check-failed`, `merge-review-not-approved`,
     `merge-unresolved-review-threads`, `merge-protection-snapshot-stale`,
     `merge-branch-not-fresh`, or `merge-capability-denied`.
3. The operation kind is `push-branch`, `upsert-pr`, or `publish-blocker-evidence` and the intent
   carries `purpose = "blocker-evidence-pr"`.
4. The latest usable `LocalGitEvidenceRecorded` for the active lease gives a single clean `headSha`;
   `expectedHeadSha` on the Forge intent equals that `headSha`.
5. Changed-path classification has no `outside-allowlist` and no `unclassified` result. A
   `protected-policy-change-unapproved` decision may be published only as blocker evidence and remains
   ineligible for enqueue or merge.
6. `ResolvedPolicy.policy.merge.runnerMayPush === true` and
   `ResolvedPolicy.policy.merge.runnerMayOpenPr === true`.
7. The event log is writable and the blocker intent can be appended at barrier durability before any
   Forge write.

Do not classify or emit blocker PR operations for these states or evidence conditions:

- `event-log-unwritable` or `merge-intent-unwritable`;
- `head-ambiguous`, `merge-head-ambiguous`, missing local git evidence, or dirty worktree evidence;
- `changed-files-outside-allowlist` or `changed-file-policy-absent`;
- `merge-forge-unavailable` or Forge credential/auth/degraded states that prevent safe push or PR
  writes;
- any `MergeIntentRecorded` operation (`enqueue` or `merge`).

This deliberately leaves blocker PRs as evidence-publication only: they do not imply completion, Work
Source task closure, queue, or merge. Evidence: core-05 README §Design, §Events & data, and §Failure &
degraded modes; core-05 evidence subfile §Evidence anchoring, §Decision states, §Merge predicate, and
§Blocker-evidence PR behavior; fnd-03 README §Local git evidence.

### 3. Stable verifier `commandDigest`

Amend prov-04 and core-05 to say:

- `commandDigest` is a stable SHA-256 digest over a canonical JSON representation of the runner-owned
  command identity: `{ kind, argv, cwd, timeoutSeconds, injection.scopeDigest }`, with keys sorted,
  strings UTF-8 encoded, no ambient environment, no raw secret values, and no output fields.
- The Control plane can compute the planned verify digest before launch from `HostCommandRequest` and
  store it as `ProtectedPolicySnapshotRecorded.verifierCommandDigest`.
- `RunnerCommandCaptured` / `CommandResult.commandDigest` must equal that planned digest for the
  verification evidence to satisfy core-05 freshness.
- If the Execution Host cannot compute or return this digest, the result is
  `runner-command-capture-incomplete` and core-05 returns `verification-uncertain`.

This is an amendment because the current corpus exposes a `commandDigest` field but does not define
the canonical digest or pre-run launch snapshot surface. Evidence: prov-04 contracts §Contract types;
prov-04 README §Testing strategy; core-05 evidence subfile §Verification freshness and §Protected
policy and changed files.

## Corpus impact

No corpus file was edited. If approved, amend:

1. `docs/design/30-domain-reference/core/completion-and-merge/README.md`
   - §Open questions: close "Trusted-check source configuration" by pointing to
     `ResolvedPolicy.policy.merge.requiredEvidence` and Forge protection/ruleset evidence.
   - §Events & data: add blocker-purpose wording for `ForgeOperationIntentRecorded` and clarify that
     blocker PR operations are not merge intents.
2. `docs/design/30-domain-reference/core/completion-and-merge/evidence-model-and-predicates.md`
   - §Protected policy and changed files: use `verifierCommandDigest` terminology.
   - §Merge predicate: bind required checks to `policy.merge.requiredEvidence` and normalized Forge
     protection/ruleset required-check names.
   - §Blocker-evidence PR behavior: add the eligible and excluded state lists above.
3. `docs/design/30-domain-reference/providers/forge-collaboration/contracts-and-conformance.md`
   - §Contract types: enrich `ForgeRuleset` or add a normalized ruleset required-check DTO so
     ruleset-derived required checks are typeable.
4. `docs/design/30-domain-reference/providers/forge-collaboration/README.md`
   - §Open questions: close trusted-check source configuration once the ruleset DTO is amended.
5. `docs/design/30-domain-reference/providers/execution-host/contracts-and-conformance.md`
   - §Contract types: define canonical `commandDigest` inputs and stability requirements.
6. `docs/design/30-domain-reference/providers/execution-host/README.md`
   - §Design / §Testing strategy: state that `commandDigest` is precomputable for runner-owned verify
     commands and must match captured command evidence.
7. `docs/design/10-architecture/protected-policy-gate.md`
   - §Snapshot record: replace "verifier command" with "verifier command digest" and cite the
     prov-04 canonical digest contract.
8. `docs/design/10-architecture/evidence-gates-and-merge.md`
   - §Completion vs merge: optionally clarify the trusted-check source in the high-level summary.

## Acceptance criteria

**AC-1 - Trusted-check / `requiredEvidence` source is defined.** Met with one required follow-up
amendment. The policy field is the frozen T1 path `ResolvedPolicy.policy.merge.requiredEvidence`. The
check-name source is Forge protection/ruleset evidence, and the check-result source is
`ForgeStatusCheckFacts.contexts` for the same exact head. Branch-protection check names are already
typed as `requiredStatusCheckContexts`; ruleset required checks need a small prov-02 DTO amendment
because the current `ForgeRuleset` type does not expose `RepositoryRuleset.rules`.

**AC-2 - Blocker PR classification conditions are enumerated.** Met. The proposal lists required
source events, eligible completion/merge states, exact-head/local-git conditions, policy fields,
allowed Forge operation kinds, barrier append requirement, and excluded states/conditions.

**AC-3 - prov-04 stable verifier `commandDigest` confirmed or flagged.** Flagged. prov-04 exposes
`CommandResult.commandDigest` and has command/output digest stability as a conformance target, but it
does not define a canonical digest algorithm or a pre-run digest surface for
`ProtectedPolicySnapshotRecorded`. The proposal records the necessary amendment.

**AC-4 - Consistent with frozen Wave-1 T1 fields.** Met. The proposal uses `policy.merge`, not
`mergePolicy`, preserves `requiredEvidence` as the existing string-literal array, and uses
`policy.merge.runnerMayPush`, `.runnerMayOpenPr`, and `changePolicy.allowedChangePaths` without
renaming or restructuring. No missing T1 input blocks T7.

**AC-5 - Corpus files/sections listed; no corpus file edited.** Met. See "Corpus impact." This worker
has written only this proposal under `design-closure/outputs/wave-2/T7/`.

## Minimal-change justification

- **No T1 schema rename.** The proposal keeps `policy.merge` and does not rename it to
  `mergePolicy`, because Wave-1 T1 freezes the key and the README says consumer prose should be
  corrected instead.
- **No richer fnd-01 evidence object array.** Required-check names are not added to policy. The cited
  consumer requirement is core-05's predicate that required checks come from Forge
  protection/ruleset evidence; policy only chooses required evidence classes.
- **Small prov-02 type addition only where needed.** Branch-protection required checks are already
  typed; only ruleset-derived required checks need a normalized typed field because current
  `ForgeRuleset` omits the `rules` detail that the evidence appendix says GitHub exposes.
- **Small prov-04 digest clarification.** The proposal does not add raw argv to core-05 evidence.
  It defines how the existing digest becomes stable and precomputable so `ProtectedPolicySnapshotRecorded`
  can bind verifier identity without persisting secrets.
- **Blocker PR classifier adds purpose, not new Forge powers.** The proposal uses existing
  `push-branch`, `upsert-pr`, and `publish-blocker-evidence` intents and explicitly excludes enqueue
  and merge.

### Optional upgrades

- Add a richer `RequiredCheckRef` object that records provider, source (`branch-protection` or
  `ruleset`), rule id/pattern, and check name for diagnostics. This is not required for the core gate;
  the minimal gate only needs normalized check names plus source refs.

## Contradiction & open-choice log

- **Spec-vs-frozen-input naming conflict:** the task text says `mergePolicy.requiredEvidence`, but
  Wave-1 T1 freezes the key as `policy.merge.requiredEvidence`. Recommendation: keep `policy.merge`
  and treat `mergePolicy` as loose prose/type-name shorthand.
- **prov-02 ruleset type drift:** the dated evidence says `RepositoryRuleset` exposes `rules`, but the
  typed `ForgeRuleset` does not expose required-check rule details. Recommendation: add the smallest
  normalized ruleset required-check field needed by core-05.
- **prov-04 digest stability gap:** `CommandResult.commandDigest` exists, but stable digest inputs and
  pre-run computation are not specified. Recommendation: define canonical digest inputs in prov-04 and
  reference them from core-05.
- **Blocker PR narrowing choice:** core-05 currently names three no-intent exclusions
  (`event-log-unwritable`, `head-ambiguous`, `changed-files-outside-allowlist`). This proposal also
  excludes dirty/missing local evidence, `changed-file-policy-absent`, Forge-unavailable write paths,
  and merge-intent-unwritable because those conditions cannot prove a safe exact Forge write. Architect
  approval is needed because this narrows blocker PR eligibility.
- **Protected policy blocker choice:** this proposal allows `protected-policy-change-unapproved` to be
  published only as blocker evidence when all other safe-head and push/PR policy checks pass; it still
  forbids enqueue/merge. Architect may instead forbid blocker PR publication for unapproved protected
  policy changes if the push itself is considered too risky.

## Open issues / assumptions / risk

- Ruleset-derived required checks remain only proposal-level until prov-02 exposes a typed normalized
  required-check field.
- The canonical `commandDigest` input set should be reviewed by the prov-04 owner, especially whether
  `timeoutSeconds` and `injection.scopeDigest` belong in command identity or only in execution context.
- The blocker PR eligible-state list is intentionally conservative; it may reduce diagnostic PRs in
  cases where local or Forge evidence is degraded, but it avoids writing remote state when exact-head
  safety is not proven.
- No docs, design corpus files, or sibling wave outputs were edited.
