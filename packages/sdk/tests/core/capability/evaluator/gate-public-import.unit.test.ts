import type {
  AttestationRef,
  CapabilityGateFailureReason,
  CapabilityGatePolicyDecision,
  CapabilityGateRecordPayload,
  CapabilityGateRequest,
  CapabilityGateScope,
  GateDecision,
  GuaranteeEvaluation,
  ProviderDomain,
} from 'sdk';
import { evaluateCapabilityGate } from 'sdk';
import { describe, expect, it } from 'vitest';

import { allowAutoMergeFixture } from './fixtures/allow-auto-merge.fixture.js';

describe('core-02-s2 public sdk exports', () => {
  it('imports the gate evaluator surface from the sdk entrypoint', () => {
    const request: CapabilityGateRequest = allowAutoMergeFixture.request;
    const scope: CapabilityGateScope = request.scope;
    const policyDecision: CapabilityGatePolicyDecision = request.policyDecision;
    const decision: GateDecision = 'allow';
    const provider: ProviderDomain = 'Forge';
    const failureReason: CapabilityGateFailureReason = 'attestation-absent';
    const guarantee: GuaranteeEvaluation = {
      guaranteeId: 'assisted-mode-required',
      passed: true,
      attestationRefs: [],
      evidenceRefs: [],
    };
    const attestationRef: AttestationRef = {
      eventId: 'evt-1',
      provider,
      capability: 'canInspectProtection',
      evidenceRef: 'evidence:forge-pr-head',
      freshnessKey: 'forge:pr-42',
      scope: 'repo:aryeko/workflow-kit/pr:42/head#abc123',
      expiry: '2026-06-23T13:00:00.000Z',
    };
    const payload: CapabilityGateRecordPayload = evaluateCapabilityGate(
      allowAutoMergeFixture.request,
      allowAutoMergeFixture.replay,
      allowAutoMergeFixture.projections,
    );

    expect(request.policyRef).toBe(policyDecision.policyRef);
    expect(scope.providerScopes[0]?.provider).toBe(provider);
    expect(decision).toBe('allow');
    expect(failureReason).toBe('attestation-absent');
    expect(guarantee.passed).toBe(true);
    expect(attestationRef.provider).toBe('Forge');
    expect(payload.decision).toBe('allow');
  });
});
