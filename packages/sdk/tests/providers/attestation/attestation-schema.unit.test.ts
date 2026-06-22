import { describe, expect, it } from 'vitest';

import {
  capabilityAttestationSchema,
  isCapabilityAttestation,
  type CapabilityAttestation,
} from '../../../src/index.js';

const validAttestation = (): CapabilityAttestation<'canResumeOwned'> => ({
  capability: 'canResumeOwned',
  probeMethod: 'schema',
  result: 'positive',
  evidenceRef: 'artifact://provider-attestation',
  scope: 'agent-session',
  expiry: '2026-06-23T00:00:00.000Z',
  driverVersion: '2.0.0',
  platform: 'linux-x64',
  freshnessKey: 'agent:2.0.0:linux-x64',
  at: '2026-06-22T00:00:00.000Z',
  details: { mode: 'manual' },
});

describe('prov-00-s1 attestation schema', () => {
  it('parses a valid capability attestation payload', () => {
    const attestation = validAttestation();

    expect(capabilityAttestationSchema.parse(attestation)).toEqual(attestation);
    expect(isCapabilityAttestation(attestation)).toBe(true);
  });

  it('parses a valid payload without optional details', () => {
    const { details: _details, ...attestation } = validAttestation();

    expect(capabilityAttestationSchema.parse(attestation)).toEqual(attestation);
    expect(isCapabilityAttestation(attestation)).toBe(true);
  });

  it('rejects payloads missing result, expiry, or freshnessKey', () => {
    const missingResult = { ...validAttestation() } as Omit<CapabilityAttestation<'canResumeOwned'>, 'result'>;
    const missingExpiry = { ...validAttestation() } as Omit<CapabilityAttestation<'canResumeOwned'>, 'expiry'>;
    const missingFreshnessKey = {
      ...validAttestation(),
    } as Omit<CapabilityAttestation<'canResumeOwned'>, 'freshnessKey'>;

    delete (missingResult as Record<string, unknown>).result;
    delete (missingExpiry as Record<string, unknown>).expiry;
    delete (missingFreshnessKey as Record<string, unknown>).freshnessKey;

    expect(() => capabilityAttestationSchema.parse(missingResult)).toThrow(
      'Capability attestation field "result" must be a non-empty string.',
    );
    expect(() => capabilityAttestationSchema.parse(missingExpiry)).toThrow(
      'Capability attestation field "expiry" must be a non-empty string.',
    );
    expect(() => capabilityAttestationSchema.parse(missingFreshnessKey)).toThrow(
      'Capability attestation field "freshnessKey" must be a non-empty string.',
    );

    expect(isCapabilityAttestation(missingResult)).toBe(false);
    expect(isCapabilityAttestation(missingExpiry)).toBe(false);
    expect(isCapabilityAttestation(missingFreshnessKey)).toBe(false);
  });

  it('rejects non-object payloads and invalid result values', () => {
    expect(() => capabilityAttestationSchema.parse('not-an-attestation')).toThrow(
      'Capability attestation must be a plain object.',
    );
    expect(
      capabilityAttestationSchema.safeParse({
        ...validAttestation(),
        result: 'stale',
      }),
    ).toMatchObject({ success: false });
  });

  it('rejects non-record details payloads', () => {
    const invalidDetails = {
      ...validAttestation(),
      details: ['wrong-shape'],
    };

    expect(() => capabilityAttestationSchema.parse(invalidDetails)).toThrow(
      'Capability attestation details must be a record when provided.',
    );
    expect(isCapabilityAttestation(invalidDetails)).toBe(false);
  });
});
