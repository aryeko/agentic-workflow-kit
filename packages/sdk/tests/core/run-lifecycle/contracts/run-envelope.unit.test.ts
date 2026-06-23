import { describe, expect, it } from 'vitest';

import type { EvidenceEventRef, RunCreatedPayload, RunEventEnvelope } from '../../../../src/index.js';

import { evidenceEventRefFixture, runEventEnvelopeFixture } from './fixtures.js';

describe('core-01-s1 run envelope', () => {
  it('constructs a valid run event envelope and evidence ref', () => {
    const envelope: RunEventEnvelope<RunCreatedPayload> = runEventEnvelopeFixture;
    const ref: EvidenceEventRef = evidenceEventRefFixture;

    expect(envelope.schema).toBe('kit-vnext.run-event.v1');
    expect(envelope.payload.idempotencyKey).toBe('idem-1');
    expect(ref.payloadDigest).toBe(envelope.payloadDigest);
  });
});
