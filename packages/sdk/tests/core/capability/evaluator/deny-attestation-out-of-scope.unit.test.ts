import { describe, expect, it } from 'vitest';

import { evaluateCapabilityGate } from '../../../../src/core/capability/evaluator/index.js';

import { wrongScopeAttestationFixture } from './fixtures/wrong-scope-attestation.fixture.js';

describe('core-02-s2 deny attestation out of scope', () => {
  it('denies attestations whose scope and freshness key do not match the gate scope', () => {
    const payload = evaluateCapabilityGate(
      wrongScopeAttestationFixture.request,
      wrongScopeAttestationFixture.replay,
      wrongScopeAttestationFixture.projections,
    );

    expect(payload.failureReason).toBe('attestation-out-of-scope');
  });
});
