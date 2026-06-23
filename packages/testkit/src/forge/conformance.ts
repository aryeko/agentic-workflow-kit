import type { ForgeActionResult, ForgeFailureToken, ForgeProvider } from 'sdk';

import { conformanceResult, failCheck, passCheck, type ConformanceResult } from '../conformance/index.js';
import { createForgeTestkitFixtures } from '../fixtures/forge/index.js';
import { createMockForgeProvider } from './mock-forge-provider.js';

export type ForgeConformanceResult = ConformanceResult<ForgeFailureToken>;

export interface ForgeConformanceSubject {
  readonly provider: ForgeProvider;
  readonly driftedProvider?: ForgeProvider;
}

const isAccepted = (result: ForgeActionResult): boolean => result.kind === 'accepted';

const actionToken = (result: ForgeActionResult): ForgeFailureToken | undefined =>
  result.kind === 'accepted' ? undefined : result.token;

const collectWriteResults = (provider: ForgeProvider): readonly ForgeActionResult[] => {
  const fixtures = createForgeTestkitFixtures();
  const request = {
    ...fixtures.expectedHeadActionRequest,
    credentialScope: fixtures.credentialScopes.merge,
  };
  return [
    provider.updateBranch({ ...request, credentialScope: fixtures.credentialScopes.pullRequest }),
    provider.enqueue(request),
    provider.merge(request),
  ];
};

export const forgeConformanceSuite = (subject: ForgeConformanceSubject): ForgeConformanceResult => {
  const fixtures = createForgeTestkitFixtures();
  const evidence = subject.provider.collectEvidence(fixtures.evidenceRequest);
  const readCheck =
    'kind' in evidence
      ? passCheck<ForgeFailureToken>('forge-read-degraded')
      : evidence.expectedHeadSha === fixtures.evidenceRequest.expectedHeadSha &&
          evidence.prState.headRefOid === fixtures.evidenceRequest.expectedHeadSha &&
          evidence.statusChecks.contexts.length > 0 &&
          evidence.reviewThreads.threads.length > 0 &&
          evidence.protection.rulesets.length > 0 &&
          evidence.mergeQueue.mergeQueuePresent
        ? passCheck<ForgeFailureToken>('forge-read-snapshot')
        : failCheck<ForgeFailureToken>(
            'forge-read-snapshot',
            'forge-state-unknown',
            'Evidence snapshot was not authoritative.',
          );
  const driftedProvider =
    subject.driftedProvider ??
    createMockForgeProvider({
      pullRequest: {
        ...fixtures.pullRequest,
        headSha: '2222222222222222222222222222222222222222',
      },
    });
  const writeResults = collectWriteResults(driftedProvider);
  const writeCheck = writeResults.every(
    (result) => !isAccepted(result) && actionToken(result) === 'forge-head-mismatch',
  )
    ? passCheck<ForgeFailureToken>('forge-expected-head-writes')
    : failCheck<ForgeFailureToken>(
        'forge-expected-head-writes',
        'forge-head-mismatch',
        'A drifted expected-head write was accepted or refused with the wrong token.',
      );

  return conformanceResult<ForgeFailureToken>([readCheck, writeCheck]);
};

const fixtures = createForgeTestkitFixtures();

export const brokenForgeFixtures = {
  writesOnHeadMismatch: {
    ...createMockForgeProvider({
      pullRequest: {
        ...fixtures.pullRequest,
        headSha: '2222222222222222222222222222222222222222',
      },
    }),
    updateBranch: () => ({
      kind: 'accepted',
      observedHeadSha: '2222222222222222222222222222222222222222',
      redactionFingerprintIds: fixtures.redactionFingerprintIds,
      credentialAuditEventIds: fixtures.credentialAuditEventIds,
      evidenceRef: 'artifact://testkit/forge/broken/update-branch',
      at: fixtures.scope.at,
    }),
  } satisfies ForgeProvider,
  degradedAsAuthoritative: {
    ...createMockForgeProvider(),
    collectEvidence: (req) => ({
      ...createMockForgeProvider().collectEvidence(req),
      expectedHeadSha: 'not-the-request-head',
    }),
  } satisfies ForgeProvider,
} as const;
