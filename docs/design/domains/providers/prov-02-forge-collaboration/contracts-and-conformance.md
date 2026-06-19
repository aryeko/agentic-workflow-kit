---
title: "Forge / Collaboration - contracts and conformance"
status: draft
last-reviewed: 2026-06-19
---

# Contracts and conformance

This file holds the typed contract details and conformance targets for
`docs/design/domains/providers/prov-02-forge-collaboration/README.md`. It is split out because the
type catalog and driver conformance matrix are cohesive detail. It transcribes the contract that
already exists in the README (§4 design, §5 contracts, §8 failure modes, §9 testing) into a single
typed surface and defines the types the README states only in prose. It adds no operation,
capability, failure token, or requirement beyond the README.

## Contract types

```ts
type ForgeCapability =
  | "supportsRulesets"
  | "supportsMergeQueue"
  | "supportsThreadResolution"
  | "canInspectProtection";

// README §8. Owned by this domain; capability gates treat every token as absent capability.
type ForgeFailureToken =
  | "forge-credential-unavailable" | "forge-auth-denied"
  | "forge-head-mismatch" | "forge-state-unknown"
  | "forge-protection-uninspectable" | "forge-rulesets-unattested"
  | "forge-merge-queue-unavailable" | "forge-review-threads-uninspectable"
  | "forge-admin-bypass-refused" | "forge-ghes-capability-unknown"
  | "forge-rate-limited" | "forge-redaction-unavailable";

// CapabilityAttestation is the shared w2-1 shape, qualified here by ForgeCapability. Each provider
// domain (prov-01, prov-04) carries the same shape parameterised by its own capability type;
// consumers qualify by provider through core-02 AttestationRef.provider.
interface CapabilityAttestation {
  capability: ForgeCapability;
  probeMethod: string;
  result: "positive" | "negative";
  evidenceRef: string;
  scope: string;
  expiry: string;
  driverVersion: string;
  platform: string;
  freshnessKey: string;
  at: string;
  details?: Record<string, unknown>;
}

// fnd-04 CredentialScope.phase vocabulary used by Forge (README §4): the only valid Forge phases.
type ForgeCredentialPhase = "push" | "PR create/update" | "evidence refresh" | "review metadata" | "merge";

// README §4 data model: provider/host/owner/repo, default base ref, and the credential reference id.
interface ForgeRepoRef {
  provider: string; host: string; owner: string; repo: string;
  defaultBaseRef: string; credentialRefId: string;
}
// README §4 data model: branch name + local head SHA (from Workspace & Repository), remote head SHA,
// and push result.
interface ForgeBranchRef {
  branchName: string; localHeadSha: string; remoteHeadSha?: string;
  pushResult?: "pushed" | "rejected" | "not-pushed";
}
// README §4 data model: provider PR id, number/url, base/head refs, author identity, and head SHA.
interface PullRequestRef {
  providerPullRequestId: string; number: number; url: string;
  baseRef: string; headRef: string; author: string; headSha: string;
}

// README §4 scope vocabulary; bounds a capability probe and credential resolution.
interface ForgeScope {
  driverId: string; driverVersion: string; provider: string; host: string;
  freshnessKey: string; capabilities: ForgeCapability[]; at: string;
}

interface EvidenceRequest {
  repo: ForgeRepoRef; pullRequest: PullRequestRef; expectedHeadSha: string;
  credentialScope: CredentialScope;
}
interface ExpectedHeadActionRequest extends EvidenceRequest {
  method?: "merge" | "squash" | "rebase"; comment?: string;
}
// Push is remote git owned by Forge (README §4). Bound to the branch's local head SHA.
interface PushBranchRequest {
  repo: ForgeRepoRef; branch: ForgeBranchRef; credentialScope: CredentialScope;
}
// PR create/update: base/head refs + title/body (README §4; CreatePullRequestInput probe).
interface PullRequestUpsertRequest {
  repo: ForgeRepoRef; pullRequest?: PullRequestRef; baseRef: string; headRef: string;
  title: string; body?: string; draft?: boolean; credentialScope: CredentialScope;
}
// Runner-authored run status/comment exchange via create/update comment (README §4).
interface PullRequestCommentRequest {
  repo: ForgeRepoRef; pullRequest: PullRequestRef; commentId?: string; body: string;
  credentialScope: CredentialScope;
}

// README §4: ForgeActionResult is accepted, refused, or degraded, each with observed head SHA,
// redaction fingerprint ids, and credential audit event ids.
type ForgeActionResult =
  | {
      kind: "accepted"; observedHeadSha: string;
      redactionFingerprintIds: string[]; credentialAuditEventIds: string[];
      evidenceRef: string; at: string;
    }
  | {
      kind: "refused"; token: ForgeFailureToken; observedHeadSha: string;
      redactionFingerprintIds: string[]; credentialAuditEventIds: string[];
      evidenceRef: string; at: string;
    }
  | ForgeDegraded;
// README §8: every degraded mode names a token and observed provider facts; treated as absent capability.
interface ForgeDegraded {
  kind: "degraded"; token: ForgeFailureToken; observedHeadSha?: string;
  redactionFingerprintIds: string[]; credentialAuditEventIds: string[];
  evidenceRef: string; at: string;
}

// README §4 + evidence/2026-06-18 probes. Evidence is bound to an exact head SHA; absent or stale
// clusters degrade rather than return a silently-empty snapshot.
// PR-state DTO. Fields anchored to the PullRequest GraphQL probe.
interface ForgePrStateFacts {
  baseRefOid: string; headRefOid: string; state: "OPEN" | "CLOSED" | "MERGED";
  reviewDecision?: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED";
  mergeStateStatus: string; // note: GraphQL MergeStateStatus enum; not narrowed (README §2 prefer stable signals)
  isInMergeQueue: boolean;
}
// CI / status-check DTO. Anchored to the StatusCheckRollup probe (contexts + state).
interface ForgeStatusCheckFacts {
  state: "EXPECTED" | "ERROR" | "FAILURE" | "PENDING" | "SUCCESS"; // GraphQL StatusState
  contexts: ForgeStatusCheckContext[];
}
interface ForgeStatusCheckContext {
  name: string; // note: rollup context name (StatusContext.context / CheckRun.name)
  state?: string; conclusion?: string;
}
// Review / threads DTO. Anchored to the PullRequestReviewThread probe.
interface ForgeReviewThreadFacts {
  threads: ForgeReviewThread[];
}
interface ForgeReviewThread {
  id: string; isResolved: boolean; viewerCanResolve: boolean; path: string;
  comments: ForgeReviewThreadComment[];
}
interface ForgeReviewThreadComment { id: string; author: string; bodyRef: string }
// Protection / rulesets DTO. Anchored to the BranchProtectionRule and RepositoryRuleset probes;
// README §4: repository reads expose branch protection and rulesets separately.
interface ForgeProtectionFacts {
  branchProtectionRules: ForgeBranchProtectionRule[];
  rulesets: ForgeRuleset[];
}
interface ForgeBranchProtectionRule {
  pattern: string; requiredStatusCheckContexts: string[];
  requiresApprovingReviews: boolean; requiresStatusChecks: boolean;
  requiresStrictStatusChecks: boolean; requiresCommitSignatures: boolean;
  allowsForcePushes: boolean; allowsDeletions: boolean; blocksCreations: boolean;
}
interface ForgeRuleset {
  id: string; name: string; enforcement: string; target?: string; // GraphQL RuleEnforcement / RepositoryRulesetTarget
}
// Merge-queue DTO. Anchored to the MergeQueueEntry probe.
interface ForgeMergeQueueFacts {
  mergeQueuePresent: boolean; mergeQueueEntry?: ForgeMergeQueueEntry;
}
interface ForgeMergeQueueEntry {
  position: number; state: string; // GraphQL MergeQueueEntryState
  baseCommitOid?: string; headCommitOid?: string;
}

interface ForgeEvidenceSnapshot {
  repo: ForgeRepoRef; pullRequest: PullRequestRef; expectedHeadSha: string;
  prState: ForgePrStateFacts;
  statusChecks: ForgeStatusCheckFacts;
  reviewThreads: ForgeReviewThreadFacts;
  protection: ForgeProtectionFacts;
  mergeQueue: ForgeMergeQueueFacts;
  // provider scope + evidence refs (README §4).
  scope: ForgeScope;
  // fnd-02 ArtifactRef.id values; resolve via ArtifactStore.resolve(id).
  evidenceRefs: string[];
  redactionFingerprintIds: string[]; credentialAuditEventIds: string[];
  collectedAt: string;
}

interface ForgeContract {
  probeCapabilities(scope: ForgeScope): CapabilityAttestation[];
  pushBranch(req: PushBranchRequest): ForgeActionResult;
  upsertPullRequest(req: PullRequestUpsertRequest): ForgeActionResult;
  publishComment(req: PullRequestCommentRequest): ForgeActionResult;
  collectEvidence(req: EvidenceRequest): ForgeEvidenceSnapshot | ForgeDegraded;
  updateBranch(req: ExpectedHeadActionRequest): ForgeActionResult;
  enqueue(req: ExpectedHeadActionRequest): ForgeActionResult;
  merge(req: ExpectedHeadActionRequest): ForgeActionResult;
}
```

Exact-head support is not optional: a driver that cannot bind reads and actions to the PR head does
not implement Forge. Every irreversible action (`updateBranch`, `enqueue`, `merge`) re-reads the
remote PR head and refuses with `forge-head-mismatch` when it is missing, unknown, or different from
`expectedHeadSha` (README §4). `collectEvidence` returns a full `ForgeEvidenceSnapshot` only when all
clusters are present; an absent or unprovable cluster returns a `ForgeDegraded` with the cluster's
named token rather than a silently-empty snapshot (README §8).

Consumed Foundation dependencies. From fnd-04: `CredentialScope` (request scoping), `CredentialRef`
(via `ForgeRepoRef.credentialRefId`), injection/redaction results, and credential audit event ids;
the Forge phase vocabulary (`ForgeCredentialPhase`) is fnd-04's approved phase set and introduces no
new phase. Worker credential scopes are rejected before material is resolved (AD-12). From fnd-02:
`ArtifactRef.id` strings carried in `evidenceRefs` and `*.evidenceRef`, resolved via
`ArtifactStore.resolve(id)`; provider responses are redacted before persistence and reference fnd-04
audit events through `redactionFingerprintIds` and `credentialAuditEventIds`. `CapabilityAttestation`
is the shared w2-1 shape, qualified by `ForgeCapability`.

Produced for the Control plane. The contract methods plus event-ready action/evidence payloads
(README §6): `ForgeBranchPushed`, `ForgePullRequestUpserted`, `ForgeCommentPublished`,
`ForgeEvidenceCollected`, `ForgeBranchUpdated`, `ForgeMergeQueued`, `ForgePullRequestMerged`, and
`ForgeActionRefused`. The caller appends them to the run event log.

The fnd-04 public types used here are `CredentialScope`, `CredentialRef`, `RedactionSet`, and the
`CredentialAuditEvent` family, defined in
`../../foundation/fnd-04-credentials-and-secrets/contracts-and-events.md`. The fnd-02 `ArtifactRef`
type is defined in `../../foundation/fnd-02-storage-and-artifacts/README.md`.

## Capability set

| Capability | Positive evidence | Negative / absent evidence |
|---|---|---|
| `canInspectProtection` | Branch protection state is freshly read for the PR head and scope (`ForgeProtectionFacts.branchProtectionRules`). | Protection state cannot be freshly proven: `forge-protection-uninspectable`. |
| `supportsRulesets` | Repository rulesets are freshly attested for the scope (`ForgeProtectionFacts.rulesets`). | Ruleset state stale or absent: `forge-rulesets-unattested`. |
| `supportsMergeQueue` | Merge queue membership and entry are observable (`ForgeMergeQueueFacts`); `enqueue` is honoured. | Queue unsupported or hidden: `forge-merge-queue-unavailable`; `enqueue` refused. |
| `supportsThreadResolution` | Review threads are inspectable and resolution is performable (`viewerCanResolve`); resolution is a capability, not default behavior. | Thread state cannot be proven: `forge-review-threads-uninspectable`. Default contract still reads thread state and comments. |

Capability gates treat every degraded mode as absent capability; unknown external state fails closed
(README §8). Attestations carry the shared `CapabilityAttestation` shape and are qualified by
provider through core-02 `AttestationRef.provider`. A negative or stale attestation is treated as the
capability absent (e.g. no `enqueue` is attempted).

## Conformance targets

GitHub driver conformance:

- Reads PR state bound to an exact head SHA: base/head OIDs, state, review decision, merge state
  status, and merge-queue membership, anchored to the `PullRequest`, `StatusCheckRollup`,
  `PullRequestReviewThread`, `BranchProtectionRule`, `RepositoryRuleset`, and `MergeQueueEntry`
  GraphQL probes in `evidence/2026-06-18/`.
- Reads branch protection and rulesets separately and attests `canInspectProtection` /
  `supportsRulesets` only when the state is freshly proven for the scope, platform, driver version,
  and freshness key.
- Performs `pushBranch`, `upsertPullRequest`, `publishComment`, `updateBranch`, `enqueue`, and
  `merge`; passes `expectedHeadOid` (mapped from `expectedHeadSha`) on every irreversible action and
  re-reads the head before acting, refusing with `forge-head-mismatch` on any difference.
- Refuses with `forge-admin-bypass-refused` when success would require admin override, bypass,
  force-push, or ignoring rules; admin/bypass paths are unreachable.
- Resolves credentials only for the mapped Forge phase, rejects worker scopes before material is
  resolved, redacts provider text before persistence, and references fnd-04 audit events.
- Degrades rather than guesses when a cluster is unprovable, emitting the cluster's named token;
  reports `forge-ghes-capability-unknown` when provider/version is off the attested matrix and
  `forge-rate-limited` when fresh evidence is blocked. Write-side smoke needs a disposable writable
  remote (README §10 open implementation probe).

Mock Forge driver conformance:

- Implements the same types, exact-head checks, capability attestations, degraded states, and event
  payloads as GitHub, with scripted deterministic scenarios and zero real network or processes.
- Reproduces the dated `evidence/2026-06-18/mock-forge-conformance.json` structure: four
  capabilities, seven operations, and adversarial cases covering adversarial head SHA, CI, review,
  thread, ruleset, queue, credential, and auth signals.
- Can omit, delay, or lie about head SHA, CI/check, review, thread, ruleset, queue, credential, and
  auth signals so the Control plane and Capability & Safety gates prove fail-closed behavior; the
  exact-head mismatch case refuses all write actions, and missing protection / rulesets / queue /
  thread capability degrades with the named token rather than returning an empty result.
