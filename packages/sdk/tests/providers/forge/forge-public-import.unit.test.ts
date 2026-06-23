import { describe, expect, it } from 'vitest';

import {
  type CapabilityAttestation,
  type EvidenceRequest,
  type ExpectedHeadActionRequest,
  type ForgeActionResult,
  type ForgeBranchProtectionRule,
  type ForgeBranchRef,
  type ForgeCapability,
  type ForgeCredentialPhase,
  type ForgeDegraded,
  type ForgeEvidenceSnapshot,
  type ForgeFailureToken,
  type ForgeMergeQueueEntry,
  type ForgeMergeQueueFacts,
  type ForgeObservedFacts,
  type ForgePrStateFacts,
  type ForgeProtectionFacts,
  type ForgeProvider,
  type ForgeRepoRef,
  type ForgeReviewThread,
  type ForgeReviewThreadComment,
  type ForgeReviewThreadFacts,
  type ForgeRuleset,
  type ForgeScope,
  type ForgeStatusCheckContext,
  type ForgeStatusCheckFacts,
  type PullRequestCommentRequest,
  type PullRequestRef,
  type PullRequestUpsertRequest,
  type PushBranchRequest,
} from 'sdk';

import {
  acceptedActionResultFixture,
  evidenceRequestFixture,
  evidenceSnapshotFixture,
  expectedHeadActionRequestFixture,
  forgeCapabilityAttestations,
  forgeRepoFixture,
} from './fixtures.js';

describe('prov-02-s1 public sdk forge imports', () => {
  it('exports the forge provider public surface from the sdk entrypoint', () => {
    const repo: ForgeRepoRef = forgeRepoFixture;
    const evidenceRequest: EvidenceRequest = evidenceRequestFixture;
    const actionRequest: ExpectedHeadActionRequest = expectedHeadActionRequestFixture;
    const snapshot: ForgeEvidenceSnapshot = evidenceSnapshotFixture;
    const provider: ForgeProvider = {
      probeCapabilities: () => forgeCapabilityAttestations,
      pushBranch: () => acceptedActionResultFixture,
      upsertPullRequest: () => acceptedActionResultFixture,
      publishComment: () => acceptedActionResultFixture,
      collectEvidence: () => snapshot,
      updateBranch: () => acceptedActionResultFixture,
      enqueue: () => acceptedActionResultFixture,
      merge: () => acceptedActionResultFixture,
    };

    const attestations: CapabilityAttestation<ForgeCapability>[] = provider.probeCapabilities({
      driverId: 'provider-github',
      driverVersion: '1.0.0',
      provider: 'github',
      host: 'github.com',
      freshnessKey: 'forge:github',
      capabilities: ['supportsRulesets', 'supportsMergeQueue', 'supportsThreadResolution', 'canInspectProtection'],
      at: '2026-06-22T12:00:00.000Z',
    });

    const _refs: [ForgeRepoRef, ForgeBranchRef, PullRequestRef, ForgeScope] = [
      repo,
      {
        branchName: 'branch',
        localHeadSha: '1111111111111111111111111111111111111111',
      },
      {
        providerPullRequestId: 'PR_1',
        number: 1,
        url: 'https://example.com/pr/1',
        baseRef: 'v-next',
        headRef: 'branch',
        author: 'codex',
        headSha: '1111111111111111111111111111111111111111',
      },
      {
        driverId: 'provider-github',
        driverVersion: '1.0.0',
        provider: 'github',
        host: 'github.com',
        freshnessKey: 'forge:github',
        capabilities: ['supportsRulesets', 'supportsMergeQueue', 'supportsThreadResolution', 'canInspectProtection'],
        at: '2026-06-22T12:00:00.000Z',
      },
    ];

    const _requests: [
      EvidenceRequest,
      ExpectedHeadActionRequest,
      PushBranchRequest,
      PullRequestUpsertRequest,
      PullRequestCommentRequest,
    ] = [
      evidenceRequest,
      actionRequest,
      {
        repo,
        branch: {
          branchName: 'branch',
          localHeadSha: '1111111111111111111111111111111111111111',
        },
        credentialScope: evidenceRequest.credentialScope,
      },
      {
        repo,
        baseRef: 'v-next',
        headRef: 'branch',
        title: 'title',
        credentialScope: evidenceRequest.credentialScope,
      },
      {
        repo,
        pullRequest: evidenceRequest.pullRequest,
        body: 'body',
        credentialScope: evidenceRequest.credentialScope,
      },
    ];

    const observedFacts: ForgeObservedFacts = {
      prState: snapshot.prState,
      statusChecks: snapshot.statusChecks,
      reviewThreads: snapshot.reviewThreads,
      protection: snapshot.protection,
      mergeQueue: snapshot.mergeQueue,
    };

    const _facts: [
      ForgeObservedFacts,
      ForgePrStateFacts,
      ForgeStatusCheckFacts,
      ForgeStatusCheckContext,
      ForgeReviewThreadFacts,
      ForgeReviewThread,
      ForgeReviewThreadComment,
      ForgeProtectionFacts,
      ForgeBranchProtectionRule,
      ForgeRuleset,
      ForgeMergeQueueFacts,
      ForgeMergeQueueEntry,
    ] = [
      observedFacts,
      snapshot.prState,
      snapshot.statusChecks,
      snapshot.statusChecks.contexts[0]!,
      snapshot.reviewThreads,
      snapshot.reviewThreads.threads[0]!,
      snapshot.reviewThreads.threads[0]!.comments[0]!,
      snapshot.protection,
      snapshot.protection.branchProtectionRules[0]!,
      snapshot.protection.rulesets[0]!,
      snapshot.mergeQueue,
      snapshot.mergeQueue.mergeQueueEntry!,
    ];

    const _resultKinds: [ForgeActionResult, ForgeDegraded, ForgeFailureToken, ForgeCredentialPhase] = [
      provider.pushBranch({
        repo,
        branch: {
          branchName: 'branch',
          localHeadSha: '1111111111111111111111111111111111111111',
        },
        credentialScope: evidenceRequest.credentialScope,
      }),
      {
        kind: 'degraded',
        token: 'forge-state-unknown',
        redactionFingerprintIds: ['redaction-1'],
        credentialAuditEventIds: ['evt-cred-1'],
        evidenceRef: 'artifact://degraded',
        at: '2026-06-22T12:18:00.000Z',
      },
      'forge-auth-denied',
      'merge',
    ];

    expect(attestations).toHaveLength(4);
    expect(_refs[0]).toEqual(repo);
    expect(_requests[0].expectedHeadSha).toBe(actionRequest.expectedHeadSha);
    expect(_facts[1].headRefOid).toBe(snapshot.expectedHeadSha);
    expect(_resultKinds[0].kind).toBe('accepted');
  });
});
