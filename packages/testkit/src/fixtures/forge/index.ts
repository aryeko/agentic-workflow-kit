import type {
  CredentialScope,
  EvidenceRequest,
  ExpectedHeadActionRequest,
  ForgeBranchProtectionRule,
  ForgeBranchRef,
  ForgeMergeQueueEntry,
  ForgeObservedFacts,
  ForgePrStateFacts,
  ForgeProtectionFacts,
  ForgeRepoRef,
  ForgeReviewThread,
  ForgeReviewThreadFacts,
  ForgeRuleset,
  ForgeScope,
  ForgeStatusCheckFacts,
  PullRequestCommentRequest,
  PullRequestRef,
  PullRequestUpsertRequest,
  PushBranchRequest,
} from 'sdk';

export interface ForgeTestkitFixtures {
  readonly credentialScope: CredentialScope;
  readonly credentialScopes: {
    readonly push: CredentialScope;
    readonly pullRequest: CredentialScope;
    readonly evidence: CredentialScope;
    readonly reviewMetadata: CredentialScope;
    readonly merge: CredentialScope;
  };
  readonly repo: ForgeRepoRef;
  readonly branch: ForgeBranchRef;
  readonly pullRequest: PullRequestRef;
  readonly scope: ForgeScope;
  readonly evidenceRequest: EvidenceRequest;
  readonly expectedHeadActionRequest: ExpectedHeadActionRequest;
  readonly pushBranchRequest: PushBranchRequest;
  readonly pullRequestUpsertRequest: PullRequestUpsertRequest;
  readonly pullRequestCommentRequest: PullRequestCommentRequest;
  readonly observedFacts: ForgeObservedFacts;
  readonly redactionFingerprintIds: readonly string[];
  readonly credentialAuditEventIds: readonly string[];
}

export interface ForgeTestkitFixtureOverrides {
  readonly headSha?: string;
  readonly repo?: Partial<ForgeRepoRef>;
  readonly branch?: Partial<ForgeBranchRef>;
  readonly pullRequest?: Partial<PullRequestRef>;
  readonly scope?: Partial<ForgeScope>;
}

const defaultHeadSha = '1111111111111111111111111111111111111111';
const defaultBaseSha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const defaultAt = '2026-06-22T12:00:00.000Z';

const credentialScope = (phase: string): CredentialScope => ({
  runId: 'run-testkit-forge',
  taskId: 'task-testkit-forge',
  operationId: `operation-${phase.replaceAll(' ', '-').replaceAll('/', '-').toLowerCase()}`,
  party: 'runner',
  phase,
  commandPrefix: 'forge-testkit',
  processId: 'process-testkit-forge',
  expiresAt: '2026-06-22T13:00:00.000Z',
  grantEventId: `evt-credential-${phase.replaceAll(' ', '-').replaceAll('/', '-').toLowerCase()}`,
});

export const createForgeTestkitFixtures = (overrides: ForgeTestkitFixtureOverrides = {}): ForgeTestkitFixtures => {
  const headSha = overrides.headSha ?? overrides.pullRequest?.headSha ?? defaultHeadSha;
  const credentialScopes = {
    push: credentialScope('push'),
    pullRequest: credentialScope('PR create/update'),
    evidence: credentialScope('evidence refresh'),
    reviewMetadata: credentialScope('review metadata'),
    merge: credentialScope('merge'),
  } as const;
  const repo = {
    provider: 'github',
    host: 'github.com',
    owner: 'aryeko',
    repo: 'agentic-workflow-kit',
    defaultBaseRef: 'v-next',
    credentialRefId: 'credref-forge-testkit',
    ...overrides.repo,
  } satisfies ForgeRepoRef;
  const branch = {
    branchName: 'codex/epic2-provider-contracts',
    localHeadSha: headSha,
    remoteHeadSha: headSha,
    pushResult: 'pushed',
    ...overrides.branch,
  } satisfies ForgeBranchRef;
  const pullRequest = {
    providerPullRequestId: 'PR_kwDOTestkitForge',
    number: 124,
    url: 'https://github.com/aryeko/agentic-workflow-kit/pull/124',
    baseRef: repo.defaultBaseRef,
    headRef: branch.branchName,
    author: 'codex',
    headSha,
    ...overrides.pullRequest,
  } satisfies PullRequestRef;
  const scope = {
    driverId: 'testkit-forge',
    driverVersion: '0.0.0',
    provider: repo.provider,
    host: repo.host,
    freshnessKey: 'testkit-forge:0.0.0:github.com',
    capabilities: ['supportsRulesets', 'supportsMergeQueue', 'supportsThreadResolution', 'canInspectProtection'],
    at: defaultAt,
    ...overrides.scope,
  } satisfies ForgeScope;
  const statusChecks = {
    state: 'SUCCESS',
    contexts: [
      {
        name: 'check',
        state: 'SUCCESS',
        conclusion: 'SUCCESS',
      },
    ],
  } satisfies ForgeStatusCheckFacts;
  const prState = {
    baseRefOid: defaultBaseSha,
    headRefOid: pullRequest.headSha,
    state: 'OPEN',
    reviewDecision: 'APPROVED',
    mergeStateStatus: 'CLEAN',
    isInMergeQueue: false,
  } satisfies ForgePrStateFacts;
  const reviewThread = {
    id: 'thread-1',
    isResolved: false,
    viewerCanResolve: true,
    path: 'packages/testkit/src/forge/mock-forge-provider.ts',
    comments: [
      {
        id: 'comment-1',
        author: 'reviewer',
        bodyRef: 'artifact://testkit/forge/thread-comment/comment-1',
      },
    ],
  } satisfies ForgeReviewThread;
  const reviewThreads = {
    threads: [reviewThread],
  } satisfies ForgeReviewThreadFacts;
  const branchProtectionRule = {
    pattern: repo.defaultBaseRef,
    requiredStatusCheckContexts: ['check'],
    requiresApprovingReviews: true,
    requiresStatusChecks: true,
    requiresStrictStatusChecks: true,
    requiresCommitSignatures: false,
    allowsForcePushes: false,
    allowsDeletions: false,
    blocksCreations: false,
  } satisfies ForgeBranchProtectionRule;
  const ruleset = {
    id: 'ruleset-1',
    name: 'default',
    enforcement: 'active',
    requiredStatusChecks: ['check'],
    target: 'branch',
  } satisfies ForgeRuleset;
  const protection = {
    branchProtectionRules: [branchProtectionRule],
    rulesets: [ruleset],
  } satisfies ForgeProtectionFacts;
  const mergeQueueEntry = {
    position: 1,
    state: 'queued',
    baseCommitOid: defaultBaseSha,
    headCommitOid: pullRequest.headSha,
  } satisfies ForgeMergeQueueEntry;
  const observedFacts = {
    prState,
    statusChecks,
    reviewThreads,
    protection,
    mergeQueue: {
      mergeQueuePresent: true,
      mergeQueueEntry,
    },
  } satisfies ForgeObservedFacts;
  const evidenceRequest = {
    repo,
    pullRequest,
    expectedHeadSha: pullRequest.headSha,
    credentialScope: credentialScopes.evidence,
  } satisfies EvidenceRequest;
  const expectedHeadActionRequest = {
    ...evidenceRequest,
    credentialScope: credentialScopes.merge,
    method: 'merge',
    comment: 'Merge after required evidence is present.',
  } satisfies ExpectedHeadActionRequest;

  return {
    credentialScope: credentialScopes.push,
    credentialScopes,
    repo,
    branch,
    pullRequest,
    scope,
    evidenceRequest,
    expectedHeadActionRequest,
    pushBranchRequest: {
      repo,
      branch,
      credentialScope: credentialScopes.push,
    },
    pullRequestUpsertRequest: {
      repo,
      pullRequest,
      baseRef: repo.defaultBaseRef,
      headRef: branch.branchName,
      title: 'feat: add forge provider testkit',
      body: 'Adds a deterministic ForgeProvider mock for tests.',
      draft: false,
      credentialScope: credentialScopes.pullRequest,
    },
    pullRequestCommentRequest: {
      repo,
      pullRequest,
      commentId: 'IC_kwDOExample',
      body: 'Forge testkit status update.',
      credentialScope: credentialScopes.pullRequest,
    },
    observedFacts,
    redactionFingerprintIds: ['redaction:testkit-forge'],
    credentialAuditEventIds: ['evt-credential-testkit-forge'],
  };
};
