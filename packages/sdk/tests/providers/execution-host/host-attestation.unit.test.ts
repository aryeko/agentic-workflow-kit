import { describe, expect, it } from 'vitest';

import type { CapabilityAttestation, HostAttestationDetails } from '../../../src/index.js';

import { capabilityAttestationFixture, hostAttestationDetailsFixture } from './fixtures/shared.js';

describe('prov-04-s1 host capability attestation specialization', () => {
  it('uses HostAttestationDetails as the execution-host attestation payload', () => {
    const details: HostAttestationDetails = hostAttestationDetailsFixture();
    const attestation: CapabilityAttestation<'containmentStrength'> = capabilityAttestationFixture({
      details,
    });

    expect(attestation.capability).toBe('containmentStrength');
    expect(attestation.details).toEqual(details);
  });
});
