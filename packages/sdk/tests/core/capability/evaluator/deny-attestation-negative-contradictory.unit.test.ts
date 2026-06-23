import { describe, expect, it } from 'vitest';

import { evaluateCapabilityGate } from '../../../../src/core/capability/evaluator/index.js';

import { contradictoryAttestationsFixture } from './fixtures/contradictory-attestations.fixture.js';
import { negativeAttestationFixture } from './fixtures/negative-attestation.fixture.js';

describe('core-02-s2 deny attestation negative and contradictory', () => {
  it('denies fresh in-scope negative attestations', () => {
    const payload = evaluateCapabilityGate(
      negativeAttestationFixture.request,
      negativeAttestationFixture.replay,
      negativeAttestationFixture.projections,
    );

    expect(payload.failureReason).toBe('attestation-negative');
  });

  it('denies contradictory fresh in-scope attestations', () => {
    const payload = evaluateCapabilityGate(
      contradictoryAttestationsFixture.request,
      contradictoryAttestationsFixture.replay,
      contradictoryAttestationsFixture.projections,
    );

    expect(payload.failureReason).toBe('attestation-contradictory');
  });
});
