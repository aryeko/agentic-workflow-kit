import { describe, expect, it } from 'vitest';

import { evaluateCapabilityGate } from '../../../../src/core/capability/evaluator/index.js';

import { malformedAttestationEnvelopeFixture } from './fixtures/malformed-attestation-envelope.fixture.js';
import { nonReplayableAttestationEvidenceFixture } from './fixtures/non-replayable-attestation-evidence.fixture.js';
import { unresolvableEvidenceRefFixture } from './fixtures/unresolvable-evidence-ref.fixture.js';

describe('core-02-s2 deny attestation non-replayable', () => {
  it('denies unresolved attestation evidence refs', () => {
    const payload = evaluateCapabilityGate(
      unresolvableEvidenceRefFixture.request,
      unresolvableEvidenceRefFixture.replay,
      unresolvableEvidenceRefFixture.projections,
    );

    expect(payload.failureReason).toBe('attestation-non-replayable');
  });

  it('denies malformed attestation envelopes', () => {
    const payload = evaluateCapabilityGate(
      malformedAttestationEnvelopeFixture.request,
      malformedAttestationEnvelopeFixture.replay,
      malformedAttestationEnvelopeFixture.projections,
    );

    expect(payload.failureReason).toBe('attestation-non-replayable');
  });

  it('denies positive attestations backed only by schema-only evidence', () => {
    const payload = evaluateCapabilityGate(
      nonReplayableAttestationEvidenceFixture.request,
      nonReplayableAttestationEvidenceFixture.replay,
      nonReplayableAttestationEvidenceFixture.projections,
    );

    expect(payload.failureReason).toBe('attestation-non-replayable');
  });
});
