import { describe, expect, it } from 'vitest';

import {
  capabilityAttestationSchema,
  isCapabilityAttestation,
  type CapabilityAttestation,
  type CapabilityAttestationResult,
  type CapabilityProvider,
} from 'sdk';

describe('prov-00-s1 public sdk attestation imports', () => {
  it('exports the attestation public surface from the sdk entrypoint', () => {
    const provider: CapabilityProvider = 'agent';
    const result: CapabilityAttestationResult = 'positive';
    const attestation: CapabilityAttestation<'canRelayApproval'> = {
      capability: 'canRelayApproval',
      probeMethod: 'live-smoke',
      result,
      evidenceRef: 'artifact://public-import',
      scope: provider,
      expiry: '2026-06-23T00:00:00.000Z',
      driverVersion: '3.0.0',
      platform: 'darwin-arm64',
      freshnessKey: 'agent:3.0.0:darwin-arm64',
      at: '2026-06-22T00:00:00.000Z',
    };

    expect(capabilityAttestationSchema.parse(attestation)).toEqual(attestation);
    expect(isCapabilityAttestation(attestation)).toBe(true);
  });
});
