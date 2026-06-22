import { describe, expect, it } from 'vitest';

import type { CapabilityAttestation, WorkSourceCapability, WorkSourceProbeScope } from '../../../src/index.js';

describe('prov-03-s1 work source attestations', () => {
  it('specializes the shared attestation envelope for work source capabilities', () => {
    const attestation = {
      capability: 'supportsClaim',
      probeMethod: 'mock-probe',
      result: 'positive',
      evidenceRef: 'artifact://work-source/probe',
      scope: 'provider',
      expiry: '2026-06-22T13:00:00.000Z',
      driverVersion: '1.0.0',
      platform: 'darwin-arm64',
      freshnessKey: 'work-source@1.0.0',
      at: '2026-06-22T12:00:00.000Z',
    } satisfies CapabilityAttestation<WorkSourceCapability>;

    const scope: WorkSourceProbeScope = {
      driverId: 'provider-markdown',
      driverVersion: '1.0.0',
      platform: 'darwin-arm64',
      sourceKind: 'markdown',
      freshnessKey: 'work-source@1.0.0',
      capabilities: ['supportsClaim'],
      trackIds: ['track-a'],
      at: '2026-06-22T12:00:00.000Z',
    };

    expect(attestation.capability).toBe('supportsClaim');
    expect(scope.sourceKind).toBe('markdown');
  });
});
