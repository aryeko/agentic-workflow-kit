import { describe, expect, it } from 'vitest';

import { evaluateCapabilityGate } from '../../../../src/core/capability/evaluator/index.js';

import { expiredAttestationFixture } from './fixtures/expired-attestation.fixture.js';
import { futureAttestationFixture } from './fixtures/future-attestation.fixture.js';

describe('core-02-s2 deny attestation stale', () => {
  it('denies expired attestations', () => {
    const payload = evaluateCapabilityGate(
      expiredAttestationFixture.request,
      expiredAttestationFixture.replay,
      expiredAttestationFixture.projections,
    );

    expect(payload.failureReason).toBe('attestation-stale');
  });

  it('denies future-dated attestations', () => {
    const payload = evaluateCapabilityGate(
      futureAttestationFixture.request,
      futureAttestationFixture.replay,
      futureAttestationFixture.projections,
    );

    expect(payload.failureReason).toBe('attestation-stale');
  });
});
