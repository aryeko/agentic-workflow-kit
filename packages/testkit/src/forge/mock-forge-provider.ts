import type {
  CapabilityAttestation,
  CapabilityAttestationResult,
  EvidenceRequest,
  ExpectedHeadActionRequest,
  ForgeActionResult,
  ForgeBranchRef,
  ForgeCapability,
  ForgeDegraded,
  ForgeEvidenceSnapshot,
  ForgeFailureToken,
  ForgeObservedFacts,
  ForgeProvider,
  ForgeScope,
  PullRequestCommentRequest,
  PullRequestRef,
  PullRequestUpsertRequest,
  PushBranchRequest,
} from 'sdk';

import { createForgeTestkitFixtures } from '../fixtures/forge/index.js';

type MockForgeAction = 'pushBranch' | 'upsertPullRequest' | 'publishComment' | 'updateBranch' | 'enqueue' | 'merge';

export interface MockForgeProviderScript {
  readonly scope?: ForgeScope;
  readonly branch?: ForgeBranchRef;
  readonly pullRequest?: PullRequestRef;
  readonly observedFacts?: ForgeObservedFacts;
  readonly capabilityResults?: Partial<Record<ForgeCapability, CapabilityAttestationResult>>;
  readonly degradeEvidence?: ForgeFailureToken;
  readonly actionRefusals?: Partial<Record<MockForgeAction, ForgeFailureToken>>;
  readonly updateBranchHeadSha?: string;
  readonly redactionFingerprintIds?: readonly string[];
  readonly credentialAuditEventIds?: readonly string[];
  readonly at?: string;
}

export interface MockForgeCommentState {
  readonly commentId?: string;
  readonly bodyRef: string;
}

export interface MockForgePullRequestState extends PullRequestRef {
  readonly state: 'OPEN' | 'CLOSED' | 'MERGED';
  readonly isInMergeQueue: boolean;
}

export interface MockForgeProviderState {
  readonly branches: Readonly<Record<string, ForgeBranchRef>>;
  readonly pullRequest: MockForgePullRequestState;
  readonly comments: readonly MockForgeCommentState[];
}

export interface MockForgeProvider extends ForgeProvider {
  getState(): MockForgeProviderState;
}

const fixtureDefaults = createForgeTestkitFixtures();
const defaultAt = '2026-06-22T12:00:00.000Z';

const completeObservedFacts = (
  facts: ForgeObservedFacts,
): Required<Pick<ForgeObservedFacts, 'prState' | 'statusChecks' | 'reviewThreads' | 'protection' | 'mergeQueue'>> => {
  const { prState, statusChecks, reviewThreads, protection, mergeQueue } = facts;
  if (
    prState === undefined ||
    statusChecks === undefined ||
    reviewThreads === undefined ||
    protection === undefined ||
    mergeQueue === undefined
  ) {
    throw new Error('Forge testkit default observed facts must include every evidence cluster.');
  }

  return { prState, statusChecks, reviewThreads, protection, mergeQueue };
};

const defaultFacts = completeObservedFacts(fixtureDefaults.observedFacts);

const cloneBranches = (branches: Readonly<Record<string, ForgeBranchRef>>): Record<string, ForgeBranchRef> =>
  Object.fromEntries(Object.entries(branches).map(([name, branch]) => [name, { ...branch }]));

const currentFacts = (facts: ForgeObservedFacts, pullRequest: MockForgePullRequestState): ForgeObservedFacts => ({
  ...(facts.prState === undefined
    ? {}
    : {
        prState: {
          ...facts.prState,
          headRefOid: pullRequest.headSha,
          state: pullRequest.state,
          isInMergeQueue: pullRequest.isInMergeQueue,
        },
      }),
  ...(facts.statusChecks === undefined ? {} : { statusChecks: facts.statusChecks }),
  ...(facts.reviewThreads === undefined ? {} : { reviewThreads: facts.reviewThreads }),
  ...(facts.protection === undefined ? {} : { protection: facts.protection }),
  ...(facts.mergeQueue === undefined
    ? {}
    : {
        mergeQueue: {
          ...facts.mergeQueue,
          mergeQueueEntry: pullRequest.isInMergeQueue
            ? {
                position: 1,
                state: 'queued',
                baseCommitOid: facts.prState?.baseRefOid ?? defaultFacts.prState.baseRefOid,
                headCommitOid: pullRequest.headSha,
              }
            : facts.mergeQueue.mergeQueueEntry,
        },
      }),
});

const missingEvidenceToken = (facts: ForgeObservedFacts): ForgeFailureToken | undefined => {
  if (facts.prState === undefined || facts.statusChecks === undefined) {
    return 'forge-state-unknown';
  }
  if (facts.reviewThreads === undefined) {
    return 'forge-review-threads-uninspectable';
  }
  if (facts.protection === undefined) {
    return 'forge-protection-uninspectable';
  }
  if (facts.protection.rulesets.length === 0) {
    return 'forge-rulesets-unattested';
  }
  if (facts.mergeQueue === undefined) {
    return 'forge-merge-queue-unavailable';
  }

  return undefined;
};

const invalidCredentialToken = (
  req: { readonly credentialScope: { readonly party: string; readonly phase: string } },
  allowedPhases: readonly string[],
): ForgeFailureToken | undefined => {
  if (req.credentialScope.party === 'worker') {
    return 'forge-credential-unavailable';
  }
  return allowedPhases.includes(req.credentialScope.phase) ? undefined : 'forge-auth-denied';
};

const accepted = (
  observedHeadSha: string,
  evidenceRef: string,
  script: MockForgeProviderScript,
): Extract<ForgeActionResult, { kind: 'accepted' }> => ({
  kind: 'accepted',
  observedHeadSha,
  redactionFingerprintIds: script.redactionFingerprintIds ?? fixtureDefaults.redactionFingerprintIds,
  credentialAuditEventIds: script.credentialAuditEventIds ?? fixtureDefaults.credentialAuditEventIds,
  evidenceRef,
  at: script.at ?? defaultAt,
});

const refused = (
  token: ForgeFailureToken,
  observedHeadSha: string,
  evidenceRef: string,
  script: MockForgeProviderScript,
): Extract<ForgeActionResult, { kind: 'refused' }> => ({
  kind: 'refused',
  token,
  observedHeadSha,
  redactionFingerprintIds: script.redactionFingerprintIds ?? fixtureDefaults.redactionFingerprintIds,
  credentialAuditEventIds: script.credentialAuditEventIds ?? fixtureDefaults.credentialAuditEventIds,
  evidenceRef,
  at: script.at ?? defaultAt,
});

const degraded = (
  token: ForgeFailureToken,
  observedHeadSha: string | undefined,
  evidenceRef: string,
  script: MockForgeProviderScript,
  observedFacts?: ForgeObservedFacts,
): ForgeDegraded => ({
  kind: 'degraded',
  token,
  observedHeadSha,
  redactionFingerprintIds: script.redactionFingerprintIds ?? fixtureDefaults.redactionFingerprintIds,
  credentialAuditEventIds: script.credentialAuditEventIds ?? fixtureDefaults.credentialAuditEventIds,
  evidenceRef,
  at: script.at ?? defaultAt,
  ...(observedFacts === undefined ? {} : { observedFacts }),
});

const commentBodyRef = (commentId: string | undefined): string =>
  `artifact://testkit/forge/comment/${commentId ?? 'new'}`;

export const createMockForgeProvider = (script: MockForgeProviderScript = {}): MockForgeProvider => {
  const initialBranch = script.branch ?? fixtureDefaults.branch;
  const initialPullRequest = script.pullRequest ?? fixtureDefaults.pullRequest;
  const scope = script.scope ?? fixtureDefaults.scope;
  const facts = script.observedFacts ?? fixtureDefaults.observedFacts;
  let state: MockForgeProviderState = {
    branches: {
      [initialBranch.branchName]: { ...initialBranch },
    },
    pullRequest: {
      ...initialPullRequest,
      state: 'OPEN',
      isInMergeQueue: false,
    },
    comments: [],
  };

  const actionResult = (
    action: MockForgeAction,
    observedHeadSha: string,
    evidenceRef: string,
    req: { readonly credentialScope: { readonly party: string; readonly phase: string } },
    allowedPhases: readonly string[],
  ): ForgeActionResult => {
    const credentialToken = invalidCredentialToken(req, allowedPhases);
    if (credentialToken !== undefined) {
      return refused(credentialToken, observedHeadSha, evidenceRef, script);
    }

    const token = script.actionRefusals?.[action];
    return token === undefined
      ? accepted(observedHeadSha, evidenceRef, script)
      : refused(token, observedHeadSha, evidenceRef, script);
  };

  const expectedHeadResult = (
    action: Extract<MockForgeAction, 'updateBranch' | 'enqueue' | 'merge'>,
    req: ExpectedHeadActionRequest,
  ): ForgeActionResult => {
    const observedHeadSha = state.pullRequest.headSha;
    const allowedPhases = action === 'updateBranch' ? ['PR create/update'] : ['merge'];
    const credentialToken = invalidCredentialToken(req, allowedPhases);
    if (credentialToken !== undefined) {
      return refused(credentialToken, observedHeadSha, `artifact://testkit/forge/${action}/refused`, script);
    }
    if (req.expectedHeadSha !== observedHeadSha) {
      return refused('forge-head-mismatch', observedHeadSha, `artifact://testkit/forge/${action}/refused`, script);
    }

    const token = script.actionRefusals?.[action];
    if (token !== undefined) {
      return refused(token, observedHeadSha, `artifact://testkit/forge/${action}/refused`, script);
    }

    if (action === 'updateBranch') {
      const updatedHeadSha = script.updateBranchHeadSha ?? observedHeadSha;
      state = {
        ...state,
        pullRequest: {
          ...state.pullRequest,
          headSha: updatedHeadSha,
        },
      };
    }
    if (action === 'enqueue') {
      state = {
        ...state,
        pullRequest: {
          ...state.pullRequest,
          isInMergeQueue: true,
        },
      };
    }
    if (action === 'merge') {
      state = {
        ...state,
        pullRequest: {
          ...state.pullRequest,
          state: 'MERGED',
        },
      };
    }

    return accepted(observedHeadSha, `artifact://testkit/forge/${action}/accepted`, script);
  };

  return {
    getState: () => ({
      branches: cloneBranches(state.branches),
      pullRequest: { ...state.pullRequest },
      comments: state.comments.map((comment) => ({ ...comment })),
    }),
    probeCapabilities: (requestedScope: ForgeScope): CapabilityAttestation<ForgeCapability>[] =>
      requestedScope.capabilities.map((capability) => ({
        capability,
        probeMethod: 'testkit-script',
        result: script.capabilityResults?.[capability] ?? 'positive',
        evidenceRef: `artifact://testkit/forge/attestation/${capability}`,
        scope: `forge:${requestedScope.provider}:${requestedScope.host}`,
        expiry: '2026-06-22T13:00:00.000Z',
        driverVersion: requestedScope.driverVersion,
        platform: 'testkit',
        freshnessKey: requestedScope.freshnessKey,
        at: script.at ?? requestedScope.at,
      })),
    pushBranch: (req: PushBranchRequest): ForgeActionResult => {
      const observedHeadSha = req.branch.localHeadSha;
      const result = actionResult('pushBranch', observedHeadSha, 'artifact://testkit/forge/push/accepted', req, [
        'push',
      ]);
      if (result.kind === 'accepted') {
        state = {
          ...state,
          branches: {
            ...state.branches,
            [req.branch.branchName]: {
              ...req.branch,
              remoteHeadSha: observedHeadSha,
              pushResult: 'pushed',
            },
          },
        };
      }
      return result;
    },
    upsertPullRequest: (req: PullRequestUpsertRequest): ForgeActionResult => {
      const branch = state.branches[req.headRef];
      const observedHeadSha = branch?.remoteHeadSha ?? req.pullRequest?.headSha ?? state.pullRequest.headSha;
      const result = actionResult(
        'upsertPullRequest',
        observedHeadSha,
        'artifact://testkit/forge/pull-request/accepted',
        req,
        ['PR create/update'],
      );
      if (result.kind === 'accepted') {
        state = {
          ...state,
          pullRequest: {
            ...(req.pullRequest ?? state.pullRequest),
            baseRef: req.baseRef,
            headRef: req.headRef,
            headSha: observedHeadSha,
            state: state.pullRequest.state,
            isInMergeQueue: state.pullRequest.isInMergeQueue,
          },
        };
      }
      return result;
    },
    publishComment: (req: PullRequestCommentRequest): ForgeActionResult => {
      const observedHeadSha = state.pullRequest.headSha;
      const result = actionResult('publishComment', observedHeadSha, 'artifact://testkit/forge/comment/accepted', req, [
        'PR create/update',
      ]);
      if (result.kind === 'accepted') {
        state = {
          ...state,
          comments: [
            ...state.comments.filter((comment) => comment.commentId !== req.commentId),
            {
              commentId: req.commentId,
              bodyRef: commentBodyRef(req.commentId),
            },
          ],
        };
      }
      return result;
    },
    collectEvidence: (req: EvidenceRequest): ForgeEvidenceSnapshot | ForgeDegraded => {
      const observedHeadSha = state.pullRequest.headSha;
      const observedFacts = currentFacts(facts, state.pullRequest);
      const credentialToken = invalidCredentialToken(req, ['evidence refresh', 'review metadata']);
      if (credentialToken !== undefined) {
        return degraded(
          credentialToken,
          observedHeadSha,
          'artifact://testkit/forge/evidence/degraded',
          script,
          observedFacts,
        );
      }
      if (req.expectedHeadSha !== observedHeadSha) {
        return degraded(
          'forge-head-mismatch',
          observedHeadSha,
          'artifact://testkit/forge/evidence/degraded',
          script,
          observedFacts,
        );
      }
      if (script.degradeEvidence !== undefined) {
        return degraded(
          script.degradeEvidence,
          observedHeadSha,
          'artifact://testkit/forge/evidence/degraded',
          script,
          observedFacts,
        );
      }
      const missingToken = missingEvidenceToken(observedFacts);
      if (missingToken !== undefined) {
        return degraded(
          missingToken,
          observedHeadSha,
          'artifact://testkit/forge/evidence/degraded',
          script,
          observedFacts,
        );
      }
      const completeFacts = completeObservedFacts(observedFacts);

      return {
        repo: req.repo,
        pullRequest: {
          ...req.pullRequest,
          headSha: observedHeadSha,
        },
        expectedHeadSha: req.expectedHeadSha,
        prState: completeFacts.prState,
        statusChecks: completeFacts.statusChecks,
        reviewThreads: completeFacts.reviewThreads,
        protection: completeFacts.protection,
        mergeQueue: completeFacts.mergeQueue,
        scope,
        evidenceRefs: ['artifact://testkit/forge/evidence/snapshot'],
        redactionFingerprintIds: script.redactionFingerprintIds ?? fixtureDefaults.redactionFingerprintIds,
        credentialAuditEventIds: script.credentialAuditEventIds ?? fixtureDefaults.credentialAuditEventIds,
        collectedAt: script.at ?? defaultAt,
      };
    },
    updateBranch: (req: ExpectedHeadActionRequest): ForgeActionResult => expectedHeadResult('updateBranch', req),
    enqueue: (req: ExpectedHeadActionRequest): ForgeActionResult => expectedHeadResult('enqueue', req),
    merge: (req: ExpectedHeadActionRequest): ForgeActionResult => expectedHeadResult('merge', req),
  };
};
