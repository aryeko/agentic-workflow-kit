import { describe, expect, it } from 'vitest';
import type {
  AttestationRef,
  CapabilityGatePolicyDecision,
  CapabilityGateRequest,
  CapabilityGateScope,
  GuaranteeEvaluation,
  ProviderDomain,
} from '../../../../src/core/capability/evaluator/index.js';

import { allowAutoMergeFixture } from './fixtures/allow-auto-merge.fixture.js';
import { assertNever } from './shared.js';

const describeProvider = (provider: ProviderDomain): string => {
  switch (provider) {
    case 'Agent':
    case 'Execution Host':
    case 'Forge':
    case 'Work Source':
      return provider;
    default:
      return assertNever(provider);
  }
};

describe('core-02-s2 gate evaluator types', () => {
  it('constructs the request, policy, scope, guarantee, and attestation shapes', () => {
    const request: CapabilityGateRequest = allowAutoMergeFixture.request;
    const policyDecision: CapabilityGatePolicyDecision = request.policyDecision;
    const scope: CapabilityGateScope = request.scope;
    const guarantee: GuaranteeEvaluation = {
      guaranteeId: 'recorded-evidence-unambiguous-not-self-report',
      passed: true,
      attestationRefs: [],
      evidenceRefs: [...request.evidenceRefs],
    };
    const attestationRef: AttestationRef = {
      eventId: 'evt-1',
      provider: 'Forge',
      capability: 'canInspectProtection',
      evidenceRef: 'evidence:forge-pr-head',
      freshnessKey: 'forge:pr-42',
      scope: 'repo:aryeko/workflow-kit/pr:42/head#abc123',
      expiry: '2026-06-23T13:00:00.000Z',
    };

    expect(policyDecision.permits).toBe(true);
    expect(scope.providerScopes).toHaveLength(2);
    expect(guarantee.passed).toBe(true);
    expect(describeProvider(attestationRef.provider)).toBe('Forge');
  });
});
