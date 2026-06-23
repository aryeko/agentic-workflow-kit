import type { ForgeFailureToken, ForgeObservedFacts } from 'sdk';

export interface ForgeIncidentFixture {
  readonly fixtureId: string;
  readonly category: string;
  readonly expectedToken: ForgeFailureToken;
  readonly scenario: unknown;
}

const baseHeadSha = '1111111111111111111111111111111111111111';
const observedFacts = {
  prState: {
    baseRefOid: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    headRefOid: baseHeadSha,
    state: 'OPEN',
    reviewDecision: 'APPROVED',
    mergeStateStatus: 'CLEAN',
    isInMergeQueue: false,
  },
  statusChecks: { state: 'SUCCESS', contexts: [{ name: 'check', state: 'SUCCESS' }] },
  reviewThreads: {
    threads: [
      {
        id: 'thread-1',
        isResolved: false,
        viewerCanResolve: true,
        path: 'packages/testkit/src/forge/mock-forge-provider.ts',
        comments: [{ id: 'comment-1', author: 'reviewer', bodyRef: 'artifact://testkit/forge/review/comment-1' }],
      },
    ],
  },
  protection: {
    branchProtectionRules: [
      {
        pattern: 'v-next',
        requiredStatusCheckContexts: ['check'],
        requiresApprovingReviews: true,
        requiresStatusChecks: true,
        requiresStrictStatusChecks: true,
        requiresCommitSignatures: false,
        allowsForcePushes: false,
        allowsDeletions: false,
        blocksCreations: false,
      },
    ],
    rulesets: [{ id: 'ruleset-1', name: 'default', enforcement: 'active', requiredStatusChecks: ['check'] }],
  },
  mergeQueue: { mergeQueuePresent: true },
} as const satisfies ForgeObservedFacts;

const degradedFixture = (
  category: string,
  expectedToken: ForgeFailureToken,
  scenario: unknown,
): ForgeIncidentFixture => ({
  fixtureId: category,
  category,
  expectedToken,
  scenario,
});

export const forgeIncidentFixtures = {
  headShaMismatch: degradedFixture('head-sha-mismatch', 'forge-head-mismatch', {
    degradeEvidence: 'forge-head-mismatch',
  }),
  checks: degradedFixture('checks', 'forge-state-unknown', {
    observedFacts: { ...observedFacts, statusChecks: undefined },
  }),
  reviews: degradedFixture('reviews', 'forge-review-threads-uninspectable', {
    observedFacts: { ...observedFacts, reviewThreads: undefined },
  }),
  rulesets: degradedFixture('rulesets', 'forge-rulesets-unattested', {
    observedFacts: {
      ...observedFacts,
      protection: { branchProtectionRules: observedFacts.protection.branchProtectionRules, rulesets: [] },
    },
  }),
  mergeQueue: degradedFixture('merge-queue', 'forge-merge-queue-unavailable', {
    observedFacts: { ...observedFacts, mergeQueue: undefined },
  }),
  reviewThread: degradedFixture('review-thread', 'forge-review-threads-uninspectable', {
    observedFacts: { ...observedFacts, reviewThreads: undefined },
  }),
  auth: degradedFixture('auth', 'forge-auth-denied', {
    actionRefusals: { merge: 'forge-auth-denied' },
  }),
  credential: degradedFixture('credential', 'forge-credential-unavailable', {
    actionRefusals: { pushBranch: 'forge-credential-unavailable' },
  }),
  protection: degradedFixture('protection', 'forge-protection-uninspectable', {
    observedFacts: { ...observedFacts, protection: undefined },
  }),
  adminBypass: degradedFixture('admin-bypass', 'forge-admin-bypass-refused', {
    actionRefusals: { merge: 'forge-admin-bypass-refused' },
  }),
  ghes: degradedFixture('ghes', 'forge-ghes-capability-unknown', {
    degradeEvidence: 'forge-ghes-capability-unknown',
  }),
  rateLimit: degradedFixture('rate-limit', 'forge-rate-limited', {
    degradeEvidence: 'forge-rate-limited',
  }),
  redaction: degradedFixture('redaction', 'forge-redaction-unavailable', {
    actionRefusals: { publishComment: 'forge-redaction-unavailable' },
  }),
} as const satisfies Record<string, ForgeIncidentFixture>;
