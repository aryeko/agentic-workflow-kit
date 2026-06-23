import { describe, expect, it } from 'vitest';

import { evaluateCapabilityGate } from '../../../../src/core/capability/evaluator/index.js';

import { allowAutoMergeFixture } from './fixtures/allow-auto-merge.fixture.js';
import { expiredAttestationFixture } from './fixtures/expired-attestation.fixture.js';

describe('core-02-s2 guarantee evaluation refs', () => {
  it('unions guarantee refs into payload refs on allow', () => {
    const payload = evaluateCapabilityGate(
      allowAutoMergeFixture.request,
      allowAutoMergeFixture.replay,
      allowAutoMergeFixture.projections,
    );

    const guaranteeEvidenceRefs = payload.evaluatedGuarantees.flatMap((guarantee) => guarantee.evidenceRefs);
    const guaranteeAttestationIds = payload.evaluatedGuarantees.flatMap((guarantee) =>
      guarantee.attestationRefs.map((ref) => ref.eventId),
    );

    expect(new Set(payload.evidenceRefs)).toEqual(new Set(guaranteeEvidenceRefs));
    expect(new Set(payload.attestationRefs.map((ref) => ref.eventId))).toEqual(new Set(guaranteeAttestationIds));
  });

  it('records the guarantee-local failure reason on deny', () => {
    const payload = evaluateCapabilityGate(
      expiredAttestationFixture.request,
      expiredAttestationFixture.replay,
      expiredAttestationFixture.projections,
    );
    const failingGuarantee = payload.evaluatedGuarantees.find(
      (guarantee) => guarantee.failureReason === 'attestation-stale',
    );

    expect(failingGuarantee).toMatchObject({
      passed: false,
      failureReason: 'attestation-stale',
    });
  });
});
