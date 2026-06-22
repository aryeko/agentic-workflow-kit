import { describe, expect, it } from 'vitest';

import { createForgeTestkitFixtures, createMockForgeProvider, type MockForgeProviderState } from '../../src/index.js';

describe('testkit mock ForgeProvider', () => {
  it('refuses exact-head actions and degrades evidence when the observed PR head differs', () => {
    const fixtures = createForgeTestkitFixtures();
    const observedHeadSha = '2222222222222222222222222222222222222222';
    const provider = createMockForgeProvider({
      pullRequest: {
        ...fixtures.pullRequest,
        headSha: observedHeadSha,
      },
    });

    const updateResult = provider.updateBranch({
      ...fixtures.expectedHeadActionRequest,
      credentialScope: fixtures.credentialScopes.pullRequest,
    });
    const enqueueResult = provider.enqueue(fixtures.expectedHeadActionRequest);
    const mergeResult = provider.merge(fixtures.expectedHeadActionRequest);
    const evidenceResult = provider.collectEvidence(fixtures.evidenceRequest);

    for (const result of [updateResult, enqueueResult, mergeResult]) {
      expect(result).toMatchObject({
        kind: 'refused',
        token: 'forge-head-mismatch',
        observedHeadSha,
      });
      expect(result.redactionFingerprintIds).toEqual(fixtures.redactionFingerprintIds);
      expect(result.credentialAuditEventIds).toEqual(fixtures.credentialAuditEventIds);
    }
    expect(evidenceResult).toMatchObject({
      kind: 'degraded',
      token: 'forge-head-mismatch',
      observedHeadSha,
    });
  });

  it('returns scripted capability attestations with shared attestation fields', () => {
    const fixtures = createForgeTestkitFixtures();
    const provider = createMockForgeProvider({
      capabilityResults: {
        supportsMergeQueue: 'negative',
        supportsThreadResolution: 'negative',
      },
    });

    const attestations = provider.probeCapabilities(fixtures.scope);

    expect(attestations).toHaveLength(4);
    expect(attestations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capability: 'supportsRulesets',
          result: 'positive',
          driverVersion: fixtures.scope.driverVersion,
          freshnessKey: fixtures.scope.freshnessKey,
          scope: 'forge:github:github.com',
        }),
        expect.objectContaining({
          capability: 'supportsMergeQueue',
          result: 'negative',
          evidenceRef: 'artifact://testkit/forge/attestation/supportsMergeQueue',
        }),
      ]),
    );
  });

  it('collects evidence snapshots and scripted degraded evidence with audit and redaction markers', () => {
    const fixtures = createForgeTestkitFixtures();
    const provider = createMockForgeProvider();
    const snapshot = provider.collectEvidence(fixtures.evidenceRequest);

    expect(snapshot).toMatchObject({
      expectedHeadSha: fixtures.pullRequest.headSha,
      prState: { headRefOid: fixtures.pullRequest.headSha, reviewDecision: 'APPROVED' },
      statusChecks: { state: 'SUCCESS' },
      reviewThreads: { threads: [{ id: 'thread-1', isResolved: false }] },
      protection: { rulesets: [{ id: 'ruleset-1', name: 'default', requiredStatusChecks: ['check'] }] },
      mergeQueue: { mergeQueuePresent: true },
      evidenceRefs: ['artifact://testkit/forge/evidence/snapshot'],
      redactionFingerprintIds: fixtures.redactionFingerprintIds,
      credentialAuditEventIds: fixtures.credentialAuditEventIds,
    });

    const degradedProvider = createMockForgeProvider({
      degradeEvidence: 'forge-rulesets-unattested',
    });
    const degraded = degradedProvider.collectEvidence(fixtures.evidenceRequest);

    expect(degraded).toMatchObject({
      kind: 'degraded',
      token: 'forge-rulesets-unattested',
      observedHeadSha: fixtures.pullRequest.headSha,
      observedFacts: {
        prState: expect.objectContaining({ headRefOid: fixtures.pullRequest.headSha }),
      },
      redactionFingerprintIds: fixtures.redactionFingerprintIds,
      credentialAuditEventIds: fixtures.credentialAuditEventIds,
    });

    const omittedReviewThreads = createMockForgeProvider({
      observedFacts: {
        ...fixtures.observedFacts,
        reviewThreads: undefined,
      },
    });
    const omittedReviewThreadsResult = omittedReviewThreads.collectEvidence(fixtures.evidenceRequest);
    expect(omittedReviewThreadsResult).toMatchObject({
      kind: 'degraded',
      token: 'forge-review-threads-uninspectable',
    });
    expect(
      'observedFacts' in omittedReviewThreadsResult && 'reviewThreads' in omittedReviewThreadsResult.observedFacts,
    ).toBe(false);
  });

  it('runs push, PR, comment, update, enqueue, and merge as deterministic in-memory state changes', () => {
    const fixtures = createForgeTestkitFixtures();
    const updatedHeadSha = '3333333333333333333333333333333333333333';
    const provider = createMockForgeProvider({ updateBranchHeadSha: updatedHeadSha });

    expect(provider.pushBranch(fixtures.pushBranchRequest)).toMatchObject({
      kind: 'accepted',
      observedHeadSha: fixtures.branch.localHeadSha,
    });
    expect(provider.upsertPullRequest(fixtures.pullRequestUpsertRequest)).toMatchObject({
      kind: 'accepted',
      observedHeadSha: fixtures.branch.localHeadSha,
    });
    expect(provider.publishComment(fixtures.pullRequestCommentRequest)).toMatchObject({
      kind: 'accepted',
      observedHeadSha: fixtures.branch.localHeadSha,
    });

    const updateBranchRequest = {
      ...fixtures.expectedHeadActionRequest,
      credentialScope: fixtures.credentialScopes.pullRequest,
    };
    const updateResult = provider.updateBranch(updateBranchRequest);
    expect(updateResult).toMatchObject({
      kind: 'accepted',
      observedHeadSha: fixtures.pullRequest.headSha,
    });

    const nextPullRequest = { ...fixtures.pullRequest, headSha: updatedHeadSha };
    const nextActionRequest = {
      ...fixtures.expectedHeadActionRequest,
      pullRequest: nextPullRequest,
      expectedHeadSha: updatedHeadSha,
    };

    expect(provider.enqueue(nextActionRequest)).toMatchObject({
      kind: 'accepted',
      observedHeadSha: updatedHeadSha,
    });
    expect(provider.merge(nextActionRequest)).toMatchObject({
      kind: 'accepted',
      observedHeadSha: updatedHeadSha,
    });

    const state: MockForgeProviderState = provider.getState();
    expect(state.branches[fixtures.branch.branchName]).toMatchObject({
      remoteHeadSha: fixtures.branch.localHeadSha,
      pushResult: 'pushed',
    });
    expect(state.pullRequest).toMatchObject({
      headSha: updatedHeadSha,
      state: 'MERGED',
      isInMergeQueue: true,
    });
    expect(state.comments).toEqual([
      {
        commentId: fixtures.pullRequestCommentRequest.commentId,
        bodyRef: 'artifact://testkit/forge/comment/IC_kwDOExample',
      },
    ]);
  });

  it('refuses worker Forge credential scopes before accepting an action', () => {
    const fixtures = createForgeTestkitFixtures();
    const provider = createMockForgeProvider();
    const workerPushRequest = {
      ...fixtures.pushBranchRequest,
      credentialScope: {
        ...fixtures.credentialScope,
        party: 'worker',
      },
    };

    expect(provider.pushBranch(workerPushRequest)).toMatchObject({
      kind: 'refused',
      token: 'forge-credential-unavailable',
      observedHeadSha: fixtures.branch.localHeadSha,
      credentialAuditEventIds: fixtures.credentialAuditEventIds,
      redactionFingerprintIds: fixtures.redactionFingerprintIds,
    });

    expect(
      provider.pushBranch({
        ...fixtures.pushBranchRequest,
        credentialScope: fixtures.credentialScopes.merge,
      }),
    ).toMatchObject({
      kind: 'refused',
      token: 'forge-auth-denied',
    });

    expect(
      provider.merge({
        ...fixtures.expectedHeadActionRequest,
        credentialScope: fixtures.credentialScopes.push,
      }),
    ).toMatchObject({
      kind: 'refused',
      token: 'forge-auth-denied',
    });
  });
});
