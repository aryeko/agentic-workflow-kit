import type {
  CapabilityAttestation,
  CredentialScope,
  EvidenceRequest,
  ExpectedHeadActionRequest,
  ForgeActionResult,
  ForgeBranchProtectionRule,
  ForgeBranchRef,
  ForgeCapability,
  ForgeCredentialPhase,
  ForgeDegraded,
  ForgeEvidenceSnapshot,
  ForgeFailureToken,
  ForgeMergeQueueEntry,
  ForgeMergeQueueFacts,
  ForgePrStateFacts,
  ForgeProtectionFacts,
  ForgeRepoRef,
  ForgeReviewThread,
  ForgeReviewThreadComment,
  ForgeReviewThreadFacts,
  ForgeRuleset,
  ForgeScope,
  ForgeStatusCheckContext,
  ForgeStatusCheckFacts,
  ForgeObservedFacts,
  PullRequestCommentRequest,
  PullRequestRef,
  PullRequestUpsertRequest,
  PushBranchRequest,
} from '../../../src/index.js';

export const credentialScopeFixture = {
  runId: 'run-123',
  taskId: 'task-123',
  operationId: 'operation-123',
  party: 'runner',
  phase: 'merge',
  commandPrefix: 'gh pr merge',
  processId: 'process-123',
  expiresAt: '2026-06-22T12:30:00.000Z',
  grantEventId: 'evt-credential-grant',
} satisfies CredentialScope;

export const forgeRepoFixture = {
  provider: 'github',
  host: 'github.com',
  owner: 'aryeko',
  repo: 'agentic-workflow-kit',
  defaultBaseRef: 'v-next',
  credentialRefId: 'credref-forge',
} satisfies ForgeRepoRef;

export const forgeBranchFixture = {
  branchName: 'codex/epic2-provider-contracts',
  localHeadSha: '1111111111111111111111111111111111111111',
  remoteHeadSha: '1111111111111111111111111111111111111111',
  pushResult: 'pushed',
} satisfies ForgeBranchRef;

export const pullRequestRefFixture = {
  providerPullRequestId: 'PR_kwDOExample',
  number: 124,
  url: 'https://github.com/aryeko/agentic-workflow-kit/pull/124',
  baseRef: 'v-next',
  headRef: 'codex/epic2-provider-contracts',
  author: 'codex',
  headSha: '1111111111111111111111111111111111111111',
} satisfies PullRequestRef;

export const forgeScopeFixture = {
  driverId: 'provider-github',
  driverVersion: '1.0.0',
  provider: 'github',
  host: 'github.com',
  freshnessKey: 'provider-github:1.0.0:github.com',
  capabilities: ['supportsRulesets', 'supportsMergeQueue', 'supportsThreadResolution', 'canInspectProtection'],
  at: '2026-06-22T12:00:00.000Z',
} satisfies ForgeScope;

export const evidenceRequestFixture = {
  repo: forgeRepoFixture,
  pullRequest: pullRequestRefFixture,
  expectedHeadSha: pullRequestRefFixture.headSha,
  credentialScope: credentialScopeFixture,
} satisfies EvidenceRequest;

export const expectedHeadActionRequestFixture = {
  ...evidenceRequestFixture,
  method: 'merge',
  comment: 'Queued after required checks succeed.',
} satisfies ExpectedHeadActionRequest;

export const pushBranchRequestFixture = {
  repo: forgeRepoFixture,
  branch: forgeBranchFixture,
  credentialScope: credentialScopeFixture,
} satisfies PushBranchRequest;

export const pullRequestUpsertRequestFixture = {
  repo: forgeRepoFixture,
  pullRequest: pullRequestRefFixture,
  baseRef: 'v-next',
  headRef: 'codex/epic2-provider-contracts',
  title: 'feat: add forge provider port',
  body: 'Implements the Forge provider contract.',
  draft: false,
  credentialScope: credentialScopeFixture,
} satisfies PullRequestUpsertRequest;

export const pullRequestCommentRequestFixture = {
  repo: forgeRepoFixture,
  pullRequest: pullRequestRefFixture,
  commentId: 'IC_kwDOExample',
  body: 'Rebased on the expected head.',
  credentialScope: credentialScopeFixture,
} satisfies PullRequestCommentRequest;

export const statusCheckContextFixture = {
  name: 'check',
  state: 'SUCCESS',
  conclusion: 'SUCCESS',
} satisfies ForgeStatusCheckContext;

export const statusCheckFactsFixture = {
  state: 'SUCCESS',
  contexts: [statusCheckContextFixture],
} satisfies ForgeStatusCheckFacts;

export const prStateFactsFixture = {
  baseRefOid: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  headRefOid: pullRequestRefFixture.headSha,
  state: 'OPEN',
  reviewDecision: 'APPROVED',
  mergeStateStatus: 'CLEAN',
  isInMergeQueue: false,
} satisfies ForgePrStateFacts;

export const reviewThreadCommentFixture = {
  id: 'comment-1',
  author: 'reviewer',
  bodyRef: 'artifact://thread-comment-1',
} satisfies ForgeReviewThreadComment;

export const reviewThreadFixture = {
  id: 'thread-1',
  isResolved: false,
  viewerCanResolve: true,
  path: 'packages/sdk/src/providers/forge/provider.ts',
  comments: [reviewThreadCommentFixture],
} satisfies ForgeReviewThread;

export const reviewThreadFactsFixture = {
  threads: [reviewThreadFixture],
} satisfies ForgeReviewThreadFacts;

export const branchProtectionRuleFixture = {
  pattern: 'v-next',
  requiredStatusCheckContexts: ['check'],
  requiresApprovingReviews: true,
  requiresStatusChecks: true,
  requiresStrictStatusChecks: true,
  requiresCommitSignatures: false,
  allowsForcePushes: false,
  allowsDeletions: false,
  blocksCreations: false,
} satisfies ForgeBranchProtectionRule;

export const rulesetFixture = {
  id: 'ruleset-1',
  name: 'default',
  enforcement: 'active',
  requiredStatusChecks: ['check'],
  target: 'branch',
} satisfies ForgeRuleset;

export const protectionFactsFixture = {
  branchProtectionRules: [branchProtectionRuleFixture],
  rulesets: [rulesetFixture],
} satisfies ForgeProtectionFacts;

export const mergeQueueEntryFixture = {
  position: 1,
  state: 'queued',
  baseCommitOid: prStateFactsFixture.baseRefOid,
  headCommitOid: prStateFactsFixture.headRefOid,
} satisfies ForgeMergeQueueEntry;

export const mergeQueueFactsFixture = {
  mergeQueuePresent: true,
  mergeQueueEntry: mergeQueueEntryFixture,
} satisfies ForgeMergeQueueFacts;

export const observedFactsFixture = {
  prState: prStateFactsFixture,
  statusChecks: statusCheckFactsFixture,
  reviewThreads: reviewThreadFactsFixture,
  protection: protectionFactsFixture,
  mergeQueue: mergeQueueFactsFixture,
} satisfies ForgeObservedFacts;

export const evidenceSnapshotFixture = {
  repo: forgeRepoFixture,
  pullRequest: pullRequestRefFixture,
  expectedHeadSha: pullRequestRefFixture.headSha,
  prState: prStateFactsFixture,
  statusChecks: statusCheckFactsFixture,
  reviewThreads: reviewThreadFactsFixture,
  protection: protectionFactsFixture,
  mergeQueue: mergeQueueFactsFixture,
  scope: forgeScopeFixture,
  evidenceRefs: ['artifact://evidence/1'],
  redactionFingerprintIds: ['redaction-1'],
  credentialAuditEventIds: ['evt-cred-1'],
  collectedAt: '2026-06-22T12:10:00.000Z',
} satisfies ForgeEvidenceSnapshot;

export const acceptedActionResultFixture = {
  kind: 'accepted',
  observedHeadSha: pullRequestRefFixture.headSha,
  redactionFingerprintIds: ['redaction-1'],
  credentialAuditEventIds: ['evt-cred-1'],
  evidenceRef: 'artifact://evidence/accepted',
  at: '2026-06-22T12:11:00.000Z',
} satisfies Extract<ForgeActionResult, { kind: 'accepted' }>;

export const refusedActionResultFixture = {
  kind: 'refused',
  token: 'forge-auth-denied',
  observedHeadSha: pullRequestRefFixture.headSha,
  redactionFingerprintIds: ['redaction-1'],
  credentialAuditEventIds: ['evt-cred-1'],
  evidenceRef: 'artifact://evidence/refused',
  at: '2026-06-22T12:12:00.000Z',
} satisfies Extract<ForgeActionResult, { kind: 'refused' }>;

export const degradedResultFixture = {
  kind: 'degraded',
  token: 'forge-state-unknown',
  observedHeadSha: pullRequestRefFixture.headSha,
  redactionFingerprintIds: ['redaction-1'],
  credentialAuditEventIds: ['evt-cred-1'],
  evidenceRef: 'artifact://evidence/degraded',
  at: '2026-06-22T12:13:00.000Z',
  observedFacts: observedFactsFixture,
} satisfies ForgeDegraded;

export const forgeCapabilities = [
  'supportsRulesets',
  'supportsMergeQueue',
  'supportsThreadResolution',
  'canInspectProtection',
] as const satisfies readonly ForgeCapability[];

export const forgeCredentialPhases = [
  'push',
  'PR create/update',
  'evidence refresh',
  'review metadata',
  'merge',
] as const satisfies readonly ForgeCredentialPhase[];

export const forgeFailureTokens = [
  'forge-credential-unavailable',
  'forge-auth-denied',
  'forge-head-mismatch',
  'forge-state-unknown',
  'forge-protection-uninspectable',
  'forge-rulesets-unattested',
  'forge-merge-queue-unavailable',
  'forge-review-threads-uninspectable',
  'forge-admin-bypass-refused',
  'forge-ghes-capability-unknown',
  'forge-rate-limited',
  'forge-redaction-unavailable',
] as const satisfies readonly ForgeFailureToken[];

export const forgeCapabilityAttestations = forgeCapabilities.map((capability, index) => ({
  capability,
  probeMethod: 'live-smoke',
  result: index % 2 === 0 ? 'positive' : 'negative',
  evidenceRef: `artifact://attestation/${capability}`,
  scope: 'forge',
  expiry: '2026-06-23T00:00:00.000Z',
  driverVersion: '1.0.0',
  platform: 'darwin-arm64',
  freshnessKey: `forge:${capability}`,
  at: '2026-06-22T12:14:00.000Z',
})) satisfies CapabilityAttestation<ForgeCapability>[];
