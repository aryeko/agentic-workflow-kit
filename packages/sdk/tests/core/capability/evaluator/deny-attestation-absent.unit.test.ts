import { describe, expect, it } from 'vitest';

import { evaluateCapabilityGate } from '../../../../src/core/capability/evaluator/index.js';

import { noAttestationFixture } from './fixtures/no-attestation.fixture.js';
import { wrongProviderAttestationFixture } from './fixtures/wrong-provider-attestation.fixture.js';

describe('core-02-s2 deny attestation absent', () => {
  it('denies when no committed matching attestation exists', () => {
    const payload = evaluateCapabilityGate(
      noAttestationFixture.request,
      noAttestationFixture.replay,
      noAttestationFixture.projections,
    );

    expect(payload.decision).toBe('deny');
    expect(payload.failureReason).toBe('attestation-absent');
  });

  it('denies when only the wrong provider claims the required capability', () => {
    const payload = evaluateCapabilityGate(
      wrongProviderAttestationFixture.request,
      wrongProviderAttestationFixture.replay,
      wrongProviderAttestationFixture.projections,
    );

    expect(payload.decision).toBe('deny');
    expect(payload.failureReason).toBe('attestation-absent');
  });
});
