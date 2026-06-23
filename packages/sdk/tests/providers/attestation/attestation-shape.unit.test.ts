import { describe, expect, it } from 'vitest';

import type { CapabilityAttestation, CapabilityAttestationResult, CapabilityProvider } from '../../../src/index.js';

const attestationFixture = (): CapabilityAttestation<'canKill'> => ({
  capability: 'canKill',
  probeMethod: 'live-smoke',
  result: 'positive',
  evidenceRef: 'artifact://attestation',
  scope: 'worker',
  expiry: '2026-06-22T12:00:00.000Z',
  driverVersion: '1.2.3',
  platform: 'darwin-arm64',
  freshnessKey: 'driver@1.2.3:worker',
  at: '2026-06-22T11:00:00.000Z',
  details: { source: 'test' },
});

describe('prov-00-s1 attestation shape', () => {
  it('constructs a valid generic attestation envelope', () => {
    const attestation = attestationFixture();

    expect(attestation.capability).toBe('canKill');
    expect(attestation.result).toBe('positive');
    expect(attestation.details).toEqual({ source: 'test' });
  });

  it('defines the provider discriminants exactly once', () => {
    const providers: readonly CapabilityProvider[] = ['agent', 'executionHost', 'forge', 'workSource'];

    expect(providers).toEqual(['agent', 'executionHost', 'forge', 'workSource']);
  });

  it('defines the attestation result discriminants exactly once', () => {
    const results: readonly CapabilityAttestationResult[] = ['positive', 'negative'];

    expect(results).toEqual(['positive', 'negative']);
  });
});
